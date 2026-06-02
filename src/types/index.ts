import type { Flag } from '@oclif/core/lib/interfaces'

export type SignerType = 'arweave' | 'ethereum' | 'kyve' | 'polygon'

export interface DeployOptions {
  'deploy-file': string
  'deploy-folder': string
  name?: string
  'names-bundler': string
  'names-gateway': string
  'names-graphql'?: string
  'names-namespace'?: string
  'private-key': string
  'reference-id'?: string
  'sig-type': SignerType
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

export interface NamesReference {
  name?: string
  namespace: string
  referenceId: string
}
