import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'

import { runCommand } from '@oclif/test'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'

import { TEST_ARWEAVE_WALLET, TEST_ETH_PRIVATE_KEY } from '../constants.js'
import { server } from '../setup.js'

const DEFAULT_LEGACY_UPLOADER = 'https://up.arweave.net'
const DEFAULT_PERMAWEBOS_BUNDLER_GATEWAY = 'https://push-9.forward.computer'
const DEFAULT_PERMAWEBOS_BUNDLER_STAKING_PROCESS = 'Xv7dvev8_dJVwW7k_VGGdHpRqWpgSCgK4vzJmnBkg5M'
const lapeeAddressKey = 'lapee_address'
const require = createRequire(import.meta.url)
const { DataItem } = require('@dha-team/arbundles') as {
  DataItem: new (raw: Buffer) => { tags: Array<{ name: string; value: string }> }
}

function base64UrlToBuffer(value: string): Buffer {
  const pad = '='.repeat((4 - (value.length % 4)) % 4)
  return Buffer.from((value + pad).replaceAll('-', '+').replaceAll('_', '/'), 'base64')
}

function walletAddress(jwk: { n: string }): string {
  return createHash('sha256').update(base64UrlToBuffer(jwk.n)).digest('base64url')
}

function dataItemTags(raw: Buffer): Record<string, string> {
  return Object.fromEntries(new DataItem(raw).tags.map((tag) => [tag.name, tag.value]))
}

function mockHyperbeamBundler(baseUrl: string, id = 'mock-hyperbeam-dataitem-id'): void {
  server.use(
    http.get(`${baseUrl}/~meta@1.0/info/address`, () => HttpResponse.text('node-deposit-address')),
    http.get(`${baseUrl}/~meta@1.0/info/ao-payment-deposit-address`, () =>
      HttpResponse.text('node-deposit-address'),
    ),
    http.get(`${baseUrl}/~meta@1.0/info/ao-payment-ledger`, () => HttpResponse.text('default')),
    http.get(`${baseUrl}/~meta@1.0/info/ao-payment-token`, () => HttpResponse.text('default')),
    http.get('https://arweave.net/wallet/node-deposit-address/balance', () =>
      HttpResponse.text('1'),
    ),
    http.post(`${baseUrl}/~arweave-byte-pricing@1.0/preflight`, () =>
      HttpResponse.text('preflight route unavailable', { status: 500 }),
    ),
    http.get(`${baseUrl}/~arweave-byte-pricing@1.0/quote`, () => HttpResponse.text('1000')),
    http.post(
      `${baseUrl}/~bundler@1.0/item`,
      () =>
        new HttpResponse('<html><title>HyperBEAM</title></html>', {
          headers: { id },
          status: 200,
        }),
    ),
  )
}

function mockPermawebOSBundlerState(location = 'https://hyperbeam-a.test/'): {
  activeReads: number
  registeredReads: number
} {
  const reads = { activeReads: 0, registeredReads: 0 }

  server.use(
    http.get(
      `${DEFAULT_PERMAWEBOS_BUNDLER_GATEWAY}/${DEFAULT_PERMAWEBOS_BUNDLER_STAKING_PROCESS}/compute/:statePath`,
      ({ params }) => {
        if (params.statePath === 'active') {
          reads.activeReads += 1
          return HttpResponse.json({
            body: {
              owner1: {
                [lapeeAddressKey]: 'bundler-address-1',
                ring: 'permawebos-v0.1-gold',
                stake: '1000',
              },
            },
          })
        }

        if (params.statePath === 'registered') {
          reads.registeredReads += 1
          return HttpResponse.json({
            body: {
              'bundler-address-1': {
                location,
                owner: 'owner1',
              },
            },
          })
        }

        return HttpResponse.text('not_found', { status: 404 })
      },
    ),
  )

  return reads
}

