import { createRequire } from 'node:module'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TEST_ARWEAVE_WALLET } from '../../../tests/constants.js'
import { createNamesJwkSigner, resolveNamesReferenceId, validateNamesTarget } from '../names.js'

const require = createRequire(import.meta.url)
const { DataItem } = require('@dha-team/arbundles') as {
  DataItem: new (raw: Buffer) => { tags: Array<{ name: string; value: string }> }
}

const arweaveMock = vi.hoisted(() => {
  const tx = {
    addTag: vi.fn(),
    id: 'posted-reference-tx-id',
    owner: 'mock-owner',
    reward: '1',
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
        ownerToAddress: vi.fn(async () => arweaveMock.walletAddress),
      },
    }),
  },
}))

describe('names utilities', () => {
  beforeEach(() => {
    arweaveMock.createTransaction.mockClear()
    arweaveMock.post.mockClear()
    arweaveMock.sign.mockClear()
    arweaveMock.tx.addTag.mockClear()
    arweaveMock.tx.id = 'posted-reference-tx-id'
    arweaveMock.tx.owner = 'mock-owner'
    arweaveMock.tx.reward = '1'
  })

  describe('resolveNamesReferenceId', () => {
    it('uses a direct reference id without namespace lookups', async () => {
      const client = {
        findReferences: vi.fn(),
        getName: vi.fn(),
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
      ).resolves.toEqual({
        kind: 'reference',
        name: 'my-app',
        referenceId: 'direct-reference-id',
      })

      expect(client.getName).not.toHaveBeenCalled()
      expect(client.getReference).not.toHaveBeenCalled()
      expect(client.findReferences).not.toHaveBeenCalled()
      expect(signer.address).not.toHaveBeenCalled()
    })

    it('resolves a legacy namespace name through the SDK name lookup', async () => {
      const client = {
        findReferences: vi.fn(),
        getName: vi.fn(async () => ({
          authority: 'ME',
          kind: 'reference',
          name: 'my-app',
          referenceId: 'resolved-reference-id',
        })),
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
      ).resolves.toEqual({
        kind: 'reference',
        name: 'my-app',
        referenceId: 'resolved-reference-id',
      })

      expect(signer.address).toHaveBeenCalled()
      expect(client.getName).toHaveBeenCalledWith('my-app')
      expect(client.findReferences).not.toHaveBeenCalled()
      expect(client.getReference).not.toHaveBeenCalled()
    })

    it('resolves a carrier namespace name through the SDK name lookup', async () => {
      const client = {
        findReferences: vi.fn(),
        getName: vi.fn(async () => ({
          authority: 'ME',
          kind: 'carrier',
          name: 'my-app',
          processId: 'carrier-process-id',
          referenceId: 'carrier-process-id',
        })),
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
      ).resolves.toEqual({
        kind: 'carrier',
        name: 'my-app',
        processId: 'carrier-process-id',
        referenceId: 'carrier-process-id',
      })

      expect(signer.address).toHaveBeenCalled()
      expect(client.getName).toHaveBeenCalledWith('my-app')
      expect(client.findReferences).not.toHaveBeenCalled()
      expect(client.getReference).not.toHaveBeenCalled()
    })

    it('errors when the name is not controlled by the signer in the namespace', async () => {
      const client = {
        findReferences: vi.fn(),
        getName: vi.fn(async () => {}),
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
        kind: 'reference',
        name: 'my-app',
        namespace: 'namespace-root',
        referenceId: 'direct-reference-id',
      })
    })
  })

  describe('createNamesJwkSigner', () => {
    it('creates an Arweave names signer and posts a device-less set data item to the bundler', async () => {
      const deployKey = Buffer.from(JSON.stringify(TEST_ARWEAVE_WALLET)).toString('base64')
      const signer = createNamesJwkSigner('arweave', deployKey)
      let signedItem: InstanceType<typeof DataItem> | undefined
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        signedItem = new DataItem(Buffer.from(init?.body as Uint8Array))
        return new Response(JSON.stringify({ id: 'posted-reference-data-item-id' }), {
          status: 200,
          statusText: 'OK',
        })
      })

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

      expect(result.id).toBe('posted-reference-data-item-id')
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://up.arweave.net/tx',
        expect.objectContaining({ method: 'POST' }),
      )
      expect(arweaveMock.createTransaction).not.toHaveBeenCalled()
      expect(arweaveMock.sign).not.toHaveBeenCalled()
      expect(arweaveMock.post).not.toHaveBeenCalled()
      expect(
        Object.fromEntries((signedItem?.tags ?? []).map((tag) => [tag.name, tag.value])),
      ).toEqual({
        'reference-id': 'reference-id',
        'reference-value': 'manifest-id',
        timestamp: '1',
      })

      fetchSpy.mockRestore()
    })

    it('signs and posts data-free carrier process transactions', async () => {
      const deployKey = Buffer.from(JSON.stringify(TEST_ARWEAVE_WALLET)).toString('base64')
      const signer = createNamesJwkSigner('arweave', deployKey)
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
        async () =>
          new Response('', {
            status: 200,
            statusText: 'OK',
          }),
      )

      const result = await signer.sendTransaction?.(
        {
          quantity: '1',
          tags: [
            { name: 'action', value: 'set' },
            { name: 'reference-value', value: 'manifest-id' },
          ],
          target: 'carrier-process-id',
        },
        {
          expectedSigner: arweaveMock.walletAddress,
          gateway: 'https://arweave.net',
        },
      )

      expect(result).toEqual({ id: 'posted-reference-tx-id' })
      expect(arweaveMock.createTransaction).toHaveBeenCalledWith(
        { quantity: '1', target: 'carrier-process-id' },
        TEST_ARWEAVE_WALLET,
      )
      expect(arweaveMock.sign).toHaveBeenCalledWith(arweaveMock.tx, TEST_ARWEAVE_WALLET)
      expect(arweaveMock.tx.addTag).toHaveBeenCalledWith('action', 'set')
      expect(arweaveMock.tx.addTag).toHaveBeenCalledWith('reference-value', 'manifest-id')
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://arweave.net/tx',
        expect.objectContaining({ method: 'POST' }),
      )

      fetchSpy.mockRestore()
    })

    it('rejects non-Arweave signers for names updates', () => {
      const deployKey = Buffer.from(JSON.stringify(TEST_ARWEAVE_WALLET)).toString('base64')

      expect(() => createNamesJwkSigner('ethereum', deployKey)).toThrow(
        'Names updates currently require --sig-type arweave',
      )
    })
  })
})
