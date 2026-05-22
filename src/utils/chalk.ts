const RESET = '\u001B[0m'
const WHITE = '\u001B[37m'
const BG_BLACK = '\u001B[40m'

const colorCodes = [
  ['bold', '\u001B[1m'],
  ['dim', '\u001B[2m'],
  ['italic', '\u001B[3m'],
  ['underline', '\u001B[4m'],
  ['inverse', '\u001B[7m'],
  ['strikethrough', '\u001B[9m'],

  ['black', '\u001B[30m'],
  ['red', '\u001B[31m'],
  ['green', '\u001B[32m'],
  ['yellow', '\u001B[33m'],
  ['blue', '\u001B[34m'],
  ['magenta', '\u001B[35m'],
  ['cyan', '\u001B[36m'],
  ['white', WHITE],
  ['gray', '\u001B[90m'],
  ['grey', '\u001B[90m'],

  ['blackBright', '\u001B[90m'],
  ['redBright', '\u001B[91m'],
  ['greenBright', '\u001B[92m'],
  ['yellowBright', '\u001B[93m'],
  ['blueBright', '\u001B[94m'],
  ['magentaBright', '\u001B[95m'],
  ['cyanBright', '\u001B[96m'],
  ['whiteBright', '\u001B[97m'],

  ['bgBlack', BG_BLACK],
  ['bgRed', '\u001B[41m'],
  ['bgGreen', '\u001B[42m'],
  ['bgYellow', '\u001B[43m'],
  ['bgBlue', '\u001B[44m'],
  ['bgMagenta', '\u001B[45m'],
  ['bgCyan', '\u001B[46m'],
  ['bgWhite', '\u001B[47m'],
  ['bgBlackBright', '\u001B[100m'],
] as const

type ColorName = (typeof colorCodes)[number][0]
type ColorFunction = (text: unknown) => string
type Chalk = {
  highlight: ColorFunction
} & Record<ColorName, ColorFunction>

const createColorFunction =
  (code: string): ColorFunction =>
  (text) =>
    `${code}${String(text)}${RESET}`

const colorFunctions = {} as Record<ColorName, ColorFunction>

for (const [name, code] of colorCodes) {
  colorFunctions[name] = createColorFunction(code)
}

export const chalk: Chalk = Object.assign(colorFunctions, {
  highlight: (text: unknown) => `${BG_BLACK}${WHITE}${String(text)} ${RESET}`,
})
