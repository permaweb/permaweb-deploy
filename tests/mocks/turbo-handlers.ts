import { http, HttpResponse } from 'msw'

import type { components as PaymentComponents } from '../types/payment-service.js'
import type { components as UploadComponents } from '../types/upload-service.js'

/**
 * Type aliases from generated OpenAPI types
 */
type DataItemPost = UploadComponents['schemas']['DataItemPost']
type BalanceResponse = PaymentComponents['schemas']['BalanceResponse']
type CreditResponse = PaymentComponents['schemas']['CreditResponse']
type CreditedPaymentTx = PaymentComponents['schemas']['CreditedPaymentTx']

/**
 * Mock data generators for Turbo API responses
 * Based on actual Turbo SDK types and API responses
 */
export const mockTurboData = {
  // Balance response from Payment Service
  balanceResponse: (winc = '1000000000000'): BalanceResponse => ({
    controlledWinc: winc,
    effectiveBalance: winc,
    winc,
  }),

  // Price response from Payment Service
  priceResponse: (winc = '100000000'): CreditResponse => ({
    adjustments: [],
    winc,
  }),

  // Crypto fund/top-up response from Payment Service
  topUpResponse: (
    winc = '1000000000000',
    txId = 'K4C3y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8',
  ): CreditedPaymentTx => ({
    block: 1_234_567,
    confirmedBlocks: 50,
    id: txId,
    owner: 'mock-owner',
    quantity: '1000000000',
    status: 'confirmed',
    target: 'turbo-wallet-address',
    transactionId: txId,
    transactionQuantity: 1_000_000_000,
    winc,
    winstonCreditAmount: winc,
  }),

  // Folder upload response (TurboUploadFolderResponse)
  uploadFolderResponse: (manifestId = 'J4C3y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8') => ({
    fileResponses: [
      {
        dataCaches: ['https://arweave.net'],
        deadlineHeight: 1_000_000,
        fastFinalityIndexes: ['https://arweave.net'],
        id: 'mock-file-id-1',
        owner: 'mock-owner-address',
        public: 'mock-public-key',
        signature: 'mock-signature',
        timestamp: Date.now(),
        version: '1.0.0',
        winc: '50000000',
      },
      {
        dataCaches: ['https://arweave.net'],
        deadlineHeight: 1_000_000,
        fastFinalityIndexes: ['https://arweave.net'],
        id: 'mock-file-id-2',
        owner: 'mock-owner-address',
        public: 'mock-public-key',
        signature: 'mock-signature',
        timestamp: Date.now(),
        version: '1.0.0',
        winc: '50000000',
      },
    ],
    manifest: {
      index: {
        path: 'index.html',
      },
      manifest: 'arweave/paths',
      paths: {
        'index.html': { id: 'mock-file-id-1' },
        'style.css': { id: 'mock-file-id-2' },
      },
      version: '0.2.0',
    },
    manifestResponse: {
      dataCaches: ['https://arweave.net'],
      deadlineHeight: 1_000_000,
      fastFinalityIndexes: ['https://arweave.net'],
      id: manifestId,
      owner: 'mock-owner-address',
      public: 'mock-public-key',
      signature: 'mock-signature',
      timestamp: Date.now(),
      version: '1.0.0',
      winc: '100000000',
    },
  }),

  // Upload Service response (DataItemPost)
  uploadResponse: (id = 'NkeBzc8ObeLGw_L9AO-ivBN8H-ZUKOhOvmDKdBRxVUw'): DataItemPost => ({
    dataCaches: ['https://arweave.net'],
    deadlineHeight: 1_000_000,
    fastFinalityIndexes: ['https://arweave.net'],
    id,
    owner: 'mock-owner-address',
    public: 'mock-public-key',
    signature: 'mock-signature',
    timestamp: Date.now(),
    version: '1.0.0',
  }),
}

/**
 * Default MSW handlers for Turbo Upload Service
 * Based on OpenAPI spec: https://turbo.ardrive.io/api-docs
 */
