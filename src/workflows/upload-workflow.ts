import fs from 'node:fs'
import path from 'node:path'

import {
  ARIOToTokenAmount,
  ETHToTokenAmount,
  OnDemandFunding,
  TurboAuthenticatedConfiguration,
  TurboFactory,
} from '@ardrive/turbo-sdk'
import chalk from 'chalk'
import ora from 'ora'

import type { SignerType } from '../types/index.js'
import { cleanupCache, loadCache, saveCache } from '../utils/cache.js'
import { HyperbeamBundlerClient, type UploadClient } from '../utils/hyperbeam-uploader.js'
import { expandPath } from '../utils/path.js'
import { createSigner } from '../utils/signer.js'
import { type FolderUploadResult, uploadFile, uploadFolder } from '../utils/uploader.js'

export interface UploadWorkflowConfig {
  'dedupe-cache-max-entries': number
  'deploy-file'?: string
  'deploy-folder': string
  'hyperbeam-upload-path': string
  'max-token-amount'?: string
  'on-demand'?: string
  'sig-type': string
  uploader?: string
  'uploader-type': string
}

function getFolderSize(folderPath: string): number {
  let totalSize = 0

  for (const item of fs.readdirSync(folderPath)) {
    const fullPath = path.join(folderPath, item)
    const stats = fs.statSync(fullPath)

    totalSize += stats.isDirectory() ? getFolderSize(fullPath) : stats.size
  }

  return totalSize
}

export interface UploadWorkflowIo {
  error: (msg: string) => never
}

/**
 * Sign in to Turbo and upload a file or folder.
 *
 * @param deployKey - Wallet material (base64 JWK or hex private key per sig-type)
 * @param config - Upload paths, dedupe, bundler service URL, on-demand payment
 * @param io - Error handler (must exit the process)
 * @returns Transaction ID or folder manifest ID
 */
