import path from 'node:path'
import { Readable } from 'node:stream'

import { OnDemandFunding, type TurboAuthenticatedClient } from '@ardrive/turbo-sdk'
import * as mime from 'mime-types'
import pLimit from 'p-limit'

import {
  getAllFiles,
  getCachedTransaction,
  hashFile,
  setCachedTransaction,
  touchCacheEntry,
  type TransactionCache,
} from './cache.js'

export interface UploadResult {
  cacheHit: boolean
  transactionId: string
  updatedCache?: TransactionCache
}

export interface FolderUploadResult extends UploadResult {
  /** Number of files that were cache hits (not re-uploaded) */
  cacheHits: number
  /** Total number of files in the folder */
  totalFiles: number
  /** Number of files that were uploaded */
  uploaded: number
}

export async function uploadFile(
  turbo: TurboAuthenticatedClient,
  filePath: string,
  options?: {
    cache?: TransactionCache
    fundingMode?: OnDemandFunding
  },
): Promise<UploadResult> {
  const mimeType = mime.lookup(filePath) || 'application/octet-stream'

  // Compute hash if cache is provided
  const fileHash = options?.cache ? await hashFile(filePath) : undefined

  // Check cache for hit
  if (fileHash && options?.cache) {
    const cached = getCachedTransaction(options.cache, fileHash)
    if (cached) {
      const updatedCache = touchCacheEntry(options.cache, fileHash)
      return {
        cacheHit: true,
        transactionId: cached.transactionId,
        updatedCache,
      }
    }
  }

  // Upload file
  const uploadResult = await turbo.uploadFile({
    dataItemOpts: {
      tags: [
        {
          name: 'App-Name',
          value: 'Permaweb-Deploy',
        },
        {
          name: 'anchor',
          value: new Date().toISOString(),
        },
        {
          name: 'Content-Type',
          value: mimeType,
        },
      ],
    },
    file: filePath,
    ...(options?.fundingMode && { fundingMode: options.fundingMode }),
  })

  if (!uploadResult?.id) {
    throw new Error('Failed to upload file: upload result missing transaction ID')
  }

  // Store in cache if provided
  if (fileHash && options?.cache) {
    const updatedCache = setCachedTransaction(options.cache, fileHash, uploadResult.id)
    return {
      cacheHit: false,
      transactionId: uploadResult.id,
      updatedCache,
    }
  }

  return {
    cacheHit: false,
    transactionId: uploadResult.id,
  }
}

/** Default concurrency for parallel file uploads */
const DEFAULT_UPLOAD_CONCURRENCY = 10

interface FileUploadTask {
  cached?: { transactionId: string }
  fullPath: string
  hash: string
  relativePath: string
}

/**
 * Upload a folder with per-file deduplication.
 * Each file is checked against the cache individually, and only uncached files are uploaded.
 * A manifest is then constructed and uploaded to create the folder structure.
 */
