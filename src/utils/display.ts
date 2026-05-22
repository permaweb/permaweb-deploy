import boxen from 'boxen'
import chalk from 'chalk'
// eslint-disable-next-line import/no-named-as-default
import Table from 'cli-table3'

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

export function uploadErrorTable(message: string, title = 'Upload failed'): string {
  const table = new Table({
    style: { head: [] },
  })
  const sections = message
    .split(/\n{2,}/)
    .map((section) => section.trim())
    .filter(Boolean)

  for (const [index, section] of sections.entries()) {
    if (index === 0) {
      table.push(['Error', chalk.red(section)])
      continue
    }

    if (section.startsWith('Required upload credit:')) {
      table.push([
        'Required upload credit',
        chalk.blue(section.replace(/^Required upload credit:\s*/, '')),
      ])
      continue
    }

    if (section.startsWith('The HyperBEAM node requires AO')) {
      table.push(['Funding', fundingDisplay(section)])
      continue
    }

    table.push(['Note', section])
  }

  return boxen(`${chalk.red.bold(title)}\n\n${table.toString()}`, {
    borderColor: 'red',
    borderStyle: 'round',
    padding: 1,
    title: chalk.bold('Permaweb Deploy'),
    titleAlignment: 'center',
  })
}
