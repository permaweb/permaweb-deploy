import { describe, expect, it } from 'vitest'

import {
  hyperbeamAoFundingHint,
  hyperbeamBundlerLink,
  parseHyperbeamFundAmount,
} from '../hyperbeam-uploader.js'

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

describe('hyperbeamAoFundingHint', () => {
  it('formats AO token and ledger payment metadata', () => {
    expect(
      hyperbeamAoFundingHint({
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

describe('parseHyperbeamFundAmount', () => {
  it('accepts positive token base-unit amounts', () => {
    expect(parseHyperbeamFundAmount('1000000000000')).toBe(1_000_000_000_000n)
  })

  it('rejects zero, negative, decimal, and non-numeric amounts', () => {
    for (const value of ['0', '-1', '1.5', 'AO']) {
      expect(() => parseHyperbeamFundAmount(value)).toThrow(/positive integer/)
    }
  })
})
