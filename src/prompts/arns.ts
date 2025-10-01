import { ARIO_MAINNET_PROCESS_ID, ARIO_TESTNET_PROCESS_ID } from '@ar.io/sdk'
import { confirm, input, select } from '@inquirer/prompts'

import { validateArioProcess, validateArnsName, validateTtl } from '../utils/validators.js'

export interface AdvancedOptions {
  arioProcess: string
  ttlSeconds: string
  undername: string
}

export async function promptArnsName(): Promise<string> {
  return input({
    message: 'Enter your ArNS name:',
    required: true,
    validate: validateArnsName,
  })
}

export async function promptUndername(): Promise<string> {
  return input({
    default: '@',
    message: 'Enter undername (subdomain):',
  })
}

export async function promptTtl(): Promise<string> {
  return input({
    default: '60',
    message: 'Enter TTL in seconds:',
    validate: validateTtl,
  })
}

export async function promptArioProcess(): Promise<string> {
  const networkChoice = await select({
    choices: [
      { name: 'Mainnet', value: 'mainnet' },
      { name: 'Testnet', value: 'testnet' },
      { name: 'Custom Process ID', value: 'custom' },
    ],
    default: 'mainnet',
    message: 'Select ARIO network:',
  })

  if (networkChoice === 'custom') {
    return input({
      message: 'Enter ARIO process ID:',
      validate: validateArioProcess,
    })
  }

  return networkChoice === 'mainnet' ? ARIO_MAINNET_PROCESS_ID : ARIO_TESTNET_PROCESS_ID
}

export async function promptAdvancedOptions(): Promise<AdvancedOptions | null> {
  const wantsAdvanced = await confirm({
    default: false,
    message: 'Configure advanced options?',
  })

  if (!wantsAdvanced) {
    return null
  }

  const undername = await promptUndername()
  const ttlSeconds = await promptTtl()
  const arioProcess = await promptArioProcess()

  return {
    arioProcess,
    ttlSeconds,
    undername,
  }
}
