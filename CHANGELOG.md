# permaweb-deploy

## 3.0.1

### Patch Changes

- f2dee44: Fix alpha release pipeline to properly create alpha-versioned releases

## 3.0.0

### Major Changes

- c346701: Major CLI revamp with modern tooling:
  - Migrated from yargs to oclif for better CLI structure
  - Converted entire codebase to TypeScript
  - Added Vite for building and Vitest for testing
  - Integrated ESLint with TypeScript plugins
  - Added Prettier with import sorting
  - Implemented commitlint for conventional commits
  - Added changesets for version management
  - Switched to pnpm as package manager
  - Improved code organization with proper folder structure
  - Enhanced error handling and user feedback
  - Updated documentation and added CONTRIBUTING.md
