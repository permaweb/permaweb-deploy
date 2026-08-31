import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { TEST_ARWEAVE_WALLET } from '../../../tests/constants.js'
import type { UploadClient, UploadFileArgs } from '../hyperbeam-uploader.js'
import { preparePermagitTarget, publishPermagit } from '../permagit.js'

const DEPLOY_KEY = Buffer.from(JSON.stringify(TEST_ARWEAVE_WALLET)).toString('base64')

interface CapturedUpload {
  data: Buffer
  id: string
  tags: Record<string, string>
}

function mockUploadClient(): { client: UploadClient; uploads: CapturedUpload[] } {
  const uploads: CapturedUpload[] = []
  const client: UploadClient = {
    async uploadFile(args: UploadFileArgs) {
      const data = Buffer.isBuffer(args.file) ? args.file : Buffer.from('')
      const id = `upload-${uploads.length + 1}`
      uploads.push({
        data,
        id,
        tags: Object.fromEntries(
          (args.dataItemOpts?.tags ?? []).map((tag) => [tag.name, tag.value]),
        ),
      })
      return { id }
    },
  }

  return { client, uploads }
}

function target(repoName = 'my-app', branch = 'main') {
  return preparePermagitTarget(repoName, DEPLOY_KEY, branch)
}

describe('Permagit publishing', () => {
  it('prepares the current committed HEAD without changing the repository', () => {
    const prepared = target('my-app', 'test-branch')

    expect(prepared.branch).toBe('test-branch')
    expect(prepared.commitSha).toMatch(/^[\da-f]{40}$/)
    expect(prepared.gitRoot).toBe(process.cwd())
    expect(prepared.ownerAddress).toBe(
      createHash('sha256')
        .update(Buffer.from(TEST_ARWEAVE_WALLET.n, 'base64url'))
        .digest('base64url'),
    )
  })

  it('uploads a Permagit-compatible full pack and ref', async () => {
    const prepared = target()
    const { client, uploads } = mockUploadClient()

    const result = await publishPermagit(prepared, client, 10 * 1024 * 1024)

    expect(uploads).toHaveLength(2)
    expect(uploads[0].data.subarray(0, 4).toString('ascii')).toBe('PACK')
    expect(uploads[0].tags).toEqual({
      'App-Name': 'permagit',
      'Content-Type': 'application/x-git-pack',
      Owner: prepared.ownerAddress,
      'Pack-Type': 'full',
      Repo: 'my-app',
      Type: 'pack',
    })
    expect(JSON.parse(uploads[1].data.toString('utf8'))).toEqual({
      old: '0'.repeat(40),
      packTx: uploads[0].id,
      ref: 'refs/heads/main',
      snapshotTx: null,
      target: prepared.commitSha,
    })
    expect(uploads[1].tags).toEqual({
      'App-Name': 'permagit',
      Owner: prepared.ownerAddress,
      'Pack-Tx': uploads[0].id,
      'Ref-Name': 'refs/heads/main',
      'Ref-Old': '0'.repeat(40),
      'Ref-Target': prepared.commitSha,
      Repo: 'my-app',
      Type: 'ref',
    })
    expect(result.packTransactionId).toBe(uploads[0].id)
    expect(result.refTransactionId).toBe(uploads[1].id)
  })

  it('uses Permagit pack chunks and a pack manifest for larger packs', async () => {
    const prepared = target('chunked-app')
    const { client, uploads } = mockUploadClient()

    const result = await publishPermagit(prepared, client, 512 * 1024)

    const chunks = uploads.filter((upload) => upload.tags.Type === 'pack-chunk')
    const manifest = uploads.find(
      (upload) => upload.tags.Type === 'pack' && upload.tags['Pack-Type'] === 'chunked',
    )
    expect(chunks.length).toBeGreaterThan(1)
    expect(manifest).toBeDefined()
    const group = manifest!.tags['Pack-Group']
    expect(JSON.parse(manifest!.data.toString('utf8'))).toEqual({
      chunks: chunks.map((chunk) => chunk.id),
      group,
      totalSize: chunks.reduce((total, chunk) => total + chunk.data.byteLength, 0),
      type: 'pack-manifest',
    })
    expect(chunks[0].tags).toEqual({
      'App-Name': 'permagit',
      'Chunk-Index': '0',
      'Chunk-Total': String(chunks.length),
      'Content-Type': 'application/octet-stream',
      Owner: prepared.ownerAddress,
      'Pack-Group': group,
      'Pack-Type': 'full',
      Repo: 'chunked-app',
      Type: 'pack-chunk',
    })
    expect(manifest!.tags).toEqual({
      'App-Name': 'permagit',
      'Chunk-Total': String(chunks.length),
      'Content-Type': 'application/json',
      Owner: prepared.ownerAddress,
      'Pack-Group': group,
      'Pack-Type': 'chunked',
      Repo: 'chunked-app',
      Type: 'pack',
    })
    expect(result.packTransactionId).toBe(manifest!.id)
  })

  it('rejects invalid repository names and wallet material', () => {
    expect(() => preparePermagitTarget('bad repo', DEPLOY_KEY)).toThrow('Permagit repository name')
    expect(() =>
      preparePermagitTarget('my-app', Buffer.from('{}').toString('base64'), 'main'),
    ).toThrow('--permagit requires a valid Arweave JWK')
  })
})
