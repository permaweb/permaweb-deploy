import { createHash } from 'node:crypto'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { Readable } from 'node:stream'

import { createDataItemSigner, message as aoMessage } from '@permaweb/aoconnect'
import {
  AoTokenTransferAdapter,
  DEFAULT_AO_TOKEN_ID,
  discoverHyperbeamAoBundlerProfile,
  type FundingResult,
  HyperbalanceClient,
  type HyperbalanceProfile,
  HYPERBEAM_DEFAULT_LEDGER_ID,
  HYPERBEAM_DEFAULT_LEDGER_ROUTE,
  waitForAoAssignmentSlot,
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
  uploadFile: (args: UploadFileArgs) => Promise<UploadClientResult>
}

export interface UploadClientResult {
  cost?: UploadCost
  id?: string
  size?: UploadSize
}

export interface UploadCost {
  amount: bigint
  token: 'AO'
}

export interface UploadSize {
  payloadBytes: number
  signedBytes?: number
}

const AO_BASE_UNITS = 1_000_000_000_000n

export interface HyperbeamBundlerOptions {
  autoFund?: HyperbeamBundlerAutoFundOptions
  deployKey: string
  quote?: HyperbeamBundlerQuoteOptions
  uploadPath: string
  uploader: string
}

export interface HyperbeamAutoFundOptions {
  aoPollMs?: number
  aoStateUrl?: string
  aoTimeoutMs?: number
  deployKey: string
  ledgerId?: string
  minimumBalance: bigint
  tokenId?: string
  uploader: string
}

export interface HyperbeamBundlerAutoFundOptions {
  aoPollMs?: number
  aoStateUrl?: string
  aoTimeoutMs?: number
  deployKey: string
  ledgerId?: string
  minimumBalance?: bigint
  quoteAction?: string
  tokenId?: string
  uploader: string
}

export interface HyperbeamBundlerQuoteOptions {
  ledgerId?: string
  quoteAction?: string
  tokenId?: string
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

function arweaveAddressFromJwk(jwk: Record<string, unknown>): string {
  if (typeof jwk.n !== 'string') {
    throw new TypeError('Arweave JWK is missing modulus field "n"')
  }

  return createHash('sha256').update(Buffer.from(jwk.n, 'base64url')).digest('base64url')
}

export function parseHyperbeamFundAmount(value: string): bigint {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error('--hyperbeam-fund-amount must be a positive integer in token base units')
  }

  return BigInt(value)
}

function formatAoAmount(amount: bigint): string {
  const whole = amount / AO_BASE_UNITS
  const fraction = amount % AO_BASE_UNITS

  if (fraction === 0n) {
    return `${whole.toString()} AO`
  }

  return `${whole.toString()}.${fraction.toString().padStart(12, '0').replaceAll(/0+$/g, '')} AO`
}

export async function autoFundHyperbeamLedger(
  options: HyperbeamAutoFundOptions,
): Promise<FundingResult> {
  const profile = await discoverHyperbeamAoBundlerProfile({
    ledgerId: options.ledgerId,
    nodeUrl: options.uploader,
    tokenId: options.tokenId,
  })

  return ensureHyperbeamCredit(options, profile)
}

async function ensureHyperbeamCredit(
  options: HyperbeamAutoFundOptions,
  profile: HyperbalanceProfile,
): Promise<FundingResult> {
  const jwk = JSON.parse(Buffer.from(options.deployKey, 'base64').toString('utf8')) as Record<
    string,
    unknown
  >
  const recipient = arweaveAddressFromJwk(jwk)
  const signer = createDataItemSigner(jwk)
  const client = new HyperbalanceClient({ nodeUrl: options.uploader })
  const adapter = new AoTokenTransferAdapter({
    async inferSender() {
      return recipient
    },
    async message(input) {
      return aoMessage({
        data: input.data ?? '',
        process: input.process,
        signer,
        tags: input.tags,
      })
    },
    async waitForAssignmentSlot(messageId, context) {
      return waitForAoAssignmentSlot({
        messageId,
        pollMs: options.aoPollMs,
        processId: context.processId,
        stateUrl: options.aoStateUrl,
        timeoutMs: options.aoTimeoutMs,
      })
    },
  })

  return client.ensureCreditAuto({
    ledgerId: options.ledgerId,
    minimumBalance: options.minimumBalance,
    profile,
    recipient,
    tokenId: options.tokenId ?? DEFAULT_AO_TOKEN_ID,
    transferAdapter: adapter,
  })
}

export async function autoFundQuotedHyperbeamLedger(
  options: { signedBytes: number } & HyperbeamBundlerAutoFundOptions,
): Promise<FundingResult> {
  const profile = await discoverHyperbeamAoBundlerProfile({
    ledgerId: options.ledgerId,
    nodeUrl: options.uploader,
    tokenId: options.tokenId,
  })
  const client = new HyperbalanceClient({ nodeUrl: options.uploader })
  let { ledgerId } = options
  let { minimumBalance } = options
  let { tokenId } = options

  if (minimumBalance === undefined) {
    const quote = await client.quoteAuto({
      action: options.quoteAction ?? 'hyperbeam-upload',
      params: { bytes: options.signedBytes },
      profile,
    })
    minimumBalance = quote.amount
    ledgerId ??= quote.ledgerId
    tokenId ??= quote.tokenId
  }

  return ensureHyperbeamCredit(
    {
      aoPollMs: options.aoPollMs,
      aoStateUrl: options.aoStateUrl,
      aoTimeoutMs: options.aoTimeoutMs,
      deployKey: options.deployKey,
      ledgerId,
      minimumBalance,
      tokenId,
      uploader: options.uploader,
    },
    profile,
  )
}

