import { select } from '@inquirer/prompts'
import { Command } from '@oclif/core'

export default class Interactive extends Command {
  static override description = 'Interactive command selector for permaweb-deploy'

  static override examples = [
    '<%= config.bin %> interactive',
    '<%= config.bin %> interactive --help',
  ]

  public async run(): Promise<void> {
    this.log('🚀 Welcome to Permaweb Deploy!\n')

    const command = await select({
      choices: [
        {
          description: 'Deploy your application to the permaweb',
          name: 'Deploy to Permaweb',
          value: 'deploy',
        },
        {
          description: 'Display help information',
          name: 'Show Help',
          value: 'help',
        },
        {
          description: 'Exit the interactive prompt',
          name: 'Exit',
          value: 'exit',
        },
      ],
      message: 'What would you like to do?',
    })

    switch (command) {
      case 'deploy': {
        this.log('\n📦 Starting deployment wizard...\n')
        // Run the deploy command
        await this.config.runCommand('deploy', [])
        break
      }

      case 'help': {
        await this.config.runCommand('help', [])
        break
      }

      case 'exit': {
        this.log('\n👋 Goodbye!')
        break
      }

      default: {
        this.log('Unknown command')
      }
    }
  }
}
