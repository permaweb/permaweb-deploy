import fs from 'node:fs'

import { ANT, AOProcess, ARIO } from '@ar.io/sdk'
import { Command } from '@oclif/core'
import { connect } from '@permaweb/aoconnect'
import boxen from 'boxen'
import chalk from 'chalk'
// eslint-disable-next-line import/no-named-as-default
import Table from 'cli-table3'
import ora from 'ora'

import { type DeployConfig, deployFlagConfigs } from '../constants/flags.js'
import { promptAdvancedOptions } from '../prompts/arns.js'
import { getWalletConfig } from '../prompts/wallet.js'
import type { SignerType } from '../types/index.js'
import { extractFlags, resolveConfig } from '../utils/config-resolver.js'
import { uploadErrorTable } from '../utils/display.js'
import { hyperbeamBundlerLink } from '../utils/hyperbeam-uploader.js'
import { expandPath } from '../utils/path.js'
import { createSigner } from '../utils/signer.js'
import { runUploadWorkflow } from '../workflows/upload-workflow.js'

export default class Deploy extends Command {
  static override args = {}

  static override description = 'Deploy an application to the permaweb with optional ArNS update'

  static override examples = [
    '<%= config.bin %> deploy --wallet ./wallet.json',
    '<%= config.bin %> deploy --wallet ./wallet.json --deploy-folder ./dist',
    '<%= config.bin %> deploy --wallet ./wallet.json --deploy-file ./dist/index.html',
    '<%= config.bin %> deploy --wallet ./wallet.json --uploader-type hyperbeam --uploader https://hyperbeam.example.com',
    '<%= config.bin %> deploy --wallet ./wallet.json --use-arns --arns-name my-app',
    '<%= config.bin %> deploy --wallet ./wallet.json --use-arns --arns-name my-app --undername staging',
  ]

  static override flags = extractFlags(deployFlagConfigs)