describe(
  'deploy command',
  () => {
    it('should show deploy help message', async () => {
      const result = await runCommand(['deploy', '--help'])
      expect(result.error).toBeUndefined()
    })

    it('should show upload help message', async () => {
      const result = await runCommand(['upload', '--help'])
      expect(result.error).toBeUndefined()
    })

    it('should deploy without requiring names publishing by default', async () => {
      const result = await runCommand([
        'deploy',
        '--deploy-file',
        './tests/fixtures/test-app/index.html',
        '--wallet',
        './tests/fixtures/test_wallet.json',
        '--no-dedupe',
      ])

      expect(result.error).toBeUndefined()
    })

    it('should deploy and update a names reference by reference id', async () => {
      const authority = walletAddress(TEST_ARWEAVE_WALLET)
      let contentUploads = 0
      let namesBundlerUploads = 0

      server.use(
        http.post('https://arweave.net/graphql', async ({ request }) => {
          const body = (await request.json()) as { query?: string }

          if (body.query?.includes('transaction(id')) {
            return HttpResponse.json({
              data: {
                transaction: {
                  block: { height: 1 },
                  id: 'direct-reference-id',
                  owner: { address: authority },
                  tags: [
                    { name: 'device', value: 'reference@1.0' },
                    { name: 'authority', value: authority },
                    { name: 'reference-value', value: 'old-manifest-id' },
                    { name: 'timestamp', value: '1' },
                  ],
                },
              },
            })
          }

          return HttpResponse.json({
            data: {
              transactions: {
                edges: [],
                pageInfo: { hasNextPage: false },
              },
            },
          })
        }),
        http.get('https://arweave.net/tx_anchor', () =>
          HttpResponse.text('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
        ),
        http.get('https://arweave.net/price/1', () => HttpResponse.text('1')),
        http.post(`${DEFAULT_LEGACY_UPLOADER}/v1/tx/:token`, async ({ request }) => {
          const raw = Buffer.from(await request.arrayBuffer())
          contentUploads += 1
          expect(raw.byteLength).toBeGreaterThan(0)
          return HttpResponse.json({ id: `mock-legacy-upload-${contentUploads}` })
        }),
        http.post(`${DEFAULT_LEGACY_UPLOADER}/tx`, async ({ request }) => {
          namesBundlerUploads += 1
          const raw = Buffer.from(await request.arrayBuffer())
          const tags = Object.fromEntries(
            new DataItem(raw).tags.map((tag) => [tag.name, tag.value]),
          )
          expect(raw.byteLength).toBeGreaterThan(0)
          expect(tags.device).toBeUndefined()
          expect(tags['reference-id']).toBe('direct-reference-id')
          return HttpResponse.json({ id: 'mock-reference-update-id' })
        }),
      )

      const result = await runCommand([
        'deploy',
        '--deploy-file',
        './tests/fixtures/test-app/index.html',
        '--wallet',
        './tests/fixtures/test_wallet.json',
        '--no-dedupe',
        '--use-names',
        '--reference-id',
        'direct-reference-id',
      ])

      expect(result.error).toBeUndefined()
      expect(contentUploads).toBe(1)
      expect(namesBundlerUploads).toBe(1)
    })

    it('should validate names reference authority before uploading content', async () => {
      let namesUploads = 0
      let uploadAttempts = 0

      server.use(
        http.post('https://arweave.net/graphql', async ({ request }) => {
          const body = (await request.json()) as { query?: string }

          if (body.query?.includes('transaction(id')) {
            return HttpResponse.json({
              data: {
                transaction: {
                  block: { height: 1 },
                  id: 'direct-reference-id',
                  owner: { address: 'OTHER' },
                  tags: [
                    { name: 'device', value: 'reference@1.0' },
                    { name: 'authority', value: 'OTHER' },
                    { name: 'reference-value', value: 'old-manifest-id' },
                    { name: 'timestamp', value: '1' },
                  ],
                },
              },
            })
          }

          return HttpResponse.json({
            data: {
              transactions: {
                edges: [],
                pageInfo: { hasNextPage: false },
              },
            },
          })
        }),
        http.post('https://upload.ardrive.io/v1/tx/arweave', async () => {
          uploadAttempts += 1
          return HttpResponse.json({ id: 'unexpected-upload-id' })
        }),
        http.post(`${DEFAULT_LEGACY_UPLOADER}/tx`, async () => {
          namesUploads += 1
          return HttpResponse.json({}, { status: 200 })
        }),
      )

      const result = await runCommand([
        'deploy',
        '--deploy-file',
        './tests/fixtures/test-app/index.html',
        '--wallet',
        './tests/fixtures/test_wallet.json',
        '--no-dedupe',
        '--use-names',
        '--reference-id',
        'direct-reference-id',
      ])

      expect(result.error).toBeDefined()
      expect(result.error?.message).toContain(
        'signer is not reference authority for direct-reference-id',
      )
      expect(uploadAttempts).toBe(0)
      expect(namesUploads).toBe(0)
    })

    it('should reject invalid dedupe-cache-max-entries', async () => {
      const result = await runCommand([
        'deploy',
        '--deploy-folder',
        './tests/fixtures/test-app',
        '--wallet',
        './tests/fixtures/test_wallet.json',
        '--dedupe-cache-max-entries',
        '-1',
      ])

      expect(result.error).toBeDefined()
      expect(result.error?.message).toMatch(/Expected an integer greater than or equal to 0/)
    })

    it('should accept valid dedupe-cache-max-entries', async () => {
      const result = await runCommand([
        'deploy',
        '--deploy-folder',
        './tests/fixtures/test-app',
        '--wallet',
        './tests/fixtures/test_wallet.json',
        '--dedupe-cache-max-entries',
        '50',
      ])

      expect(result.error).toBeUndefined()
    })

    it('should accept --no-dedupe flag', async () => {
      const result = await runCommand([
        'deploy',
        '--deploy-folder',
        './tests/fixtures/test-app',
        '--wallet',
        './tests/fixtures/test_wallet.json',
        '--no-dedupe',
      ])

      expect(result.error).toBeUndefined()
    })

    it('should accept --dedupe-cache-max-entries 0 to disable caching', async () => {
      const result = await runCommand([
        'deploy',
        '--deploy-folder',
        './tests/fixtures/test-app',
        '--wallet',
        './tests/fixtures/test_wallet.json',
        '--dedupe-cache-max-entries',
        '0',
      ])

      expect(result.error).toBeUndefined()
    })

    it('should keep the manifest device tag for legacy folder uploads', async () => {
      const seenTags: Array<Record<string, string>> = []

      server.use(
        http.post(`${DEFAULT_LEGACY_UPLOADER}/v1/tx/:token`, async ({ request }) => {
          const raw = Buffer.from(await request.arrayBuffer())
          seenTags.push(dataItemTags(raw))

          return HttpResponse.json({ id: `mock-legacy-dataitem-id-${seenTags.length}` })
        }),
      )

      const result = await runCommand([
        'deploy',
        '--deploy-folder',
        './tests/fixtures/test-app',
        '--wallet',
        './tests/fixtures/test_wallet.json',
        '--no-dedupe',
      ])

      expect(result.error).toBeUndefined()

      const manifestTags = seenTags.find(
        (tags) => tags['Content-Type'] === 'application/x.arweave-manifest+json',
      )
      expect(manifestTags).toBeDefined()
      expect(manifestTags?.Device).toBe('manifest@1.0')
    })

    describe('hyperbeam uploader', () => {
      beforeEach(() => {
        mockHyperbeamBundler('https://hyperbeam.test')
      })

      it('should list active HyperBEAM uploaders from the dedicated command as JSON', async () => {
        const reads = mockPermawebOSBundlerState()

        const result = await runCommand(['hyperbeam-uploaders', '--json'])

        expect(result.error).toBeUndefined()
        expect(reads.activeReads).toBe(1)
        expect(reads.registeredReads).toBe(1)
      })

      it('should auto-select an active HyperBEAM uploader when no uploader URL is passed', async () => {
        const reads = mockPermawebOSBundlerState('https://hyperbeam.test/')
        const seenUploads: Array<{ contentType: string; size: number }> = []

        server.use(
          http.post('https://hyperbeam.test/~bundler@1.0/item', async ({ request }) => {
            const raw = Buffer.from(await request.arrayBuffer())
            seenUploads.push({
              contentType: request.headers.get('content-type') || '',
              size: raw.length,
            })

            return new HttpResponse('<html><title>HyperBEAM</title></html>', {
              headers: { id: 'mock-auto-selected-hyperbeam-dataitem-id' },
              status: 200,
            })
          }),
        )

        const result = await runCommand([
          'upload',
          '--deploy-file',
          './tests/fixtures/test-app/index.html',
          '--wallet',
          './tests/fixtures/test_wallet.json',
          '--uploader-type',
          'hyperbeam',
          '--no-dedupe',
        ])

        expect(result.error).toBeUndefined()
        expect(reads.activeReads).toBe(1)
        expect(reads.registeredReads).toBe(1)
        expect(seenUploads).toHaveLength(1)
        expect(seenUploads[0].contentType).toBe('application/octet-stream')
        expect(seenUploads[0].size).toBeGreaterThan(0)
      })

      it('should upload a file through a HyperBEAM bundler route', async () => {
        const seenUploads: Array<{ contentType: string; size: number }> = []

        server.use(
          http.post('https://hyperbeam.test/~bundler@1.0/item', async ({ request }) => {
            const raw = Buffer.from(await request.arrayBuffer())
            seenUploads.push({
              contentType: request.headers.get('content-type') || '',
              size: raw.length,
            })

            return new HttpResponse('<html><title>HyperBEAM</title></html>', {
              headers: { id: 'mock-hyperbeam-dataitem-id' },
              status: 200,
            })
          }),
        )

        const result = await runCommand([
          'upload',
          '--deploy-file',
          './tests/fixtures/test-app/index.html',
          '--wallet',
          './tests/fixtures/test_wallet.json',
          '--uploader-type',
          'hyperbeam',
          '--uploader',
          'https://hyperbeam.test',
          '--no-dedupe',
        ])

        expect(result.error).toBeUndefined()
        expect(seenUploads).toHaveLength(1)
        expect(seenUploads[0].contentType).toBe('application/octet-stream')
        expect(seenUploads[0].size).toBeGreaterThan(0)
      })

      it('should upload HyperBEAM folder manifests as plain Arweave manifests', async () => {
        const seenTags: Array<Record<string, string>> = []

        server.use(
          http.post('https://hyperbeam.test/~bundler@1.0/item', async ({ request }) => {
            const raw = Buffer.from(await request.arrayBuffer())
            seenTags.push(dataItemTags(raw))

            return new HttpResponse('<html><title>HyperBEAM</title></html>', {
              headers: { id: `mock-hyperbeam-dataitem-id-${seenTags.length}` },
              status: 200,
            })
          }),
        )

        const result = await runCommand([
          'deploy',
          '--deploy-folder',
          './tests/fixtures/test-app',
          '--wallet',
          './tests/fixtures/test_wallet.json',
          '--uploader-type',
          'hyperbeam',
          '--uploader',
          'https://hyperbeam.test',
          '--no-dedupe',
        ])

        expect(result.error).toBeUndefined()
        expect(seenTags).toHaveLength(3)

        const manifestTags = seenTags.find(
          (tags) => tags['Content-Type'] === 'application/x.arweave-manifest+json',
        )
        expect(manifestTags).toBeDefined()
        expect(manifestTags?.Device).toBeUndefined()
      })

      it('should use the legacy up.arweave.net uploader by default', async () => {
        let uploadAttempted = false

        server.use(
          http.post(`${DEFAULT_LEGACY_UPLOADER}/v1/tx/:token`, () => {
            uploadAttempted = true
            return HttpResponse.json({ id: 'mock-default-legacy-dataitem-id' })
          }),
        )

        const result = await runCommand([
          'upload',
          '--deploy-file',
          './tests/fixtures/test-app/index.html',
          '--wallet',
          './tests/fixtures/test_wallet.json',
          '--no-dedupe',
        ])

        expect(result.error).toBeUndefined()
        expect(uploadAttempted).toBe(true)
      })

      it('should include AO funding metadata when a HyperBEAM upload needs payment', async () => {
        server.use(
          http.post('https://hyperbeam.test/~bundler@1.0/item', () =>
            HttpResponse.text('insufficient local ledger balance', { status: 402 }),
          ),
        )

        const result = await runCommand([
          'upload',
          '--deploy-file',
          './tests/fixtures/test-app/index.html',
          '--wallet',
          './tests/fixtures/test_wallet.json',
          '--uploader-type',
          'hyperbeam',
          '--uploader',
          'https://hyperbeam.test',
          '--no-dedupe',
        ])

        expect(result.error).toBeDefined()
        expect(result.error?.message).toContain('node-deposit-address')
        expect(result.error?.message).toContain('default')
      })

      it('should size auto-funding from the byte-count quote without an exact-request preflight', async () => {
        let preflightPosted = false
        let quoteReads = 0

        server.use(
          http.post('https://hyperbeam.test/~arweave-byte-pricing@1.0/preflight', () => {
            preflightPosted = true
            return HttpResponse.text('preflight route unavailable', { status: 500 })
          }),
          http.get('https://hyperbeam.test/~arweave-byte-pricing@1.0/quote', () => {
            quoteReads += 1
            return HttpResponse.text('1000')
          }),
          // Aggregated p4 balance already covers the byte quote, so no AO transfer is needed.
          http.get('https://hyperbeam.test/~p4@1.0/balance', () => HttpResponse.text('1000000000')),
          http.post(
            'https://hyperbeam.test/~bundler@1.0/item',
            () =>
              new HttpResponse('<html><title>HyperBEAM</title></html>', {
                headers: { id: 'mock-quote-funded-hyperbeam-dataitem-id' },
                status: 200,
              }),
          ),
        )

        const result = await runCommand([
          'upload',
          '--deploy-file',
          './tests/fixtures/test-app/index.html',
          '--wallet',
          './tests/fixtures/test_wallet.json',
          '--uploader-type',
          'hyperbeam',
          '--uploader',
          'https://hyperbeam.test',
          '--hyperbeam-auto-fund',
          '--no-dedupe',
        ])

        expect(result.error).toBeUndefined()
        expect(preflightPosted).toBe(false)
        expect(quoteReads).toBeGreaterThan(0)
      })

      it('should fall back to direct upload when auto-fund is unavailable', async () => {
        let uploadAttempted = false

        server.use(
          http.get('https://hyperbeam.test/~arweave-byte-pricing@1.0/quote', () =>
            HttpResponse.text('quote route unavailable', { status: 500 }),
          ),
          http.post('https://hyperbeam.test/~bundler@1.0/item', () => {
            uploadAttempted = true

            return new HttpResponse('<html><title>HyperBEAM</title></html>', {
              headers: { id: 'mock-direct-fallback-id' },
              status: 200,
            })
          }),
        )

        const result = await runCommand([
          'upload',
          '--deploy-file',
          './tests/fixtures/test-app/index.html',
          '--wallet',
          './tests/fixtures/test_wallet.json',
          '--uploader-type',
          'hyperbeam',
          '--uploader',
          'https://hyperbeam.test',
          '--hyperbeam-auto-fund',
          '--no-dedupe',
        ])

        expect(result.error).toBeUndefined()
        expect(uploadAttempted).toBe(true)
      })

      it('should require AR balance before direct fallback when auto-fund is unavailable', async () => {
        let uploadAttempted = false

        server.use(
          http.get('https://hyperbeam.test/~arweave-byte-pricing@1.0/quote', () =>
            HttpResponse.text('quote route unavailable', { status: 500 }),
          ),
          http.get('https://arweave.net/wallet/node-deposit-address/balance', () =>
            HttpResponse.text('0'),
          ),
          http.post('https://hyperbeam.test/~bundler@1.0/item', () => {
            uploadAttempted = true
            return HttpResponse.text('should not upload', { status: 200 })
          }),
        )

        const result = await runCommand([
          'upload',
          '--deploy-file',
          './tests/fixtures/test-app/index.html',
          '--wallet',
          './tests/fixtures/test_wallet.json',
          '--uploader-type',
          'hyperbeam',
          '--uploader',
          'https://hyperbeam.test',
          '--hyperbeam-auto-fund',
          '--no-dedupe',
        ])

        expect(result.error).toBeDefined()
        expect(result.error?.message).toContain('has 0 AR')
        expect(result.error?.message).toContain('cannot seed data to Arweave')
        expect(uploadAttempted).toBe(false)
      })

      it('should require AR balance before auto-funding a HyperBEAM upload', async () => {
        let uploadAttempted = false

        server.use(
          http.get('https://arweave.net/wallet/node-deposit-address/balance', () =>
            HttpResponse.text('0'),
          ),
          http.post('https://hyperbeam.test/~bundler@1.0/item', () => {
            uploadAttempted = true
            return HttpResponse.text('should not upload', { status: 200 })
          }),
        )

        const result = await runCommand([
          'upload',
          '--deploy-file',
          './tests/fixtures/test-app/index.html',
          '--wallet',
          './tests/fixtures/test_wallet.json',
          '--uploader-type',
          'hyperbeam',
          '--uploader',
          'https://hyperbeam.test',
          '--hyperbeam-auto-fund',
          '--no-dedupe',
        ])

        expect(result.error).toBeDefined()
        expect(result.error?.message).toContain('has 0 AR')
        expect(result.error?.message).toContain('cannot seed data to Arweave')
        expect(uploadAttempted).toBe(false)
      })

      it('should explain auto-fund compatibility failures when direct fallback still needs payment', async () => {
        server.use(
          http.get('https://hyperbeam.test/~arweave-byte-pricing@1.0/quote', () =>
            HttpResponse.text('quote route unavailable', { status: 500 }),
          ),
          http.post('https://hyperbeam.test/~bundler@1.0/item', () =>
            HttpResponse.text('insufficient local ledger balance', { status: 402 }),
          ),
        )

        const result = await runCommand([
          'upload',
          '--deploy-file',
          './tests/fixtures/test-app/index.html',
          '--wallet',
          './tests/fixtures/test_wallet.json',
          '--uploader-type',
          'hyperbeam',
          '--uploader',
          'https://hyperbeam.test',
          '--hyperbeam-auto-fund',
          '--no-dedupe',
        ])

        expect(result.error).toBeDefined()
        expect(result.error?.message).toContain('not hyperbalance-compatible')
        expect(result.error?.message).toContain('Attempted direct upload instead')
        expect(result.error?.message).not.toContain('Use --hyperbeam-auto-fund')
      })

      it('should reject explicit HyperBEAM uploads when the bundler wallet has no AR', async () => {
        let uploadAttempted = false

        server.use(
          http.get('https://arweave.net/wallet/node-deposit-address/balance', () =>
            HttpResponse.text('0'),
          ),
          http.post('https://hyperbeam.test/~bundler@1.0/item', () => {
            uploadAttempted = true

            return new HttpResponse('<html><title>HyperBEAM</title></html>', {
              headers: { id: 'mock-explicit-hyperbeam-dataitem-id' },
              status: 200,
            })
          }),
        )

        const result = await runCommand([
          'upload',
          '--deploy-file',
          './tests/fixtures/test-app/index.html',
          '--wallet',
          './tests/fixtures/test_wallet.json',
          '--uploader-type',
          'hyperbeam',
          '--uploader',
          'https://hyperbeam.test',
          '--no-dedupe',
        ])

        expect(result.error).toBeDefined()
        expect(result.error?.message).toContain('has 0 AR')
        expect(result.error?.message).toContain('cannot seed data to Arweave')
        expect(uploadAttempted).toBe(false)
      })

      it('should reject auto-selected HyperBEAM uploads when the bundler wallet has no AR', async () => {
        let uploadAttempted = false
        mockPermawebOSBundlerState('https://hyperbeam.test/')

        server.use(
          http.get('https://arweave.net/wallet/node-deposit-address/balance', () =>
            HttpResponse.text('0'),
          ),
          http.post('https://hyperbeam.test/~bundler@1.0/item', () => {
            uploadAttempted = true
            return HttpResponse.text('should not upload', { status: 200 })
          }),
        )

        const result = await runCommand([
          'upload',
          '--deploy-file',
          './tests/fixtures/test-app/index.html',
          '--wallet',
          './tests/fixtures/test_wallet.json',
          '--uploader-type',
          'hyperbeam',
          '--no-dedupe',
        ])

        expect(result.error).toBeDefined()
        expect(result.error?.message).toContain('No active HyperBEAM uploaders with spendable AR')
        expect(result.error?.message).toContain('has 0 AR')
        expect(result.error?.message).toContain('cannot seed data to Arweave')
        expect(uploadAttempted).toBe(false)
      })
    })

    describe('arweave signer', () => {
      describe('upload folder', () => {
        it('should deploy without payment', async () => {
          const result = await runCommand([
            'deploy',
            '--deploy-folder',
            './tests/fixtures/test-app',
            '--wallet',
            './tests/fixtures/test_wallet.json',
          ])

          expect(result.error).toBeUndefined()
        })
      })

      describe('upload file', () => {
        it('should deploy without payment', async () => {
          const result = await runCommand([
            'deploy',
            '--deploy-file',
            './tests/fixtures/test-app/index.html',
            '--wallet',
            './tests/fixtures/test_wallet.json',
          ])

          expect(result.error).toBeUndefined()
        })
      })
    })

    describe('ethereum signer', () => {
      describe('upload folder', () => {
        it('should deploy without payment', async () => {
          const result = await runCommand([
            'deploy',
            '--deploy-folder',
            './tests/fixtures/test-app',
            '--sig-type',
            'ethereum',
            '--private-key',
            TEST_ETH_PRIVATE_KEY,
            '--uploader-type',
            'legacy',
          ])

          expect(result.error).toBeUndefined()
        })
      })

      describe('upload file', () => {
        it('should deploy without payment', async () => {
          const result = await runCommand([
            'deploy',
            '--deploy-file',
            './tests/fixtures/test-app/index.html',
            '--sig-type',
            'ethereum',
            '--private-key',
            TEST_ETH_PRIVATE_KEY,
            '--uploader-type',
            'legacy',
          ])

          expect(result.error).toBeUndefined()
        })
      })
    })

    describe('caching', () => {
      it('should cache file uploads and reuse on subsequent deploys', async () => {
        const fs = await import('node:fs')
        const path = await import('node:path')

        // Clean up any existing cache
        const cacheDir = path.join(process.cwd(), '.permaweb-deploy')
        if (fs.existsSync(cacheDir)) {
          fs.rmSync(cacheDir, { force: true, recursive: true })
        }

        // First deploy - should upload and cache
        const result1 = await runCommand([
          'deploy',
          '--deploy-file',
          './tests/fixtures/test-app/index.html',
          '--wallet',
          './tests/fixtures/test_wallet.json',
          '--dedupe-cache-max-entries',
          '10',
        ])

        expect(result1.error).toBeUndefined()

        // Check cache was created
        const cachePath = path.join(cacheDir, 'transaction-cache.json')
        expect(fs.existsSync(cachePath)).toBe(true)

        const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'))
        const entries = Object.keys(cache)
        expect(entries.length).toBe(1)

        // Second deploy - should use cache
        const result2 = await runCommand([
          'deploy',
          '--deploy-file',
          './tests/fixtures/test-app/index.html',
          '--wallet',
          './tests/fixtures/test_wallet.json',
          '--dedupe-cache-max-entries',
          '10',
        ])

        expect(result2.error).toBeUndefined()

        // Cache should still have same entry (not duplicated)
        const cache2 = JSON.parse(fs.readFileSync(cachePath, 'utf8'))
        expect(Object.keys(cache2).length).toBe(1)

        // Clean up
        if (fs.existsSync(cacheDir)) {
          fs.rmSync(cacheDir, { force: true, recursive: true })
        }
      })

      it('should cache folder uploads and reuse on subsequent deploys', async () => {
        const fs = await import('node:fs')
        const path = await import('node:path')

        // Clean up any existing cache
        const cacheDir = path.join(process.cwd(), '.permaweb-deploy')
        if (fs.existsSync(cacheDir)) {
          fs.rmSync(cacheDir, { force: true, recursive: true })
        }

        // First deploy - should upload and cache each file individually
        const result1 = await runCommand([
          'deploy',
          '--deploy-folder',
          './tests/fixtures/test-app',
          '--wallet',
          './tests/fixtures/test_wallet.json',
          '--dedupe-cache-max-entries',
          '10',
        ])

        expect(result1.error).toBeUndefined()

        // Check cache was created with per-file entries
        const cachePath = path.join(cacheDir, 'transaction-cache.json')
        expect(fs.existsSync(cachePath)).toBe(true)

        const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'))
        const entries = Object.keys(cache)
        // test-app folder has 2 files (index.html, style.css), so expect 2 cache entries
        expect(entries.length).toBe(2)

        // Second deploy - should use cache for all files
        const result2 = await runCommand([
          'deploy',
          '--deploy-folder',
          './tests/fixtures/test-app',
          '--wallet',
          './tests/fixtures/test_wallet.json',
          '--dedupe-cache-max-entries',
          '10',
        ])

        expect(result2.error).toBeUndefined()

        // Cache should still have same entries (not duplicated)
        const cache2 = JSON.parse(fs.readFileSync(cachePath, 'utf8'))
        expect(Object.keys(cache2).length).toBe(2)

        // Clean up
        if (fs.existsSync(cacheDir)) {
          fs.rmSync(cacheDir, { force: true, recursive: true })
        }
      })

      it('should not create cache when --no-dedupe is used', async () => {
        const fs = await import('node:fs')
        const path = await import('node:path')

        // Clean up any existing cache
        const cacheDir = path.join(process.cwd(), '.permaweb-deploy')
        if (fs.existsSync(cacheDir)) {
          fs.rmSync(cacheDir, { force: true, recursive: true })
        }

        // Deploy with --no-dedupe
        const result = await runCommand([
          'deploy',
          '--deploy-file',
          './tests/fixtures/test-app/index.html',
          '--wallet',
          './tests/fixtures/test_wallet.json',
          '--no-dedupe',
        ])

        expect(result.error).toBeUndefined()

        // Check cache was NOT created
        const cachePath = path.join(cacheDir, 'transaction-cache.json')
        expect(fs.existsSync(cachePath)).toBe(false)

        // Clean up
        if (fs.existsSync(cacheDir)) {
          fs.rmSync(cacheDir, { force: true, recursive: true })
        }
      })

      it('should not create cache when --dedupe-cache-max-entries 0 is used', async () => {
        const fs = await import('node:fs')
        const path = await import('node:path')

        // Clean up any existing cache
        const cacheDir = path.join(process.cwd(), '.permaweb-deploy')
        if (fs.existsSync(cacheDir)) {
          fs.rmSync(cacheDir, { force: true, recursive: true })
        }

        // Deploy with --dedupe-cache-max-entries 0
        const result = await runCommand([
          'deploy',
          '--deploy-folder',
          './tests/fixtures/test-app',
          '--wallet',
          './tests/fixtures/test_wallet.json',
          '--dedupe-cache-max-entries',
          '0',
        ])

        expect(result.error).toBeUndefined()

        // Check cache was NOT created
        const cachePath = path.join(cacheDir, 'transaction-cache.json')
        expect(fs.existsSync(cachePath)).toBe(false)

        // Clean up
        if (fs.existsSync(cacheDir)) {
          fs.rmSync(cacheDir, { force: true, recursive: true })
        }
      })
    })
  },
  { timeout: 30_000 },
)
