import fs from 'node:fs'

import { Command } from '@oclif/core'

import { type UploadConfig, uploadFlagConfigs } from '../constants/flags.js'
import { getWalletConfig } from '../prompts/wallet.js'
import { chalk } from '../utils/chalk.js'
import { extractFlags, resolveConfig } from '../utils/config-resolver.js'
import {
  type DisplayRow,
  formatDisplayRows,
  formatUploadCost,
  formatUploadError,
  formatUploadSize,
} from '../utils/display.js'
import { hyperbeamBundlerLink } from '../utils/hyperbeam-uploader.js'
import { expandPath } from '../utils/path.js'
import { runUploadWorkflow } from '../workflows/upload-workflow.js'

export default class Upload extends Command {
  static override args = {}

  static override description = 'Upload a file or folder to Arweave via Turbo without updating ArNS'

  static override examples = [
    '<%= config.bin %> upload --wallet ./wallet.json',
    '<%= config.bin %> upload --wallet ./wallet.json --deploy-folder ./dist',
    '<%= config.bin %> upload --wallet ./wallet.json --deploy-file ./dist/index.html',
    '<%= config.bin %> upload --private-key "$(cat wallet.json)" --on-demand ario --max-token-amount 1.5',
    '<%= config.bin %> upload --wallet ./wallet.json --uploader https://up.arweave.net',
    '<%= config.bin %> upload --wallet ./wallet.json --uploader-type hyperbeam --uploader https://hyperbeam.example.com',
  ]

  static override flags = extractFlags(uploadFlagConfigs)

  public async run(): Promise<void> {
    try {
      const { flags } = await this.parse(Upload)

      const interactive = !flags.wallet && !flags['private-key'] && !process.env.DEPLOY_KEY?.trim()

      if (interactive) {
        this.log(chalk.bold(chalk.cyan('\nInteractive upload mode\n')))
      }

      const baseConfig = (await resolveConfig<typeof uploadFlagConfigs>(uploadFlagConfigs, flags, {
        interactive,
      })) as UploadConfig

      let walletConfig: { privateKey?: string; wallet?: string } = {
        privateKey: baseConfig['private-key'],
        wallet: baseConfig.wallet,
      }

      if (interactive && !baseConfig.wallet && !baseConfig['private-key']) {
        const config = await getWalletConfig()
        walletConfig = {
          privateKey: config.privateKey,
          wallet: config.wallet,
        }
      }

      const effectiveCacheMaxEntries = baseConfig['no-dedupe']
        ? 0
        : baseConfig['dedupe-cache-max-entries']

      const uploadCfg = {
        'dedupe-cache-max-entries': effectiveCacheMaxEntries,
        'deploy-file': baseConfig['deploy-file'],
        'deploy-folder': baseConfig['deploy-folder'],
        'hyperbeam-ao-state-url': baseConfig['hyperbeam-ao-state-url'],
        'hyperbeam-auto-fund': baseConfig['hyperbeam-auto-fund'],
        'hyperbeam-fund-amount': baseConfig['hyperbeam-fund-amount'],
        'hyperbeam-ledger-id': baseConfig['hyperbeam-ledger-id'],
        'hyperbeam-token-id': baseConfig['hyperbeam-token-id'],
        'hyperbeam-upload-path': baseConfig['hyperbeam-upload-path'],
        'max-token-amount': baseConfig['max-token-amount'],
        'on-demand': baseConfig['on-demand'],
        'sig-type': baseConfig['sig-type'],
        uploader: baseConfig.uploader,
        'uploader-type': baseConfig['uploader-type'],
      }

      if (interactive) {
        this.log('')
      }

      const { privateKey, wallet } = walletConfig
      const sigType = uploadCfg['sig-type']

      let deployKey: string
      if (wallet) {
        const walletPath = expandPath(wallet)
        if (!fs.existsSync(walletPath)) {
          this.error(`Wallet file [${wallet}] does not exist`)
        }

        const walletContent = fs.readFileSync(walletPath, 'utf8')
        deployKey =
          sigType === 'arweave'
            ? Buffer.from(walletContent).toString('base64')
            : walletContent.trim()
      } else if (privateKey) {
        deployKey =
          sigType === 'arweave' ? Buffer.from(privateKey).toString('base64') : privateKey.trim()
      } else {
        deployKey = process.env.DEPLOY_KEY || ''
        if (!deployKey) {
          this.error(
            'DEPLOY_KEY environment variable not set. Use --wallet, --private-key, or set DEPLOY_KEY',
          )
        }
      }

      this.log(chalk.bold(chalk.cyan('\nStarting upload...\n')))

      try {
        const uploadResult = await runUploadWorkflow(deployKey, uploadCfg, {
          error: (msg) => this.error(msg),
        })
        const txOrManifestId = uploadResult.transactionId

        this.log('')

        const uploadSize = uploadResult.size
        const bundlerLink =
          uploadCfg['uploader-type'] === 'hyperbeam' && uploadCfg.uploader
            ? hyperbeamBundlerLink(uploadCfg.uploader, txOrManifestId, !uploadCfg['deploy-file'])
            : undefined

        const rows: DisplayRow[] = [['Tx ID', chalk.green(txOrManifestId)]]
        if (uploadSize) {
          rows.push(['Upload size', chalk.blue(formatUploadSize(uploadSize))])
        }

        if (uploadResult.cost) {
          rows.push(['Upload cost', chalk.blue(formatUploadCost(uploadResult.cost))])
        }

        if (uploadCfg.uploader) {
          rows.push(
            ['Bundler service', chalk.cyan(uploadCfg.uploader)],
            ['Uploader type', chalk.cyan(uploadCfg['uploader-type'])],
          )
        }

        if (bundlerLink) {
          rows.push(['Bundler link', chalk.yellow(bundlerLink)])
        }

        rows.push(['Arweave URL', chalk.yellow(`https://arweave.net/${txOrManifestId}`)])

        this.log(chalk.bold(chalk.green('Upload successful!')))
        this.log(formatDisplayRows(rows))
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        const normalizedError = errorMessage.startsWith('Upload failed:')
          ? errorMessage.replace(/^Upload failed:\s*/, '')
          : errorMessage

        if (!process.env.CI && process.stdout.isTTY) {
          this.log(`\n${formatUploadError(normalizedError)}`)
          this.exit(1)
        }

        this.error(
          chalk.red(
            errorMessage.startsWith('Upload failed:')
              ? errorMessage
              : `Upload failed: ${errorMessage}`,
          ),
        )
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'ExitPromptError') {
        this.log(chalk.yellow('\n\nUpload cancelled'))
        this.exit(0)
      }

      throw error
    }
  }
}
