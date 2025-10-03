# Testing

This directory contains the test suite for `permaweb-deploy`.

## Test Structure

```
tests/
├── constants.ts              # Test constants (wallets, keys)
├── global-setup.ts           # Vitest global setup (type generation)
├── setup.ts                  # MSW server configuration
├── e2e/                      # End-to-end CLI tests
│   └── deploy-command.test.ts
├── fixtures/                 # Test fixtures and data
│   ├── test_wallet.json
│   ├── test-app/            # Sample deployment app
│   ├── upload-service.openapi.yaml
│   └── payment-service.openapi.yaml
├── mocks/                    # MSW request handlers
│   ├── turbo-handlers.ts    # Turbo API mocks
│   └── README.md
└── types/                    # Generated TypeScript types
    ├── payment-service.ts
    └── upload-service.ts
```

## Running Tests

```bash
# Run all tests
pnpm test:run

# Run unit tests only
pnpm test:unit

# Run E2E tests only
pnpm test:e2e

# Run tests in watch mode
pnpm test

# Run with coverage
pnpm test:coverage
```

## Verbose Logging

To see detailed MSW request/response flows during tests:

```bash
# Enable verbose logging for any test command
MSW_VERBOSE=true pnpm test:run
MSW_VERBOSE=true pnpm test:e2e
```

This will show:
- 📤 Outgoing requests
- ✅ Matched handlers
- ⚠️  Unhandled requests
- 📥 Mocked responses

**Default**: MSW verbose logging is **disabled** by default for cleaner test output.

## Type Generation

TypeScript types are automatically generated from OpenAPI specs before tests run via Vitest's `globalSetup`:

```bash
# Happens automatically before test:run, test:unit, test:e2e, etc.
pnpm test:e2e
# → 🔧 Generating types from OpenAPI specs...
# → ✨ openapi-typescript 7.9.1
# → 🚀 upload-service.openapi.yaml → upload-service.ts
# → 🚀 payment-service.openapi.yaml → payment-service.ts
# → ✅ Types generated successfully
```

You can also manually generate types:

```bash
pnpm generate:types
```

## Mock Service Worker (MSW)

Tests use [MSW](https://mswjs.io/) to intercept and mock HTTP requests at the network level. This provides:

- **Fast tests** - No real API calls
- **Isolated tests** - Consistent mock data
- **Reliable tests** - No network dependencies

### Mocked Services

The MSW server intercepts requests to:

1. **Turbo Upload Service** (`upload.ardrive.io`)
   - File and folder uploads
   - Multi-part uploads
   - Upload status checks

2. **Turbo Payment Service** (`payment.ardrive.io`)
   - Balance queries
   - Price calculations
   - Payment transactions

3. **AO Services**
   - Compute Unit (`cu.ardrive.io`) - Message execution and results
   - Message Unit (`mu.ao-testnet.xyz`) - Data item uploads

4. **Arweave** (`arweave.net/graphql`)
   - Contract state queries
   - Transaction lookups

## Writing Tests

### E2E Tests

E2E tests use `@oclif/test` to run actual CLI commands with mocked network requests:

```typescript
import { runCommand } from '@oclif/test'

it('should deploy with on-demand funding', async () => {
  const result = await runCommand([
    'deploy',
    '--deploy-folder', './test-app',
    '--on-demand', 'ario',
    '--max-token-amount', '1.5'
  ])

  expect(result.error).toBeUndefined()
})
```

### Adding New Mocks

Add handlers to `mocks/turbo-handlers.ts`:

```typescript
export const myHandlers = [
  http.post('https://api.example.com/endpoint', async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({
      success: true,
      data: body
    })
  })
]
```

Then add to the combined handlers:

```typescript
export const turboHandlers = [
  ...turboUploadHandlers,
  ...turboPaymentHandlers,
  ...myHandlers
]
```

## Test Constants

Use shared constants from `tests/constants.ts`:

```typescript
import { TEST_ARWEAVE_WALLET, TEST_ETH_PRIVATE_KEY } from '../constants.js'

// Use in tests
const signer = new ArweaveSigner(TEST_ARWEAVE_WALLET)
```

## Debugging

### View Handler Matches

Enable verbose logging to see which handlers are matching requests:

```bash
MSW_VERBOSE=true pnpm test:e2e
```

### Check Mock Responses

Inspect mock data generators in `mocks/turbo-handlers.ts`:

```typescript
export const mockTurboData = {
  uploadResponse: (id = 'mock-tx-id') => ({ ... }),
  balanceResponse: (winc = '1000000000000') => ({ ... }),
  // ... more generators
}
```

### Add Custom Logging

Add logging to specific handlers:

```typescript
http.post('https://api.example.com/endpoint', async ({ request }) => {
  console.log('Request body:', await request.clone().json())
  return HttpResponse.json({ success: true })
})
```

## CI/CD

Tests run automatically on:
- Pull requests
- Pushes to `main`
- Release workflows

See `.github/workflows/` for CI configuration.
