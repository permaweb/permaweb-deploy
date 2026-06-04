# Legacy Upload API Test Mocks

This directory contains Mock Service Worker (MSW) handlers for testing legacy upload endpoints.

## Overview

MSW intercepts HTTP requests at the network level, allowing you to test your code with realistic API responses without hitting actual endpoints.

Upload mock handlers are typed from the legacy upload OpenAPI fixtures.

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
import { http, HttpResponse } from 'msw'

import { server } from '../setup.js'

describe('My Upload Test', () => {
  it('should upload successfully', async () => {
    server.use(
      http.post('https://up.arweave.net/v1/tx/arweave', () =>
        HttpResponse.json({ id: 'mock-tx-id-123' }),
      ),
    )

    // Your test code
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
  - `GET /v1/rates/:currency/:amount` - Get fiat rates

### Custom Handlers

Override default behavior for specific tests:

```typescript
import { server } from '../setup.js'
import { mockUploadSuccess, mockUploadFailure } from '../mocks/legacy-handlers.js'

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

## Mock Data

Access mock data generators for custom responses:

```typescript
import { mockLegacyData } from '../mocks/legacy-handlers.js'

const customUpload = mockLegacyData.uploadResponse('my-id')
const customBalance = mockLegacyData.balanceResponse('5000000000')
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