  public async run(): Promise<void> {
    try {
      const { flags } = await this.parse(Deploy)

      const useArns = Boolean(flags['use-arns'] || flags['arns-name'])
      const interactive = useArns && !flags['arns-name']

      if (interactive) {
        this.log(chalk.cyan.bold('\nInteractive ArNS Deployment Mode\n'))
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

      let advancedOptions:
        | {
            arioProcess: string
            maxTokenAmount?: string
            onDemand?: string
            ttlSeconds: string
            undername: string
          }
        | undefined

      if (interactive) {
        const options = await promptAdvancedOptions()
        advancedOptions = options || undefined
      }

      const effectiveCacheMaxEntries = baseConfig['no-dedupe']
        ? 0
        : baseConfig['dedupe-cache-max-entries']

      const deployConfig: DeployConfig = {
        'ario-process': advancedOptions?.arioProcess || baseConfig['ario-process'],
        'arns-name': baseConfig['arns-name'],
        'dedupe-cache-max-entries': effectiveCacheMaxEntries,
        'deploy-file': baseConfig['deploy-file'],
        'deploy-folder': baseConfig['deploy-folder'],
        'hyperbeam-ao-state-url': baseConfig['hyperbeam-ao-state-url'],
        'hyperbeam-auto-fund': baseConfig['hyperbeam-auto-fund'],
        'hyperbeam-fund-amount': baseConfig['hyperbeam-fund-amount'],
        'hyperbeam-ledger-id': baseConfig['hyperbeam-ledger-id'],
        'hyperbeam-token-id': baseConfig['hyperbeam-token-id'],
        'hyperbeam-upload-path': baseConfig['hyperbeam-upload-path'],
        'max-token-amount': advancedOptions?.maxTokenAmount || baseConfig['max-token-amount'],
        'no-dedupe': baseConfig['no-dedupe'],
        'on-demand': advancedOptions?.onDemand || baseConfig['on-demand'],
        'private-key': walletConfig.privateKey,
        'sig-type': baseConfig['sig-type'],
        'ttl-seconds': advancedOptions?.ttlSeconds || baseConfig['ttl-seconds'],
        undername: advancedOptions?.undername || baseConfig.undername,
        uploader: baseConfig.uploader,
        'uploader-type': baseConfig['uploader-type'],
        'use-arns': useArns,
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

      this.log(chalk.cyan.bold('\nStarting deployment...\n'))
      try {
        if (!deployConfig['use-arns']) {
          const { transactionId: txOrManifestId } = await runUploadWorkflow(
            deployKey,
            deployConfig,
            {
              error: (msg) => this.error(msg),
            },
          )

          this.log('')

          const isCI = Boolean(process.env.CI)
          const bundlerLink =
            deployConfig['uploader-type'] === 'hyperbeam' && deployConfig.uploader
              ? hyperbeamBundlerLink(
                  deployConfig.uploader,
                  txOrManifestId,
                  !deployConfig['deploy-file'],
                )
              : undefined

          if (isCI) {
            this.log('Deployment Successful!')
            this.log('Tx ID: ' + txOrManifestId)
            if (deployConfig.uploader) {
              this.log('Bundler service: ' + deployConfig.uploader)
              this.log('Uploader type: ' + deployConfig['uploader-type'])
            }

            if (bundlerLink) {
              this.log('Bundler link: ' + bundlerLink)
            }

            this.log(`Arweave URL: https://arweave.net/${txOrManifestId}`)
          } else {
            const table = new Table({
              style: {
                head: [],
              },
            })

            table.push(
              ['Tx ID', chalk.green(txOrManifestId)],
              ...(deployConfig.uploader
                ? ([
                    ['Bundler service', chalk.cyan(deployConfig.uploader)],
                    ['Uploader type', chalk.cyan(deployConfig['uploader-type'])],
                  ] as [string, string][])
                : []),
              ...(bundlerLink
                ? ([['Bundler link', chalk.yellow(bundlerLink)]] as [string, string][])
                : []),
              ['Arweave URL', chalk.yellow(`https://arweave.net/${txOrManifestId}`)],
            )

            const successMessage = boxen(
              `${chalk.green.bold('Deployment Successful!')}\n\n${table.toString()}`,
              {
                borderColor: 'green',
                borderStyle: 'round',
                padding: 1,
                title: chalk.bold('Permaweb Deploy'),
                titleAlignment: 'center',
              },
            )

            this.log(`\n${successMessage}`)
          }

          return
        }

        const arioProcess = deployConfig['ario-process']
        const arnsName = deployConfig['arns-name']
        if (!arnsName) {
          this.error('--use-arns requires --arns-name')
        }

        const spinner = ora()

        spinner.start('Initializing ARIO')

        const ao = connect({
          CU_URL: 'https://cu.ardrive.io',
          MODE: 'legacy',
          MU_URL: 'https://mu.ao-testnet.xyz',
        })

        const ario = ARIO.init({
          process: new AOProcess({
            ao,
            processId: arioProcess,
          }),
        })

        spinner.succeed('ARIO initialized')

        spinner.start(`Fetching ArNS record for ${chalk.yellow(arnsName)}`)
        const arnsNameRecord = await ario.getArNSRecord({ name: arnsName }).catch(() => {
          spinner.fail(`ArNS name ${chalk.red(arnsName)} does not exist`)
          this.error(`ArNS name [${arnsName}] does not exist`)
        })

        spinner.succeed(`ArNS record fetched for ${chalk.green(arnsName)}`)

        const { transactionId: txOrManifestId } = await runUploadWorkflow(deployKey, deployConfig, {
          error: (msg) => this.error(msg),
        })

        this.log('')

        spinner.start('Updating ANT record')
        const { signer } = createSigner(deployConfig['sig-type'] as SignerType, deployKey)
        const ant = ANT.init({ processId: arnsNameRecord.processId, signer })

        await ant.setRecord(
          {
            transactionId: txOrManifestId,
            ttlSeconds: Number.parseInt(deployConfig['ttl-seconds'], 10),
            undername: deployConfig.undername,
          },
          {
            tags: [
              {
                name: 'App-Name',
                value: 'Permaweb-Deploy',
              },
              ...(process.env.GITHUB_SHA
                ? [
                    {
                      name: 'GIT-HASH',
                      value: process.env.GITHUB_SHA,
                    },
                  ]
                : []),
            ],
          },
        )

        spinner.succeed('ANT record updated')

        const isCI = Boolean(process.env.CI)
        const bundlerLink =
          deployConfig['uploader-type'] === 'hyperbeam' && deployConfig.uploader
            ? hyperbeamBundlerLink(
                deployConfig.uploader,
                txOrManifestId,
                !deployConfig['deploy-file'],
              )
            : undefined

        if (isCI) {
          this.log('Deployment Successful!')
          this.log('Tx ID: ' + txOrManifestId)
          if (deployConfig.uploader) {
            this.log('Bundler service: ' + deployConfig.uploader)
            this.log('Uploader type: ' + deployConfig['uploader-type'])
          }

          if (bundlerLink) {
            this.log('Bundler link: ' + bundlerLink)
          }

          this.log('ArNS Name: ' + arnsName)
          this.log('Undername: ' + deployConfig.undername)
          this.log('ANT: ' + arnsNameRecord.processId)
          this.log('ARIO Process: ' + arioProcess)
          this.log('TTL Seconds: ' + deployConfig['ttl-seconds'])
          this.log(`Arweave URL: https://arweave.net/${txOrManifestId}`)
        } else {
          const table = new Table({
            style: {
              head: [],
            },
          })

          table.push(
            ['Tx ID', chalk.green(txOrManifestId)],
            ...(deployConfig.uploader
              ? ([
                  ['Bundler service', chalk.cyan(deployConfig.uploader)],
                  ['Uploader type', chalk.cyan(deployConfig['uploader-type'])],
                ] as [string, string][])
              : []),
            ...(bundlerLink
              ? ([['Bundler link', chalk.yellow(bundlerLink)]] as [string, string][])
              : []),
            ['ArNS Name', chalk.yellow(arnsName)],
            ['Undername', chalk.yellow(deployConfig.undername)],
            ['ANT', chalk.cyan(arnsNameRecord.processId)],
            ['ARIO Process', chalk.gray(arioProcess)],
            ['TTL Seconds', chalk.blue(deployConfig['ttl-seconds'])],
            ['Arweave URL', chalk.yellow(`https://arweave.net/${txOrManifestId}`)],
          )

          const successMessage = boxen(
            `${chalk.green.bold('Deployment Successful!')}\n\n${table.toString()}`,
            {
              borderColor: 'green',
              borderStyle: 'round',
              padding: 1,
              title: chalk.bold('Permaweb Deploy'),
              titleAlignment: 'center',
            },
          )

          this.log(`\n${successMessage}`)
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        const normalizedError = errorMessage.startsWith('Upload failed:')
          ? errorMessage.replace(/^Upload failed:\s*/, '')
          : errorMessage

        if (errorMessage.startsWith('Upload failed:') && !process.env.CI && process.stdout.isTTY) {
          this.log(`\n${uploadErrorTable(normalizedError, 'Deployment failed')}`)
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
