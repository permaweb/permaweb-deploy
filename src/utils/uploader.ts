import { Readable } from 'node:stream'

import { OnDemandFunding, type TurboAuthenticatedClient } from '@ardrive/turbo-sdk'
import * as mime from 'mime-types'

import {
  getCachedTransaction,
  hashFile,
  hashFolder,
  setCachedTransaction,
  touchCacheEntry,
  type TransactionCache,
} from './cache.js'

export interface UploadResult {
  cacheHit: boolean
  transactionId: string
  updatedCache?: TransactionCache
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

export async function uploadFolder(
  turbo: TurboAuthenticatedClient,
  folderPath: string,
  options?: {
    cache?: TransactionCache
    fundingMode?: OnDemandFunding
    throwOnFailure?: boolean
  },
): Promise<UploadResult> {
  // Compute hash if cache is provided
  const folderHash = options?.cache ? await hashFolder(folderPath) : undefined

  // Check cache for hit
  if (folderHash && options?.cache) {
    const cached = getCachedTransaction(options.cache, folderHash)
    if (cached) {
      const updatedCache = touchCacheEntry(options.cache, folderHash)
      return {
        cacheHit: true,
        transactionId: cached.transactionId,
        updatedCache,
      }
    }
  }

  const uploadResult = await turbo.uploadFolder({
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
      ],
    },
    folderPath,
    ...(options?.fundingMode && {
      fundingMode: options.fundingMode,
      throwOnFailure: options.throwOnFailure,
    }),
  })

  let txOrManifestId = uploadResult.manifestResponse?.id

  // Make default folder paths work by adding extra path entries
  const origPaths = uploadResult.manifest?.paths || {}
  const newPaths: Record<string, { id: string }> = {}
  let replaceManifest = false

  for (const [key, value] of Object.entries(origPaths)) {
    newPaths[key] = value
    if (key.endsWith('/index.html')) {
      const newKey = key.replace(/\/index\.html$/, '')
      newPaths[newKey] = value
      replaceManifest = true
    }
  }

  if (replaceManifest && uploadResult.manifest) {
    console.info('Replacing manifest to support directory indexes')
    const newManifest = { ...uploadResult.manifest, paths: newPaths }
    const buffer = Buffer.from(JSON.stringify(newManifest))
    const manifestUploadResult = await turbo.uploadFile({
      dataItemOpts: {
        tags: [{ name: 'Content-Type', value: 'application/x.arweave-manifest+json' }],
      },
      fileSizeFactory: () => buffer.length,
      fileStreamFactory: () => Readable.from(buffer),
      ...(options?.fundingMode && { fundingMode: options.fundingMode }),
    })
    if (!manifestUploadResult?.id) {
      throw new Error('Failed to upload manifest: upload result missing transaction ID')
    }

    txOrManifestId = manifestUploadResult.id
  }

  if (!txOrManifestId) {
    throw new Error('Failed to upload folder')
  }

  // Store in cache if provided
  if (folderHash && options?.cache) {
    const updatedCache = setCachedTransaction(options.cache, folderHash, txOrManifestId)
    return {
      cacheHit: false,
      transactionId: txOrManifestId,
      updatedCache,
    }
  }

  return {
    cacheHit: false,
    transactionId: txOrManifestId,
  }
}
