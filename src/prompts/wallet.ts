import { input, select } from '@inquirer/prompts'

import { validateFileExists } from '../utils/validators.js'

export interface WalletConfig {
  method: 'env' | 'file' | 'string'
  privateKey?: string
  wallet?: string
}

export async function promptWalletMethod(): Promise<string> {
  return select({
    choices: [
      { name: 'Wallet file path', value: 'file' },
      { name: 'Private key/JWK string', value: 'string' },
      { name: 'Environment variable (DEPLOY_KEY)', value: 'env' },
    ],
    message: 'How do you want to provide your wallet?',
  })
}

export async function promptWalletFile(): Promise<string> {
  return input({
    default: './wallet.json',
    message: 'Enter wallet file path:',
    validate: validateFileExists,
  })
}

export async function promptPrivateKey(): Promise<string> {
  return input({
    message: 'Enter your private key or JWK JSON:',
    required: true,
  })
}

export async function promptSignerType(): Promise<string> {
  return select({
    choices: [
      { name: 'Arweave', value: 'arweave' },
      { name: 'Ethereum', value: 'ethereum' },
      { name: 'Polygon', value: 'polygon' },
      { name: 'KYVE', value: 'kyve' },
    ],
    default: 'arweave',
    message: 'Select signer type:',
  })
}

export async function getWalletConfig(): Promise<WalletConfig> {
  const method = (await promptWalletMethod()) as 'env' | 'file' | 'string'

  const config: WalletConfig = { method }

  if (method === 'file') {
    config.wallet = await promptWalletFile()
  } else if (method === 'string') {
    config.privateKey = await promptPrivateKey()
  }

  return config
}
