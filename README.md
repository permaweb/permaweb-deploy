# Permaweb Deployment Package

Inspired by the [cookbook github action deployment guide](https://cookbook.arweave.dev/guides/deployment/github-action.html), `permaweb-deploy` is a Node.js command-line tool designed to streamline the deployment of web applications to the permaweb using Arweave. It uploads your build folder or a single file, creates Arweave manifests, and updates ArNS (Arweave Name Service) records via ANT (Arweave Name Token) with the transaction ID.

### Features

- **Turbo SDK Integration:** Uses Turbo SDK for fast, reliable file uploads to Arweave
- **Arweave Manifest v0.2.0:** Creates manifests with fallback support for SPAs
- **ArNS Updates:** Updates ArNS records via ANT with new transaction IDs and metadata
- **Automated Workflow:** Integrates with GitHub Actions for continuous deployment
- **Git Hash Tagging:** Automatically tags deployments with Git commit hashes
- **404 Fallback Detection:** Automatically detects and sets 404.html as fallback
- **Network Support:** Supports mainnet, testnet, and custom ARIO process IDs
- **Flexible Deployment:** Supports deploying a folder or a single file

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

1. **For Arweave signer (default):** Encode your Arweave wallet key in base64 format and set it as a GitHub secret:

   ```bash
   base64 -i wallet.json | pbcopy
   ```

2. **For Ethereum/Polygon/KYVE signers:** Use your raw private key (no encoding needed) as the `DEPLOY_KEY`.

3. Ensure that the secret name for the encoded wallet or private key is `DEPLOY_KEY`.

⚠️ **Important:** Use a dedicated wallet for deployments to minimize security risks. Ensure your wallet has sufficient Turbo Credits for uploads.

### Usage

To deploy your application, ensure you have a build script and a deployment script in your `package.json`:

```json
"scripts": {
    "build": "your-build-command",
    "deploy": "npm run build && permaweb-deploy --arns-name <ARNS_NAME>"
}
```

Replace `<ARNS_NAME>` with your ArNS name. To deploy to an undername, add `--undername <UNDERNAME>`.

#### CLI Options

- `--arns-name, -n` (required): The ArNS name to update.
- `--ario-process, -p`: ARIO process to use (`mainnet`, `testnet`, or a custom process ID). Default: mainnet.
- `--deploy-folder, -d`: Folder to deploy. Default: `./dist`.
- `--deploy-file, -f`: Deploy a single file instead of a folder.
- `--undername, -u`: ANT undername to update. Default: `@`.
- `--ttl-seconds, -t`: TTL in seconds for the ANT record (60-86400). Default: `60`.
- `--sig-type, -s`: Signer type for deployment. Choices: `arweave`, `ethereum`, `polygon`, `kyve`. Default: `arweave`.
- `--help`: Show all available options and usage examples.
- `--version`: Show the current version number.

#### Example CLI Usage

Deploy a folder (default):

```sh
DEPLOY_KEY=$(base64 -i wallet.json) npx permaweb-deploy --arns-name my-app
```

Deploy a specific folder:

```sh
DEPLOY_KEY=$(base64 -i wallet.json) npx permaweb-deploy --arns-name my-app --deploy-folder ./build
```

Deploy a single file:

```sh
DEPLOY_KEY=$(base64 -i wallet.json) npx permaweb-deploy --arns-name my-app --deploy-file ./path/to/file.txt
```

Deploy to an undername:

```sh
DEPLOY_KEY=$(base64 -i wallet.json) npx permaweb-deploy --arns-name my-app --undername staging
```

Deploy with a custom TTL:

```sh
DEPLOY_KEY=$(base64 -i wallet.json) npx permaweb-deploy --arns-name my-app --ttl-seconds 7200
```

Deploy using a different signer (e.g., Ethereum):

```sh
DEPLOY_KEY=<ETH_PRIVATE_KEY> npx permaweb-deploy --arns-name my-app --sig-type ethereum
```

#### Example `package.json` Scripts

```json
"scripts": {
    "build": "vite build",
    "deploy": "npm run build && permaweb-deploy --arns-name <ARNS_NAME>"
}
```

#### ARIO Process Examples

**Mainnet (default):**

```json
"scripts": {
    "deploy-main": "npm run build && permaweb-deploy --arns-name <ARNS_NAME>"
}
```

**Testnet:**

```json
"scripts": {
    "deploy-test": "npm run build && permaweb-deploy --arns-name <ARNS_NAME> --ario-process testnet"
}
```

**Custom process ID:**

```json
"scripts": {
    "deploy-custom": "npm run build && permaweb-deploy --arns-name <ARNS_NAME> --ario-process <PROCESS_ID>"
}
```

### GitHub Actions Workflow

To automate the deployment, set up a GitHub Actions workflow as follows:

```yaml
name: Deploy to Permaweb
on:
  push:
    branches:
      - main
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20.x
      - run: npm install
      - run: npm run deploy
        env:
          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}
```


### Security & Best Practices

- **Dedicated Wallet:** Always use a dedicated wallet for deployments to minimize security risks
- **Wallet Encoding:** Arweave wallets must be base64 encoded to be used in the deployment script
- **ArNS Name:** The ArNS Name must be passed so that the ANT Process can be resolved to update the target undername or root record
- **Turbo Credits:** Ensure your wallet has sufficient Turbo Credits before deployment
- **Secret Management:** Keep your `DEPLOY_KEY` secret secure and never commit it to your repository
- **Build Security:** Always check your build for exposed environmental secrets before deployment, as data on Arweave is permanent

### Troubleshooting

- **Error: "ARNS_NAME not configured":** Ensure you're passing the `--arns-name` flag with a valid ArNS name
- **Error: "DEPLOY_KEY not configured":** Verify your base64 encoded wallet is set as the `DEPLOY_KEY` environment variable
- **Error: "deploy-folder does not exist":** Check that your build folder exists and the path is correct
- **Error: "deploy-file does not exist":** Check that your build file exists and the path is correct
- **Error: "ARNS name does not exist":** Verify the ArNS name is correct and exists in the specified network
- **Upload timeouts:** Files have a 10-second upload timeout. Large files may fail and require optimization
- **Insufficient Turbo Credits:** Ensure your wallet has enough Turbo Credits for the deployment

### Dependencies

- **@ar.io/sdk:** - For ANT operations and ArNS management
- **@ardrive/turbo-sdk:** - For fast file uploads to Arweave
- **@permaweb/aoconnect:** - For AO network connectivity
- **yargs:** - For CLI argument parsing
