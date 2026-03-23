import fs from 'node:fs'

import { Command } from '@oclif/core'
import boxen from 'boxen'
import chalk from 'chalk'
// eslint-disable-next-line import/no-named-as-default
import Table from 'cli-table3'

import { type UploadConfig, uploadFlagConfigs } from '../constants/flags.js'
import { getWalletConfig } from '../prompts/wallet.js'
import { extractFlags, resolveConfig } from '../utils/config-resolver.js'
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
  ]

  static override flags = extractFlags(uploadFlagConfigs)

  public async run(): Promise<void> {
    try {
      const { flags } = await this.parse(Upload)

      const interactive = !flags.wallet && !flags['private-key'] && !process.env.DEPLOY_KEY?.trim()

      if (interactive) {
        this.log(chalk.cyan.bold('\nInteractive upload mode\n'))
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
        'max-token-amount': baseConfig['max-token-amount'],
        'on-demand': baseConfig['on-demand'],
        'sig-type': baseConfig['sig-type'],
        uploader: baseConfig.uploader,
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

      this.log(chalk.cyan.bold('\nStarting upload...\n'))

      try {
        const txOrManifestId = await runUploadWorkflow(deployKey, uploadCfg, {
          error: (msg) => this.error(msg),
        })

        this.log('')

        const table = new Table({
          head: [chalk.cyan.bold('Property'), chalk.cyan.bold('Value')],
          style: { head: [] },
        })

        table.push(['Tx ID', chalk.green(txOrManifestId)])

        if (uploadCfg.uploader) {
          table.push(['Bundler service', chalk.cyan(uploadCfg.uploader)])
        }

        table.push(['Arweave URL', chalk.yellow(`https://arweave.net/${txOrManifestId}`)])

        const isCI = Boolean(process.env.CI)
        const successMessage = boxen(
          `${chalk.green.bold('Upload successful!')}\n\n${table.toString()}`,
          {
            borderColor: 'green',
            borderStyle: isCI ? 'single' : 'round',
            fullscreen: isCI ? (width: number) => [width, 0] : undefined,
            padding: 1,
            title: chalk.bold('Permaweb Deploy'),
            titleAlignment: 'center',
          },
        )

        this.log(`\n${successMessage}`)
      } catch (error) {
        this.error(
          chalk.red(`Upload failed: ${error instanceof Error ? error.message : String(error)}`),
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