export async function runUploadWorkflow(
  deployKey: string,
  config: UploadWorkflowConfig,
  io: UploadWorkflowIo,
): Promise<string> {
  const spinner = ora()

  const uploaderType = config['uploader-type']
  let uploadClient: UploadClient
  let turbo: ReturnType<typeof TurboFactory.authenticated> | undefined

  if (uploaderType === 'hyperbeam') {
    if (config['sig-type'] !== 'arweave') {
      io.error('HyperBEAM uploads require --sig-type arweave')
    }

    if (!config.uploader) {
      io.error('HyperBEAM uploads require --uploader <node-url>')
    }

    if (config['on-demand']) {
      io.error('HyperBEAM uploads do not support Turbo --on-demand payments')
    }

    spinner.start('Initializing HyperBEAM bundler')
    uploadClient = new HyperbeamBundlerClient({
      deployKey,
      uploadPath: config['hyperbeam-upload-path'],
      uploader: config.uploader,
    })
    spinner.succeed(`HyperBEAM bundler initialized (${chalk.cyan(config.uploader)})`)
  } else {
    spinner.start('Creating signer')
    const { signer, token } = createSigner(config['sig-type'] as SignerType, deployKey)
    spinner.succeed(`Signer created (${chalk.cyan(config['sig-type'])})`)

    spinner.start('Initializing Turbo')

    const turboFactoryArgs: TurboAuthenticatedConfiguration = { signer, token }

    if (config.uploader) {
      turboFactoryArgs.uploadServiceConfig = { url: config.uploader }
    }

    turbo = TurboFactory.authenticated(turboFactoryArgs)
    uploadClient = turbo as UploadClient

    spinner.succeed('Turbo initialized')
  }

  let fundingMode: OnDemandFunding | undefined
  if (config['on-demand'] && config['max-token-amount']) {
    const tokenType = config['on-demand']
    const maxAmount = Number.parseFloat(config['max-token-amount'])

    let maxTokenAmount: ReturnType<typeof ARIOToTokenAmount>
    switch (tokenType) {
      case 'ario': {
        maxTokenAmount = ARIOToTokenAmount(maxAmount)
        break
      }

      case 'base-eth': {
        maxTokenAmount = ETHToTokenAmount(maxAmount)
        break
      }

      default: {
        throw new Error(`Unsupported on-demand token type: ${tokenType}`)
      }
    }

    fundingMode = new OnDemandFunding({
      maxTokenAmount,
      topUpBufferMultiplier: 1.1,
    })
  }

  if (!fundingMode && turbo) {
    spinner.start('Checking Turbo credits for upload')

    try {
      const uploadBytes = config['deploy-file']
        ? (() => {
            const filePath = expandPath(config['deploy-file']!)
            return fs.statSync(filePath).size
          })()
        : (() => {
            const folderPath = expandPath(config['deploy-folder']!)
            return getFolderSize(folderPath)
          })()

      const FREE_THRESHOLD_BYTES = 107_520 // ~105 KiB

      if (uploadBytes >= FREE_THRESHOLD_BYTES) {
        const [uploadCost] = await turbo.getUploadCosts({ bytes: [uploadBytes] })
        const balance = await turbo.getBalance()

        const requiredWinc = BigInt(uploadCost.winc)
        const currentWinc = BigInt(balance.winc)

        if (requiredWinc > currentWinc) {
          spinner.fail('Insufficient Turbo credits')

          io.error(
            [
              'Insufficient Turbo credits for this upload.',
              `Required: ${requiredWinc.toString()} winc, available: ${currentWinc.toString()} winc.`,
              '',
              'Top up your Turbo balance (or re-run with --on-demand and --max-token-amount).',
            ].join(' '),
          )
        }
      }

      spinner.succeed('Turbo credits check passed')
    } catch (balanceError) {
      spinner.fail('Failed to check Turbo credits')
      const errorMessage =
        balanceError instanceof Error ? balanceError.message : String(balanceError)
      io.error(`Failed to check Turbo credits: ${errorMessage}`)
    }
  }

  let txOrManifestId: string
  try {
    if (config['deploy-file']) {
      const filePath = expandPath(config['deploy-file'])
      spinner.start(`Uploading file ${chalk.yellow(config['deploy-file'])}`)

      let cache = config['dedupe-cache-max-entries'] > 0 ? loadCache() : {}
      const uploadResult = await uploadFile(uploadClient, filePath, { cache, fundingMode })

      if (!uploadResult.transactionId) {
        spinner.fail('File upload failed: no transaction ID returned')
        io.error('File upload failed: no transaction ID returned')
      }

      txOrManifestId = uploadResult.transactionId

      if (uploadResult.updatedCache && config['dedupe-cache-max-entries'] > 0) {
        cache = cleanupCache(uploadResult.updatedCache, config['dedupe-cache-max-entries'])
        saveCache(cache)
      }

      if (uploadResult.cacheHit) {
        spinner.succeed(`File cache hit - reusing transaction ${chalk.green(txOrManifestId)}`)
      } else {
        const cacheMsg =
          config['dedupe-cache-max-entries'] > 0 ? chalk.gray('(cached for future uploads)') : ''
        spinner.succeed(`File uploaded: ${chalk.green(txOrManifestId)} ${cacheMsg}`.trim())
      }
    } else {
      const folderPath = expandPath(config['deploy-folder'])
      spinner.start(`Uploading folder ${chalk.yellow(config['deploy-folder'])}`)

      let cache = config['dedupe-cache-max-entries'] > 0 ? loadCache() : {}
      const uploadResult: FolderUploadResult = await uploadFolder(uploadClient, folderPath, {
        cache,
        fundingMode,
        throwOnFailure: true,
      })

      if (!uploadResult.transactionId) {
        spinner.fail('Folder upload failed: no transaction ID returned')
        io.error('Folder upload failed: no transaction ID returned')
      }

      txOrManifestId = uploadResult.transactionId

      if (uploadResult.updatedCache && config['dedupe-cache-max-entries'] > 0) {
        cache = cleanupCache(uploadResult.updatedCache, config['dedupe-cache-max-entries'])
        saveCache(cache)
      }

      const { cacheHits, totalFiles, uploaded } = uploadResult
      const statsMsg =
        cacheHits > 0
          ? chalk.gray(` (${cacheHits}/${totalFiles} files cached, ${uploaded} uploaded)`)
          : ''

      if (uploadResult.cacheHit) {
        spinner.succeed(`All ${totalFiles} files cached - manifest: ${chalk.green(txOrManifestId)}`)
      } else {
        const cacheMsg =
          config['dedupe-cache-max-entries'] > 0
            ? chalk.gray(' (files cached for future uploads)')
            : ''
        spinner.succeed(`Folder uploaded: ${chalk.green(txOrManifestId)}${statsMsg}${cacheMsg}`)
      }
    }
  } catch (uploadError) {
    spinner.fail('Upload failed')
    const errorMessage = uploadError instanceof Error ? uploadError.message : String(uploadError)
    io.error(`Upload failed: ${errorMessage}`)
  }

  return txOrManifestId
}
