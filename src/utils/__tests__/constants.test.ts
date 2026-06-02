import { describe, expect, it } from 'vitest'

import { ARWEAVE_TX_ID_REGEX } from '../constants.js'

describe('constants', () => {
  describe('ARWEAVE_TX_ID_REGEX', () => {
    it('should match valid Arweave transaction IDs', () => {
      const validIds = [
        'dQNHo0ghRz4xT7GWPNiKVBdMfNEXjfvKPh5hBcHt8xI',
        'Y2JtSl-XKwOp_5_k4zH0LMqZqF3u8YPHQcBjB6bMvGo',
        '1234567890123456789012345678901234567890123',
      ]

      for (const id of validIds) {
        expect(ARWEAVE_TX_ID_REGEX.test(id)).toBe(true)
      }
    })

    it('should not match invalid Arweave transaction IDs', () => {
      const invalidIds = [
        'too-short',
        'too-long-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        'invalid@characters',
        '',
      ]

      for (const id of invalidIds) {
        expect(ARWEAVE_TX_ID_REGEX.test(id)).toBe(false)
      }
    })
  })
})
