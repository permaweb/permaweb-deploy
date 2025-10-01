# Project Structure

This document explains the organization of the permaweb-deploy codebase.

## Directory Structure

```
permaweb-deploy/
├── .changeset/              # Changesets for version management
│   ├── config.json          # Changesets configuration
│   ├── README.md            # Changesets documentation
│   └── *.md                 # Individual changesets
├── .github/
│   └── workflows/
│       └── ci.yml           # CI/CD pipeline
├── .husky/                  # Git hooks
│   └── commit-msg           # Commit message validation
├── .vscode/                 # VS Code workspace settings
│   ├── extensions.json      # Recommended extensions
│   └── settings.json        # Editor settings
├── bin/                     # Executable entry points
│   ├── dev.js               # Development entry point (with tsx)
│   └── run.js               # Production entry point
├── dist/                    # Build output (generated)
├── src/                     # Source code
│   ├── commands/            # oclif commands
│   │   └── deploy.ts        # Deploy command implementation
│   ├── types/               # TypeScript type definitions
│   │   └── index.ts         # Shared types
│   ├── utils/               # Utility functions
│   │   ├── __tests__/       # Unit tests
│   │   │   └── constants.test.ts
│   │   ├── constants.ts     # Constants and regex patterns
│   │   ├── signer.ts        # Signer creation utilities
│   │   └── uploader.ts      # File/folder upload utilities
│   └── index.ts             # Main entry point
├── .editorconfig            # Editor configuration
├── .eslintignore            # ESLint ignore patterns
├── .eslintrc.json           # ESLint configuration
├── .gitignore               # Git ignore patterns
├── .nvmrc                   # Node version specification
├── .prettierignore          # Prettier ignore patterns
├── .prettierrc.json         # Prettier configuration
├── commitlint.config.js     # Commitlint configuration
├── CONTRIBUTING.md          # Contribution guidelines
├── MIGRATION.md             # Migration guide
├── package.json             # Package manifest
├── pnpm-workspace.yaml      # pnpm workspace configuration
├── PROJECT_STRUCTURE.md     # This file
├── QUICKSTART.md            # Quick start guide
├── README.md                # Main documentation
├── tsconfig.json            # TypeScript configuration
└── vite.config.ts           # Vite build configuration
```

## Source Code Organization

### Commands (`src/commands/`)

Contains oclif command implementations. Each file exports a default class extending `Command` from `@oclif/core`.

**Example:**
```typescript
// src/commands/deploy.ts
import { Command, Flags } from '@oclif/core'

export default class Deploy extends Command {
  static flags = { /* ... */ }
  async run() { /* ... */ }
}
```

### Types (`src/types/`)

TypeScript type definitions shared across the codebase.

**Example:**
```typescript
// src/types/index.ts
export type SignerType = 'arweave' | 'ethereum' | 'polygon' | 'kyve'
export interface DeployOptions { /* ... */ }
```

### Utils (`src/utils/`)

Utility functions organized by functionality:

- **constants.ts**: Regular expressions, TTL bounds, etc.
- **signer.ts**: Signer creation based on type
- **uploader.ts**: File and folder upload logic

Each utility module should:
- Be focused on a single responsibility
- Export pure functions when possible
- Include unit tests in `__tests__/` subdirectory

### Tests (`src/**/__tests__/`)

Tests are co-located with the code they test using the `__tests__` directory pattern.

**Example:**
```
src/utils/
├── constants.ts
├── signer.ts
└── __tests__/
    └── constants.test.ts
```

## Configuration Files

### Build & Runtime

- **vite.config.ts**: Vite build configuration for creating ESM bundles
- **tsconfig.json**: TypeScript compiler options
- **package.json**: Dependencies, scripts, and oclif configuration

### Code Quality

- **.eslintrc.json**: Linting rules for TypeScript
- **.prettierrc.json**: Code formatting rules
- **commitlint.config.js**: Commit message conventions

### Version Management

- **.changeset/config.json**: Changesets configuration
- Individual changeset files in `.changeset/*.md`

### Development Tools

- **.editorconfig**: Cross-editor configuration
- **.nvmrc**: Node version specification
- **.vscode/**: VS Code specific settings

## Build Process

1. **TypeScript Compilation**: TypeScript files are compiled to JavaScript
2. **Vite Bundling**: Entry points are bundled with dependencies externalized
3. **Declaration Files**: TypeScript declaration files are generated for type support

Build outputs:
```
dist/
├── index.js              # Main entry point
├── index.d.ts            # Type declarations
├── commands/
│   └── deploy.js         # Deploy command
├── utils/
│   ├── constants.js
│   ├── signer.js
│   └── uploader.js
└── types/
    └── index.js
```

## Entry Points

### Production
```bash
./bin/run.js → @oclif/core → dist/commands/deploy.js
```

### Development
```bash
./bin/dev.js → tsx → src/commands/deploy.ts
```

## Adding New Commands

1. Create command file:
   ```typescript
   // src/commands/your-command.ts
   import { Command } from '@oclif/core'
   
   export default class YourCommand extends Command {
     static description = 'Your command description'
     async run() {
       // Implementation
     }
   }
   ```

2. Update `vite.config.ts` entry points:
   ```typescript
   entry: {
     // ... existing entries
     'commands/your-command': resolve(__dirname, 'src/commands/your-command.ts'),
   }
   ```

3. Build and test:
   ```bash
   pnpm build
   ./bin/run.js your-command
   ```

## Testing Strategy

- **Unit tests**: For utility functions in `__tests__/` directories
- **Integration tests**: Command-level tests (to be added)
- **Coverage**: Aim for >80% coverage on utilities

Run tests:
```bash
pnpm test           # Watch mode
pnpm test:run       # Single run
pnpm test:coverage  # With coverage report
```

## Conventions

### File Naming
- Commands: kebab-case (e.g., `deploy.ts`)
- Utils: camelCase (e.g., `uploader.ts`)
- Types: camelCase (e.g., `index.ts`)
- Tests: same name as file being tested with `.test.ts` extension

### Code Style
- Use ESLint and Prettier
- Import sorting with `simple-import-sort`
- Conventional commits for commit messages

### Exports
- Use named exports for utilities
- Use default export for oclif commands
- Use `.js` extension in imports (ESM requirement)

## Development Workflow

1. Make changes in `src/`
2. Run tests: `pnpm test`
3. Check linting: `pnpm lint`
4. Format code: `pnpm format`
5. Build: `pnpm build`
6. Test manually: `./bin/dev.js deploy --help`
7. Create changeset: `pnpm changeset`
8. Commit with conventional commit message

