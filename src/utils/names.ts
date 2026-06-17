import { createRequire } from 'node:module'

import { PHASE2_NAMESPACE, ReferenceClient, type Signer } from '@permaweb/references'
import Arweave from 'arweave'

import type { SignerType } from '../types/index.js'

const require = createRequire(import.meta.url)
const { ArweaveSigner, DataItem, createData } = require('@dha-team/arbundles') as {
  ArweaveSigner: new (jwk: Record<string, unknown>) => unknown
  DataItem: new (raw: Buffer) => { id: string | Uint8Array }
  createData: (
    data: Buffer,
    signer: unknown,
    opts?: { tags?: Array<{ name: string; value: string }> },
  ) => {
    getRaw: () => Uint8Array
    id?: string
    sign: (signer: unknown) => Promise<void>
  }
}

const DEFAULT_NAMES_BUNDLER = 'https://up.arweave.net'

export interface NamesPublishConfig {
  deployKey: string
  gateway: string
  graphql?: string
  name?: string
  namespace?: string
  referenceId?: string
  sigType: SignerType
  value: string
}

type NamesClientConfig = Omit<NamesPublishConfig, 'value'>

export interface NamesReferenceTarget {
  name?: string
  namespace: string
  referenceId: string
}

export interface NamesPublishResult {
  name?: string
  namespace: string
  referenceId: string
  updateId: string
}

function toBase64Url(value: string | Uint8Array): string {
  if (typeof value === 'string') {
    return value
  }

  return Buffer.from(value).toString('base64url')
}

function namesBundlerTxUrl(bundler = DEFAULT_NAMES_BUNDLER): string {
  const normalized = bundler.replace(/\/+$/, '')
  return normalized.endsWith('/tx') ? normalized : `${normalized}/tx`
}

function responsePreview(body: string): string | undefined {
  const preview = body.replaceAll(/\s+/g, ' ').trim()
  if (!preview) {
    return undefined
  }

  return preview.slice(0, 300)
}

function omitSetDeviceTag(tags: Array<{ name: string; value: string }>): Array<{
  name: string
  value: string
}> {
  const isSet = tags.some((tag) => tag.name === 'reference-id')
  if (!isSet) {
    return tags
  }

  return tags.filter((tag) => !(tag.name === 'device' && tag.value === 'reference@1.0'))
}

export function createNamesJwkSigner(sigType: SignerType, deployKey: string): Signer {
  if (sigType !== 'arweave') {
    throw new Error('Names updates currently require --sig-type arweave')
  }

  const jwk = JSON.parse(Buffer.from(deployKey, 'base64').toString('utf8'))
  const arweave = Arweave.init({ host: 'arweave.net', port: 443, protocol: 'https' })
  const signer = new ArweaveSigner(jwk)

  return {
    async address() {
      return arweave.wallets.jwkToAddress(jwk)
    },
    async send({ data, tags }, opts = {}) {
      const payload = Buffer.from(data && data.length > 0 ? data : ' ')
      const item = createData(payload, signer, { tags: omitSetDeviceTag(tags ?? []) })
      await item.sign(signer)

      const raw = Buffer.from(item.getRaw())
      const localId = item.id || toBase64Url(new DataItem(raw).id)
      const fetchImpl = opts.fetch ?? fetch
      const response = await fetchImpl(namesBundlerTxUrl(opts.bundler), {
        body: raw,
        headers: {
          'content-length': String(raw.length),
          'content-type': 'application/octet-stream',
        },
        method: 'POST',
      })
      const body = await response.text()

      if (!response.ok) {
        const preview = responsePreview(body)
        throw new Error(
          `Reference update bundler upload failed with HTTP ${response.status}${preview ? `: ${preview}` : ''}`,
        )
      }

      let id: string | undefined
      if (body) {
        try {
          const parsed = JSON.parse(body) as { id?: unknown }
          id = typeof parsed.id === 'string' ? parsed.id : undefined
        } catch {
          id = undefined
        }
      }

      return { id: id ?? localId }
    },
  }
}

export async function resolveNamesReferenceId(args: {
  client: ReferenceClient
  name?: string
  namespace: string
  referenceId?: string
  signer: Signer
}): Promise<{ name?: string; referenceId: string }> {
  if (args.referenceId) {
    return { name: args.name, referenceId: args.referenceId }
  }

  if (!args.name) {
    throw new Error('Names update requires --name or --reference-id')
  }

  const signerAddress = await args.signer.address()
  const references = await args.client.findReferences(signerAddress)
  const reference = references.find((item) => item.name === args.name)

  if (!reference) {
    throw new Error(
      `Name [${args.name}] is not controlled by signer in namespace ${args.namespace}`,
    )
  }

  return { name: args.name, referenceId: reference.referenceId }
}

function createNamesContext(config: NamesClientConfig): {
  client: ReferenceClient
  namespace: string
  signer: Signer
} {
  const namespace = config.namespace ?? PHASE2_NAMESPACE
  const signer = createNamesJwkSigner(config.sigType, config.deployKey)
  const client = new ReferenceClient({
    gateway: config.gateway,
    graphql: config.graphql,
    namespace,
    signer,
  })

  return { client, namespace, signer }
}

export async function validateNamesTarget(args: {
  client: ReferenceClient
  name?: string
  namespace: string
  referenceId?: string
  signer: Signer
}): Promise<NamesReferenceTarget> {
  const target = await resolveNamesReferenceId({
    client: args.client,
    name: args.name,
    namespace: args.namespace,
    referenceId: args.referenceId,
    signer: args.signer,
  })

  const reference = await args.client.getReference(target.referenceId)
  if (!reference) {
    throw new Error(`reference not found: ${target.referenceId}`)
  }

  const signerAddress = await args.signer.address()
  if (reference.authority !== signerAddress) {
    throw new Error(`signer is not reference authority for ${target.referenceId}`)
  }

  return {
    name: target.name,
    namespace: args.namespace,
    referenceId: target.referenceId,
  }
}

export async function preflightNamesUpdate(
  config: NamesClientConfig,
): Promise<NamesReferenceTarget> {
  const { client, namespace, signer } = createNamesContext(config)
  return validateNamesTarget({
    client,
    name: config.name,
    namespace,
    referenceId: config.referenceId,
    signer,
  })
}

export async function publishNamesUpdate(config: NamesPublishConfig): Promise<NamesPublishResult> {
  const { client, namespace, signer } = createNamesContext(config)
  const target = await resolveNamesReferenceId({
    client,
    name: config.name,
    namespace,
    referenceId: config.referenceId,
    signer,
  })
  const { id: updateId } = await client.updateReference(target.referenceId, { value: config.value })

  return {
    name: target.name,
    namespace,
    referenceId: target.referenceId,
    updateId,
  }
}
