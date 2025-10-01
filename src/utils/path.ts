import os from 'node:os'
import path from 'node:path'

/**
 * Expand tilde (~) to home directory in file paths
 */
export function expandPath(filePath: string): string {
  if (filePath.startsWith('~/')) {
    return path.join(os.homedir(), filePath.slice(2))
  }

  if (filePath === '~') {
    return os.homedir()
  }

  return filePath
}
