import { execFileSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'

import ora from 'ora'

import type { UploadClient } from './hyperbeam-uploader.js'

const CHUNK_SIZE = 100 * 1024
const ZERO_SHA = '0'.repeat(40)
const REPO_NAME = /^[\dA-Za-z][\w.-]{0,127}$/

export interface PermagitTarget {
  branch: string
  commitSha: string
  gitRoot: string
  ownerAddress: string
  repoName: string
}

export interface PermagitPublishResult extends PermagitTarget {
  packTransactionId: string
  refName: string
  refTransactionId: string
}

function git(args: string[], cwd: string, input?: string): Buffer {
  try {
    return execFileSync('git', args, {
      cwd,
      input,
      maxBuffer: 1024 ** 3,
      timeout: 10 * 60 * 1000,
    })
  } catch (error) {
    const stderr = String((error as { stderr?: unknown }).stderr ?? '').trim()
    throw new Error(stderr || `git ${args.join(' ')} failed`)
  }
}

const gitText = (args: string[], cwd: string): string => git(args, cwd).toString().trim()

function jwkOwner(deployKey: string): string {
  try {
    const jwk = JSON.parse(Buffer.from(deployKey, 'base64').toString()) as Record<string, unknown>
    if (jwk.kty !== 'RSA' || typeof jwk.n !== 'string' || typeof jwk.d !== 'string')
      throw new TypeError('Invalid RSA JWK')
    return createHash('sha256').update(Buffer.from(jwk.n, 'base64url')).digest('base64url')
  } catch {
    throw new Error('--permagit requires a valid Arweave JWK')
  }
}

function resolveBranch(gitRoot: string, requested?: string): string {
  if (requested !== undefined && !requested.trim())
    throw new Error('--permagit-ref cannot be empty')

  let branch = requested
  if (branch === undefined) {
    try {
      branch = gitText(['symbolic-ref', '--quiet', '--short', 'HEAD'], gitRoot)
    } catch {
      throw new Error('Cannot determine the current Git branch; pass --permagit-ref explicitly')
    }
  }

  branch = branch?.trim().replace(/^refs\/heads\//, '')
  if (!branch) {
    throw new Error('Cannot determine the current Git branch; pass --permagit-ref explicitly')
  }

  try {
    git(['check-ref-format', `refs/heads/${branch}`], gitRoot)
  } catch {
    throw new Error(`Invalid Permagit branch: ${branch}`)
  }

  return branch
}

export function preparePermagitTarget(
  repoName: string,
  deployKey: string,
  branch?: string,
  cwd = process.cwd(),
): PermagitTarget {
  if (!REPO_NAME.test(repoName)) {
    throw new Error(
      'Permagit repository name must be 1-128 characters using letters, numbers, dot, underscore, or hyphen',
    )
  }

  const ownerAddress = jwkOwner(deployKey)

  let gitRoot: string
  try {
    gitRoot = gitText(['rev-parse', '--show-toplevel'], cwd)
  } catch {
    throw new Error('--permagit must be run inside a Git repository')
  }

  const commitSha = gitText(['rev-parse', '--verify', 'HEAD^{commit}'], gitRoot)
  // Permagit currently parses SHA-1 object IDs throughout its clients.
  // eslint-disable-next-line unicorn/better-regex
  if (!/^[0-9a-f]{40}$/i.test(commitSha)) {
    throw new Error('Permagit currently requires a SHA-1 Git repository')
  }

  return {
    branch: resolveBranch(gitRoot, branch),
    commitSha,
    gitRoot,
    ownerAddress,
    repoName,
  }
}

export async function publishPermagit(
  target: PermagitTarget,
  uploadClient: UploadClient,
  chunkSizeBytes = CHUNK_SIZE,
): Promise<PermagitPublishResult> {
  if (!Number.isSafeInteger(chunkSizeBytes) || chunkSizeBytes <= 0) {
    throw new Error('Permagit chunk size must be a positive integer')
  }

  const spinner = ora('Creating Permagit pack').start()
  const upload = async (data: Buffer, tags: Record<string, string>): Promise<string> => {
    const allTags = {
      'App-Name': 'permagit',
      Owner: target.ownerAddress,
      Repo: target.repoName,
      ...tags,
    }
    const { id } = await uploadClient.uploadFile({
      dataItemOpts: {
        tags: Object.entries(allTags).map(([name, value]) => ({ name, value })),
      },
      file: data,
    })
    if (!id) throw new Error('Permagit upload did not return a transaction ID')
    return id
  }

  try {
    const pack = git(
      ['pack-objects', '--stdout', '--revs'],
      target.gitRoot,
      `${target.commitSha}\n`,
    )
    spinner.text = 'Publishing Permagit pack'
    let packTransactionId: string
    if (pack.byteLength <= chunkSizeBytes) {
      packTransactionId = await upload(pack, {
        'Content-Type': 'application/x-git-pack',
        'Pack-Type': 'full',
        Type: 'pack',
      })
    } else {
      const group = randomBytes(12).toString('hex')
      const total = Math.ceil(pack.byteLength / chunkSizeBytes)
      const chunks: string[] = []

      for (let index = 0; index < total; index += 1) {
        spinner.text = `Publishing Permagit pack chunk ${index + 1}/${total}`
        chunks.push(
          await upload(pack.subarray(index * chunkSizeBytes, (index + 1) * chunkSizeBytes), {
            'Chunk-Index': String(index),
            'Chunk-Total': String(total),
            'Content-Type': 'application/octet-stream',
            'Pack-Group': group,
            'Pack-Type': 'full',
            Type: 'pack-chunk',
          }),
        )
      }

      spinner.text = 'Publishing Permagit pack manifest'
      packTransactionId = await upload(
        Buffer.from(
          JSON.stringify({ chunks, group, totalSize: pack.byteLength, type: 'pack-manifest' }),
        ),
        {
          'Chunk-Total': String(total),
          'Content-Type': 'application/json',
          'Pack-Group': group,
          'Pack-Type': 'chunked',
          Type: 'pack',
        },
      )
    }

    const refName = `refs/heads/${target.branch}`
    const ref = {
      old: ZERO_SHA,
      packTx: packTransactionId,
      ref: refName,
      snapshotTx: null,
      target: target.commitSha,
    }
    spinner.text = 'Publishing Permagit ref'
    const refTransactionId = await upload(Buffer.from(JSON.stringify(ref)), {
      'Pack-Tx': packTransactionId,
      'Ref-Name': refName,
      'Ref-Old': ZERO_SHA,
      'Ref-Target': target.commitSha,
      Type: 'ref',
    })

    spinner.succeed(`Permagit ref published (${target.repoName}/${target.branch})`)
    return { ...target, packTransactionId, refName, refTransactionId }
  } catch (error) {
    spinner.fail('Permagit publication failed')
    throw error
  }
}
