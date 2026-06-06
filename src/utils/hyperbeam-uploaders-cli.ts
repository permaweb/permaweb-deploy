import { chalk } from './chalk.js'
import { type DisplayRow, formatDisplayRows } from './display.js'
import {
  type ActivePermawebOSBundler,
  fetchActivePermawebOSBundlers,
  type FetchActivePermawebOSBundlersOptions,
} from './permawebos-bundlers.js'

export interface FormatHyperbeamUploadersOptions extends FetchActivePermawebOSBundlersOptions {
  json?: boolean
}

export async function formatActiveHyperbeamUploaders(
  options: FormatHyperbeamUploadersOptions = {},
): Promise<string> {
  const uploaders = await fetchActivePermawebOSBundlers(options)
  return formatHyperbeamUploaders(uploaders, options.json)
}

export function formatHyperbeamUploaders(
  uploaders: ActivePermawebOSBundler[],
  json = false,
): string {
  if (json) {
    return JSON.stringify({ uploaders }, null, 2)
  }

  if (uploaders.length === 0) {
    return chalk.yellow('No active HyperBEAM uploaders found.')
  }

  const sections = uploaders.map((uploader, index) => {
    const rows: DisplayRow[] = [
      [`Uploader ${index + 1}`, chalk.cyan(uploader.url)],
      ['Ring', chalk.yellow(uploader.ring)],
      ['Address', chalk.gray(uploader.address)],
      ['Owner', chalk.gray(uploader.owner)],
    ]

    if (uploader.stake) {
      rows.push(['Stake', chalk.blue(uploader.stake)])
    }

    return formatDisplayRows(rows)
  })

  return [chalk.bold(chalk.cyan('Active HyperBEAM uploaders')), '', ...sections].join('\n\n')
}