export async function quoteHyperbeamUpload(
  options: { signedBytes: number } & HyperbeamBundlerQuoteOptions,
): Promise<{ amount: bigint; ledgerId?: string; tokenId?: string }> {
  const profile = await discoverHyperbeamAoBundlerProfile({
    ledgerId: options.ledgerId,
    nodeUrl: options.uploader,
    tokenId: options.tokenId,
  })
  const quote = await new HyperbalanceClient({ nodeUrl: options.uploader }).quoteAuto({
    action: options.quoteAction ?? 'hyperbeam-upload',
    params: { bytes: options.signedBytes },
    profile,
  })

  return { amount: quote.amount, ledgerId: quote.ledgerId, tokenId: quote.tokenId }
}

export function hyperbeamBundlerLink(uploader: string, id: string, isManifest = false): string {
  const normalizedBase = uploader.endsWith('/') ? uploader : `${uploader}/`
  return new URL(`${encodeURIComponent(id)}${isManifest ? '/' : ''}`, normalizedBase).toString()
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

function cleanAutoFundErrorMessage(message: string): string {
  const jsonStart = message.indexOf('{')
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(message.slice(jsonStart)) as { error?: string }
      if (parsed.error) {
        return parsed.error.replace(/^Error:\s*/, '')
      }
    } catch {
      // Keep the original error below if the body is not JSON.
    }
  }

  return message
}

function autoFundFailureNote(message: string): string {
  if (/rate limit exceeded/i.test(message)) {
    return 'AO token transfer was rate limited. Check that the wallet has enough spendable AO before retrying auto-fund.'
  }

  return 'Check the wallet or node ledger before retrying auto-fund; the AO transfer may already have been submitted.'
}

export class HyperbeamBundlerClient implements UploadClient {
  private readonly autoFund?: HyperbeamBundlerAutoFundOptions
  private readonly quote: HyperbeamBundlerQuoteOptions
  private readonly signer: unknown
  private readonly uploader: string
  private readonly uploadUrl: string

  constructor({ autoFund, deployKey, quote, uploadPath, uploader }: HyperbeamBundlerOptions) {
    const jwk = JSON.parse(Buffer.from(deployKey, 'base64').toString('utf8')) as Record<
      string,
      unknown
    >
    this.autoFund = autoFund
    this.quote = quote ?? { uploader }
    this.signer = new ArweaveSigner(jwk)
    this.uploader = uploader
    this.uploadUrl = normalizeUploadUrl(uploader, uploadPath)
  }

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
    let cost: UploadCost | undefined

    if (this.autoFund) {
      const quote = await quoteHyperbeamUpload({ ...this.quote, signedBytes: raw.length })
      cost = { amount: quote.amount, token: 'AO' }
      try {
        await autoFundQuotedHyperbeamLedger({
          ...this.autoFund,
          ledgerId: this.autoFund.ledgerId ?? quote.ledgerId,
          minimumBalance: this.autoFund.minimumBalance ?? quote.amount,
          signedBytes: raw.length,
          tokenId: this.autoFund.tokenId ?? quote.tokenId,
        })
      } catch (error) {
        const message = cleanAutoFundErrorMessage(
          error instanceof Error ? error.message : String(error),
        )
        throw new Error(
          [
            `HyperBEAM auto-fund failed: ${message}`,
            `Required upload credit: ${formatAoAmount(cost.amount)}`,
            autoFundFailureNote(message),
            await this.paymentHint(false),
          ]
            .filter(Boolean)
            .join('\n\n'),
        )
      }
    } else {
      try {
        const quote = await quoteHyperbeamUpload({ ...this.quote, signedBytes: raw.length })
        cost = { amount: quote.amount, token: 'AO' }
      } catch {
        cost = undefined
      }
    }

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

    return { cost, id: responseId(res.headers, body) || localId, size }
  }

  private async paymentHint(includeAutoFundInstruction = true): Promise<string | undefined> {
    try {
      return hyperbeamAoFundingHint(
        await discoverHyperbeamAoBundlerProfile({ nodeUrl: this.uploader }),
        { includeAutoFundInstruction },
      )
    } catch {
      try {
        const operator = await fetch(
          `${this.uploader.replace(/\/+$/, '')}/~meta@1.0/info/address`,
        ).then((res) => (res.ok ? res.text() : undefined))
        if (!operator?.trim()) return undefined

        return [
          'The HyperBEAM node requires AO in its local ledger:',
          `- AO: send funds to ${operator.trim()}. Local ledger: ${HYPERBEAM_DEFAULT_LEDGER_ID} at ${HYPERBEAM_DEFAULT_LEDGER_ROUTE}.`,
          includeAutoFundInstruction
            ? 'Use --hyperbeam-auto-fund to transfer AO and import the credit automatically before upload.'
            : undefined,
        ]
          .filter(Boolean)
          .join('\n')
      } catch {
        return undefined
      }
    }
  }
}

export function hyperbeamAoFundingHint(
  profile: HyperbalanceProfile,
  options: { includeAutoFundInstruction?: boolean } = {},
): string | undefined {
  const lines = profile.tokens
    .map((token) => {
      const depositAddress = token.depositAddress ?? profile.node?.operator
      if (!depositAddress) return

      const label =
        token.ticker === 'AO' ? 'AO' : token.ticker ? `${token.ticker} (${token.id})` : token.id
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
    'The HyperBEAM node requires AO in its local ledger:',
    ...lines,
    options.includeAutoFundInstruction === false
      ? undefined
      : 'Use --hyperbeam-auto-fund to transfer AO and import the credit automatically before upload.',
  ]
    .filter(Boolean)
    .join('\n')
}
