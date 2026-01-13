import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { CACHE_DIR, CACHE_FILE } from '../constants/cache.js'

export interface TransactionCacheEntry {
  createdAtTimestamp: number
  lastUsedTimestamp: number
  transactionId: string
}

export type TransactionCache = Record<string, TransactionCacheEntry>

/**
 * Get the path to the cache file in the current working directory
 */
export function getCachePath(): string {
  return path.join(process.cwd(), CACHE_DIR, CACHE_FILE)
}

/**
 * Load the transaction cache from disk
 * Returns an empty object if the cache file doesn't exist or is invalid
 */
export function loadCache(): TransactionCache {
  const cachePath = getCachePath()

  try {
    if (!fs.existsSync(cachePath)) {
      return {}
    }

    const content = fs.readFileSync(cachePath, 'utf8')
    return JSON.parse(content) as TransactionCache
  } catch {
    // If the cache is corrupted or unreadable, start fresh
    return {}
  }
}

/**
 * Save the transaction cache to disk
 * Creates the cache directory if it doesn't exist
 */
export function saveCache(cache: TransactionCache): void {
  const cachePath = getCachePath()
  const cacheDir = path.dirname(cachePath)

  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true })
  }

  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf8')
}

/**
 * Compute the SHA-256 hash of a file using streaming
 */
export async function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = fs.createReadStream(filePath)

    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

/**
 * Recursively get all files in a directory
 */
function getAllFiles(dirPath: string, basePath: string = dirPath): string[] {
  const files: string[] = []

  for (const item of fs.readdirSync(dirPath)) {
    const fullPath = path.join(dirPath, item)
    const stats = fs.statSync(fullPath)

    if (stats.isDirectory()) {
      files.push(...getAllFiles(fullPath, basePath))
    } else {
      // Store relative path for consistent hashing
      files.push(path.relative(basePath, fullPath))
    }
  }

  return files
}

/**
 * Compute a combined SHA-256 hash of all files in a folder
 * Files are sorted by relative path for consistent ordering
 */
export async function hashFolder(folderPath: string): Promise<string> {
  const files = getAllFiles(folderPath).sort()
  const combinedHash = crypto.createHash('sha256')

  for (const relativePath of files) {
    const fullPath = path.join(folderPath, relativePath)
    const fileHash = await hashFile(fullPath)
    // Include both the relative path and file hash for uniqueness
    combinedHash.update(`${relativePath}:${fileHash}\n`)
  }

  return combinedHash.digest('hex')
}

/**
 * Get a cached transaction entry by its file hash
 */
export function getCachedTransaction(
  cache: TransactionCache,
  hash: string,
): TransactionCacheEntry | undefined {
  return cache[hash]
}

/**
 * Add or update a cache entry for a file hash
 * Updates lastUsedTimestamp if the entry already exists
 */
export function setCachedTransaction(
  cache: TransactionCache,
  hash: string,
  transactionId: string,
): TransactionCache {
  const now = Date.now()
  const existing = cache[hash]

  return {
    ...cache,
    [hash]: {
      createdAtTimestamp: existing?.createdAtTimestamp ?? now,
      lastUsedTimestamp: now,
      transactionId,
    },
  }
}

/**
 * Update the lastUsedTimestamp for an existing cache entry
 */
export function touchCacheEntry(cache: TransactionCache, hash: string): TransactionCache {
  const existing = cache[hash]
  if (!existing) {
    return cache
  }

  return {
    ...cache,
    [hash]: {
      ...existing,
      lastUsedTimestamp: Date.now(),
    },
  }
}

/**
 * Clean up the cache by keeping only the most recently used entries
 * Entries are sorted by lastUsedTimestamp descending, keeping the newest maxEntries
 */
export function cleanupCache(cache: TransactionCache, maxEntries: number): TransactionCache {
  const entries = Object.entries(cache)

  if (entries.length <= maxEntries) {
    return cache
  }

  // Sort by lastUsedTimestamp descending (newest first)
  const sorted = entries.sort(([, a], [, b]) => b.lastUsedTimestamp - a.lastUsedTimestamp)

  // Keep only the newest maxEntries
  const kept = sorted.slice(0, maxEntries)

  return Object.fromEntries(kept)
}
