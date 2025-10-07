import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll } from 'vitest'

import { turboHandlers } from './mocks/turbo-handlers.js'

/**
 * Enable verbose logging for MSW requests
 * Set to true to see all intercepted requests
 */
const VERBOSE_LOGGING = process.env.MSW_VERBOSE === 'true'

/**
 * MSW Server for mocking HTTP requests in tests
 * Configured to intercept requests to:
 * - Turbo Upload Service (upload.ardrive.io)
 * - Turbo Payment Service (payment.ardrive.io)
 * - AO Compute Unit (cu.ardrive.io)
 * - AO Message Unit (mu.ao-testnet.xyz)
 * - Arweave GraphQL (arweave.net/graphql)
 */
export const server = setupServer(...turboHandlers)

// Start server before all tests
beforeAll(() => {
  server.listen({
    onUnhandledRequest(request, print) {
      // Don't warn about certain expected unhandled requests
      const url = new URL(request.url)
      const ignoredHosts = ['localhost', '127.0.0.1']

      if (ignoredHosts.includes(url.hostname)) {
        return
      }

      print.warning()
    },
  })

  if (VERBOSE_LOGGING) {
    console.log('\n🔧 MSW Server started with verbose logging enabled\n')
  }

  // Add request logging if verbose mode is enabled
  if (VERBOSE_LOGGING) {
    server.events.on('request:start', ({ request }) => {
      console.log('📤 [MSW] Request:', request.method, request.url)
    })

    server.events.on('request:match', ({ request }) => {
      console.log('✅ [MSW] Matched:', request.method, request.url)
    })

    server.events.on('request:unhandled', ({ request }) => {
      console.log('⚠️  [MSW] Unhandled:', request.method, request.url)
    })

    server.events.on('response:mocked', ({ request, response }) => {
      console.log('📥 [MSW] Response:', response.status, request.method, request.url)
    })
  }
})

// Reset handlers after each test
afterEach(() => {
  server.resetHandlers()
})

// Close server after all tests
afterAll(() => {
  server.close()
  if (VERBOSE_LOGGING) {
    console.log('\n🔧 MSW Server closed\n')
  }
})
