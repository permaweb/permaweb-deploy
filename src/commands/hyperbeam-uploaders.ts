import { Command, Flags } from '@oclif/core'

import { formatActiveHyperbeamUploaders } from '../utils/hyperbeam-uploaders-cli.js'
import {
  DEFAULT_PERMAWEBOS_BUNDLER_GATEWAY,
  DEFAULT_PERMAWEBOS_BUNDLER_STAKING_PROCESS,
} from '../utils/permawebos-bundlers.js'

export default class HyperbeamUploaders extends Command {
  static override args = {}

  static override description = 'List active HyperBEAM uploader endpoints'

  static override examples = [
    '<%= config.bin %> hyperbeam-uploaders',
    '<%= config.bin %> hyperbeam-uploaders --ring permawebos-v0.1-gold',
    '<%= config.bin %> hyperbeam-uploaders --json',
  ]

  static override flags = {
    gateway: Flags.string({
      default: DEFAULT_PERMAWEBOS_BUNDLER_GATEWAY,
      description: 'Gateway used to read PermawebOS bundler staking state.',
      required: false,
    }),
    json: Flags.boolean({
      default: false,
      description: 'Output uploaders as JSON.',
      required: false,
    }),
    'process-id': Flags.string({
      default: DEFAULT_PERMAWEBOS_BUNDLER_STAKING_PROCESS,
      description: 'PermawebOS bundler staking process ID.',
      required: false,
    }),
    ring: Flags.string({
      description: 'Only include uploaders in this staking ring.',
      required: false,
    }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(HyperbeamUploaders)

    this.log(
      await formatActiveHyperbeamUploaders({
        gateway: flags.gateway,
        json: flags.json,
        processId: flags['process-id'],
        ring: flags.ring,
      }),
    )
  }
}