export const turboUploadHandlers = [
  // Service info
  http.get('https://upload.ardrive.io/', async () =>
    HttpResponse.json({
      addresses: {
        arweave: '8wgRDgvYOrtSaWEIV21g0lTuWDUnTu4_iYj4hmA7PI0',
        ethereum: '0x8wgRDgvYOrtSaWEIV21g0lTuWDUnTu4_iYj4hmA7PI0',
        solana: '8wgRDgvYOrtSaWEIV21g0lTuWDUnTu4_iYj4hmA7PI0',
      },
      gateway: 'https://arweave.net',
      version: '0.1.0',
    }),
  ),

  // Upload single data item (POST /v1/tx)
  http.post('https://upload.ardrive.io/v1/tx', async () =>
    HttpResponse.json(mockTurboData.uploadResponse()),
  ),

  // Upload with specific token (POST /v1/tx/:token)
  http.post('https://upload.ardrive.io/v1/tx/:token', async ({ params: _params }) =>
    HttpResponse.json(mockTurboData.uploadResponse()),
  ),

  // Get data item status (GET /v1/tx/:id/status)
  http.get('https://upload.ardrive.io/v1/tx/:id/status', async ({ params: _params }) =>
    HttpResponse.json({
      bundleId: 'QpmY8mZmFEC8RxNsgbxSV6e36OF6quIYaPRKzvUco0o',
      info: 'permanent',
      status: 'CONFIRMED',
      winc: '1000000',
    }),
  ),

  // Get data item offsets (GET /v1/tx/:id/offsets)
  http.get('https://upload.ardrive.io/v1/tx/:id/offsets', async ({ params: _params }) =>
    HttpResponse.json({
      payloadContentType: 'application/json',
      payloadDataStart: 1024,
      rawContentLength: 123_456,
      rootBundleId: 'J40R1BgFSI1_7p25QW49T7P46BePJJnlDrsFGY1YWbM',
      startOffsetInRootBundle: 12_345,
    }),
  ),

  // Get price for bytes (GET /price/:token/:byteCount)
  http.get('https://upload.ardrive.io/price/:token/:byteCount', async ({ params: _params }) =>
    HttpResponse.text('1000000'),
  ),

  // Get price (GET /price/:token)
  http.get('https://upload.ardrive.io/price/:token', async ({ params: _params }) =>
    HttpResponse.text('1000000'),
  ),

  // Get account balance (GET /account/balance/:id)
  http.get('https://upload.ardrive.io/account/balance/:id', async ({ params: _params }) =>
    HttpResponse.text('1000000000000'),
  ),

  // Multi-part upload: Create (GET /chunks/-1/-1)
  http.get('https://upload.ardrive.io/v1/chunks/-1/-1', async () =>
    HttpResponse.json({
      id: 'mock-upload-id-123',
      max: 500_000_000,
      min: 25_000,
    }),
  ),

  // Multi-part upload: Get status (GET /chunks/:token/:uploadId/-1)
  http.get('https://upload.ardrive.io/chunks/:token/:uploadId/-1', async ({ params }) =>
    HttpResponse.json({
      chunks: [[0, 25_000_000]],
      id: params.uploadId,
      max: 500_000_000,
      min: 25_000,
      size: 25_000_000,
    }),
  ),

  // Multi-part upload: Upload chunk (POST /chunks/:token/:uploadId/:chunkOffset)
  http.post(
    'https://upload.ardrive.io/chunks/:token/:uploadId/:chunkOffset',
    async () => new HttpResponse(null, { status: 200 }),
  ),

  // Multi-part upload: Finalize (POST /chunks/:token/:uploadId/-1)
  http.post('https://upload.ardrive.io/chunks/:token/:uploadId/-1', async ({ params }) =>
    HttpResponse.json({
      data: mockTurboData.uploadResponse(params.uploadId as string),
      id: params.uploadId,
    }),
  ),

  // Multi-part upload: Finalize async (POST /chunks/:token/:uploadId/finalize)
  http.post('https://upload.ardrive.io/chunks/:token/:uploadId/finalize', async ({ params }) =>
    HttpResponse.json(
      {
        data: mockTurboData.uploadResponse(params.uploadId as string),
        id: params.uploadId,
      },
      { status: 202 },
    ),
  ),

  // Multi-part upload: Get finalize status (GET /chunks/:token/:uploadId/status)
  http.get('https://upload.ardrive.io/chunks/:token/:uploadId/status', async () =>
    HttpResponse.json({
      status: 'VALIDATING',
      timestamp: Date.now(),
    }),
  ),
]

