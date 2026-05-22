import { chalk } from './chalk.js'
import type { UploadCost, UploadSize } from './hyperbeam-uploader.js'

const AO_BASE_UNITS = 1_000_000_000_000n

export type DisplayRow = [label: string, value: string]

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

export function formatDisplayRows(rows: DisplayRow[]): string {
  return rows.map(([label, value]) => `${label}: ${value}`).join('\n')
}

function fundingDisplay(section: string): string {
  const fundingLine = section
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('- '))
    ?.replace(/^- /, '')

  if (!fundingLine) {
    return section
  }

  return fundingLine
    .replace(/^AO: send funds to /, 'Sending AO to ')
    .replace(/\. Local ledger:.*$/, '')
}

export function formatUploadError(message: string, title = 'Upload failed'): string {
  const rows: DisplayRow[] = []
  const sections = message
    .split(/\n{2,}/)
    .map((section) => section.trim())
    .filter(Boolean)

  for (const [index, section] of sections.entries()) {
    if (index === 0) {
      rows.push(['Error', chalk.red(section)])
      continue
    }

    if (section.startsWith('Required upload credit:')) {
      rows.push([
        'Required upload credit',
        chalk.blue(section.replace(/^Required upload credit:\s*/, '')),
      ])
      continue
    }

    if (section.startsWith('The HyperBEAM node requires AO')) {
      rows.push(['Funding', fundingDisplay(section)])
      continue
    }

    rows.push(['Note', section])
  }

  return `${chalk.bold(chalk.red(title))}\n\n${formatDisplayRows(rows)}`
}
