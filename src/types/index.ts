import type { Flag } from '@oclif/core/lib/interfaces'

export type SignerType = 'arweave' | 'ethereum' | 'kyve' | 'polygon'

export interface DeployOptions {
  'ario-process': string
  'arns-name': string
  'deploy-file': string
  'deploy-folder': string
  'private-key': string
  'sig-type': SignerType
  'ttl-seconds': string
  undername: string
  wallet: string
}

export type DeployFlags = Partial<Record<keyof DeployOptions, Flag<string>>>

export interface UploadResult {
  id: string
  manifest?: {
    paths: Record<string, { id: string }>
  }
  manifestResponse?: {
    id: string
  }
}

export interface ArnsRecord {
  processId: string
  type: string
  undernames?: string[]
}
