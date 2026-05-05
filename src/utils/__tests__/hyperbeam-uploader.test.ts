import { describe, expect, it } from 'vitest'

import { hyperbalanceFundingHint, hyperbeamBundlerLink } from '../hyperbeam-uploader.js'

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

describe('hyperbalanceFundingHint', () => {
  it('formats generic token and ledger discovery metadata', () => {
    expect(
      hyperbalanceFundingHint({
        ledgers: [
          {
            balancePath: '/ledger~process@1.0/now/balance/{address}',
            id: 'local-ao',
            route: '/ledger~process@1.0',
            type: 'process-ledger@1.0',
          },
        ],
        node: { operator: 'node-operator' },
        tokens: [
          {
            id: 'ao-mainnet',
            ledgerId: 'local-ao',
            ticker: 'AO',
          },
        ],
        version: 'hyperbalance@0.1',
      }),
    ).toContain('AO (ao-mainnet): send funds to node-operator')
  })
})
