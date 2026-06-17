import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'commands/deploy': resolve(__dirname, 'src/commands/deploy.ts'),
        'commands/hyperbeam-uploaders': resolve(__dirname, 'src/commands/hyperbeam-uploaders.ts'),
        'commands/upload': resolve(__dirname, 'src/commands/upload.ts'),
        'workflows/upload-workflow': resolve(__dirname, 'src/workflows/upload-workflow.ts'),
        'constants/flags': resolve(__dirname, 'src/constants/flags.ts'),
        'prompts/names': resolve(__dirname, 'src/prompts/names.ts'),
        'prompts/deployment': resolve(__dirname, 'src/prompts/deployment.ts'),
        'prompts/wallet': resolve(__dirname, 'src/prompts/wallet.ts'),
        'utils/config-resolver': resolve(__dirname, 'src/utils/config-resolver.ts'),
        'utils/constants': resolve(__dirname, 'src/utils/constants.ts'),
        'utils/hyperbeam-uploaders-cli': resolve(__dirname, 'src/utils/hyperbeam-uploaders-cli.ts'),
        'utils/permawebos-bundlers': resolve(__dirname, 'src/utils/permawebos-bundlers.ts'),
        'utils/names': resolve(__dirname, 'src/utils/names.ts'),
        'utils/path': resolve(__dirname, 'src/utils/path.ts'),
        'utils/validators': resolve(__dirname, 'src/utils/validators.ts'),
        'utils/signer': resolve(__dirname, 'src/utils/signer.ts'),
        'utils/uploader': resolve(__dirname, 'src/utils/uploader.ts'),
        'types/index': resolve(__dirname, 'src/types/index.ts'),
      },
      formats: ['es'],
      fileName: (format, entryName) => `${entryName}.js`,
    },
    rollupOptions: {
      external: [
        '@permaweb/references',
        '@inquirer/prompts',
        '@oclif/core',
        '@permaweb/aoconnect',
        '@permaweb/hyperbalance',
        'arweave',
        'mime-types',
        'ora',
        /^node:.*/,
      ],
      output: {
        preserveModules: false,
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
      },
    },
    outDir: 'dist',
    sourcemap: true,
    target: 'esnext',
    minify: false,
  },
  test: {
    globals: true,
    environment: 'node',
    env: {
      // Enable MSW verbose logging by default (can be disabled with MSW_VERBOSE=false)
      MSW_VERBOSE: process.env.MSW_VERBOSE ?? 'true',
    },
    globalSetup: ['./tests/global-setup.ts'],
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', '**/*.spec.ts', '**/*.test.ts'],
    },
  },
})
