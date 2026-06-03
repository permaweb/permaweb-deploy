import fs from 'node:fs'
import path from 'node:path'

import {
  TurboAuthenticatedConfiguration as LegacyAuthenticatedConfiguration,
  TurboFactory as LegacyFactory,
} from '@ardrive/turbo-sdk'
import ora from 'ora'

import type { SignerType } from '../types/index.js'
import { cleanupCache, loadCache, saveCache } from '../utils/cache.js'
import { chalk } from '../utils/chalk.js'
import {
  type HyperbeamBundlerAutoFundOptions,
  HyperbeamBundlerClient,
  parseHyperbeamFundAmount,
  type UploadClient,
  type UploadCost,
  type UploadSize,
} from '../utils/hyperbeam-uploader.js'
import { expandPath } from '../utils/path.js'
import { createSigner } from '../utils/signer.js'
import { type FolderUploadResult, uploadFile, uploadFolder } from '../utils/uploader.js'

export interface UploadWorkflowConfig {
  'dedupe-cache-max-entries': number
  'deploy-file'?: string
  'deploy-folder': string
  'hyperbeam-ao-state-url'?: string
  'hyperbeam-auto-fund'?: boolean
  'hyperbeam-fund-amount'?: string
  'hyperbeam-ledger-id'?: string
  'hyperbeam-token-id'?: string
  'hyperbeam-upload-path'?: string
  'sig-type': string
  uploader?: string
  'uploader-type'?: string
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

export interface UploadWorkflowResult {
  cost?: UploadCost
  size?: UploadSize
  transactionId: string
}

/**
 * Sign and upload a file or folder.
 *
 * @param deployKey - Wallet material (base64 JWK or hex private key per sig-type)
 * @param config - Upload paths, dedupe, and bundler service URL.
 * @param io - Error handler (must exit the process)
 * @returns Transaction ID or folder manifest ID
 */
export async function runUploadWorkflow(
  deployKey: string,
  config: UploadWorkflowConfig,
  io: UploadWorkflowIo,
): Promise<UploadWorkflowResult> {
  const spinner = ora()

  const uploaderType = config['uploader-type'] ?? 'legacy'
  let uploadClient: UploadClient
  let legacyClient: ReturnType<typeof LegacyFactory.authenticated> | undefined

  if (uploaderType === 'hyperbeam') {
    if (config['sig-type'] !== 'arweave') {
      io.error('HyperBEAM uploads require --sig-type arweave')
    }

    if (!config.uploader) {
      io.error('HyperBEAM uploads require --uploader <node-url>')
    }

    let autoFund: HyperbeamBundlerAutoFundOptions | undefined
    if (config['hyperbeam-auto-fund']) {
      autoFund = {
        deployKey,
        uploader: config.uploader,
      }
      if (config['hyperbeam-ao-state-url']) autoFund.aoStateUrl = config['hyperbeam-ao-state-url']
      if (config['hyperbeam-ledger-id']) autoFund.ledgerId = config['hyperbeam-ledger-id']
      if (config['hyperbeam-token-id']) autoFund.tokenId = config['hyperbeam-token-id']
      if (config['hyperbeam-fund-amount']) {
        autoFund.minimumBalance = parseHyperbeamFundAmount(config['hyperbeam-fund-amount'])
      }
    }

    spinner.start('Initializing HyperBEAM bundler')
    uploadClient = new HyperbeamBundlerClient({
      autoFund,
      deployKey,
      quote: {
        ledgerId: config['hyperbeam-ledger-id'],
        tokenId: config['hyperbeam-token-id'],
        uploader: config.uploader,
      },
      uploadPath: config['hyperbeam-upload-path'] ?? '/~bundler@1.0/item?codec-device=ans104@1.0',
      uploader: config.uploader,
    })
    spinner.succeed(`HyperBEAM bundler initialized (${chalk.cyan(config.uploader)})`)
  } else {
    spinner.start('Creating signer')
    const { signer, token } = createSigner(config['sig-type'] as SignerType, deployKey)
    spinner.succeed(`Signer created (${chalk.cyan(config['sig-type'])})`)

    spinner.start('Initializing legacy bundler')

    const legacyFactoryArgs: LegacyAuthenticatedConfiguration = { signer, token }

    if (config.uploader) {
      legacyFactoryArgs.uploadServiceConfig = { url: config.uploader }
    }

    legacyClient = LegacyFactory.authenticated(legacyFactoryArgs)
    uploadClient = legacyClient as UploadClient

    spinner.succeed('Legacy bundler initialized')
  }

  if (legacyClient) {
    spinner.start('Checking legacy bundler credits for upload')

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
        const [uploadCost] = await legacyClient.getUploadCosts({ bytes: [uploadBytes] })
        const balance = await legacyClient.getBalance()

        const requiredWinc = BigInt(uploadCost.winc)
        const currentWinc = BigInt(balance.winc)

        if (requiredWinc > currentWinc) {
          spinner.fail('Insufficient legacy bundler credits')

          io.error(
            [
              'Insufficient legacy bundler credits for this upload.',
              `Required: ${requiredWinc.toString()} winc, available: ${currentWinc.toString()} winc.`,
              '',
              'Add bundler credits before retrying.',
            ].join(' '),
          )
        }
      }

      spinner.succeed('Legacy bundler credits check passed')
    } catch (balanceError) {
      spinner.fail('Failed to check legacy bundler credits')
      const errorMessage =
        balanceError instanceof Error ? balanceError.message : String(balanceError)
      io.error(`Failed to check legacy bundler credits: ${errorMessage}`)
    }
  }

  let txOrManifestId: string
  let cost: UploadCost | undefined
  let size: UploadSize | undefined
  try {
    if (config['deploy-file']) {
      const filePath = expandPath(config['deploy-file'])
      spinner.start(`Uploading file ${chalk.yellow(config['deploy-file'])}`)

      let cache = config['dedupe-cache-max-entries'] > 0 ? loadCache() : {}
      const uploadResult = await uploadFile(uploadClient, filePath, { cache })

      if (!uploadResult.transactionId) {
        spinner.fail('File upload failed: no transaction ID returned')
        io.error('File upload failed: no transaction ID returned')
      }

      txOrManifestId = uploadResult.transactionId
      cost = uploadResult.cost
      size = uploadResult.size

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
        concurrency: config['hyperbeam-auto-fund'] ? 1 : undefined,
        throwOnFailure: true,
      })

      if (!uploadResult.transactionId) {
        spinner.fail('Folder upload failed: no transaction ID returned')
        io.error('Folder upload failed: no transaction ID returned')
      }

      txOrManifestId = uploadResult.transactionId
      cost = uploadResult.cost
      size = uploadResult.size

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

  return {
    cost,
    size,
    transactionId: txOrManifestId,
  }
}
