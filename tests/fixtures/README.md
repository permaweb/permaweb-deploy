# OpenAPI Specifications

This directory contains the OpenAPI specifications for Turbo services used to generate TypeScript types for testing.

## Files

- **`upload-service.openapi.yaml`** - Turbo Upload Service API specification
  - Original: https://turbo.ardrive.io/api-docs
  - Defines endpoints for uploading data items to Arweave

- **`payment-service.openapi.yaml`** - Turbo Payment Service API specification
  - Original: https://payment.ardrive.io/api-docs
  - Defines endpoints for balance, pricing, and payment processing

## Generating Types

TypeScript types are auto-generated from these specs using `openapi-typescript`:

```bash
# Generate types for both services
pnpm generate:types

# Or individually:
npx openapi-typescript tests/fixtures/upload-service.openapi.yaml -o tests/types/upload-service.ts
npx openapi-typescript tests/fixtures/payment-service.openapi.yaml -o tests/types/payment-service.ts
```

Generated types are used in:
- MSW mock handlers (`tests/mocks/turbo-handlers.ts`)
- Test files for type-safe API responses

## Updating Specifications

When Turbo APIs are updated:

1. Update the YAML files in this directory
2. Run `pnpm generate:types` to regenerate TypeScript types
3. Update mock handlers if response structures changed
4. Run tests to verify: `pnpm test`

## Type Usage Example

```typescript
import type { components } from '../types/upload-service.js'

type DataItemPost = components['schemas']['DataItemPost']

const mockResponse: DataItemPost = {
  id: 'tx-id',
  owner: 'address',
  // ... fully typed!
}
```

## Benefits

✅ **Type Safety** - All API responses are fully typed
✅ **Auto-completion** - IDE provides intelligent suggestions
✅ **Error Prevention** - TypeScript catches mismatches at compile time
✅ **Documentation** - Types serve as inline API documentation
✅ **Maintainability** - Single source of truth for API structure

