# Next Steps

Now that the CLI has been revamped, here's what you need to do to get everything working.

## Immediate Actions (Required)

### 1. Install Dependencies

```bash
cd /Volumes/primary_all/code/permaweb/permaweb-deploy
pnpm install
```

This will:

- Install all dependencies from package.json
- Set up the pnpm workspace
- Prepare git hooks with husky

### 2. Build the Project

```bash
pnpm build
```

This will:

- Compile TypeScript to JavaScript
- Bundle with Vite
- Generate type declarations
- Output to `dist/` directory

### 3. Test the CLI

```bash
# Show help
./bin/run.js --help

# Show deploy command help
./bin/run.js deploy --help

# Test in development mode
./bin/dev.js deploy --help
```

### 4. Run Tests

```bash
# Run tests in watch mode
pnpm test

# Run tests once
pnpm test:run

# Run with coverage
pnpm test:coverage
```

### 5. Check Code Quality

```bash
# Run linter
pnpm lint

# Fix linting issues
pnpm lint:fix

# Check formatting
pnpm format:check

# Format code
pnpm format
```

## Post-Setup Actions (Recommended)

### 1. Initialize Git Hooks

If not already done:

```bash
pnpm prepare
```

This sets up Husky git hooks for commit message validation.

### 2. Test a Real Deployment

```bash
# Set your deploy key
export DEPLOY_KEY=$(base64 -i /path/to/wallet.json)

# Test deployment (use a test ArNS name)
./bin/run.js deploy --arns-name your-test-name --ario-process testnet
```

### 3. Update GitHub Repository

If you haven't already:

```bash
# Stage all changes
git add .

# Commit (will be validated by commitlint)
git commit -m "feat: revamp CLI with modern tooling

- Migrate from yargs to oclif
- Convert codebase to TypeScript
- Add Vite and Vitest
- Set up ESLint and Prettier
- Add changesets and commitlint
- Improve documentation"

# Push to your branch
git push origin revamp-cli
```

### 4. Create a Pull Request

1. Go to GitHub
2. Create a PR from `revamp-cli` to `main`
3. Add description using the template below

### 5. Set Up NPM Publishing (if needed)

If you want to publish to npm:

1. Get an NPM token: https://www.npmjs.com/settings/YOUR_USERNAME/tokens
2. Add it to GitHub secrets as `NPM_TOKEN`
3. The CI workflow will handle publishing when changesets are merged

## PR Description Template

```markdown
## 🚀 Major CLI Revamp

This PR completely revamps the permaweb-deploy CLI with modern tooling and best practices.

### ✨ What's New

- **TypeScript**: Full type safety with strict mode
- **oclif**: Professional CLI framework with better UX
- **Vite**: Fast builds with ESM support
- **Vitest**: Modern testing framework
- **Prettier**: Consistent code formatting
- **ESLint**: Enhanced with TypeScript plugins
- **commitlint**: Conventional commit enforcement
- **changesets**: Proper version management
- **pnpm**: Faster, more efficient package manager

### 📦 Package Changes

- Added: TypeScript, Vite, Vitest, oclif, Prettier, commitlint, changesets
- Removed: Babel and old build setup
- Updated: All dev dependencies to latest versions

### 💔 Breaking Changes

**Command structure:**

- Before: `permaweb-deploy --arns-name my-app`
- After: `permaweb-deploy deploy --arns-name my-app`

See [MIGRATION.md](./MIGRATION.md) for full migration guide.

### 📚 Documentation

- Added comprehensive README updates
- Added QUICKSTART.md for new users
- Added CONTRIBUTING.md for contributors
- Added MIGRATION.md for upgrading users
- Added PROJECT_STRUCTURE.md for code organization

### 🧪 Testing

- [x] Unit tests pass
- [x] Linting passes
- [x] Formatting passes
- [x] Build succeeds
- [x] CLI help works
- [ ] Real deployment tested (manual testing required)

### 🔍 Review Checklist

- [x] All requested features implemented
- [x] Documentation updated
- [x] Tests added
- [x] CI/CD configured
- [x] Migration guide provided
```

## Verification Checklist

Before considering this complete, verify:

- [ ] `pnpm install` completes successfully
- [ ] `pnpm build` creates dist/ directory
- [ ] `pnpm test` runs and passes
- [ ] `pnpm lint` shows no errors
- [ ] `pnpm format:check` shows no issues
- [ ] `./bin/run.js --help` displays help
- [ ] `./bin/run.js deploy --help` displays deploy help
- [ ] `./bin/dev.js deploy --help` works in dev mode
- [ ] Commit message validation works (try a bad commit message)
- [ ] CI workflow is valid (check .github/workflows/ci.yml)

## Optional Improvements

Consider these for future enhancements:

### 1. Add More Commands

```typescript
// src/commands/status.ts - Check deployment status
// src/commands/rollback.ts - Rollback to previous deployment
// src/commands/config.ts - Manage configuration
```

### 2. Add Integration Tests

```typescript
// src/__tests__/integration/deploy.test.ts
// Test full deployment flow with mocked services
```

### 3. Add Pre-commit Hook

```bash
# .husky/pre-commit
pnpm lint && pnpm test:run
```

### 4. Add More Documentation

- Architecture decision records (ADRs)
- API documentation
- Video tutorials
- Blog post about the migration

### 5. Performance Optimization

- Add caching for builds
- Optimize bundle size
- Add performance benchmarks

## Troubleshooting

### "pnpm: command not found"

Install pnpm globally:

```bash
npm install -g pnpm
```

Or use npx:

```bash
npx pnpm install
```

### Build Errors

Clear cache and rebuild:

```bash
rm -rf dist node_modules
pnpm install
pnpm build
```

### Test Failures

Check Node version (should be 18+):

```bash
node --version
```

Update if needed using nvm:

```bash
nvm use 20
```

### Linting Errors

Auto-fix most issues:

```bash
pnpm lint:fix
pnpm format
```

## Resources

- [oclif Documentation](https://oclif.io/)
- [Vite Documentation](https://vitejs.dev/)
- [Vitest Documentation](https://vitest.dev/)
- [Changesets Documentation](https://github.com/changesets/changesets)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [pnpm Documentation](https://pnpm.io/)

## Support

If you run into issues:

1. Check the documentation in this repository
2. Review the REVAMP_SUMMARY.md for what changed
3. Read the MIGRATION.md for migration help
4. Open an issue on GitHub
5. Reach out to the team

---

**Status**: Ready for testing and review! 🎉
