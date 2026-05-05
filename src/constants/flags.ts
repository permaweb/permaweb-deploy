import { ARIO_MAINNET_PROCESS_ID } from '@ar.io/sdk'
import { Flags } from '@oclif/core'

import { promptArioProcess, promptArnsName } from '../prompts/arns.js'
import { promptDeployTarget } from '../prompts/deployment.js'
import { promptSignerType } from '../prompts/wallet.js'
import { createFlagConfig, type ResolvedConfig } from '../utils/config-resolver.js'
import { TTL_MAX, TTL_MIN } from '../utils/constants.js'
import {
  resolveArioProcess,
  validateArioProcess,
  validateFileExists,
  validateFolderExists,
  validateTtl,
  validateUndername,
} from '../utils/validators.js'
import { DEFAULT_CACHE_MAX_ENTRIES } from './cache.js'

/**
 * Global flag definitions - single source of truth for all flags
 * Each flag includes its oclif definition and optional prompt function
 */
export const globalFlags = {
  arioProcess: createFlagConfig<string>({
    flag: Flags.string({
      char: 'p',
      default: ARIO_MAINNET_PROCESS_ID,
      description: 'The ARIO process to use (mainnet, testnet, or process ID)',
      async parse(input) {
        const validation = validateArioProcess(input)
        if (validation !== true) {
          throw new Error(validation)
        }

        return resolveArioProcess(input)
      },
      required: false,
    }),
    prompt: promptArioProcess,
  }),
  arnsName: createFlagConfig<string>({
    flag: Flags.string({
      char: 'n',
      description: 'The ArNS name to deploy to',
      required: false,
    }),
    prompt: promptArnsName,
    triggersInteractive: true,
  }),
  dedupeCacheMaxEntries: createFlagConfig<number>({
    flag: Flags.integer({
      default: DEFAULT_CACHE_MAX_ENTRIES,
      description: 'Maximum number of entries to keep in the dedupe cache (LRU)',
      min: 0,
      required: false,
    }),
  }),
  deployFile: createFlagConfig<string | undefined>({
    flag: Flags.string({
      char: 'f',
      description: 'File to deploy (overrides deploy-folder)',
      async parse(input) {
        const validation = validateFileExists(input)
        if (validation !== true) {
          throw new Error(validation)
        }

        return input
      },
      required: false,
    }),
    async prompt() {
      const target = await promptDeployTarget()
      return target.type === 'file' ? target.path : undefined
    },
  }),
  deployFolder: createFlagConfig<string>({
    flag: Flags.string({
      char: 'd',
      default: './dist',
      description: 'Folder to deploy',
      async parse(input) {
        const validation = validateFolderExists(input)
        if (validation !== true) {
          throw new Error(validation)
        }

        return input
      },
      required: false,
    }),
    async prompt() {
      const target = await promptDeployTarget()
      return target.type === 'folder' ? target.path : './dist'
    },
  }),
  hyperbeamAoStateUrl: createFlagConfig<string>({
    flag: Flags.string({
      default: 'https://state.forward.computer',
      description: 'AO state endpoint used to wait for HyperBEAM auto-fund transfer assignment.',
      required: false,
    }),
  }),
  hyperbeamAutoFund: createFlagConfig<boolean>({
    flag: Flags.boolean({
      default: false,
      description: 'Automatically fund the HyperBEAM local ledger before upload.',
      required: false,
    }),
  }),
  hyperbeamFundAmount: createFlagConfig<string | undefined>({
    flag: Flags.string({
      description: 'Optional minimum HyperBEAM local ledger balance override, in token base units.',
      required: false,
    }),
  }),
  hyperbeamLedgerId: createFlagConfig<string | undefined>({
    flag: Flags.string({
      description:
        'Hyperbalance ledger ID to fund. Defaults to the first matching advertised ledger.',
      required: false,
    }),
  }),
  hyperbeamTokenId: createFlagConfig<string | undefined>({
    flag: Flags.string({
      description:
        'Hyperbalance token ID to fund. Defaults to the first matching advertised token.',
      required: false,
    }),
  }),
  hyperbeamUploadPath: createFlagConfig<string>({
    flag: Flags.string({
      default: '/~bundler@1.0/item?codec-device=ans104@1.0',
      description: 'HyperBEAM bundler route used when --uploader-type hyperbeam is set.',
      required: false,
    }),
  }),
  // Advanced payment settings
  maxTokenAmount: createFlagConfig<string | undefined>({
    flag: Flags.string({
      description: 'Maximum token amount for on-demand payment',
      required: false,
    }),
  }),
  noDedupe: createFlagConfig<boolean>({
    flag: Flags.boolean({
      default: false,
      description: 'Disable deduplication (do not cache or reuse previous uploads)',
      required: false,
    }),
  }),
  onDemand: createFlagConfig<string | undefined>({
    flag: Flags.string({
      description: 'Enable on-demand payment with specified token (ario or base-eth)',
      options: ['ario', 'base-eth'],
      required: false,
    }),
  }),
  privateKey: createFlagConfig<string | undefined>({
    flag: Flags.string({
      char: 'k',
      description: 'Private key or JWK JSON string (alternative to --wallet)',
      exclusive: ['wallet'],
      required: false,
    }),
  }),
  sigType: createFlagConfig<string>({
    flag: Flags.string({
      char: 's',
      default: 'arweave',
      description: 'Signer type for deployment',
      options: ['arweave', 'ethereum', 'polygon', 'kyve'],
      required: false,
    }),
    prompt: promptSignerType,
  }),
  ttlSeconds: createFlagConfig<string>({
    flag: Flags.string({
      char: 't',
      default: '60',
      description: `ArNS TTL in seconds (${TTL_MIN}-${TTL_MAX})`,
      async parse(input) {
        const validation = validateTtl(input)
        if (validation !== true) {
          throw new Error(validation)
        }

        return input
      },
      required: false,
    }),
  }),
  undername: createFlagConfig<string>({
    flag: Flags.string({
      char: 'u',
      default: '@',
      description: 'ANT undername to update',
      async parse(input) {
        const validation = validateUndername(input)
        if (validation !== true) {
          throw new Error(validation)
        }

        return input
      },
      required: false,
    }),
  }),
  uploader: createFlagConfig<string | undefined>({
    flag: Flags.string({
      description:
        'Base URL of the bundler service to use. For Turbo, omit for ArDrive production: https://upload.ardrive.io. For HyperBEAM, pass the node URL, for example https://hyperbeam.example.com.',
      required: false,
    }),
  }),
  uploaderType: createFlagConfig<string>({
    flag: Flags.string({
      default: 'turbo',
      description:
        'Uploader protocol to use. turbo uses the Turbo bundler API; hyperbeam signs ANS-104 items and posts them to a HyperBEAM bundler route.',
      options: ['turbo', 'hyperbeam'],
      required: false,
    }),
  }),
  wallet: createFlagConfig<string | undefined>({
    flag: Flags.string({
      char: 'w',
      description: 'Path to wallet file (JWK for Arweave, private key for others)',
      exclusive: ['private-key'],
      async parse(input) {
        const validation = validateFileExists(input)
        if (validation !== true) {
          throw new Error(validation)
        }

        return input
      },
      required: false,
    }),
  }),
}

