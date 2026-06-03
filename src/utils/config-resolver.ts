import type { FlagInput } from '@oclif/core/lib/interfaces'

/**
 * Configuration for a single flag with its associated prompt
 */
type DefaultResolver = (context: Record<string, unknown>) => unknown | Promise<unknown>

type CommandFlag = {
  default?: unknown | DefaultResolver
}

type AnyFlagConfig = {
  flag: CommandFlag
  prompt?: () => Promise<unknown>
  transform?: (value: never) => unknown
  triggersInteractive?: boolean
}

function isDefaultResolver(value: unknown): value is DefaultResolver {
  return typeof value === 'function'
}

export type FlagConfig<T = unknown, F extends CommandFlag = CommandFlag> = {
  /** The oclif flag definition */
  flag: F
  /** Optional prompt function to get the value interactively */
  prompt?: () => Promise<T>
  /** Transform function to apply to the resolved value */
  transform?: (value: T) => T
  /** Whether this flag triggers interactive mode when missing */
  triggersInteractive?: boolean
}

/**
 * Map of flag configurations
 */
export type FlagConfigMap = Record<string, AnyFlagConfig>

/**
 * Extract the resolved config type from a FlagConfigMap
 * Infers the actual type (string, number, boolean) and optionality from each FlagConfig
 */
export type ResolvedConfig<T extends FlagConfigMap> = {
  [K in keyof T]: T[K] extends FlagConfig<infer U, CommandFlag> ? U : unknown
}

/**
 * Options for resolveConfig
 */
export interface ResolveConfigOptions {
  /** Whether to run in interactive mode */
  interactive?: boolean
  /** Custom logic to determine if interactive mode should be enabled */
  shouldBeInteractive?: (parsedFlags: Record<string, unknown>) => boolean
}

/**
 * Resolves configuration by combining parsed CLI flags with interactive prompts
 *
 * @param flagConfigs - Map of flag names to their configurations
 * @param parsedFlags - Parsed flags from this.parse()
 * @param options - Resolution options
 * @returns Fully resolved configuration object
 *
 * @example
 * ```typescript
 * const config = await resolveConfig(
 *   {
 *     name: {
 *       flag: globalFlags.name,
 *       prompt: promptName,
 *       triggersInteractive: true,
 *     },
 *     wallet: {
 *       flag: globalFlags.wallet,
 *       prompt: async () => (await getWalletConfig()).wallet,
 *     },
 *   },
 *   flags,
 *   {
 *     shouldBeInteractive: (flags) => !flags.name,
 *   }
 * )
 * ```
 */
export async function resolveConfig<T extends FlagConfigMap>(
  flagConfigs: T,
  parsedFlags: Record<string, unknown>,
  options: ResolveConfigOptions = {},
): Promise<ResolvedConfig<T>> {
  const { interactive, shouldBeInteractive } = options

  // Determine if we should run in interactive mode
  const isInteractive =
    interactive ?? (shouldBeInteractive ? shouldBeInteractive(parsedFlags) : false)

  const resolved: Record<string, unknown> = {}

  for (const [key, config] of Object.entries(flagConfigs)) {
    const flagValue = parsedFlags[key]

    // If value exists from flags, use it
    if (flagValue !== undefined && flagValue !== null && flagValue !== '') {
      resolved[key] = config.transform ? config.transform(flagValue as never) : flagValue
      continue
    }

    // If interactive mode and prompt exists, use prompt
    if (isInteractive && config.prompt) {
      const promptValue = await config.prompt()
      resolved[key] = config.transform ? config.transform(promptValue as never) : promptValue
      continue
    }

    // Otherwise use the flag's default value (if any)
    const defaultValue = config.flag.default
    if (isDefaultResolver(defaultValue)) {
      resolved[key] = await defaultValue({})
    } else if (defaultValue === undefined) {
      resolved[key] = flagValue // May be undefined
    } else {
      resolved[key] = defaultValue
    }
  }

  return resolved as ResolvedConfig<T>
}

/**
 * Helper to create a flag configuration with proper type inference
 *
 * @param config - Flag configuration to preserve.
 * @returns The same flag configuration with inferred value and flag types.
 */
export function createFlagConfig<T, F extends CommandFlag = CommandFlag>(
  config: FlagConfig<T, F>,
): FlagConfig<T, F> {
  return config
}

/**
 * Helper to extract just the flags from a FlagConfigMap for use in command static flags
 *
 * @param flagConfigs - Map of flag names to flag configurations.
 * @returns Map of flag names to oclif flag definitions.
 */
export function extractFlags<T extends FlagConfigMap>(
  flagConfigs: T,
): FlagInput<Record<string, unknown>> {
  const flags: Record<string, unknown> = {}
  for (const [key, config] of Object.entries(flagConfigs)) {
    flags[key] = config.flag
  }

  return flags as FlagInput<Record<string, unknown>>
}
