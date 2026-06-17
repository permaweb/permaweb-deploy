import fs from 'node:fs'

import { expandPath } from './path.js'

/**
 * Validate file path exists.
 *
 * @param value - File path to validate.
 * @returns Validation error message, or true when the file exists.
 */
export function validateFileExists(value: string): string | true {
  const filePath = expandPath(value)
  if (!fs.existsSync(filePath)) {
    return `File ${value} does not exist`
  }

  return true
}

/**
 * Validate folder path exists.
 *
 * @param value - Folder path to validate.
 * @returns Validation error message, or true when the folder exists.
 */
export function validateFolderExists(value: string): string | true {
  const folderPath = expandPath(value)
  if (!fs.existsSync(folderPath)) {
    return `Folder ${value} does not exist`
  }

  return true
}

/**
 * Validate namespace name is not empty.
 *
 * @param value - Name to validate.
 * @returns Validation error message, or true when the name is present.
 */
export function validateName(value: string): string | true {
  if (value.length === 0) {
    return 'Namespace name is required'
  }

  return true
}
