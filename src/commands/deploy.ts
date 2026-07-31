import fs from 'node:fs'

import { Command } from '@oclif/core'
import ora from 'ora'

import {
  DEFAULT_LEGACY_UPLOADER,
  type DeployConfig,
  deployFlagConfigs,
} from '../constants/flags.js'
import { getWalletConfig } from '../prompts/wallet.js'
import type { SignerType } from '../types/index.js'
import { chalk } from '../utils/chalk.js'
import { extractFlags, resolveConfig } from '../utils/config-resolver.js'
import { type DisplayRow, formatDisplayRows, formatUploadError } from '../utils/display.js'
import { hyperbeamBundlerLink } from '../utils/hyperbeam-uploader.js'
import { preflightNamesUpdate, publishNamesUpdate } from '../utils/names.js'
import { expandPath } from '../utils/path.js'
import { runUploadWorkflow } from '../workflows/upload-workflow.js'

export default class Deploy extends Command {
  static override args = {}

  static override description = 'Deploy an application to the permaweb with optional names update'

  static override examples = [
    '<%= config.bin %> deploy --wallet ./wallet.json',
    '<%= config.bin %> deploy --wallet ./wallet.json --deploy-folder ./dist',
    '<%= config.bin %> deploy --wallet ./wallet.json --deploy-file ./dist/index.html',
    '<%= config.bin %> deploy --wallet ./wallet.json --uploader-type hyperbeam --uploader https://hyperbeam.example.com',
    '<%= config.bin %> deploy --wallet ./wallet.json --use-names --name my-app',
    '<%= config.bin %> deploy --wallet ./wallet.json --use-names --reference-id REFERENCE_ID',
  ]

  static override flags = extractFlags(deployFlagConfigs)

