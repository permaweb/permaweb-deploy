# Permaweb deployment package

Inspired by the [cookbook github action deployment guide](https://cookbook.arweave.dev/guides/deployment/github-action.html), `permaweb-deploy` is a Node.js command-line tool designed to streamline the deployment of web applications to the permaweb using Arweave. It simplifies the process by uploading your build folder, creating Arweave manifests, and updating ArNS (Arweave Name Service) records via ANT (Arweave Name Token) with the transaction ID.

### Features
- **Turbo SDK Integration:** Uses Turbo SDK for fast, reliable file uploads to Arweave
- **Arweave Manifest v0.2.0:** Creates manifests with fallback support for SPAs
- **ArNS Updates:** Updates ArNS records via ANT with new transaction IDs and metadata
- **Automated Workflow:** Integrates with GitHub Actions for continuous deployment
- **Git Hash Tagging:** Automatically tags deployments with Git commit hashes
- **404 Fallback Detection:** Automatically detects and sets 404.html as fallback
- **Network Support:** Supports mainnet, testnet, and custom ARIO process IDs

### Installation

Install the package using npm:

```bash
npm install permaweb-deploy
```

For development use:
```bash
npm install permaweb-deploy --save-dev
```

For Yarn users:
```bash
yarn add permaweb-deploy --dev --ignore-engines
```

### Prerequisites

Before using `permaweb-deploy`, you must:
1. **Arweave Wallet:** Have an Arweave wallet with Turbo Credits for uploading
2. **ArNS Name:** Own or control an ArNS name (which has an associated ANT process)
3. **Wallet Encoding:** Encode your Arweave wallet key in base64 format:
   ```bash
   base64 -i wallet.json | pbcopy
   ```
4. **GitHub Secret:** Set the encoded wallet as a GitHub secret named `DEPLOY_KEY`

⚠️ **Important:** Use a dedicated wallet for deployments to minimize security risks. Ensure your wallet has sufficient Turbo Credits for uploads.

### CLI Options
```bash
permaweb-deploy [options]
```

| Option | Alias | Description | Default | Required |
|--------|-------|-------------|---------|----------|
| `--arns-name` | `-n` | ArNS name for deployment | - | ✅ |
| `--ario-process` | `-p` | ARIO process ID or "mainnet"/"testnet" | `mainnet` | ❌ |
| `--deploy-folder` | `-d` | Folder to deploy | `./dist` | ❌ |
| `--undername` | `-u` | ANT undername to update | `@` | ❌ |

### Usage

To deploy your application, ensure you have a build script and a deployment script in your `package.json`:

```json
"scripts": {
    "build": "your-build-command",
    "deploy-main": "npm run build && permaweb-deploy --arns-name <ARNS_NAME>"
}
```

**Example with custom options:**
```bash
permaweb-deploy --arns-name "your-arns-name" --deploy-folder "./build" --undername "app"
```

Replace `<ARNS_NAME>` with your ArNS name. You can also specify testnet, mainnet, and custom process IDs for the ARIO process to use.

**Mainnet (default) config:**
```json
"scripts": {
    "build": "your-build-command",
    "deploy-main": "npm run build && permaweb-deploy --arns-name <ARNS_NAME> --ario-process mainnet"
}
```

**Testnet config:**
```json
"scripts": {
    "build": "your-build-command",
    "deploy-main": "npm run build && permaweb-deploy --arns-name <ARNS_NAME> --ario-process testnet"
}
```

**Custom process ID config:**
```json
"scripts": {
    "build": "your-build-command",
    "deploy-main": "npm run build && permaweb-deploy --arns-name <ARNS_NAME> --ario-process GaQrvEMKBpkjofgnBi_B3IgIDmY_XYelVLB6GcRGrHc"
}
```

### Manual CLI Deployment
```bash
DEPLOY_KEY=$(base64 -i wallet.json) npx permaweb-deploy --arns-name <ARNS_NAME>
```

### Technical Details
- **Upload Service:** Uses Turbo SDK for fast, reliable file uploads to Arweave
- **Manifest Format:** Creates Arweave manifests using version 0.2.0 specification
- **Fallback Support:** Automatically detects `404.html` and sets it as fallback, otherwise uses `index.html`
- **Upload Timeout:** 10-second timeout per file upload for reliability
- **ArNS Record TTL:** Sets 3600 seconds (1 hour) TTL for ArNS records via ANT
- **Deployment Tags:** Automatically adds `App-Name: Permaweb-Deploy` and Git hash tags
- **Network Support:** Supports mainnet, testnet, and custom ARIO process IDs

### GitHub Actions Workflow

To automate the deployment, set up a GitHub Actions workflow as follows:

```yaml
name: publish

on:
  push:
    branches:
      - 'main'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20.x
      - run: npm install
      - run: npm run deploy-main
        env:
          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}
```

### Security & Best Practices
- **Dedicated Wallet:** Always use a dedicated wallet for deployments to minimize security risks
- **Wallet Encoding:** The wallet must be base64 encoded to be used in the deployment script
- **ArNS Name:** The ArNS Name must be passed so that the ANT Process can be resolved to update the target undername or root record
- **Turbo Credits:** Ensure your wallet has sufficient Turbo Credits before deployment
- **Secret Management:** Keep your `DEPLOY_KEY` secret secure and never commit it to your repository
- **Build Security:** Always check your build for exposed environmental secrets before deployment, as data on Arweave is permanent

### Troubleshooting
- **Error: "ARNS_NAME not configured":** Ensure you're passing the `--arns-name` flag with a valid ArNS name
- **Error: "DEPLOY_KEY not configured":** Verify your base64 encoded wallet is set as the `DEPLOY_KEY` environment variable
- **Error: "deploy folder does not exist":** Check that your build folder exists and the path is correct
- **Error: "ARNS name does not exist":** Verify the ArNS name is correct and exists in the specified network
- **Upload timeouts:** Files have a 10-second upload timeout. Large files may fail and require optimization
- **Insufficient Turbo Credits:** Ensure your wallet has enough Turbo Credits for the deployment

### Dependencies
- **@ar.io/sdk:** ^3.10.1 - For ANT operations and ArNS management
- **@ardrive/turbo-sdk:** ^1.17.0 - For fast file uploads to Arweave
- **@permaweb/aoconnect:** ^0.0.84 - For AO network connectivity
- **mime-types:** ^2.1.35 - For automatic content type detection
- **yargs:** 17.7.2 - For CLI argument parsing
