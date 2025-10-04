# Turbo API Test Mocks

This directory contains Mock Service Worker (MSW) handlers for testing Turbo Upload and Payment Services.

## Overview

MSW intercepts HTTP requests at the network level, allowing you to test your code with realistic API responses without hitting actual endpoints.

All mock handlers are **fully typed** using TypeScript types generated from the official Turbo OpenAPI specifications.

## Type Generation

Types are automatically generated from OpenAPI specs located in `tests/fixtures/`:

- `upload-service.openapi.yaml` → `tests/types/upload-service.ts`
- `payment-service.openapi.yaml` → `tests/types/payment-service.ts`

**Regenerate types after updating OpenAPI specs:**

```bash
pnpm generate:types
```

## Quick Start

The MSW server is automatically configured for all tests via `tests/setup.ts`. Just write your tests normally:

```typescript
import { describe, expect, it } from 'vitest'
import { TurboFactory } from '@ardrive/turbo-sdk'

describe('My Upload Test', () => {
  it('should upload successfully', async () => {
    // MSW automatically intercepts and mocks Turbo API calls
    const turbo = TurboFactory.authenticated({ signer, token: 'arweave' })
    const result = await turbo.uploadFile({ file: './test.txt' })

    expect(result.id).toBe('mock-tx-id-123')
  })
})
```

## Available Handlers

### Default Handlers

All default handlers are automatically loaded:

- **Upload Service**
  - `POST /v1/tx` - Upload file/data item
  - `POST /v1/tx/bundle` - Upload folder/manifest
  - `POST /v1/price/bytes/:bytes` - Price estimation

- **Payment Service**
  - `GET /v1/balance` - Get wallet balance
  - `POST /v1/top-up` - Top up with tokens
  - `GET /v1/rates/:currency/:amount` - Get fiat rates

### Custom Handlers

Override default behavior for specific tests:

```typescript
import { server } from '../setup.js'
import { mockUploadSuccess, mockUploadFailure } from '../mocks/turbo-handlers.js'

it('should handle custom tx id', () => {
  server.use(mockUploadSuccess('my-custom-tx-id'))
  // Your test code
})

it('should handle upload errors', () => {
  server.use(mockUploadFailure(500, 'Custom error message'))
  // Your test code
})
```

## Helper Functions

### Upload Helpers

- `mockUploadSuccess(txId)` - Mock successful upload with custom TX ID
- `mockUploadFailure(status, message)` - Mock upload failure

### Payment Helpers

- `mockInsufficientBalance(winc)` - Mock low balance scenario
- `mockOnDemandFundingSuccess(winc)` - Mock successful on-demand top-up

### Example: Testing On-Demand Funding

```typescript
import { mockInsufficientBalance, mockOnDemandFundingSuccess } from '../mocks/turbo-handlers.js'
import { server } from '../setup.js'

it('should top up when balance is low', async () => {
  // Setup: wallet has low balance
  server.use(mockInsufficientBalance('100'), mockOnDemandFundingSuccess('1000000000000'))

  // Your upload code that triggers on-demand funding
  const result = await uploadWithOnDemandFunding()

  expect(result.success).toBe(true)
})
```

## Mock Data

Access mock data generators for custom responses:

```typescript
import { mockTurboData } from '../mocks/turbo-handlers.js'

const customUpload = mockTurboData.uploadResponse('my-id')
const customBalance = mockTurboData.balanceResponse('5000000000')
```

## Best Practices

1. **Reset handlers after each test** - Done automatically via `server.resetHandlers()` in `afterEach`
2. **Use specific mocks per test** - Override only what you need with `server.use()`
3. **Test both success and failure** - Use helper functions to simulate errors
4. **Isolate tests** - Don't rely on state from other tests

## Debugging

If you need to see which requests are being intercepted:

```typescript
server.listen({ onUnhandledRequest: 'error' }) // Fail on unmocked requests
```

Or log all requests:

```typescript
server.events.on('request:start', ({ request }) => {
  console.log('MSW intercepted:', request.method, request.url)
})
```
