# Migration Guide (v2.x to v3.x)

This guide helps you migrate from the old yargs-based CLI to the new oclif-based CLI.

## Breaking Changes

### 1. Package Manager

**Before:** npm/yarn

**After:** pnpm (recommended)

```bash
# Remove old lock files
rm package-lock.json yarn.lock

# Install with pnpm
pnpm install
```

### 2. Command Structure

**Before (v2.x):**

```bash
permaweb-deploy --arns-name my-app --undername staging
```

**After (v3.x):**

```bash
permaweb-deploy deploy --arns-name my-app --undername staging
```

Note the addition of the `deploy` subcommand.

### 3. Package.json Scripts

**Before:**

```json
{
  "scripts": {
    "deploy": "npm run build && permaweb-deploy --arns-name my-app"
  }
}
```

**After:**

```json
{
  "scripts": {
    "deploy": "pnpm build && permaweb-deploy deploy --arns-name my-app"
  }
}
```

### 4. GitHub Actions

**Before:**

```yaml
- run: npm install
- run: npm run deploy
```

**After:**

```yaml
- uses: pnpm/action-setup@v3
  with:
    version: 9

- uses: actions/setup-node@v4
  with:
    node-version: 20
    cache: 'pnpm'

- run: pnpm install
- run: pnpm deploy
```

## What Hasn't Changed

### Environment Variables

The `DEPLOY_KEY` environment variable works exactly the same:

```bash
DEPLOY_KEY=$(base64 -i wallet.json) permaweb-deploy deploy --arns-name my-app
```

### CLI Flags

All flags remain the same:

- `--arns-name, -n`: ArNS name
- `--ario-process, -p`: ARIO process
- `--deploy-folder, -d`: Folder to deploy
- `--deploy-file, -f`: File to deploy
- `--ttl-seconds, -t`: TTL in seconds
- `--undername, -u`: ANT undername
- `--sig-type, -s`: Signer type

### Functionality

All core functionality remains identical:

- File and folder uploads
- Manifest creation
- ANT record updates
- Support for multiple signer types
- Network support (mainnet/testnet)

## New Features

### Better Error Messages

The new CLI provides clearer, more actionable error messages.

### Help System

Get help anytime:

```bash
permaweb-deploy --help
permaweb-deploy deploy --help
```

### TypeScript Support

The entire codebase is now in TypeScript with full type definitions.

### Development Tools

- ESLint with TypeScript
- Prettier with import sorting
- Vitest for testing
- Changesets for versioning
- Commitlint for conventional commits

## Step-by-Step Migration

1. **Update package.json**

   ```bash
   # Remove old version
   pnpm remove permaweb-deploy

   # Install new version
   pnpm add -D permaweb-deploy@^3.0.0
   ```

2. **Update scripts**

   Add `deploy` subcommand to all CLI invocations.

3. **Update CI/CD**

   Update GitHub Actions to use pnpm.

4. **Test locally**

   ```bash
   pnpm build
   DEPLOY_KEY=$(base64 -i wallet.json) pnpm deploy
   ```

5. **Deploy**

   Push your changes and test the deployment pipeline.

## Rollback Plan

If you need to rollback:

```bash
pnpm remove permaweb-deploy
pnpm add -D permaweb-deploy@^2.5.1
```

Then revert your package.json scripts and GitHub Actions changes.

## Getting Help

- [Open an issue](https://github.com/permaweb/permaweb-deploy/issues)
- [Read the docs](./README.md)
- [Quick start guide](./QUICKSTART.md)

## FAQ

**Q: Do I need to change my wallet encoding?**

A: No, wallet encoding remains the same.

---

**Q: Will my existing deployments be affected?**

A: No, this only affects the CLI tool itself, not your deployed applications.

---

**Q: Can I use npm/yarn instead of pnpm?**

A: Yes, but pnpm is recommended for better performance and disk space usage.

---

**Q: Do I need to update my ArNS configuration?**

A: No, ArNS configuration is unchanged.
