import fs from 'node:fs'
import { createRequire } from 'node:module'
import { Readable } from 'node:stream'

import {
  discoverPaymentProfile,
  type HyperbalanceProfile,
  MissingDiscoveryError,
} from 'hyperbalance'

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

export interface UploadFileArgs {
  dataItemOpts?: { tags?: Array<{ name: string; value: string }> }
  file?: string | Buffer
  fileSizeFactory?: () => number
  fileStreamFactory?: () => unknown
  fundingMode?: unknown
}

export interface UploadClient {
  uploadFile: (args: UploadFileArgs) => Promise<{ id?: string }>
}

export interface HyperbeamBundlerOptions {
  deployKey: string
  uploadPath: string
  uploader: string
}

async function readableToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = []

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  return Buffer.concat(chunks)
}

async function streamToBuffer(stream: unknown): Promise<Buffer> {
  if (Buffer.isBuffer(stream)) {
    return stream
  }

  if (stream instanceof Uint8Array) {
    return Buffer.from(stream)
  }

  if (stream instanceof Readable) {
    return readableToBuffer(stream)
  }

  if (stream && typeof (stream as { getReader?: unknown }).getReader === 'function') {
    return readableToBuffer(Readable.fromWeb(stream as ReadableStream))
  }

  throw new Error('Unsupported upload stream type')
}

function toBase64Url(value: string | Uint8Array): string {
  if (typeof value === 'string') {
    return value
  }

  return Buffer.from(value).toString('base64url')
}

function normalizeUploadUrl(base: string, uploadPath: string): string {
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  const cleanPath = uploadPath.startsWith('/') ? uploadPath.slice(1) : uploadPath
  return new URL(cleanPath, normalizedBase).toString()
}

export function hyperbeamBundlerLink(uploader: string, id: string): string {
  const normalizedBase = uploader.endsWith('/') ? uploader : `${uploader}/`
  return new URL(`~arweave@2.9/raw=${encodeURIComponent(id)}`, normalizedBase).toString()
}

function responseId(headers: Headers, body: string): string | undefined {
  const headerId = headers.get('id')
  if (headerId) {
    return headerId
  }

  try {
    const parsed = JSON.parse(body) as { body?: { id?: string }; id?: string }
    return parsed.id || parsed.body?.id
  } catch {
    return undefined
  }
}

export class HyperbeamBundlerClient implements UploadClient {
  private readonly signer: unknown
  private readonly uploader: string
  private readonly uploadUrl: string

  constructor({ deployKey, uploadPath, uploader }: HyperbeamBundlerOptions) {
    const jwk = JSON.parse(Buffer.from(deployKey, 'base64').toString('utf8')) as Record<
      string,
      unknown
    >
    this.signer = new ArweaveSigner(jwk)
    this.uploader = uploader
    this.uploadUrl = normalizeUploadUrl(uploader, uploadPath)
  }

  async uploadFile(args: UploadFileArgs): Promise<{ id: string }> {
    const data = args.file
      ? typeof args.file === 'string'
        ? fs.readFileSync(args.file)
        : args.file
      : await streamToBuffer(args.fileStreamFactory?.() ?? Readable.from([]))
    const tags = args.dataItemOpts?.tags ?? []
    const item = createData(data, this.signer, { tags })

    await item.sign(this.signer)

    const raw = Buffer.from(item.getRaw())
    const localId = item.id || toBase64Url(new DataItem(raw).id)
    const res = await fetch(this.uploadUrl, {
      body: raw,
      headers: {
        accept: 'application/json, text/plain, */*',
        'content-type': 'application/octet-stream',
      },
      method: 'POST',
    })
    const body = await res.text()

    if (!res.ok) {
      const preview = body.replaceAll(/\s+/g, ' ').trim().slice(0, 300)
      const paymentHint = res.status === 402 ? await this.paymentHint() : undefined
      throw new Error(
        [
          `HyperBEAM bundler upload failed with HTTP ${res.status}${preview ? `: ${preview}` : ''}`,
          paymentHint,
        ]
          .filter(Boolean)
          .join('\n\n'),
      )
    }

    return { id: responseId(res.headers, body) || localId }
  }

  private async paymentHint(): Promise<string | undefined> {
    try {
      return hyperbalanceFundingHint(await discoverPaymentProfile(this.uploader))
    } catch (error) {
      if (error instanceof MissingDiscoveryError) {
        return undefined
      }

      return undefined
    }
  }
}

export function hyperbalanceFundingHint(profile: HyperbalanceProfile): string | undefined {
  const lines = profile.tokens
    .map((token) => {
      const depositAddress = token.depositAddress ?? profile.node?.operator
      if (!depositAddress) return

      const label = token.ticker ? `${token.ticker} (${token.id})` : token.id
      const ledger = token.ledgerId
        ? profile.ledgers.find((candidate) => candidate.id === token.ledgerId)
        : undefined
      const ledgerInfo = ledger
        ? ` Local ledger: ${ledger.id}${ledger.route ? ` at ${ledger.route}` : ''}.`
        : ''

      return `- ${label}: send funds to ${depositAddress}.${ledgerInfo}`
    })
    .filter(Boolean)

  if (lines.length === 0) return undefined

  return [
    'The HyperBEAM node advertised hyperbalance funding metadata:',
    ...lines,
    'Set the local ledger recipient to the uploader wallet address when the token flow supports it.',
  ].join('\n')
}
