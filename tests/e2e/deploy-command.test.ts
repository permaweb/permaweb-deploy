import { runCommand } from '@oclif/test'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import { TEST_ETH_PRIVATE_KEY } from '../constants.js'
import { mockInsufficientBalance } from '../mocks/turbo-handlers.js'
import { server } from '../setup.js'

describe(
  'deploy command',
  () => {
    beforeAll(() => {
      server.listen({ onUnhandledRequest: 'warn' })
    })

    afterEach(() => {
      server.resetHandlers()
    })

    afterAll(() => {
      server.close()
    })

    it('should show help message', async () => {
      const result = await runCommand(['deploy', '--help'])
      expect(result.error).toBeUndefined()
    })

    it('should validate on-demand token options', async () => {
      const { error } = await runCommand([
        'deploy',
        '--deploy-folder',
        './tests/fixtures/test-app',
        '--wallet',
        './tests/fixtures/test_wallet.json',
        '--arns-name',
        'test-app',
        '--undername',
        '@',
        '--on-demand',
        'invalid-token',
        '--max-token-amount',
        '1.0',
      ])

      expect(error).toBeDefined()
      expect(error?.message).toMatch(/ario|base-eth/)
    })

    it('should reject invalid ario-process', async () => {
      const result = await runCommand([
        'deploy',
        '--deploy-folder',
        './tests/fixtures/test-app',
        '--wallet',
        './tests/fixtures/test_wallet.json',
        '--arns-name',
        'test-app',
        '--undername',
        '@',
        '--ario-process',
        'invalid',
      ])

      expect(result.error).toBeDefined()
      expect(result.error?.message).toMatch(/valid Arweave transaction ID/)
    })

    it('should reject invalid cache-max-entries', async () => {
      const result = await runCommand([
        'deploy',
        '--deploy-folder',
        './tests/fixtures/test-app',
        '--wallet',
        './tests/fixtures/test_wallet.json',
        '--arns-name',
        'test-app',
        '--undername',
        '@',
        '--cache-max-entries',
        '0',
      ])

      expect(result.error).toBeDefined()
      expect(result.error?.message).toMatch(/Expected an integer greater than or equal to 1/)
    })

    it('should accept valid cache-max-entries', async () => {
      const result = await runCommand([
        'deploy',
        '--deploy-folder',
        './tests/fixtures/test-app',
        '--wallet',
        './tests/fixtures/test_wallet.json',
        '--arns-name',
        'test-app',
        '--undername',
        '@',
        '--cache-max-entries',
        '50',
      ])

      expect(result.error).toBeUndefined()
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
            '--arns-name',
            'test-app',
            '--undername',
            '@',
          ])

          expect(result.error).toBeUndefined()
        })

        it('should deploy with ario on-demand', async () => {
          const result = await runCommand([
            'deploy',
            '--deploy-folder',
            './tests/fixtures/test-app',
            '--wallet',
            './tests/fixtures/test_wallet.json',
            '--arns-name',
            'test-app',
            '--undername',
            '@',
            '--on-demand',
            'ario',
            '--max-token-amount',
            '1.5',
          ])

          expect(result.error).toBeUndefined()
        })

        it('should deploy with base-eth on-demand', async () => {
          const result = await runCommand([
            'deploy',
            '--deploy-folder',
            './tests/fixtures/test-app',
            '--wallet',
            './tests/fixtures/test_wallet.json',
            '--arns-name',
            'test-app',
            '--undername',
            '@',
            '--on-demand',
            'base-eth',
            '--max-token-amount',
            '2.0',
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
            '--arns-name',
            'test-app',
            '--undername',
            '@',
          ])

          expect(result.error).toBeUndefined()
        })

        it('should deploy with ario on-demand', async () => {
          const result = await runCommand([
            'deploy',
            '--deploy-file',
            './tests/fixtures/test-app/index.html',
            '--wallet',
            './tests/fixtures/test_wallet.json',
            '--arns-name',
            'test-app',
            '--undername',
            '@',
            '--on-demand',
            'ario',
            '--max-token-amount',
            '1.0',
          ])

          expect(result.error).toBeUndefined()
        })

        it('should deploy with base-eth on-demand', async () => {
          const result = await runCommand([
            'deploy',
            '--deploy-file',
            './tests/fixtures/test-app/index.html',
            '--wallet',
            './tests/fixtures/test_wallet.json',
            '--arns-name',
            'test-app',
            '--undername',
            '@',
            '--on-demand',
            'base-eth',
            '--max-token-amount',
            '0.3',
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
            '--arns-name',
            'test-app',
            '--undername',
            '@',
          ])

          expect(result.error).toBeUndefined()
        })

        it('should deploy with base-eth on-demand', async () => {
          const result = await runCommand([
            'deploy',
            '--deploy-folder',
            './tests/fixtures/test-app',
            '--sig-type',
            'ethereum',
            '--private-key',
            TEST_ETH_PRIVATE_KEY,
            '--arns-name',
            'test-app',
            '--undername',
            '@',
            '--on-demand',
            'base-eth',
            '--max-token-amount',
            '0.5',
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
            '--arns-name',
            'test-app',
            '--undername',
            '@',
          ])

          expect(result.error).toBeUndefined()
        })

        it('should deploy with base-eth on-demand', async () => {
          const result = await runCommand([
            'deploy',
            '--deploy-file',
            './tests/fixtures/test-app/index.html',
            '--sig-type',
            'ethereum',
            '--private-key',
            TEST_ETH_PRIVATE_KEY,
            '--arns-name',
            'test-app',
            '--undername',
            '@',
            '--on-demand',
            'base-eth',
            '--max-token-amount',
            '0.4',
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
          '--arns-name',
          'test-app',
          '--undername',
          '@',
          '--cache-max-entries',
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
          '--arns-name',
          'test-app',
          '--undername',
          '@',
          '--cache-max-entries',
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

        // First deploy - should upload and cache
        const result1 = await runCommand([
          'deploy',
          '--deploy-folder',
          './tests/fixtures/test-app',
          '--wallet',
          './tests/fixtures/test_wallet.json',
          '--arns-name',
          'test-app',
          '--undername',
          '@',
          '--cache-max-entries',
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
          '--deploy-folder',
          './tests/fixtures/test-app',
          '--wallet',
          './tests/fixtures/test_wallet.json',
          '--arns-name',
          'test-app',
          '--undername',
          '@',
          '--cache-max-entries',
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
    })

    describe('insufficient balance', () => {
      it('should fail deployment when wallet has insufficient Turbo credits', async () => {
        // Mock insufficient balance: balance = 100 winc, cost = 1000000 winc
        server.use(...mockInsufficientBalance('100', '1000000'))

        // Create a large test file (> 105 KiB threshold)
        const fs = await import('node:fs')
        const path = await import('node:path')
        const largeFilePath = path.join(process.cwd(), 'tests/fixtures/large-test-file.bin')
        const largeFileSize = 200_000 // 200 KB - above the 105 KiB threshold
        const largeFileBuffer = Buffer.alloc(largeFileSize, 'a')
        fs.writeFileSync(largeFilePath, largeFileBuffer)

        try {
          const { error } = await runCommand([
            'deploy',
            '--deploy-file',
            largeFilePath,
            '--wallet',
            './tests/fixtures/test_wallet.json',
            '--arns-name',
            'test-app',
            '--undername',
            '@',
          ])

          expect(error).toBeDefined()
          expect(error?.message).toMatch(/Insufficient Turbo credits/)
          expect(error?.message).toMatch(/Required.*winc.*available.*winc/)
        } finally {
          // Clean up test file
          if (fs.existsSync(largeFilePath)) {
            fs.unlinkSync(largeFilePath)
          }
        }
      })

      it('should fail deployment when folder upload exceeds balance', async () => {
        // Mock insufficient balance: balance = 50000 winc, cost = 200000 winc
        server.use(...mockInsufficientBalance('50000', '200000'))

        // Create a large test folder (> 105 KiB threshold)
        const fs = await import('node:fs')
        const path = await import('node:path')
        const largeFolderPath = path.join(process.cwd(), 'tests/fixtures/large-test-folder')
        const largeFileSize = 150_000 // 150 KB - above the 105 KiB threshold
        const largeFileBuffer = Buffer.alloc(largeFileSize, 'b')

        // Create folder and file
        if (!fs.existsSync(largeFolderPath)) {
          fs.mkdirSync(largeFolderPath, { recursive: true })
        }

        const largeFilePath = path.join(largeFolderPath, 'large-file.bin')
        fs.writeFileSync(largeFilePath, largeFileBuffer)

        try {
          const { error } = await runCommand([
            'deploy',
            '--deploy-folder',
            largeFolderPath,
            '--wallet',
            './tests/fixtures/test_wallet.json',
            '--arns-name',
            'test-app',
            '--undername',
            '@',
          ])

          expect(error).toBeDefined()
          expect(error?.message).toMatch(/Insufficient Turbo credits/)
          expect(error?.message).toMatch(/Required.*winc.*available.*winc/)
        } finally {
          // Clean up test folder
          if (fs.existsSync(largeFolderPath)) {
            fs.rmSync(largeFolderPath, { force: true, recursive: true })
          }
        }
      })
    })
  },
  { timeout: 30_000 },
)