export async function uploadFolder(
  turbo: TurboAuthenticatedClient,
  folderPath: string,
  options?: {
    cache?: TransactionCache
    concurrency?: number
    fundingMode?: OnDemandFunding
    throwOnFailure?: boolean
  },
): Promise<FolderUploadResult> {
  const concurrency = options?.concurrency ?? DEFAULT_UPLOAD_CONCURRENCY
  const useCache = options?.cache !== undefined

  // Get all files in the folder
  const relativePaths = getAllFiles(folderPath)

  if (relativePaths.length === 0) {
    throw new Error('Folder is empty, nothing to upload')
  }

  // Prepare file tasks with hashes (if caching is enabled)
  const tasks: FileUploadTask[] = await Promise.all(
    relativePaths.map(async (relativePath) => {
      const fullPath = path.join(folderPath, relativePath)
      const hash = useCache ? await hashFile(fullPath) : ''
      return { fullPath, hash, relativePath }
    }),
  )

  // Check cache for each file
  let cache = options?.cache ?? {}
  let cacheHits = 0

  for (const task of tasks) {
    if (useCache && task.hash) {
      const cached = getCachedTransaction(cache, task.hash)
      if (cached) {
        task.cached = { transactionId: cached.transactionId }
        cache = touchCacheEntry(cache, task.hash)
        cacheHits++
      }
    }
  }

  // If all files are cached, we still need to build and upload a new manifest
  // (because the manifest itself has a unique transaction ID each time)
  const uncachedTasks = tasks.filter((t) => !t.cached)

  // Upload uncached files with concurrency control using p-limit
  const limit = pLimit(concurrency)

  const uploadResults = await Promise.all(
    uncachedTasks.map((task) =>
      limit(async () => {
        const mimeType = mime.lookup(task.fullPath) || 'application/octet-stream'

        const uploadResult = await turbo.uploadFile({
          dataItemOpts: {
            tags: [
              { name: 'App-Name', value: 'Permaweb-Deploy' },
              { name: 'Content-Type', value: mimeType },
            ],
          },
          file: task.fullPath,
          ...(options?.fundingMode && { fundingMode: options.fundingMode }),
        })

        if (!uploadResult?.id) {
          if (options?.throwOnFailure) {
            throw new Error(`Failed to upload file: ${task.relativePath}`)
          }

          return { hash: task.hash, task, transactionId: null }
        }

        return { hash: task.hash, task, transactionId: uploadResult.id }
      }),
    ),
  )

  // Update cache with all successful uploads (done sequentially to avoid race conditions)
  for (const result of uploadResults) {
    if (useCache && result.hash && result.transactionId) {
      cache = setCachedTransaction(cache, result.hash, result.transactionId)
    }
  }

  // Check for any failed uploads
  const failedUploads = uploadResults.filter((r) => r.transactionId === null)
  if (failedUploads.length > 0 && options?.throwOnFailure) {
    throw new Error(
      `Failed to upload ${failedUploads.length} file(s): ${failedUploads.map((f) => f.task.relativePath).join(', ')}`,
    )
  }

  // Build manifest paths from cached and newly uploaded files
  const manifestPaths: Record<string, { id: string }> = {}

  for (const task of tasks) {
    let transactionId: string | null = null

    if (task.cached) {
      transactionId = task.cached.transactionId
    } else {
      const uploadResult = uploadResults.find((r) => r.task === task)
      transactionId = uploadResult?.transactionId ?? null
    }

    if (transactionId) {
      manifestPaths[task.relativePath] = { id: transactionId }

      // Add directory index support: if file is dir/index.html, also add dir → same ID
      if (task.relativePath.endsWith('/index.html')) {
        const dirPath = task.relativePath.replace(/\/index\.html$/, '')
        manifestPaths[dirPath] = { id: transactionId }
      }
    }
  }

  // Determine the index path (root index.html)
  const indexPath = relativePaths.includes('index.html') ? 'index.html' : undefined

  // Build the manifest
  const manifest = {
    manifest: 'arweave/paths',
    version: '0.2.0',
    ...(indexPath && { index: { path: indexPath } }),
    paths: manifestPaths,
  }

  // Upload the manifest
  const manifestBuffer = Buffer.from(JSON.stringify(manifest))
  const manifestUploadResult = await turbo.uploadFile({
    dataItemOpts: {
      tags: [
        { name: 'App-Name', value: 'Permaweb-Deploy' },
        { name: 'Content-Type', value: 'application/x.arweave-manifest+json' },
      ],
    },
    fileSizeFactory: () => manifestBuffer.length,
    fileStreamFactory: () => Readable.from(manifestBuffer),
    ...(options?.fundingMode && { fundingMode: options.fundingMode }),
  })

  if (!manifestUploadResult?.id) {
    throw new Error('Failed to upload manifest: upload result missing transaction ID')
  }

  return {
    cacheHit: cacheHits === tasks.length,
    cacheHits,
    totalFiles: tasks.length,
    transactionId: manifestUploadResult.id,
    updatedCache: useCache ? cache : undefined,
    uploaded: uncachedTasks.length - failedUploads.length,
  }
}