  public async run(): Promise<void> {
    try {
      const { flags } = await this.parse(Deploy)

      const useNames = Boolean(flags['use-names'] || flags.name || flags['reference-id'])
      const interactive = useNames && !flags.name && !flags['reference-id']

      if (interactive) {
        this.log(chalk.bold(chalk.cyan('\nInteractive Names Deployment Mode\n')))
      }

      const baseConfig = (await resolveConfig<typeof deployFlagConfigs>(deployFlagConfigs, flags, {
        interactive,
      })) as DeployConfig

      let walletConfig: { privateKey?: string; wallet?: string } = {
        privateKey: baseConfig['private-key'],
        wallet: baseConfig.wallet,
      }

      const shouldPromptWallet =
        !baseConfig.wallet &&
        !baseConfig['private-key'] &&
        (interactive || !process.env.DEPLOY_KEY?.trim())

      if (shouldPromptWallet) {
        const config = await getWalletConfig()
        walletConfig = {
          privateKey: config.privateKey,
          wallet: config.wallet,
        }
      }

      const effectiveCacheMaxEntries = baseConfig['no-dedupe']
        ? 0
        : baseConfig['dedupe-cache-max-entries']
      const uploader =
        baseConfig.uploader ??
        (baseConfig['uploader-type'] === 'legacy' ? DEFAULT_LEGACY_UPLOADER : undefined)

      const deployConfig: DeployConfig = {
        'dedupe-cache-max-entries': effectiveCacheMaxEntries,
        'deploy-file': baseConfig['deploy-file'],
        'deploy-folder': baseConfig['deploy-folder'],
        'hyperbeam-ao-state-url': baseConfig['hyperbeam-ao-state-url'],
        'hyperbeam-auto-fund': baseConfig['hyperbeam-auto-fund'],
        'hyperbeam-fund-amount': baseConfig['hyperbeam-fund-amount'],
        'hyperbeam-ledger-id': baseConfig['hyperbeam-ledger-id'],
        'hyperbeam-token-id': baseConfig['hyperbeam-token-id'],
        'hyperbeam-upload-path': baseConfig['hyperbeam-upload-path'],
        name: baseConfig.name,
        'names-gateway': baseConfig['names-gateway'],
        'names-graphql': baseConfig['names-graphql'],
        'names-namespace': baseConfig['names-namespace'],
        'names-node': baseConfig['names-node'],
        'no-dedupe': baseConfig['no-dedupe'],
        'private-key': walletConfig.privateKey,
        'reference-id': baseConfig['reference-id'],
        'sig-type': baseConfig['sig-type'],
        uploader,
        'uploader-type': baseConfig['uploader-type'],
        'use-names': useNames,
        wallet: walletConfig.wallet,
      }

      if (interactive) {
        this.log('')
      }

      let deployKey: string
      if (deployConfig.wallet) {
        const walletPath = expandPath(deployConfig.wallet)
        if (!fs.existsSync(walletPath)) {
          this.error(`Wallet file [${deployConfig.wallet}] does not exist`)
        }

        const walletContent = fs.readFileSync(walletPath, 'utf8')
        deployKey =
          deployConfig['sig-type'] === 'arweave'
            ? Buffer.from(walletContent).toString('base64')
            : walletContent.trim()
      } else if (deployConfig['private-key']) {
        deployKey =
          deployConfig['sig-type'] === 'arweave'
            ? Buffer.from(deployConfig['private-key']).toString('base64')
            : deployConfig['private-key'].trim()
      } else {
        deployKey = process.env.DEPLOY_KEY || ''
        if (!deployKey) {
          this.error(
            'DEPLOY_KEY environment variable not set. Use --wallet, --private-key, or set DEPLOY_KEY',
          )
        }
      }

      this.log(chalk.bold(chalk.cyan('\nStarting deployment...\n')))
      try {
        if (!deployConfig['use-names']) {
          const uploadResult = await runUploadWorkflow(deployKey, deployConfig, {
            error: (msg) => this.error(msg),
          })
          const txOrManifestId = uploadResult.transactionId
          const effectiveUploader = uploadResult.uploader ?? deployConfig.uploader

          this.log('')

          const bundlerLink =
            deployConfig['uploader-type'] === 'hyperbeam' && effectiveUploader
              ? hyperbeamBundlerLink(
                  effectiveUploader,
                  txOrManifestId,
                  !deployConfig['deploy-file'],
                )
              : undefined

          const rows: DisplayRow[] = [['Tx ID', chalk.green(txOrManifestId)]]
          if (effectiveUploader) {
            rows.push(
              ['Bundler service', chalk.cyan(effectiveUploader)],
              ['Uploader type', chalk.cyan(deployConfig['uploader-type'])],
            )
          }

          if (bundlerLink) {
            rows.push(['Bundler link', chalk.yellow(bundlerLink)])
          }

          rows.push(['Arweave URL', chalk.yellow(`https://arweave.net/${txOrManifestId}`)])

          this.log(chalk.bold(chalk.green('Deployment Successful!')))
          this.log(formatDisplayRows(rows))

          return
        }

        if (deployConfig['sig-type'] !== 'arweave') {
          this.error('Names updates currently require --sig-type arweave')
        }

        if (!deployConfig.name && !deployConfig['reference-id']) {
          this.error('--use-names requires --name or --reference-id')
        }

        const spinner = ora()

        spinner.start('Validating names target')
        const namesTarget = await preflightNamesUpdate({
          deployKey,
          gateway: deployConfig['names-gateway'],
          graphql: deployConfig['names-graphql'],
          name: deployConfig.name,
          namespace: deployConfig['names-namespace'],
          node: deployConfig['names-node'],
          referenceId: deployConfig['reference-id'],
          sigType: deployConfig['sig-type'] as SignerType,
        }).catch((error) => {
          spinner.fail('Names target validation failed')
          throw error
        })

        spinner.succeed('Names target validated')

        const uploadResult = await runUploadWorkflow(deployKey, deployConfig, {
          error: (msg) => this.error(msg),
        })
        const txOrManifestId = uploadResult.transactionId
        const effectiveUploader = uploadResult.uploader ?? deployConfig.uploader

        this.log('')

        spinner.start('Updating names target')
        const namesUpdate = await publishNamesUpdate({
          deployKey,
          gateway: deployConfig['names-gateway'],
          graphql: deployConfig['names-graphql'],
          name: namesTarget.name,
          namespace: deployConfig['names-namespace'],
          node: deployConfig['names-node'],
          referenceId: deployConfig['reference-id'],
          sigType: deployConfig['sig-type'] as SignerType,
          value: txOrManifestId,
        }).catch((error) => {
          spinner.fail('Names target update failed')
          throw error
        })

        spinner.succeed('Names target updated')

        const bundlerLink =
          deployConfig['uploader-type'] === 'hyperbeam' && effectiveUploader
            ? hyperbeamBundlerLink(effectiveUploader, txOrManifestId, !deployConfig['deploy-file'])
            : undefined

        const rows: DisplayRow[] = [['Tx ID', chalk.green(txOrManifestId)]]
        if (effectiveUploader) {
          rows.push(
            ['Bundler service', chalk.cyan(effectiveUploader)],
            ['Uploader type', chalk.cyan(deployConfig['uploader-type'])],
          )
        }

        if (bundlerLink) {
          rows.push(['Bundler link', chalk.yellow(bundlerLink)])
        }

        rows.push(
          ...(namesUpdate.name ? ([['Name', chalk.yellow(namesUpdate.name)]] as DisplayRow[]) : []),
          ['Names Target Kind', chalk.cyan(namesUpdate.kind)],
          ['Names Target ID', chalk.cyan(namesUpdate.referenceId)],
          ['Names Update ID', chalk.green(namesUpdate.updateId)],
          ['Names Namespace', chalk.gray(namesUpdate.namespace)],
          ['Arweave URL', chalk.yellow(`https://arweave.net/${txOrManifestId}`)],
        )

        this.log(chalk.bold(chalk.green('Deployment Successful!')))
        this.log(formatDisplayRows(rows))
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        const normalizedError = errorMessage.startsWith('Upload failed:')
          ? errorMessage.replace(/^Upload failed:\s*/, '')
          : errorMessage

        if (errorMessage.startsWith('Upload failed:') && !process.env.CI && process.stdout.isTTY) {
          this.log(`\n${formatUploadError(normalizedError, 'Deployment failed')}`)
          this.exit(1)
        }

        this.error(chalk.red(`Deployment failed: ${errorMessage}`))
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'ExitPromptError') {
        this.log(chalk.yellow('\n\nDeployment cancelled'))
        this.exit(0)
      }

      throw error
    }
  }
}
