import fs from 'node:fs'
import path from 'node:path'
import { ANT, AOProcess, ARIO } from '@ar.io/sdk'
import {
  ARIOToTokenAmount,
  ETHToTokenAmount,
  OnDemandFunding,
  TurboFactory,
} from '@ardrive/turbo-sdk'
import { Command } from '@oclif/core'
import { connect } from '@permaweb/aoconnect'
import boxen from 'boxen'
import chalk from 'chalk'
import Table from 'cli-table3'
import ora from 'ora'

import { type DeployConfig, deployFlagConfigs } from '../constants/flags.js'
import { promptAdvancedOptions } from '../prompts/arns.js'
import { getWalletConfig } from '../prompts/wallet.js'
import type { SignerType } from '../types/index.js'
import { extractFlags, resolveConfig } from '../utils/config-resolver.js'
import { expandPath } from '../utils/path.js'
import { createSigner } from '../utils/signer.js'
import { uploadFile, uploadFolder } from '../utils/uploader.js'

function getFolderSize(folderPath: string): number {
  return fs.readdirSync(folderPath).reduce((totalSize, item) => {
    const fullPath = path.join(folderPath, item)
    const stats = fs.statSync(fullPath)

    if (stats.isDirectory()) {
      return totalSize + getFolderSize(fullPath)
    }

    return totalSize + stats.size
  }, 0)
}

export default class Deploy extends Command {
  static override args = {}

  static override description = 'Deploy your application to the permaweb'

  static override examples = [
    '<%= config.bin %> deploy  # Interactive mode',
    '<%= config.bin %> deploy --arns-name my-app --wallet ./wallet.json',
    '<%= config.bin %> deploy --arns-name my-app --private-key "$(cat wallet.json)"',
    '<%= config.bin %> deploy --arns-name my-app --undername staging',
    '<%= config.bin %> deploy --arns-name my-app --deploy-file ./dist/index.html',
    '<%= config.bin %> deploy --arns-name my-app --sig-type ethereum --wallet ./private-key.txt',
    '<%= config.bin %> deploy --arns-name my-app --sig-type ethereum --private-key "0x..."',
    '<%= config.bin %> deploy --arns-name my-app --on-demand ario --max-token-amount 1000',
  ]

  static override flags = extractFlags(deployFlagConfigs)

