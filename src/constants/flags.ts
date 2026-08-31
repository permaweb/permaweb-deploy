import { Flags } from '@oclif/core'

import { promptDeployTarget } from '../prompts/deployment.js'
import { promptName } from '../prompts/names.js'
import { promptSignerType } from '../prompts/wallet.js'
import { createFlagConfig, type ResolvedConfig } from '../utils/config-resolver.js'
import { validateFileExists, validateFolderExists, validateName } from '../utils/validators.js'
import { DEFAULT_CACHE_MAX_ENTRIES } from './cache.js'

export const DEFAULT_LEGACY_UPLOADER = 'https://up.arweave.net'

/**
 * Global flag definitions - single source of truth for all flags
 * Each flag includes its oclif definition and optional prompt function
 */
export const globalFlags = {
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
      description: 'Advanced: local HyperBEAM ledger ID to use for AO auto-funding.',
      required: false,
    }),
  }),
  hyperbeamTokenId: createFlagConfig<string | undefined>({
    flag: Flags.string({
      description: 'Advanced: AO token process ID to use for HyperBEAM auto-funding.',
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
  name: createFlagConfig<string>({
    flag: Flags.string({
      char: 'n',
      description: 'Namespace name to update with the deployed transaction ID',
      async parse(input) {
        const validation = validateName(input)
        if (validation !== true) {
          throw new Error(validation)
        }

        return input
      },
      required: false,
    }),
    prompt: promptName,
    triggersInteractive: true,
  }),
  namesGateway: createFlagConfig<string>({
    flag: Flags.string({
      default: 'https://arweave.net',
      description:
        'Gateway used for names namespace/reference reads and carrier transaction posting.',
      required: false,
    }),
  }),
  namesGraphql: createFlagConfig<string | undefined>({
    flag: Flags.string({
      description: 'GraphQL endpoint used for names reference and carrier discovery.',
      required: false,
    }),
  }),
  namesNamespace: createFlagConfig<string | undefined>({
    flag: Flags.string({
      description: 'Namespace root reference or manifest ID used to resolve --name.',
      required: false,
    }),
  }),
  namesNode: createFlagConfig<string | undefined>({
    flag: Flags.string({
      description: 'HyperBEAM node used for carrier-backed names reads.',
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
  permagit: createFlagConfig<string | undefined>({
    flag: Flags.string({
      description: 'Publish the current Git HEAD to the named Permagit repository after upload',
    }),
  }),
  permagitRef: createFlagConfig<string | undefined>({
    flag: Flags.string({
      dependsOn: ['permagit'],
      description: 'Permagit branch name (defaults to the current Git branch)',
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
  referenceId: createFlagConfig<string | undefined>({
    flag: Flags.string({
      description: 'Legacy reference ID to update directly, bypassing namespace name lookup.',
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
  uploader: createFlagConfig<string | undefined>({
    flag: Flags.string({
      description:
        'Base URL of the bundler service to use. Legacy uploads default to https://up.arweave.net; HyperBEAM uploads discover a PermawebOS uploader when omitted.',
      required: false,
    }),
  }),
  uploaderType: createFlagConfig<string>({
    flag: Flags.string({
      default: 'legacy',
      description:
        'Bundler protocol to use. legacy posts ANS-104 items to legacy upload endpoints; hyperbeam posts ANS-104 items to a HyperBEAM bundler route.',
      options: ['legacy', 'hyperbeam'],
      required: false,
    }),
  }),
  useNames: createFlagConfig<boolean>({
    flag: Flags.boolean({
      default: false,
      description: 'Update a Permaweb Name after upload.',
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
  'dedupe-cache-max-entries': globalFlags.dedupeCacheMaxEntries.flag,
  'deploy-file': globalFlags.deployFile.flag,
  'deploy-folder': globalFlags.deployFolder.flag,
  'hyperbeam-ao-state-url': globalFlags.hyperbeamAoStateUrl.flag,
  'hyperbeam-auto-fund': globalFlags.hyperbeamAutoFund.flag,
  'hyperbeam-fund-amount': globalFlags.hyperbeamFundAmount.flag,
  'hyperbeam-ledger-id': globalFlags.hyperbeamLedgerId.flag,
  'hyperbeam-token-id': globalFlags.hyperbeamTokenId.flag,
  'hyperbeam-upload-path': globalFlags.hyperbeamUploadPath.flag,
  name: globalFlags.name.flag,
  'names-gateway': globalFlags.namesGateway.flag,
  'names-graphql': globalFlags.namesGraphql.flag,
  'names-namespace': globalFlags.namesNamespace.flag,
  'names-node': globalFlags.namesNode.flag,
  'no-dedupe': globalFlags.noDedupe.flag,
  permagit: globalFlags.permagit.flag,
  'permagit-ref': globalFlags.permagitRef.flag,
  'private-key': globalFlags.privateKey.flag,
  'reference-id': globalFlags.referenceId.flag,
  'sig-type': globalFlags.sigType.flag,
  uploader: globalFlags.uploader.flag,
  'uploader-type': globalFlags.uploaderType.flag,
  'use-names': globalFlags.useNames.flag,
  wallet: globalFlags.wallet.flag,
}

/**
 * Names-specific flags (subset of deploy flags)
 */
export const namesFlags = {
  name: globalFlags.name.flag,
  'names-gateway': globalFlags.namesGateway.flag,
  'names-graphql': globalFlags.namesGraphql.flag,
  'names-namespace': globalFlags.namesNamespace.flag,
  'names-node': globalFlags.namesNode.flag,
  'reference-id': globalFlags.referenceId.flag,
  'use-names': globalFlags.useNames.flag,
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
  'dedupe-cache-max-entries': number
  'deploy-file'?: string
  'deploy-folder': string
  'hyperbeam-ao-state-url': string
  'hyperbeam-auto-fund': boolean
  'hyperbeam-fund-amount'?: string
  'hyperbeam-ledger-id'?: string
  'hyperbeam-token-id'?: string
  'hyperbeam-upload-path': string
  name?: string
  'names-gateway': string
  'names-graphql'?: string
  'names-namespace'?: string
  'names-node'?: string
  'no-dedupe': boolean
  'private-key'?: string
  permagit?: string
  'permagit-ref'?: string
  'reference-id'?: string
  'sig-type': string
  'use-names': boolean
  uploader?: string
  'uploader-type': string
  wallet?: string
}

/**
 * Deploy command flag configurations
 * Maps kebab-case flag names to their camelCase globalFlags definitions
 */
export const deployFlagConfigs = {
  'dedupe-cache-max-entries': globalFlags.dedupeCacheMaxEntries,
  'deploy-file': globalFlags.deployFile,
  'deploy-folder': globalFlags.deployFolder,
  'hyperbeam-ao-state-url': globalFlags.hyperbeamAoStateUrl,
  'hyperbeam-auto-fund': globalFlags.hyperbeamAutoFund,
  'hyperbeam-fund-amount': globalFlags.hyperbeamFundAmount,
  'hyperbeam-ledger-id': globalFlags.hyperbeamLedgerId,
  'hyperbeam-token-id': globalFlags.hyperbeamTokenId,
  'hyperbeam-upload-path': globalFlags.hyperbeamUploadPath,
  name: globalFlags.name,
  'names-gateway': globalFlags.namesGateway,
  'names-graphql': globalFlags.namesGraphql,
  'names-namespace': globalFlags.namesNamespace,
  'names-node': globalFlags.namesNode,
  'no-dedupe': globalFlags.noDedupe,
  permagit: globalFlags.permagit,
  'permagit-ref': globalFlags.permagitRef,
  'private-key': globalFlags.privateKey,
  'reference-id': globalFlags.referenceId,
  'sig-type': globalFlags.sigType,
  uploader: globalFlags.uploader,
  'uploader-type': globalFlags.uploaderType,
  'use-names': globalFlags.useNames,
  wallet: globalFlags.wallet,
} as const

/**
 * Upload command — file/folder to Arweave without updating names
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
  'no-dedupe': globalFlags.noDedupe,
  'private-key': globalFlags.privateKey,
  'sig-type': globalFlags.sigType,
  uploader: globalFlags.uploader,
  'uploader-type': globalFlags.uploaderType,
  wallet: globalFlags.wallet,
} as const

export type UploadConfig = ResolvedConfig<typeof uploadFlagConfigs>