/**
 * Default MSW handlers for Turbo Payment Service
 * Based on OpenAPI spec: https://payment.ardrive.io/api-docs
 */
export const turboPaymentHandlers = [
  // Get balance (GET /v1/balance) - supports both endpoints
  http.get('https://payment.ardrive.io/v1/balance', async () =>
    HttpResponse.json(mockTurboData.balanceResponse()),
  ),

  // Get balance with token path (GET /v1/account/balance/:token)
  http.get('https://payment.ardrive.io/v1/account/balance/:token', async ({ params: _params }) =>
    HttpResponse.json(mockTurboData.balanceResponse()),
  ),

  // Get price for bytes (GET /v1/price/bytes/:byteCount)
  http.get('https://payment.ardrive.io/v1/price/bytes/:byteCount', async ({ params: _params }) =>
    HttpResponse.json(mockTurboData.priceResponse()),
  ),

  // Get winc for payment type/amount (GET /v1/price/:type/:amount)
  http.get('https://payment.ardrive.io/v1/price/:type/:amount', async ({ params: _params }) =>
    HttpResponse.json({
      actualPaymentAmount: 1000,
      adjustments: [],
      fees: [],
      quotedPaymentAmount: 1000,
      winc: mockTurboData.priceResponse().winc,
    }),
  ),

  // Submit fund transaction (POST /v1/account/balance/:token)
  http.post(
    'https://payment.ardrive.io/v1/account/balance/:token',
    async ({ params: _params, request }) => {
      const body = (await request.json()) as { tx_id: string }
      return HttpResponse.json({
        creditedTransaction: mockTurboData.topUpResponse('1000000000000', body.tx_id),
        message: 'Transaction credited',
      })
    },
  ),
]

/**
 * Default MSW handlers for AO/ArNS Service
 */
