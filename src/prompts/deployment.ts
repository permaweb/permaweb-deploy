import { input, select } from '@inquirer/prompts'

import { validateFileExists, validateFolderExists } from '../utils/validators.js'

export interface DeployTarget {
  path: string
  type: 'file' | 'folder'
}

export async function promptDeployTarget(): Promise<DeployTarget> {
  const deployType = (await select({
    choices: [
      { name: 'Deploy a folder', value: 'folder' },
      { name: 'Deploy a single file', value: 'file' },
    ],
    message: 'What do you want to deploy?',
  })) as 'file' | 'folder'

  const deployPath = await (deployType === 'folder'
    ? input({
        default: './dist',
        message: 'Enter folder path to deploy:',
        validate: validateFolderExists,
      })
    : input({
        message: 'Enter file path to deploy:',
        validate: validateFileExists,
      }))

  return {
    path: deployPath,
    type: deployType,
  }
}
