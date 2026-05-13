import type { UploadCost, UploadSize } from './hyperbeam-uploader.js'

const AO_BASE_UNITS = 1_000_000_000_000n

export function formatUploadSize(size: UploadSize): string {
  return `${(size.signedBytes ?? size.payloadBytes).toLocaleString()} bytes`
}

export function formatUploadCost(cost: UploadCost): string {
  if (cost.token !== 'AO') {
    return `${cost.amount.toString()}`
  }

  const whole = cost.amount / AO_BASE_UNITS
  const fraction = cost.amount % AO_BASE_UNITS
  const decimal =
    fraction === 0n
      ? whole.toString()
      : `${whole.toString()}.${fraction.toString().padStart(12, '0').replaceAll(/0+$/g, '')}`

  return `${decimal} AO`
}
