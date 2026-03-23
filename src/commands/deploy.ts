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
import { expandPath } from '../utils/path.js'
import { createSigner } from '../utils/signer.js'
import { runUploadWorkflow } from '../workflows/upload-workflow.js'

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
    '<%= config.bin %> deploy --arns-name my-app --uploader https://up.arweave.net',
    '<%= config.bin %> upload --wallet ./wallet.json  # Upload only (no ArNS update)',
  ]

  static override flags = extractFlags(deployFlagConfigs)

  public async run(): Promise<void> {
    try {
      const { flags } = await this.parse(Deploy)

      const interactive = !flags['arns-name']

      if (interactive) {
        this.log(chalk.cyan.bold('\nInteractive Deployment Mode\n'))
      }

      const baseConfig = (await resolveConfig<typeof deployFlagConfigs>(deployFlagConfigs, flags, {
        interactive,
      })) as DeployConfig

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
        'max-token-amount': advancedOptions?.maxTokenAmount || baseConfig['max-token-amount'],
        'no-dedupe': baseConfig['no-dedupe'],
        'on-demand': advancedOptions?.onDemand || baseConfig['on-demand'],
        'private-key': walletConfig.privateKey,
        'sig-type': baseConfig['sig-type'],
        'ttl-seconds': advancedOptions?.ttlSeconds || baseConfig['ttl-seconds'],
        undername: advancedOptions?.undername || baseConfig.undername,
        uploader: baseConfig.uploader,
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

      const arioProcess = deployConfig['ario-process']

      this.log(chalk.cyan.bold('\nStarting deployment...\n'))
      try {
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

        spinner.start(`Fetching ArNS record for ${chalk.yellow(deployConfig['arns-name'])}`)
        const arnsNameRecord = await ario
          .getArNSRecord({ name: deployConfig['arns-name'] })
          .catch(() => {
            spinner.fail(`ArNS name ${chalk.red(deployConfig['arns-name'])} does not exist`)
            this.error(`ArNS name [${deployConfig['arns-name']}] does not exist`)
          })

        spinner.succeed(`ArNS record fetched for ${chalk.green(deployConfig['arns-name'])}`)

        const txOrManifestId = await runUploadWorkflow(deployKey, deployConfig, {
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

        const table = new Table({
          head: [chalk.cyan.bold('Property'), chalk.cyan.bold('Value')],
          style: {
            head: [],
          },
        })

        table.push(
          ['Tx ID', chalk.green(txOrManifestId)],
          ...(deployConfig.uploader
            ? ([['Bundler service', chalk.cyan(deployConfig.uploader)]] as [string, string][])
            : []),
          ['ArNS Name', chalk.yellow(deployConfig['arns-name'])],
          ['Undername', chalk.yellow(deployConfig.undername)],
          ['ANT', chalk.cyan(arnsNameRecord.processId)],
          ['ARIO Process', chalk.gray(arioProcess)],
          ['TTL Seconds', chalk.blue(deployConfig['ttl-seconds'])],
          ['Arweave URL', chalk.yellow(`https://arweave.net/${txOrManifestId}`)],
        )

        const isCI = Boolean(process.env.CI)
        const successMessage = boxen(
          `${chalk.green.bold('Deployment Successful!')}\n\n${table.toString()}`,
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
          chalk.red(`Deployment failed: ${error instanceof Error ? error.message : String(error)}`),
        )
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
