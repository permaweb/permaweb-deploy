import { describe, expect, it } from 'vitest'

import { formatUploadCost, formatUploadSize } from '../display.js'

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
