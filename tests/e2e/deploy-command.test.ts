import { runCommand } from '@oclif/test'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import { TEST_ETH_PRIVATE_KEY } from '../constants.js'
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
  },
  { timeout: 30_000 },
)
