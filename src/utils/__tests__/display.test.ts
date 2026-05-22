import { describe, expect, it } from 'vitest'

import {
  formatDisplayRows,
  formatUploadCost,
  formatUploadError,
  formatUploadSize,
} from '../display.js'

const escapeCode = String.fromCodePoint(27)
const stripAnsi = (value: string): string =>
  value.replaceAll(new RegExp(`${escapeCode}\\[[\\d;]*m`, 'g'), '')

describe('formatUploadSize', () => {
  it('formats the signed byte count when available', () => {
    expect(formatUploadSize({ payloadBytes: 18, signedBytes: 1144 })).toBe('1,144 bytes')
  })

  it('falls back to the payload byte count', () => {
    expect(formatUploadSize({ payloadBytes: 18 })).toBe('18 bytes')
  })
})

describe('formatUploadCost', () => {
  it('formats AO base units as decimal AO', () => {
    expect(formatUploadCost({ amount: 1_347_788_856n, token: 'AO' })).toBe('0.001347788856 AO')
  })
})

describe('formatDisplayRows', () => {
  it('formats rows as plain console labels', () => {
    expect(
      formatDisplayRows([
        ['Tx ID', 'abc123'],
        ['Arweave URL', 'https://arweave.net/abc123'],
      ]),
    ).toBe('Tx ID: abc123\nArweave URL: https://arweave.net/abc123')
  })
})

describe('formatUploadError', () => {
  it('formats upload errors without box or table characters', () => {
    const output = stripAnsi(
      formatUploadError('Upload rejected\n\nRequired upload credit: 0.25 AO'),
    )

    expect(output).toBe('Upload failed\n\nError: Upload rejected\nRequired upload credit: 0.25 AO')
    expect(output).not.toMatch(/[─│┌┐└┘]/)
  })
})
