import fs from 'node:fs'
import { createRequire } from 'node:module'
import { Readable } from 'node:stream'

import type { SignerType } from '../types/index.js'
import type {
  UploadClient,
  UploadClientResult,
  UploadFileArgs,
  UploadSize,
} from './hyperbeam-uploader.js'
import { createSigner } from './signer.js'

const require = createRequire(import.meta.url)
const { DataItem, createData } = require('@dha-team/arbundles') as {
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

export interface LegacyBundlerClientOptions {
  deployKey: string
  sigType: SignerType
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

function legacyUploadUrl(base: string, token: string): string {
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  return new URL(`v1/tx/${token}`, normalizedBase).toString()
}

function responsePreview(body: string): string | undefined {
  const preview = body.replaceAll(/\s+/g, ' ').trim()
  if (!preview) {
    return undefined
  }

  return preview.slice(0, 300)
}

/**
 * Legacy ANS-104 upload client.
 *
 * @remarks This signs the data item locally with arbundles and posts the raw
 * bytes to legacy upload endpoints such as up.arweave.net.
 */
export class LegacyBundlerClient implements UploadClient {
  private readonly signer: unknown
  private readonly token: string
  private readonly uploadUrl: string

  constructor({ deployKey, sigType, uploader }: LegacyBundlerClientOptions) {
    const { signer, token } = createSigner(sigType, deployKey)
    this.signer = signer
    this.token = token
    this.uploadUrl = legacyUploadUrl(uploader, token)
  }

  /**
   * Sign and post one ANS-104 data item.
   *
   * @param args - Upload payload and data item tags.
   * @returns The upload response with the data item ID.
   */
  async uploadFile(args: UploadFileArgs): Promise<{ id: string } & UploadClientResult> {
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
    const size: UploadSize = { payloadBytes: data.length, signedBytes: raw.length }
    const response = await fetch(this.uploadUrl, {
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
        `Legacy bundler upload failed with HTTP ${response.status}${preview ? `: ${preview}` : ''}`,
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

    return { id: id ?? localId, size }
  }
}