export const aoHandlers = [
  // AO dry-run endpoint - used for reading contract state (getArNSRecord, etc.)
  http.post('https://cu.ardrive.io/dry-run', async ({ request }) => {
    const body = (await request.json()) as any
    const tags = body?.Tags || []
    const action = tags.find((t: any) => t.name === 'Action')?.value

    // Handle ArNS record lookup
    if (action === 'Record') {
      return HttpResponse.json({
        Error: null,
        Messages: [
          {
            Data: JSON.stringify({
              processId: 'xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10',
              purchasePrice: 1000,
              startTimestamp: Date.now() - 86_400_000,
              type: 'permabuy',
              undernameLimit: 10,
            }),
            Tags: [
              { name: 'Action', value: 'Record' },
              { name: 'Status', value: 'Success' },
            ],
          },
        ],
        Output: { data: 'Success' },
        Spawns: [],
      })
    }

    // Handle ANT Info (contract validation)
    if (action === 'Info') {
      return HttpResponse.json({
        Error: null,
        Messages: [
          {
            Data: JSON.stringify({
              Name: 'Mock ANT',
              Owner: 'mock-owner-address',
              Ticker: 'MOCK-ANT',
            }),
            Tags: [
              { name: 'Action', value: 'Info' },
              { name: 'Status', value: 'Success' },
            ],
          },
        ],
        Output: { data: 'Success' },
        Spawns: [],
      })
    }

    // Handle ANT State (get current records)
    if (action === 'State') {
      return HttpResponse.json({
        Error: null,
        Messages: [
          {
            Data: JSON.stringify({
              Balances: { 'mock-owner-address': 1 },
              Controllers: ['mock-owner-address'],
              Name: 'Mock ANT',
              Owner: 'mock-owner-address',
              Records: {
                '@': {
                  transactionId: 'existing-tx-id',
                  ttlSeconds: 3600,
                },
              },
              Ticker: 'MOCK-ANT',
            }),
            Tags: [
              { name: 'Action', value: 'State' },
              { name: 'Status', value: 'Success' },
            ],
          },
        ],
        Output: { data: 'Success' },
        Spawns: [],
      })
    }

    // Default response for other dry-run calls
    return HttpResponse.json({
      Error: null,
      Messages: [
        {
          Data: JSON.stringify({
            Records: {
              '@': {
                transactionId: 'mock-manifest-id',
                ttlSeconds: 3600,
              },
            },
          }),
          Tags: [
            { name: 'Action', value: 'Record' },
            { name: 'Status', value: 'Success' },
          ],
        },
      ],
      Output: { data: 'Success' },
      Spawns: [],
    })
  }),

  // AO message/interaction endpoint
  http.post('https://cu.ardrive.io/', async () =>
    HttpResponse.json({
      id: 'M4C3y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8',
      timestamp: Date.now(),
    }),
  ),

  // AO result endpoint - get message result (cu.ardrive.io)
  http.get('https://cu.ardrive.io/result/:messageId', async () =>
    HttpResponse.json({
      Error: null,
      Messages: [
        {
          Data: JSON.stringify({
            Records: {
              '@': {
                transactionId: 'J4C3y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8',
                ttlSeconds: 3600,
              },
            },
          }),
          Tags: [
            { name: 'Action', value: 'Record' },
            { name: 'Status', value: 'Success' },
          ],
        },
      ],
      Output: { data: 'Success' },
      Spawns: [],
    }),
  ),

  // AO result endpoint - get message result (cu.ao-testnet.xyz)
  http.get('https://cu.ao-testnet.xyz/result/:messageId', async () =>
    HttpResponse.json({
      Error: null,
      Messages: [
        {
          Data: JSON.stringify({
            Records: {
              '@': {
                transactionId: 'J4C3y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8',
                ttlSeconds: 3600,
              },
            },
          }),
          Tags: [
            { name: 'Action', value: 'Record' },
            { name: 'Status', value: 'Success' },
          ],
        },
      ],
      Output: { data: 'Success' },
      Spawns: [],
    }),
  ),

  // AO Message Unit (MU) - upload data item
  http.post('https://mu.ao-testnet.xyz/', async () =>
    HttpResponse.json({
      id: 'A4C3y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8',
      timestamp: Date.now(),
    }),
  ),

  // AR.IO GraphQL endpoint for contract state
  http.post('https://arweave.net/graphql', async () =>
    HttpResponse.json({
      data: {
        transactions: {
          edges: [
            {
              node: {
                id: 'xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10',
                owner: { address: 'mock-owner-address' },
                tags: [{ name: 'Contract-Src', value: 'ANT' }],
              },
            },
          ],
        },
      },
    }),
  ),
]

/**
 * All Turbo API handlers combined
 */
export const turboHandlers = [...turboUploadHandlers, ...turboPaymentHandlers, ...aoHandlers]

/**
 * Helper to create custom upload response
 * @param txId - The transaction ID to return
 * @returns MSW handler for upload success
 */
export function mockUploadSuccess(txId: string) {
  return http.post('https://upload.ardrive.io/v1/tx', async () =>
    HttpResponse.json(mockTurboData.uploadResponse(txId)),
  )
}

/**
 * Helper to create upload failure response
 * @param status - HTTP status code
 * @param message - Error message
 * @returns MSW handler for upload failure
 */
export function mockUploadFailure(status = 500, message = 'Upload failed') {
  return http.post('https://upload.ardrive.io/v1/tx', async () =>
    HttpResponse.json({ error: message }, { status }),
  )
}

/**
 * Helper to create insufficient balance scenario
 * @param winc - Balance amount in winc
 * @returns MSW handler for insufficient balance
 */
export function mockInsufficientBalance(winc = '100') {
  return http.get('https://payment.ardrive.io/v1/account/balance/:token', async () =>
    HttpResponse.json(mockTurboData.balanceResponse(winc)),
  )
}

/**
 * Helper to create on-demand funding success
 * @param winc - Amount topped up in winc
 * @returns MSW handler for on-demand funding success
 */
export function mockOnDemandFundingSuccess(winc = '1000000000000') {
  return http.post('https://payment.ardrive.io/v1/top-up', async () =>
    HttpResponse.json(mockTurboData.topUpResponse(winc)),
  )
}
