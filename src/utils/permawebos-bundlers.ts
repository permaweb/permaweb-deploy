export const DEFAULT_PERMAWEBOS_BUNDLER_GATEWAY = 'https://push-9.forward.computer'
export const DEFAULT_PERMAWEBOS_BUNDLER_STAKING_PROCESS =
  'Xv7dvev8_dJVwW7k_VGGdHpRqWpgSCgK4vzJmnBkg5M'
const EXCLUDED_PERMAWEBOS_BUNDLER_URLS = new Set(['https://dev-1.forward.computer'])

export interface ActivePermawebOSBundler {
  address: string
  owner: string
  registeredAt?: number
  ring: string
  stake?: string
  stakedAt?: number
  url: string
}

export interface FetchActivePermawebOSBundlersOptions {
  fetch?: FetchLike
  gateway?: string
  processId?: string
  ring?: string
}

type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string>; method?: string },
) => Promise<{
  ok: boolean
  status: number
  text: () => Promise<string>
}>

type ActiveRecord = {
  'lapee-address'?: unknown
  lapee_address?: unknown
  lapeeAddress?: unknown
  ring?: unknown
  stake?: unknown
  staked_at?: unknown
}

type RegisteredRecord = {
  location?: unknown
  owner?: unknown
  registered_at?: unknown
}

export async function fetchActivePermawebOSBundlers(
  options: FetchActivePermawebOSBundlersOptions = {},
): Promise<ActivePermawebOSBundler[]> {
  const fetchImpl = options.fetch ?? fetch
  const [active, registered] = await Promise.all([
    fetchPermawebOSBundlerStateMap('active', options, fetchImpl),
    fetchPermawebOSBundlerStateMap('registered', options, fetchImpl),
  ])

  return Object.entries(active)
    .flatMap(([owner, record]) => {
      if (isAoMetadataKey(owner) || !isRecord(record)) return []

      const activeRecord = record as ActiveRecord
      const ring = normalizeScalar(activeRecord.ring)
      if (!ring || (options.ring && ring !== options.ring)) return []

      const address = getBundlerAddress(activeRecord)
      if (!address) return []

      const registeredRecord = isRecord(registered[address])
        ? (registered[address] as RegisteredRecord)
        : undefined
      const url = normalizeBundlerUrl(normalizeScalar(registeredRecord?.location))
      if (!url || isExcludedBundlerUrl(url)) return []

      return [
        {
          address,
          owner,
          registeredAt: normalizeTimestamp(registeredRecord?.registered_at),
          ring,
          stake: normalizeScalar(activeRecord.stake) || undefined,
          stakedAt: normalizeTimestamp(activeRecord.staked_at),
          url,
        },
      ]
    })
    .sort((a, b) => a.ring.localeCompare(b.ring) || a.url.localeCompare(b.url))
}

async function fetchPermawebOSBundlerStateMap(
  path: string,
  options: FetchActivePermawebOSBundlersOptions,
  fetchImpl: FetchLike,
): Promise<Record<string, unknown>> {
  const value = await fetchPermawebOSBundlerStateValue(path, options, fetchImpl)
  return isRecord(value) ? stripAoMetadata(value) : {}
}

async function fetchPermawebOSBundlerStateValue(
  path: string,
  options: FetchActivePermawebOSBundlersOptions,
  fetchImpl: FetchLike,
): Promise<unknown> {
  const response = await fetchImpl(permawebOSBundlerComputeUrl(path, options), {
    headers: {
      accept: 'text/plain, application/json, */*',
      'accept-bundle': 'true',
    },
    method: 'GET',
  })
  const text = await response.text()

  if (!response.ok) {
    throw new Error(`PermawebOS Bundler state fetch failed with HTTP ${response.status}: ${path}`)
  }

  if (normalizeNotFound(text)) return null

  const parsed = parseJson(text)
  if (parsed === null) return text.trim()
  if (!isRecord(parsed)) return parsed

  if (parsed.body === 'not_found' || parsed.status === 404) return null
  if (Object.hasOwn(parsed, 'body')) {
    const { body } = parsed
    if (body === 'not_found') return null
    if (typeof body === 'string') {
      return parseJson(body) ?? body
    }

    return body
  }

  return stripAoMetadata(parsed)
}

function permawebOSBundlerComputeUrl(
  path: string,
  options: FetchActivePermawebOSBundlersOptions,
): string {
  const gateway = (options.gateway ?? DEFAULT_PERMAWEBOS_BUNDLER_GATEWAY).replace(/\/+$/, '')
  const processId = options.processId ?? DEFAULT_PERMAWEBOS_BUNDLER_STAKING_PROCESS
  return `${gateway}/${processId}/compute/${path}?require-codec=application/json&accept-bundle=true`
}

function getBundlerAddress(record: ActiveRecord): string {
  return normalizeScalar(record.lapee_address ?? record.lapeeAddress ?? record['lapee-address'])
}

function normalizeBundlerUrl(value: string): string {
  if (!/^https?:\/\//i.test(value)) return ''
  return value.replace(/\/+$/, '')
}

function isExcludedBundlerUrl(url: string): boolean {
  return EXCLUDED_PERMAWEBOS_BUNDLER_URLS.has(url.toLowerCase())
}

function normalizeScalar(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function normalizeTimestamp(value: unknown): number | undefined {
  const timestamp = Number(value)
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : undefined
}

function stripAoMetadata(value: Record<string, unknown>): Record<string, unknown> {
  const stripped: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (!isAoMetadataKey(key)) stripped[key] = entry
  }

  return stripped
}

function isAoMetadataKey(key: string): boolean {
  return ['ao-result', 'ao-types', 'commitments', 'status'].includes(key) || key.endsWith('+link')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function parseJson(text: string): unknown | null {
  const trimmed = text.trim()
  if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) return null

  try {
    return JSON.parse(trimmed)
  } catch {
    return null
  }
}

function normalizeNotFound(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed || trimmed === 'not_found') return true
  if (trimmed.includes('<title>404 - Page not found.</title>')) return true

  const parsed = parseJson(trimmed)
  return isRecord(parsed) && (parsed.status === 404 || parsed.body === 'not_found')
}
