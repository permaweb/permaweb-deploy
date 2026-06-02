import { input } from '@inquirer/prompts'

import { validateName } from '../utils/validators.js'

export async function promptName(): Promise<string> {
  return input({
    message: 'Enter your namespace name:',
    required: true,
    validate: validateName,
  })
}
