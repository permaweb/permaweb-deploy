import { describe, expect, it, vi } from 'vitest'

import { fetchActivePermawebOSBundlers } from '../permawebos-bundlers.js'

const lapeeAddressKey = 'lapee_address'
const registeredAtKey = 'registered_at'
const stakedAtKey = 'staked_at'

function jsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    text: vi.fn(async () => JSON.stringify(body)),
  }
}

function createFetch(state: Record<string, unknown>) {
  return vi.fn(async (url: string) => {
    const match = url.match(/\/compute\/([^?]+)/)
    const path = match?.[1] ?? ''
    return jsonResponse(state[path])
  })
}

describe('PermawebOS Bundler discovery', () => {
  it('returns active bundlers using the same active and registered mirrors as ao-site', async () => {
    const fetch = createFetch({
      active: {
        commitments: {},
        'owner-a': {
          [lapeeAddressKey]: 'node-a',
          ring: 'permawebos-v0.1-gold',
          stake: '25000000000000',
          [stakedAtKey]: 1_779_926_407_525,
        },
        'owner-b': {
          [lapeeAddressKey]: 'node-b',
          ring: 'permawebos-v0.1-gold',
          stake: '25000000000000',
          [stakedAtKey]: 1_779_982_139_770,
        },
        status: 200,
      },
      registered: {
        commitments: {},
        'node-a': {
          location: 'https://dev-1.forward.computer/',
          owner: 'owner-a',
          [registeredAtKey]: 1_779_926_378_019,
        },
        'node-b': {
          location: 'https://lapee.hyperzine.xyz',
          owner: 'owner-b',
          [registeredAtKey]: 1_779_975_816_091,
        },
        status: 200,
      },
    })

    await expect(fetchActivePermawebOSBundlers({ fetch })).resolves.toEqual([
      {
        address: 'node-a',
        owner: 'owner-a',
        registeredAt: 1_779_926_378_019,
        ring: 'permawebos-v0.1-gold',
        stake: '25000000000000',
        stakedAt: 1_779_926_407_525,
        url: 'https://dev-1.forward.computer',
      },
      {
        address: 'node-b',
        owner: 'owner-b',
        registeredAt: 1_779_975_816_091,
        ring: 'permawebos-v0.1-gold',
        stake: '25000000000000',
        stakedAt: 1_779_982_139_770,
        url: 'https://lapee.hyperzine.xyz',
      },
    ])

    expect(fetch).toHaveBeenCalledWith(
      'https://push-9.forward.computer/Xv7dvev8_dJVwW7k_VGGdHpRqWpgSCgK4vzJmnBkg5M/compute/active?require-codec=application/json&accept-bundle=true',
      expect.objectContaining({
        headers: expect.objectContaining({ 'accept-bundle': 'true' }),
      }),
    )
  })

  it('unwraps AO body responses and filters by ring', async () => {
    const fetch = createFetch({
      active: {
        body: JSON.stringify({
          'owner-a': {
            'lapee-address': 'node-a',
            ring: 'gold',
          },
          'owner-b': {
            lapeeAddress: 'node-b',
            ring: 'silver',
          },
        }),
      },
      registered: {
        body: {
          'node-a': {
            location: 'https://gold.example.com',
          },
          'node-b': {
            location: 'https://silver.example.com',
          },
        },
      },
    })

    await expect(fetchActivePermawebOSBundlers({ fetch, ring: 'silver' })).resolves.toEqual([
      {
        address: 'node-b',
        owner: 'owner-b',
        registeredAt: undefined,
        ring: 'silver',
        stake: undefined,
        stakedAt: undefined,
        url: 'https://silver.example.com',
      },
    ])
  })

  it('drops active entries without a usable registered uploader URL', async () => {
    const fetch = createFetch({
      active: {
        'owner-a': {
          [lapeeAddressKey]: 'node-a',
          ring: 'gold',
        },
        'owner-b': {
          [lapeeAddressKey]: 'node-b',
          ring: 'gold',
        },
      },
      registered: {
        'node-a': {
          location: 'not-a-url',
        },
      },
    })

    await expect(fetchActivePermawebOSBundlers({ fetch })).resolves.toEqual([])
  })
})
