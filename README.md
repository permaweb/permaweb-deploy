# Permaweb deployment package

Inspired by the [cookbook github action deployment guide](https://cookbook.arweave.dev/guides/deployment/github-action.html), `permaweb-deploy` is a Node.js command-line tool designed to streamline the deployment of JavaScript bundles to the permaweb using Arweave. It simplifies the process by bundling JS code, deploying it as a transaction to Arweave, and updating ArNS (Arweave Name Service) with the transaction ID.

### Features

- **Bundle Deployment:** Automatically bundles your JS code and deploys it to Arweave.
- **ArNS Update:** Updates ArNS with the new transaction ID each time new content is deployed.
- **Automated Workflow:** Integrates with GitHub Actions for continuous deployment directly from your repository.

### Installation

Install the package using npm:

```bash
npm install permaweb-deploy
```

### Getting Help

```bash
# Get help with all available options
permaweb-deploy --help

# Check version
permaweb-deploy --version
```

### Prerequisites

Before using `permaweb-deploy`, you must:

1. **🚨 Security First:** Ensure your build folder contains **NO SECRETS** (API keys, environment variables, etc.) as deployed data is permanent and public on Arweave.

2. **For Arweave signer (default):** Encode your Arweave wallet key in base64 format and set it as a GitHub secret:

   ```bash
   base64 -i wallet.json | pbcopy
   ```

3. **For Ethereum/Polygon/KYVE signers:** Set your Ethereum private key directly as the `DEPLOY_KEY` (no base64 encoding needed).

4. **For Solana signer:** Set your Solana private key in base58 format as the `DEPLOY_KEY`.

5. Ensure that the secret name for the encoded wallet is `DEPLOY_KEY`.

### Usage

To deploy your application, ensure you have a build script and a deployment script in your `package.json`:

```json
"scripts": {
    "build": "your-build-command",
    "deploy-main": "npm run build && permaweb-deploy --arns-name <ARNS_NAME>"
}
```

Replace `<ARNS_NAME>` with your ArNS name.

### Optional Flags

- `--undername` (or `-u`): Deploy to an undername on your ArNS name. Default: `@`
- `--ttl` (or `-t`): TTL in seconds for the ANT record (60-86400). Default: `3600`
- `--sig-type` (or `-s`): Signer type for deployment. Choices: `arweave`, `ethereum`, `polygon`, `solana`, `kyve`. Default: `arweave`
- `--ario-process` (or `-p`): ARIO process to use. Can be `mainnet`, `testnet`, or a custom process ID
- `--deploy-folder` (or `-d`): Folder to deploy. Default: `./dist`
- `--help`: Show all available options and usage examples
- `--version`: Show the current version number

Example with undername:

```bash
permaweb-deploy --arns-name <ARNS_NAME> --undername <UNDERNAME>
```

### Deploy Folder Configuration

The `--deploy-folder` (or `-d`) flag specifies which directory contains your built application files that should be uploaded to the permaweb.

#### How It Works

- **Default:** `./dist` - The tool looks for a `dist` directory in your project root
- **Behavior:** The entire folder structure is uploaded and a manifest is automatically created
- **Manifest:** An Arweave manifest is generated that maps file paths to their transaction IDs, enabling proper web routing
- **🚨 Permanence:** All uploaded files become permanent and publicly accessible on Arweave - ensure no secrets are included

#### Common Build Tool Examples

**Vite (default output: `dist/`):**

```json
"scripts": {
    "build": "vite build",
    "deploy": "npm run build && permaweb-deploy --arns-name <ARNS_NAME>"
}
```

**Next.js (output: `out/`):**

```json
"scripts": {
    "build": "next build && next export",
    "deploy": "npm run build && permaweb-deploy --arns-name <ARNS_NAME> --deploy-folder ./out"
}
```

**Create React App (output: `build/`):**

```json
"scripts": {
    "deploy": "npm run build && permaweb-deploy --arns-name <ARNS_NAME> --deploy-folder ./build"
}
```

**Custom build directory:**

```json
"scripts": {
    "deploy": "npm run build && permaweb-deploy --arns-name <ARNS_NAME> --deploy-folder ./public"
}
```

#### Best Practices

1. **Build First:** Always run your build command before deploying
2. **Verify Contents:** Check that your deploy folder contains all necessary files
3. **Index File:** Ensure you have an `index.html` file for web applications
4. **Relative Paths:** Use relative paths in your build output for better compatibility
5. **File Size:** Be mindful of total folder size as it affects upload costs
6. **🚨 Security Check:** **Never include secrets, API keys, or sensitive data in your build folder** - Once deployed to Arweave, data is permanent and cannot be removed

#### CLI Examples

```bash
# Deploy from custom folder
npx permaweb-deploy --arns-name my-app --deploy-folder ./build

# Deploy with multiple options
npx permaweb-deploy --arns-name my-app --deploy-folder ./public --undername staging --ttl 7200
```

You can also specify testnet, mainnet, and custom process id's for the ARIO process to use.

Mainnet (default) config:

```json
"scripts": {
    "build": "your-build-command",
    "deploy-main": "npm run build && permaweb-deploy --arns-name <ARNS_NAME> --ario-process mainnet"
}
```

Testnet config:

```json
"scripts": {
    "build": "your-build-command",
    "deploy-main": "npm run build && permaweb-deploy --arns-name <ARNS_NAME> --ario-process testnet"
}
```

Custom process ID config:

```json
"scripts": {
    "build": "your-build-command",
    "deploy-main": "npm run build && permaweb-deploy --arns-name <ARNS_NAME> --ario-process GaQrvEMKBpkjofgnBi_B3IgIDmY_XYelVLB6GcRGrHc"
}
```

#### Additional Examples

Deploy with custom TTL (1 hour = 3600 seconds):

```json
"scripts": {
    "deploy-main": "npm run build && permaweb-deploy --arns-name <ARNS_NAME> --ttl 3600"
}
```

Deploy using Ethereum signer:

```json
"scripts": {
    "deploy-main": "npm run build && permaweb-deploy --arns-name <ARNS_NAME> --sig-type ethereum"
}
```

Deploy to undername with custom TTL and Polygon signer:

```json
"scripts": {
    "deploy-main": "npm run build && permaweb-deploy --arns-name <ARNS_NAME> --undername my-app --ttl 7200 --sig-type polygon"
}
```

Deploy using Solana signer:

```json
"scripts": {
    "deploy-main": "npm run build && permaweb-deploy --arns-name <ARNS_NAME> --sig-type solana"
}
```

Deploy using KYVE signer:

```json
"scripts": {
    "deploy-main": "npm run build && permaweb-deploy --arns-name <ARNS_NAME> --sig-type kyve"
}
```

Deploy from a custom build folder:

```json
"scripts": {
    "deploy-main": "npm run build && permaweb-deploy --arns-name <ARNS_NAME> --deploy-folder ./build"
}
```

**Note:** For more detailed information about configuring your deploy folder, see the [Deploy Folder Configuration](#deploy-folder-configuration) section.

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
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v1
        with:
          node-version: 20.x
      - run: npm install
      - run: npm run deploy-main
        env:
          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}
```

### To deploy to permaweb manually via cli

Basic deployment:

```sh
DEPLOY_KEY=$(base64 -i wallet.json) npx permaweb-deploy --arns-name <ARNS_NAME>
```

With custom options:

```sh
DEPLOY_KEY=$(base64 -i wallet.json) npx permaweb-deploy --arns-name <ARNS_NAME> --undername my-app --ttl 7200 --sig-type arweave
```

Using Ethereum signer (DEPLOY_KEY should be your Ethereum private key):

```sh
DEPLOY_KEY=<ETH_PRIVATE_KEY> npx permaweb-deploy --arns-name <ARNS_NAME> --sig-type ethereum
```

Using Solana signer (DEPLOY_KEY should be your Solana private key in base58 format):

```sh
DEPLOY_KEY=<SOLANA_PRIVATE_KEY_BASE58> npx permaweb-deploy --arns-name <ARNS_NAME> --sig-type solana
```

Using KYVE signer (DEPLOY_KEY should be your KYVE private key):

```sh
DEPLOY_KEY=<KYVE_PRIVATE_KEY> npx permaweb-deploy --arns-name <ARNS_NAME> --sig-type kyve
```

Deploy from a specific build folder:

```sh
DEPLOY_KEY=$(base64 -i wallet.json) npx permaweb-deploy --arns-name <ARNS_NAME> --deploy-folder ./build
```

### Important Notes

- **🚨 CRITICAL - Data Permanence:** **All files deployed to Arweave are permanent and immutable.** Never include secrets, API keys, environment variables, or any sensitive data in your build folder. Once deployed, this data cannot be removed and will be publicly accessible forever.

- **Security:** Always use a dedicated wallet for deployments to minimize risk.

- **Build Verification:** Always review your build folder contents before deployment to ensure no sensitive files are included.

- **Wallet Key Format:**

  - For Arweave signer: The wallet must be base64 encoded
  - For Ethereum/Polygon/KYVE signers: Use the raw private key (no encoding needed)
  - For Solana signer: Use the private key in base58 format

- **ARNS Name:** The ArNS Name must be passed in so that the ANT Process can be resolved to update the target undername or root record.

- **Signer Types:** Choose the appropriate signer type (`arweave`, `ethereum`, `polygon`, `solana`, or `kyve`) based on your wallet and payment preference for Turbo uploads.
