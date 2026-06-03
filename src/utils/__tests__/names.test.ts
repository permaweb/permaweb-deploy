import { describe, expect, it, vi } from 'vitest'

import { TEST_ARWEAVE_WALLET } from '../../../tests/constants.js'
import { createNamesJwkSigner, resolveNamesReferenceId, validateNamesTarget } from '../names.js'

const arweaveMock = vi.hoisted(() => {
  const tx = {
    addTag: vi.fn(),
    id: 'posted-reference-tx-id',
  }

  return {
    createTransaction: vi.fn(async () => tx),
    init: vi.fn(),
    post: vi.fn(async () => ({ status: 200, statusText: 'OK' })),
    sign: vi.fn(async () => {}),
    tx,
    walletAddress: 'mock-wallet-address',
  }
})

vi.mock('arweave', () => ({
  default: {
    init: arweaveMock.init.mockReturnValue({
      createTransaction: arweaveMock.createTransaction,
      transactions: {
        post: arweaveMock.post,
        sign: arweaveMock.sign,
      },
      wallets: {
        jwkToAddress: vi.fn(async () => arweaveMock.walletAddress),
      },
    }),
  },
}))

describe('names utilities', () => {
  describe('resolveNamesReferenceId', () => {
    it('uses a direct reference id without namespace lookups', async () => {
      const client = {
        findReferences: vi.fn(),
        getReference: vi.fn(),
      }
      const signer = {
        address: vi.fn(async () => 'ME'),
        send: vi.fn(),
      }

      await expect(
        resolveNamesReferenceId({
          client: client as never,
          name: 'my-app',
          namespace: 'namespace-root',
          referenceId: 'direct-reference-id',
          signer: signer as never,
        }),
      ).resolves.toEqual({ name: 'my-app', referenceId: 'direct-reference-id' })

      expect(client.getReference).not.toHaveBeenCalled()
      expect(client.findReferences).not.toHaveBeenCalled()
      expect(signer.address).not.toHaveBeenCalled()
    })

    it('resolves a namespace name through the SDK owned-reference lookup', async () => {
      const client = {
        findReferences: vi.fn(async () => [
          { name: 'other-app', referenceId: 'other-reference-id' },
          { name: 'my-app', referenceId: 'resolved-reference-id' },
        ]),
        getReference: vi.fn(),
      }
      const signer = {
        address: vi.fn(async () => 'ME'),
        send: vi.fn(),
      }

      await expect(
        resolveNamesReferenceId({
          client: client as never,
          name: 'my-app',
          namespace: 'namespace-root',
          signer: signer as never,
        }),
      ).resolves.toEqual({ name: 'my-app', referenceId: 'resolved-reference-id' })

      expect(signer.address).toHaveBeenCalled()
      expect(client.findReferences).toHaveBeenCalledWith('ME')
      expect(client.getReference).not.toHaveBeenCalled()
    })

    it('delegates nested namespace handling to the SDK owned-reference lookup', async () => {
      const client = {
        findReferences: vi.fn(async () => [{ name: 'darwin', referenceId: 'darwin-reference-id' }]),
        getReference: vi.fn(),
      }
      const signer = {
        address: vi.fn(async () => 'ME'),
        send: vi.fn(),
      }

      await expect(
        resolveNamesReferenceId({
          client: client as never,
          name: 'darwin',
          namespace: 'namespace-root',
          signer: signer as never,
        }),
      ).resolves.toEqual({ name: 'darwin', referenceId: 'darwin-reference-id' })

      expect(signer.address).toHaveBeenCalled()
      expect(client.findReferences).toHaveBeenCalledWith('ME')
      expect(client.getReference).not.toHaveBeenCalled()
    })

    it('errors when the name is not controlled by the signer in the namespace', async () => {
      const client = {
        findReferences: vi.fn(async () => []),
        getReference: vi.fn(),
      }
      const signer = {
        address: vi.fn(async () => 'ME'),
        send: vi.fn(),
      }

      await expect(
        resolveNamesReferenceId({
          client: client as never,
          name: 'missing-name',
          namespace: 'namespace-manifest-id',
          signer: signer as never,
        }),
      ).rejects.toThrow(
        'Name [missing-name] is not controlled by signer in namespace namespace-manifest-id',
      )
    })
  })

  describe('validateNamesTarget', () => {
    it('rejects direct reference ids that do not exist', async () => {
      const client = {
        fetchRaw: vi.fn(),
        getReference: vi.fn(async () => {}),
      }
      const signer = {
        address: vi.fn(async () => 'ME'),
        send: vi.fn(),
      }

      await expect(
        validateNamesTarget({
          client: client as never,
          namespace: 'namespace-root',
          referenceId: 'missing-reference-id',
          signer: signer as never,
        }),
      ).rejects.toThrow('reference not found: missing-reference-id')
    })

    it('rejects references controlled by another authority before upload', async () => {
      const client = {
        fetchRaw: vi.fn(),
        getReference: vi.fn(async () => ({
          authority: 'OTHER',
          id: 'direct-reference-id',
          timestamp: 1,
          value: 'old-manifest-id',
        })),
      }
      const signer = {
        address: vi.fn(async () => 'ME'),
        send: vi.fn(),
      }

      await expect(
        validateNamesTarget({
          client: client as never,
          namespace: 'namespace-root',
          referenceId: 'direct-reference-id',
          signer: signer as never,
        }),
      ).rejects.toThrow('signer is not reference authority for direct-reference-id')
    })

    it('returns the validated reference target for existing owned references', async () => {
      const client = {
        fetchRaw: vi.fn(),
        getReference: vi.fn(async () => ({
          authority: 'ME',
          id: 'direct-reference-id',
          timestamp: 1,
          value: 'old-manifest-id',
        })),
      }
      const signer = {
        address: vi.fn(async () => 'ME'),
        send: vi.fn(),
      }

      await expect(
        validateNamesTarget({
          client: client as never,
          name: 'my-app',
          namespace: 'namespace-root',
          referenceId: 'direct-reference-id',
          signer: signer as never,
        }),
      ).resolves.toEqual({
        name: 'my-app',
        namespace: 'namespace-root',
        referenceId: 'direct-reference-id',
      })
    })
  })

  describe('createNamesJwkSigner', () => {
    it('creates an Arweave names signer and posts a direct Arweave transaction', async () => {
      const deployKey = Buffer.from(JSON.stringify(TEST_ARWEAVE_WALLET)).toString('base64')
      const signer = createNamesJwkSigner('arweave', deployKey)

      await expect(signer.address()).resolves.toBe(arweaveMock.walletAddress)
      const result = await signer.send({
        data: ' ',
        tags: [
          { name: 'device', value: 'reference@1.0' },
          { name: 'reference-id', value: 'reference-id' },
          { name: 'reference-value', value: 'manifest-id' },
          { name: 'timestamp', value: '1' },
        ],
      })

      expect(result.id).toBe('posted-reference-tx-id')
      expect(arweaveMock.createTransaction).toHaveBeenCalledWith({ data: ' ' }, TEST_ARWEAVE_WALLET)
      expect(arweaveMock.tx.addTag).toHaveBeenCalledWith('device', 'reference@1.0')
      expect(arweaveMock.tx.addTag).toHaveBeenCalledWith('reference-id', 'reference-id')
      expect(arweaveMock.tx.addTag).toHaveBeenCalledWith('reference-value', 'manifest-id')
      expect(arweaveMock.tx.addTag).toHaveBeenCalledWith('timestamp', '1')
      expect(arweaveMock.sign).toHaveBeenCalledWith(arweaveMock.tx, TEST_ARWEAVE_WALLET)
      expect(arweaveMock.post).toHaveBeenCalledWith(arweaveMock.tx)
    })

    it('rejects non-Arweave signers for names updates', () => {
      const deployKey = Buffer.from(JSON.stringify(TEST_ARWEAVE_WALLET)).toString('base64')

      expect(() => createNamesJwkSigner('ethereum', deployKey)).toThrow(
        'Names updates currently require --sig-type arweave',
      )
    })
  })
})