  public async run(): Promise<void> {
    try {
      const { flags } = await this.parse(Deploy)

      // Check if we need interactive mode (no arns-name provided)
      const interactive = !flags['arns-name']

      if (interactive) {
        this.log(chalk.cyan.bold('\n🎯 Interactive Deployment Mode\n'))
      }

      // Resolve base configuration - prompts will run automatically in interactive mode
      const baseConfig = (await resolveConfig<typeof deployFlagConfigs>(deployFlagConfigs, flags, {
        interactive,
      })) as DeployConfig

      // Handle wallet configuration (shared between wallet and privateKey)
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

      // Handle advanced options (shared between ttlSeconds, undername, arioProcess, onDemand, maxTokenAmount)
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

      // Build final config with shared prompt results
      const deployConfig: DeployConfig = {
        'ario-process': advancedOptions?.arioProcess || baseConfig['ario-process'],
        'arns-name': baseConfig['arns-name'],
        'deploy-file': baseConfig['deploy-file'],
        'deploy-folder': baseConfig['deploy-folder'],
        'max-token-amount': advancedOptions?.maxTokenAmount || baseConfig['max-token-amount'],
        'on-demand': advancedOptions?.onDemand || baseConfig['on-demand'],
        'private-key': walletConfig.privateKey,
        'sig-type': baseConfig['sig-type'],
        'ttl-seconds': advancedOptions?.ttlSeconds || baseConfig['ttl-seconds'],
        undername: advancedOptions?.undername || baseConfig.undername,
        wallet: walletConfig.wallet,
      }

      if (interactive) {
        this.log('')
      }

      // Get deploy key from wallet file, private-key flag, or environment variable
      let deployKey: string
      if (deployConfig.wallet) {
        const walletPath = expandPath(deployConfig.wallet)
        if (!fs.existsSync(walletPath)) {
          this.error(`Wallet file [${deployConfig.wallet}] does not exist`)
        }

        const walletContent = fs.readFileSync(walletPath, 'utf8')
        // For Arweave wallets (JWK), encode to base64. For others (private keys), use as-is
        deployKey =
          deployConfig['sig-type'] === 'arweave'
            ? Buffer.from(walletContent).toString('base64')
            : walletContent.trim()
      } else if (deployConfig['private-key']) {
        // For Arweave wallets (JWK JSON), encode to base64. For others, use as-is
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

      // All validation is now handled in resolveDeployConfig
      const arioProcess = deployConfig['ario-process']

      this.log(chalk.cyan.bold('\n🚀 Starting deployment...\n'))
      try {
        // Initialize ARIO
        const spinner = ora('Initializing ARIO').start()

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

        // Get ArNS record
        spinner.start(`Fetching ArNS record for ${chalk.yellow(deployConfig['arns-name'])}`)
        const arnsNameRecord = await ario
          .getArNSRecord({ name: deployConfig['arns-name'] })
          .catch(() => {
            spinner.fail(`ArNS name ${chalk.red(deployConfig['arns-name'])} does not exist`)
            this.error(`ArNS name [${deployConfig['arns-name']}] does not exist`)
          })

        spinner.succeed(`ArNS record fetched for ${chalk.green(deployConfig['arns-name'])}`)

        // Create signer
        spinner.start('Creating signer')
        const { signer, token } = createSigner(deployConfig['sig-type'] as SignerType, deployKey)
        spinner.succeed(`Signer created (${chalk.cyan(deployConfig['sig-type'])})`)

        // Initialize Turbo
        spinner.start('Initializing Turbo')
        const turbo = TurboFactory.authenticated({
          signer,
          token,
        })
        spinner.succeed('Turbo initialized')

        // Create on-demand funding mode if specified
        let fundingMode: OnDemandFunding | undefined
        if (deployConfig['on-demand'] && deployConfig['max-token-amount']) {
          const tokenType = deployConfig['on-demand']
          const maxAmount = Number.parseFloat(deployConfig['max-token-amount'])

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

        if (!fundingMode) {
          spinner.start('Checking Turbo credits for upload')

          try {
            // Figure out how many bytes we're about to upload
            const uploadBytes = deployConfig['deploy-file']
              ? (() => {
                  const filePath = expandPath(deployConfig['deploy-file']!)
                  return fs.statSync(filePath).size
                })()
              : (() => {
                  const folderPath = expandPath(deployConfig['deploy-folder']!)
                  return getFolderSize(folderPath)
                })()

            const FREE_THRESHOLD_BYTES = 107_520 // ~105 KiB

            if (uploadBytes >= FREE_THRESHOLD_BYTES) {
              // Ask Turbo how many winc this upload will cost, and compare to current balance
              const [uploadCost] = await turbo.getUploadCosts({ bytes: [uploadBytes] })
              const balance = await turbo.getBalance()

              // These come back as strings; treat them as big integers
              const requiredWinc = BigInt(uploadCost.winc)
              const currentWinc = BigInt(balance.winc)

              if (requiredWinc > currentWinc) {
                spinner.fail('Insufficient Turbo credits')

                this.error(
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
            this.error(`Failed to check Turbo credits: ${errorMessage}`)
          }
        }
        // Upload file or folder
        let txOrManifestId: string
        try {
          if (deployConfig['deploy-file']) {
            const filePath = expandPath(deployConfig['deploy-file'])
            spinner.start(`Uploading file ${chalk.yellow(deployConfig['deploy-file'])}`)
            txOrManifestId = await uploadFile(turbo, filePath, { fundingMode })
            if (!txOrManifestId) {
              spinner.fail('File upload failed: no transaction ID returned')
              this.error('File upload failed: no transaction ID returned')
            }
            spinner.succeed(`File uploaded: ${chalk.green(txOrManifestId)}`)
          } else {
            const folderPath = expandPath(deployConfig['deploy-folder'])
            spinner.start(`Uploading folder ${chalk.yellow(deployConfig['deploy-folder'])}`)
            txOrManifestId = await uploadFolder(turbo, folderPath, {
              fundingMode,
              throwOnFailure: true,
            })
            if (!txOrManifestId) {
              spinner.fail('Folder upload failed: no transaction ID returned')
              this.error('Folder upload failed: no transaction ID returned')
            }
            spinner.succeed(`Folder uploaded: ${chalk.green(txOrManifestId)}`)
          }
        } catch (uploadError) {
          spinner.fail('Upload failed')
          const errorMessage =
            uploadError instanceof Error ? uploadError.message : String(uploadError)
          this.error(`Upload failed: ${errorMessage}`)
        }

        this.log('')

        // Initialize ANT and update record
        spinner.start('Updating ANT record')
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

        // Display deployment details in a table inside a success box
        const table = new Table({
          head: [chalk.cyan.bold('Property'), chalk.cyan.bold('Value')],
          style: {
            head: [],
          },
        })

        table.push(
          ['Tx ID', chalk.green(txOrManifestId)],
          ['ArNS Name', chalk.yellow(deployConfig['arns-name'])],
          ['Undername', chalk.yellow(deployConfig.undername)],
          ['ANT', chalk.cyan(arnsNameRecord.processId)],
          ['ARIO Process', chalk.gray(arioProcess)],
          ['TTL Seconds', chalk.blue(deployConfig['ttl-seconds'])],
        )

        const successMessage = boxen(
          `${chalk.green.bold('✨ Deployment Successful!')}\n\n${table.toString()}`,
          {
            borderColor: 'green',
            borderStyle: 'round',
            padding: 1,
            title: chalk.bold('🚀 Permaweb Deploy'),
            titleAlignment: 'center',
          },
        )

        this.log(`\n${successMessage}`)
      } catch (error) {
        this.error(
          chalk.red(`Deployment failed: ${error instanceof Error ? error.message : String(error)}`),
        )
      }
    } catch (error) {
      // Handle user cancellation (Ctrl+C)
      if (error instanceof Error && error.name === 'ExitPromptError') {
        this.log(chalk.yellow('\n\n👋 Deployment cancelled'))
        this.exit(0)
      }

      throw error
    }
  }
}
