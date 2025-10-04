import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

/**
 * Test Arweave wallet JWK
 * Loaded from fixtures/test_wallet.json
 */
export const TEST_ARWEAVE_WALLET = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/test_wallet.json'), 'utf8'),
)

/**
 * Test Ethereum private key
 * This is a deterministic test key - DO NOT use for real transactions
 */
export const TEST_ETH_PRIVATE_KEY =
  '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
