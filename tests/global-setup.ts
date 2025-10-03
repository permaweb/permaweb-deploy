import { execSync } from 'node:child_process'

/**
 * Global setup for Vitest
 * Generates TypeScript types from OpenAPI specs before running tests
 */
export default function setup() {
  console.log('🔧 Generating types from OpenAPI specs...')

  try {
    execSync('pnpm generate:types', {
      stdio: 'inherit',
      cwd: process.cwd(),
    })
    console.log('✅ Types generated successfully\n')
  } catch (error) {
    console.error('❌ Failed to generate types:', error)
    throw error
  }
}

