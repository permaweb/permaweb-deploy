import { describe, expect, it } from 'vitest'

import { formatHyperbeamUploaders } from '../hyperbeam-uploaders-cli.js'

const escapeCode = String.fromCodePoint(27)
const stripAnsi = (value: string): string =>
  value.replaceAll(new RegExp(`${escapeCode}\\[[\\d;]*m`, 'g'), '')

const uploaders = [
  {
    address: 'bundler-address-1',
    owner: 'owner1',
    ring: 'permawebos-v0.1-gold',
    stake: '1000',
    url: 'https://hyperbeam-a.test',
  },
]

describe('formatHyperbeamUploaders', () => {
  it('formats active uploaders for the CLI', () => {
    const output = stripAnsi(formatHyperbeamUploaders(uploaders))

    expect(output).toContain('Active HyperBEAM uploaders')
    expect(output).toContain('Uploader 1: https://hyperbeam-a.test')
    expect(output).toContain('Ring: permawebos-v0.1-gold')
    expect(output).toContain('Address: bundler-address-1')
    expect(output).toContain('Owner: owner1')
  })

  it('formats active uploaders as JSON', () => {
    expect(JSON.parse(formatHyperbeamUploaders(uploaders, true))).toEqual({ uploaders })
  })
})
