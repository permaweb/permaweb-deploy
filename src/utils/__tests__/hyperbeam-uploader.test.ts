import { describe, expect, it } from 'vitest'

import { hyperbeamBundlerLink } from '../hyperbeam-uploader.js'

describe('hyperbeamBundlerLink', () => {
  it('builds a direct HyperBEAM raw resolver URL', () => {
    expect(hyperbeamBundlerLink('https://hyperbeam.example.com', 'abc123')).toBe(
      'https://hyperbeam.example.com/~arweave@2.9/raw=abc123',
    )
  })

  it('handles uploader URLs with trailing slashes', () => {
    expect(hyperbeamBundlerLink('https://hyperbeam.example.com/', 'abc123')).toBe(
      'https://hyperbeam.example.com/~arweave@2.9/raw=abc123',
    )
  })
})
