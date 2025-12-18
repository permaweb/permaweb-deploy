import { Readable } from 'node:stream'

import { OnDemandFunding, type TurboAuthenticatedClient } from '@ardrive/turbo-sdk'
import * as mime from 'mime-types'

export async function uploadFile(
  turbo: TurboAuthenticatedClient,
  filePath: string,
  options?: {
    fundingMode?: OnDemandFunding
  },
): Promise<string> {
  const mimeType = mime.lookup(filePath) || 'application/octet-stream'

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

  return uploadResult.id
}

export async function uploadFolder(
  turbo: TurboAuthenticatedClient,
  folderPath: string,
  options?: {
    fundingMode?: OnDemandFunding
    throwOnFailure?: boolean
  },
): Promise<string> {
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

  return txOrManifestId
}
