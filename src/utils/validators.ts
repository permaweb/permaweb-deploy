import fs from 'node:fs'

import { ARIO_MAINNET_PROCESS_ID, ARIO_TESTNET_PROCESS_ID } from '@ar.io/sdk'

import { ARWEAVE_TX_ID_REGEX, TTL_MAX, TTL_MIN } from './constants.js'
import { expandPath } from './path.js'

/**
 * Validate TTL seconds
 */
export function validateTtl(value: string): string | true {
  const num = Number.parseInt(value, 10)
  if (Number.isNaN(num)) {
    return 'TTL must be a valid number'
  }

  if (num < TTL_MIN || num > TTL_MAX) {
    return `TTL must be between ${TTL_MIN} and ${TTL_MAX} seconds`
  }

  return true
}

/**
 * Validate undername
 */
export function validateUndername(value: string): string | true {
  if (value.length === 0) {
    return 'Undername must not be empty'
  }

  return true
}

/**
 * Validate ARIO process ID
 */
export function validateArioProcess(value: string): string | true {
  // Allow shorthand values
  if (value === 'mainnet' || value === 'testnet') {
    return true
  }

  if (!ARWEAVE_TX_ID_REGEX.test(value)) {
    return 'ARIO process must be a valid Arweave transaction ID, "mainnet", or "testnet"'
  }

  return true
}

/**
 * Validate file path exists
 */
export function validateFileExists(value: string): string | true {
  const filePath = expandPath(value)
  if (!fs.existsSync(filePath)) {
    return `File ${value} does not exist`
  }

  return true
}

/**
 * Validate folder path exists
 */
export function validateFolderExists(value: string): string | true {
  const folderPath = expandPath(value)
  if (!fs.existsSync(folderPath)) {
    return `Folder ${value} does not exist`
  }

  return true
}

/**
 * Resolve ARIO process from shorthand to actual ID
 */
export function resolveArioProcess(value: string): string {
  if (value === 'mainnet') {
    return ARIO_MAINNET_PROCESS_ID
  }

  if (value === 'testnet') {
    return ARIO_TESTNET_PROCESS_ID
  }

  return value
}

/**
 * Validate ArNS name is not empty
 */
export function validateArnsName(value: string): string | true {
  if (value.length === 0) {
    return 'ArNS name is required'
  }

  return true
}
