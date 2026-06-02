import { describe, expect, it } from 'vitest'

import {
  validateFileExists,
  validateFolderExists,
  validateName,
} from '../../src/utils/validators.js'

describe('Validator Unit Tests', () => {
  describe('validateName', () => {
    it('should accept valid names', () => {
      expect(validateName('my-app')).toBe(true)
      expect(validateName('test123')).toBe(true)
      expect(validateName('a')).toBe(true)
    })

    it('should reject empty names', () => {
      expect(validateName('')).toBe('Namespace name is required')
    })
  })

  describe('validateFileExists', () => {
    it('should accept existing files', () => {
      expect(validateFileExists('./package.json')).toBe(true)
      expect(validateFileExists('./README.md')).toBe(true)
    })

    it('should reject non-existent files', () => {
      expect(validateFileExists('./does-not-exist.txt')).toBe(
        'File ./does-not-exist.txt does not exist',
      )
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
