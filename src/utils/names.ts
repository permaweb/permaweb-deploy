import { PHASE2_NAMESPACE, ReferenceClient, type Signer } from '@permaweb/references'
import Arweave from 'arweave'

import type { SignerType } from '../types/index.js'

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

export function createNamesJwkSigner(sigType: SignerType, deployKey: string): Signer {
  if (sigType !== 'arweave') {
    throw new Error('Names updates currently require --sig-type arweave')
  }

  const jwk = JSON.parse(Buffer.from(deployKey, 'base64').toString('utf8'))
  const arweave = Arweave.init({ host: 'arweave.net', port: 443, protocol: 'https' })

  return {
    async address() {
      return arweave.wallets.jwkToAddress(jwk)
    },
    async send({ data, tags }) {
      const tx = await arweave.createTransaction(
        { data: data && data.length > 0 ? data : ' ' },
        jwk,
      )
      for (const tag of tags ?? []) {
        tx.addTag(tag.name, tag.value)
      }

      await arweave.transactions.sign(tx, jwk)
      const response = await arweave.transactions.post(tx)
      if (![200, 202].includes(response.status)) {
        throw new Error(
          `Reference update post failed with status ${response.status}: ${response.statusText}`,
        )
      }

      return { id: tx.id }
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
