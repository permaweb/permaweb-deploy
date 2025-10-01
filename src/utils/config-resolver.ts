/**
 * Configuration for a single flag with its associated prompt
 */
export type FlagConfig<T = any, F = any> = {
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
export type FlagConfigMap = Record<string, FlagConfig<any, any>>

/**
 * Extract the resolved config type from a FlagConfigMap
 * Infers the actual type (string, number, boolean) and optionality from each FlagConfig
 */
export type ResolvedConfig<T extends FlagConfigMap> = {
  [K in keyof T]: T[K] extends FlagConfig<infer U, any> ? U : any
}

/**
 * Options for resolveConfig
 */
export interface ResolveConfigOptions {
  /** Whether to run in interactive mode */
  interactive?: boolean
  /** Custom logic to determine if interactive mode should be enabled */
  shouldBeInteractive?: (parsedFlags: Record<string, any>) => boolean
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
 *     arnsName: {
 *       flag: globalFlags.arnsName,
 *       prompt: promptArnsName,
 *       triggersInteractive: true,
 *     },
 *     wallet: {
 *       flag: globalFlags.wallet,
 *       prompt: async () => (await getWalletConfig()).wallet,
 *     },
 *   },
 *   flags,
 *   {
 *     shouldBeInteractive: (flags) => !flags['arns-name'],
 *   }
 * )
 * ```
 */
export async function resolveConfig<T extends FlagConfigMap>(
  flagConfigs: T,
  parsedFlags: Record<string, any>,
  options: ResolveConfigOptions = {},
): Promise<ResolvedConfig<T>> {
  const { interactive, shouldBeInteractive } = options

  // Determine if we should run in interactive mode
  const isInteractive =
    interactive ?? (shouldBeInteractive ? shouldBeInteractive(parsedFlags) : false)

  const resolved: Record<string, any> = {}

  for (const [key, config] of Object.entries(flagConfigs)) {
    const flagValue = parsedFlags[key]

    // If value exists from flags, use it
    if (flagValue !== undefined && flagValue !== null && flagValue !== '') {
      resolved[key] = config.transform ? config.transform(flagValue) : flagValue
      continue
    }

    // If interactive mode and prompt exists, use prompt
    if (isInteractive && config.prompt) {
      const promptValue = await config.prompt()
      resolved[key] = config.transform ? config.transform(promptValue) : promptValue
      continue
    }

    // Otherwise use the flag's default value (if any)
    const defaultValue = config.flag.default
    if (typeof defaultValue === 'function') {
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
 */
export function createFlagConfig<T, F = any>(config: FlagConfig<T, F>): FlagConfig<T, F> {
  return config
}

/**
 * Helper to extract just the flags from a FlagConfigMap for use in command static flags
 */
export function extractFlags<T extends FlagConfigMap>(flagConfigs: T): Record<string, any> {
  const flags: Record<string, any> = {}
  for (const [key, config] of Object.entries(flagConfigs)) {
    flags[key] = config.flag
  }

  return flags
}
