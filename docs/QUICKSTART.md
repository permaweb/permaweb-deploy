# Quick Start Guide

Get up and running with Permaweb Deploy in minutes!

## Installation

Using pnpm (recommended):

```bash
pnpm add -D permaweb-deploy
```

## Setup

1. **Prepare your wallet**

   For Arweave (default):
   ```bash
   base64 -i wallet.json | pbcopy
   ```

   For Ethereum/Polygon/KYVE:
   Use your raw private key directly.

2. **Set environment variable**

   ```bash
   export DEPLOY_KEY="<your-base64-encoded-wallet-or-private-key>"
   ```

3. **Add deployment script to package.json**

   ```json
   {
     "scripts": {
       "build": "vite build",
       "deploy": "pnpm build && permaweb-deploy deploy --arns-name <YOUR_ARNS_NAME>"
     }
   }
   ```

## Basic Usage

Deploy to production:

```bash
DEPLOY_KEY=$(base64 -i wallet.json) pnpm deploy
```

Deploy to staging (undername):

```bash
DEPLOY_KEY=$(base64 -i wallet.json) permaweb-deploy deploy \
  --arns-name my-app \
  --undername staging
```

## Common Scenarios

### Deploy a React/Vite App

```json
{
  "scripts": {
    "build": "vite build",
    "deploy": "pnpm build && permaweb-deploy deploy --arns-name my-app"
  }
}
```

### Deploy with Custom Build Folder

```bash
permaweb-deploy deploy --arns-name my-app --deploy-folder ./build
```

### Deploy Single File

```bash
permaweb-deploy deploy --arns-name my-app --deploy-file ./dist/index.html
```

### Deploy with Ethereum Wallet

```bash
DEPLOY_KEY=<eth-private-key> permaweb-deploy deploy \
  --arns-name my-app \
  --sig-type ethereum
```

## GitHub Actions Setup

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Permaweb

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      
      - run: pnpm install
      - run: pnpm deploy
        env:
          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}
```

## Troubleshooting

**Issue:** "DEPLOY_KEY environment variable not set"

**Solution:** Make sure you've exported the DEPLOY_KEY variable or passed it inline:
```bash
DEPLOY_KEY=$(base64 -i wallet.json) permaweb-deploy deploy --arns-name my-app
```

---

**Issue:** "deploy-folder does not exist"

**Solution:** Make sure your build step runs before deployment and outputs to the correct folder:
```bash
pnpm build && permaweb-deploy deploy --arns-name my-app --deploy-folder ./dist
```

---

**Issue:** "ArNS name does not exist"

**Solution:** Verify your ArNS name is registered and you're using the correct network (mainnet/testnet).

## Next Steps

- Read the full [README.md](./README.md) for detailed documentation
- Check [CONTRIBUTING.md](./CONTRIBUTING.md) to contribute
- See all available options: `permaweb-deploy deploy --help`

## Need Help?

- [Open an issue](https://github.com/permaweb/permaweb-deploy/issues)
- [Read the docs](https://docs.ar.io/)
- [Join the community](https://discord.gg/arweave)

