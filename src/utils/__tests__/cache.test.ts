import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  cleanupCache,
  getAllFiles,
  getCachedTransaction,
  hashFile,
  setCachedTransaction,
  touchCacheEntry,
  type TransactionCache,
} from '../cache.js'

describe('cache', () => {
  describe('getCachedTransaction', () => {
    it('should return undefined for non-existent hash', () => {
      const cache: TransactionCache = {}
      expect(getCachedTransaction(cache, 'nonexistent')).toBeUndefined()
    })

    it('should return the cached entry for existing hash', () => {
      const cache: TransactionCache = {
        abc123: {
          createdAtTimestamp: 1000,
          lastUsedTimestamp: 2000,
          transactionId: 'tx-123',
        },
      }
      const result = getCachedTransaction(cache, 'abc123')
      expect(result).toEqual({
        createdAtTimestamp: 1000,
        lastUsedTimestamp: 2000,
        transactionId: 'tx-123',
      })
    })
  })

  describe('setCachedTransaction', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should add a new cache entry', () => {
      const cache: TransactionCache = {}
      const result = setCachedTransaction(cache, 'hash123', 'tx-abc')

      expect(result).toEqual({
        hash123: {
          createdAtTimestamp: Date.now(),
          lastUsedTimestamp: Date.now(),
          transactionId: 'tx-abc',
        },
      })
    })

    it('should preserve createdAtTimestamp when updating existing entry', () => {
      const cache: TransactionCache = {
        hash123: {
          createdAtTimestamp: 1000,
          lastUsedTimestamp: 1500,
          transactionId: 'old-tx',
        },
      }
      const result = setCachedTransaction(cache, 'hash123', 'new-tx')

      expect(result.hash123.createdAtTimestamp).toBe(1000)
      expect(result.hash123.lastUsedTimestamp).toBe(Date.now())
      expect(result.hash123.transactionId).toBe('new-tx')
    })

    it('should not mutate the original cache', () => {
      const cache: TransactionCache = {}
      setCachedTransaction(cache, 'hash123', 'tx-abc')
      expect(cache).toEqual({})
    })
  })

  describe('touchCacheEntry', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should return unchanged cache if hash does not exist', () => {
      const cache: TransactionCache = {}
      const result = touchCacheEntry(cache, 'nonexistent')
      expect(result).toBe(cache)
    })

    it('should update lastUsedTimestamp for existing entry', () => {
      const cache: TransactionCache = {
        hash123: {
          createdAtTimestamp: 1000,
          lastUsedTimestamp: 1500,
          transactionId: 'tx-abc',
        },
      }
      const result = touchCacheEntry(cache, 'hash123')

      expect(result.hash123.createdAtTimestamp).toBe(1000)
      expect(result.hash123.lastUsedTimestamp).toBe(Date.now())
      expect(result.hash123.transactionId).toBe('tx-abc')
    })

    it('should not mutate the original cache', () => {
      const cache: TransactionCache = {
        hash123: {
          createdAtTimestamp: 1000,
          lastUsedTimestamp: 1500,
          transactionId: 'tx-abc',
        },
      }
      touchCacheEntry(cache, 'hash123')
      expect(cache.hash123.lastUsedTimestamp).toBe(1500)
    })
  })

  describe('cleanupCache', () => {
    it('should return unchanged cache if entries are within limit', () => {
      const cache: TransactionCache = {
        hash1: { createdAtTimestamp: 1000, lastUsedTimestamp: 1000, transactionId: 'tx1' },
        hash2: { createdAtTimestamp: 1000, lastUsedTimestamp: 2000, transactionId: 'tx2' },
      }
      const result = cleanupCache(cache, 5)
      expect(result).toBe(cache)
    })

    it('should keep only the most recently used entries', () => {
      const cache: TransactionCache = {
        middle: { createdAtTimestamp: 1000, lastUsedTimestamp: 2000, transactionId: 'tx2' },
        newest: { createdAtTimestamp: 1000, lastUsedTimestamp: 3000, transactionId: 'tx3' },
        oldest: { createdAtTimestamp: 1000, lastUsedTimestamp: 1000, transactionId: 'tx1' },
      }
      const result = cleanupCache(cache, 2)

      expect(Object.keys(result)).toHaveLength(2)
      expect(result.newest).toBeDefined()
      expect(result.middle).toBeDefined()
      expect(result.oldest).toBeUndefined()
    })

    it('should handle maxEntries of 1', () => {
      const cache: TransactionCache = {
        hash1: { createdAtTimestamp: 1000, lastUsedTimestamp: 1000, transactionId: 'tx1' },
        hash2: { createdAtTimestamp: 1000, lastUsedTimestamp: 2000, transactionId: 'tx2' },
        hash3: { createdAtTimestamp: 1000, lastUsedTimestamp: 3000, transactionId: 'tx3' },
      }
      const result = cleanupCache(cache, 1)

      expect(Object.keys(result)).toHaveLength(1)
      expect(result.hash3).toBeDefined()
    })
  })

  describe('hashFile', () => {
    let tempDir: string
    let tempFile: string

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cache-test-'))
      tempFile = path.join(tempDir, 'test-file.txt')
    })

    afterEach(() => {
      fs.rmSync(tempDir, { force: true, recursive: true })
    })

    it('should compute SHA-256 hash of file contents', async () => {
      fs.writeFileSync(tempFile, 'hello world')
      const hash = await hashFile(tempFile)

      // SHA-256 of "hello world"
      expect(hash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9')
    })

    it('should produce different hashes for different content', async () => {
      fs.writeFileSync(tempFile, 'content 1')
      const hash1 = await hashFile(tempFile)

      fs.writeFileSync(tempFile, 'content 2')
      const hash2 = await hashFile(tempFile)

      expect(hash1).not.toBe(hash2)
    })

    it('should produce consistent hash for same content', async () => {
      fs.writeFileSync(tempFile, 'consistent content')
      const hash1 = await hashFile(tempFile)
      const hash2 = await hashFile(tempFile)

      expect(hash1).toBe(hash2)
    })
  })

  describe('getAllFiles', () => {
    let tempDir: string

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cache-getallfiles-test-'))
    })

    afterEach(() => {
      fs.rmSync(tempDir, { force: true, recursive: true })
    })

    it('should return empty array for empty directory', () => {
      const files = getAllFiles(tempDir)
      expect(files).toEqual([])
    })

    it('should return relative paths for files', () => {
      fs.writeFileSync(path.join(tempDir, 'file1.txt'), 'content 1')
      fs.writeFileSync(path.join(tempDir, 'file2.txt'), 'content 2')

      const files = getAllFiles(tempDir)
      expect(files).toHaveLength(2)
      expect(files).toContain('file1.txt')
      expect(files).toContain('file2.txt')
    })

    it('should handle nested directories', () => {
      const subDir = path.join(tempDir, 'subdir')
      fs.mkdirSync(subDir)
      fs.writeFileSync(path.join(tempDir, 'root.txt'), 'root content')
      fs.writeFileSync(path.join(subDir, 'nested.txt'), 'nested content')

      const files = getAllFiles(tempDir)
      expect(files).toHaveLength(2)
      expect(files).toContain('root.txt')
      expect(files).toContain(path.join('subdir', 'nested.txt'))
    })

    it('should handle deeply nested directories', () => {
      const deepDir = path.join(tempDir, 'a', 'b', 'c')
      fs.mkdirSync(deepDir, { recursive: true })
      fs.writeFileSync(path.join(deepDir, 'deep.txt'), 'deep content')

      const files = getAllFiles(tempDir)
      expect(files).toHaveLength(1)
      expect(files).toContain(path.join('a', 'b', 'c', 'deep.txt'))
    })
  })
})
