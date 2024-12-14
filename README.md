# Permaweb deployment package

Inspired by the [cookbook github action deployment guide](https://cookbook.arweave.dev/guides/deployment/github-action.html), `permaweb-deploy` is a Node.js command-line tool designed to streamline the deployment of JavaScript bundles to the permaweb using Arweave. It simplifies the process by bundling JS code, deploying it as a transaction to Arweave, and updating ArNS (Arweave Name Service) with the transaction ID.

### Features
- **Bundle Deployment:** Automatically bundles your JS code and deploys it to Arweave.
- **ArNS Update:** Updates ArNS with the new transaction ID each time new content is deployed.
- **Automated Workflow:** Integrates with GitHub Actions for continuous deployment directly from your repository.
- **Cross-chain support:** Upload data to Arweave and update ArNS using Arweave, Eth, or POL/Matic wallets.

### Installation
Install the package using npm:
```bash
npm install permaweb-deploy
```

### Prerequisites
Before using `permaweb-deploy`, you must:
1. Encode your Arweave wallet key in base64 format and set it as a GitHub secret:

   ```bash
   base64 -i wallet.json | pbcopy
   ```
2. Ensure that the secret name for the encoded wallet is `DEPLOY_KEY`.

**NOTE:** ETH and POL/Matic wallets should use their private key, ***WITHOUT*** base64 encoding for `DEPLOY_KEY`

### Usage
To deploy your application, ensure you have a build script and a deployment script in your `package.json`:

```json
"scripts": {
    "build": "your-build-command",
    "deploy-main": "npm run build && permaweb-deploy --ant-process <ANT_PROCESS>"
}
```

Replace `<ANT_PROCESS>` with your actual ANT process.

#### `--deploy-folder`

The default folder to upload is `./dist`, you can specify a different folder path using the `--deploy-folder` flag:

```bash
permaweb-deploy --ant-process <ANT_PROCESS> --deploy-folder "./next"
```

#### Ethereum and POL/Matic

Permaweb-deploy defaults to uploading with an Arweave Wallet. You can specify an ETH or POL/Matic wallet by providing a `-e` (`--ethereum`) flag for ETH or a `-p` (`--pol`) flag for POL/Matic.

Providing both `-e` and `-p` flags will result in an error.

The `DEPLOY_KEY` environmental variable must be set to the private key of the ETH or POL/Matic wallet, without any additional encoding.

#### Undernames

Permaweb-deploy can update undername records for an ArNS name instead of the top level name. That is, you can deploy your project to `this-project_my-name` where `this-project` is an undername on the ArNS name `my-name`. 

This is done by specifying the undername using the `--undername` flag:

```bash
permaweb-deploy --ant-process <ANT_PROCESS> --undername "this-project"
```

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

```sh
DEPLOY_KEY=$(base64 -i wallet.json) npx permaweb-deploy --ant-process <ANT_PROCESS>
```

### Important Notes
- **Security:** Always use a dedicated wallet for deployments to minimize risk.
- **Wallet Key:** Arweave wallets must be base64 encoded to be used in the deployment script. Ethereum and POL/Matic wallets should use their raw private key.
- **ANT Process:** The ANT process must be passed at runtime to associate your deployment with a specific ANT process on AO.