/**
 * Complete set of flags for the deploy command
 */
export const deployFlags = {
  'ario-process': globalFlags.arioProcess.flag,
  'arns-name': globalFlags.arnsName.flag,
  'dedupe-cache-max-entries': globalFlags.dedupeCacheMaxEntries.flag,
  'deploy-file': globalFlags.deployFile.flag,
  'deploy-folder': globalFlags.deployFolder.flag,
  'hyperbeam-ao-state-url': globalFlags.hyperbeamAoStateUrl.flag,
  'hyperbeam-auto-fund': globalFlags.hyperbeamAutoFund.flag,
  'hyperbeam-fund-amount': globalFlags.hyperbeamFundAmount.flag,
  'hyperbeam-ledger-id': globalFlags.hyperbeamLedgerId.flag,
  'hyperbeam-token-id': globalFlags.hyperbeamTokenId.flag,
  'hyperbeam-upload-path': globalFlags.hyperbeamUploadPath.flag,
  'max-token-amount': globalFlags.maxTokenAmount.flag,
  'no-dedupe': globalFlags.noDedupe.flag,
  'on-demand': globalFlags.onDemand.flag,
  'private-key': globalFlags.privateKey.flag,
  'sig-type': globalFlags.sigType.flag,
  'ttl-seconds': globalFlags.ttlSeconds.flag,
  undername: globalFlags.undername.flag,
  uploader: globalFlags.uploader.flag,
  'uploader-type': globalFlags.uploaderType.flag,
  wallet: globalFlags.wallet.flag,
}

