import { ARIO_MAINNET_PROCESS_ID } from '@ar.io/sdk'
import { Flags } from '@oclif/core'

import { promptArioProcess, promptArnsName } from '../prompts/arns.js'
import { promptDeployTarget } from '../prompts/deployment.js'
import { promptSignerType } from '../prompts/wallet.js'
import { createFlagConfig } from '../utils/config-resolver.js'
import { TTL_MAX, TTL_MIN } from '../utils/constants.js'
import {
  resolveArioProcess,
  validateArioProcess,
  validateFileExists,
  validateFolderExists,
  validateTtl,
  validateUndername,
} from '../utils/validators.js'

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
  // Advanced payment settings
  maxTokenAmount: createFlagConfig<string | undefined>({
    flag: Flags.string({
      description: 'Maximum token amount for on-demand payment',
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
  'deploy-file': globalFlags.deployFile.flag,
  'deploy-folder': globalFlags.deployFolder.flag,
  'max-token-amount': globalFlags.maxTokenAmount.flag,
  'on-demand': globalFlags.onDemand.flag,
  'private-key': globalFlags.privateKey.flag,
  'sig-type': globalFlags.sigType.flag,
  'ttl-seconds': globalFlags.ttlSeconds.flag,
  undername: globalFlags.undername.flag,
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
  'deploy-file'?: string
  'deploy-folder': string
  'max-token-amount'?: string
  'on-demand'?: string
  'private-key'?: string
  'sig-type': string
  'ttl-seconds': string
  undername: string
  wallet?: string
}

/**
 * Deploy command flag configurations
 * Maps kebab-case flag names to their camelCase globalFlags definitions
 */
export const deployFlagConfigs = {
  'ario-process': globalFlags.arioProcess,
  'arns-name': globalFlags.arnsName,
  'deploy-file': globalFlags.deployFile,
  'deploy-folder': globalFlags.deployFolder,
  'max-token-amount': globalFlags.maxTokenAmount,
  'on-demand': globalFlags.onDemand,
  'private-key': globalFlags.privateKey,
  'sig-type': globalFlags.sigType,
  'ttl-seconds': globalFlags.ttlSeconds,
  undername: globalFlags.undername,
  wallet: globalFlags.wallet,
} as const
