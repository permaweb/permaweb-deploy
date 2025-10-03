import { describe, expect, it } from 'vitest'

import {
  validateArioProcess,
  validateArnsName,
  validateFileExists,
  validateFolderExists,
  validateTtl,
} from '../../src/utils/validators.js'

describe('Validator Unit Tests', () => {
  describe('validateArnsName', () => {
    it('should accept valid arns names', () => {
      expect(validateArnsName('my-app')).toBe(true)
      expect(validateArnsName('test123')).toBe(true)
      expect(validateArnsName('a')).toBe(true)
    })

    it('should reject empty arns names', () => {
      expect(validateArnsName('')).toBe('ArNS name is required')
    })
  })

  describe('validateTtl', () => {
    it('should accept valid ttl values', () => {
      expect(validateTtl('60')).toBe(true)
      expect(validateTtl('3600')).toBe(true)
      expect(validateTtl('86400')).toBe(true)
    })

    it('should reject invalid ttl values', () => {
      expect(validateTtl('59')).toBe('TTL must be between 60 and 86400 seconds')
      expect(validateTtl('86401')).toBe('TTL must be between 60 and 86400 seconds')
      expect(validateTtl('abc')).toBe('TTL must be a valid number')
      expect(validateTtl('-100')).toBe('TTL must be between 60 and 86400 seconds')
    })
  })

  describe('validateArioProcess', () => {
    it('should accept valid arweave transaction IDs', () => {
      const validId = 'xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10'
      expect(validateArioProcess(validId)).toBe(true)
    })

    it('should reject invalid transaction IDs', () => {
      expect(validateArioProcess('short')).toMatch(/valid Arweave transaction ID/)
      expect(validateArioProcess('')).toMatch(/valid Arweave transaction ID/)
      expect(validateArioProcess('a'.repeat(50))).toMatch(/valid Arweave transaction ID/)
    })
  })

  describe('validateFileExists', () => {
    it('should accept existing files', () => {
      expect(validateFileExists('./package.json')).toBe(true)
      expect(validateFileExists('./README.md')).toBe(true)
    })

    it('should reject non-existent files', () => {
      expect(validateFileExists('./does-not-exist.txt')).toBe('File ./does-not-exist.txt does not exist')
    })

    it('should accept existing paths (even directories)', () => {
      // Note: validateFileExists only checks existence, not if it's actually a file
      expect(validateFileExists('./src')).toBe(true)
    })
  })

  describe('validateFolderExists', () => {
    it('should accept existing folders', () => {
      expect(validateFolderExists('./src')).toBe(true)
      expect(validateFolderExists('./tests')).toBe(true)
    })

    it('should reject non-existent folders', () => {
      expect(validateFolderExists('./does-not-exist-folder')).toBe(
        'Folder ./does-not-exist-folder does not exist',
      )
    })

    it('should accept existing paths (even files)', () => {
      // Note: validateFolderExists only checks existence, not if it's actually a folder
      expect(validateFolderExists('./package.json')).toBe(true)
    })
  })
})

