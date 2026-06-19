import { describe, expect, it } from 'vitest'

import {
  hyperbeamAoFundingHint,
  hyperbeamBundlerLink,
  hyperbeamFreeTierExhaustedMessage,
  isConditionalFreeTierQuote,
  parseHyperbeamFundAmount,
} from '../hyperbeam-uploader.js'

describe('hyperbeamBundlerLink', () => {
  it('builds a direct HyperBEAM item URL', () => {
    expect(hyperbeamBundlerLink('https://hyperbeam.example.com', 'abc123')).toBe(
      'https://hyperbeam.example.com/abc123',
    )
  })

  it('handles uploader URLs with trailing slashes', () => {
    expect(hyperbeamBundlerLink('https://hyperbeam.example.com/', 'abc123')).toBe(
      'https://hyperbeam.example.com/abc123',
    )
  })

  it('uses an app-root URL for manifests', () => {
    expect(hyperbeamBundlerLink('https://hyperbeam.example.com', 'abc123', true)).toBe(
      'https://hyperbeam.example.com/abc123/',
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
    ).toContain('AO: send funds to node-operator')
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

describe('isConditionalFreeTierQuote', () => {
  it('detects zero quotes that are conditional on free-tier quota', () => {
    expect(
      isConditionalFreeTierQuote({
        advisories: [
          {
            code: 'conditional-free-tier',
            message: 'Quota-dependent free quote',
            severity: 'warning',
          },
        ],
        amount: 0n,
      }),
    ).toBe(true)
  })

  it('does not treat paid quotes as conditional free-tier quotes', () => {
    expect(
      isConditionalFreeTierQuote({
        advisories: [
          {
            code: 'conditional-free-tier',
            message: 'Quota-dependent free quote',
            severity: 'warning',
          },
        ],
        amount: 1n,
      }),
    ).toBe(false)
  })
})

describe('hyperbeamFreeTierExhaustedMessage', () => {
  it('explains that trundler exhaustion becomes paid fallback', () => {
    expect(hyperbeamFreeTierExhaustedMessage('Insufficient funds')).toContain(
      'free-tier quota was exhausted',
    )
    expect(hyperbeamFreeTierExhaustedMessage()).toContain('AO payment')
  })
})