/**
 * ArNS-specific flags (subset of deploy flags)
 */
export const arnsFlags = {
  'ario-process': globalFlags.arioProcess.flag,
  'arns-name': globalFlags.arnsName.flag,
  'ttl-seconds': globalFlags.ttlSeconds.flag,
  undername: globalFlags.undername.flag,
}

/**
 * Wallet/authentication flags (subset of deploy flags)
 */
export const walletFlags = {
  'private-key': globalFlags.privateKey.flag,
  'sig-type': globalFlags.sigType.flag,
  wallet: globalFlags.wallet.flag,
}

/**
 * Deploy command configuration type
 */
export interface DeployConfig {
  'ario-process': string
  'arns-name': string
  'dedupe-cache-max-entries': number
  'deploy-file'?: string
  'deploy-folder': string
  'hyperbeam-ao-state-url': string
  'hyperbeam-auto-fund': boolean
  'hyperbeam-fund-amount'?: string
  'hyperbeam-ledger-id'?: string
  'hyperbeam-token-id'?: string
  'hyperbeam-upload-path': string
  'max-token-amount'?: string
  'no-dedupe': boolean
  'on-demand'?: string
  'private-key'?: string
  'sig-type': string
  'ttl-seconds': string
  undername: string
  uploader?: string
  'uploader-type': string
  wallet?: string
}

/**
 * Deploy command flag configurations
 * Maps kebab-case flag names to their camelCase globalFlags definitions
 */
export const deployFlagConfigs = {
  'ario-process': globalFlags.arioProcess,
  'arns-name': globalFlags.arnsName,
  'dedupe-cache-max-entries': globalFlags.dedupeCacheMaxEntries,
  'deploy-file': globalFlags.deployFile,
  'deploy-folder': globalFlags.deployFolder,
  'hyperbeam-ao-state-url': globalFlags.hyperbeamAoStateUrl,
  'hyperbeam-auto-fund': globalFlags.hyperbeamAutoFund,
  'hyperbeam-fund-amount': globalFlags.hyperbeamFundAmount,
  'hyperbeam-ledger-id': globalFlags.hyperbeamLedgerId,
  'hyperbeam-token-id': globalFlags.hyperbeamTokenId,
  'hyperbeam-upload-path': globalFlags.hyperbeamUploadPath,
  'max-token-amount': globalFlags.maxTokenAmount,
  'no-dedupe': globalFlags.noDedupe,
  'on-demand': globalFlags.onDemand,
  'private-key': globalFlags.privateKey,
  'sig-type': globalFlags.sigType,
  'ttl-seconds': globalFlags.ttlSeconds,
  undername: globalFlags.undername,
  uploader: globalFlags.uploader,
  'uploader-type': globalFlags.uploaderType,
  wallet: globalFlags.wallet,
} as const

/**
 * Upload command — file/folder to Arweave via Turbo without updating ArNS
 */
export const uploadFlagConfigs = {
  'dedupe-cache-max-entries': globalFlags.dedupeCacheMaxEntries,
  'deploy-file': globalFlags.deployFile,
  'deploy-folder': globalFlags.deployFolder,
  'hyperbeam-ao-state-url': globalFlags.hyperbeamAoStateUrl,
  'hyperbeam-auto-fund': globalFlags.hyperbeamAutoFund,
  'hyperbeam-fund-amount': globalFlags.hyperbeamFundAmount,
  'hyperbeam-ledger-id': globalFlags.hyperbeamLedgerId,
  'hyperbeam-token-id': globalFlags.hyperbeamTokenId,
  'hyperbeam-upload-path': globalFlags.hyperbeamUploadPath,
  'max-token-amount': globalFlags.maxTokenAmount,
  'no-dedupe': globalFlags.noDedupe,
  'on-demand': globalFlags.onDemand,
  'private-key': globalFlags.privateKey,
  'sig-type': globalFlags.sigType,
  uploader: globalFlags.uploader,
  'uploader-type': globalFlags.uploaderType,
  wallet: globalFlags.wallet,
} as const

export type UploadConfig = ResolvedConfig<typeof uploadFlagConfigs>
