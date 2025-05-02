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

### Prerequisites
Before using `permaweb-deploy`, you must:
1. Encode your Arweave wallet key in base64 format and set it as a GitHub secret:

   ```bash
   base64 -i wallet.json | pbcopy
   ```
3. Ensure that the secret name for the encoded wallet is `DEPLOY_KEY`.

### Usage
To deploy your application, ensure you have a build script and a deployment script in your `package.json`:

```json
"scripts": {
    "build": "your-build-command",
    "deploy-main": "npm run build && permaweb-deploy --arns-name <ARNS_NAME>"
}
```

Replace `<ARNS_NAME>` with your ArNS name.

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
DEPLOY_KEY=$(base64 -i wallet.json) npx permaweb-deploy --arns-name <ARNS_NAME>
```

### Important Notes
- **Security:** Always use a dedicated wallet for deployments to minimize risk.
- **Wallet Key:** The wallet must be base64 encoded to be used in the deployment script.
- **ARNS Name:** The ArNS Name must be passed in so that the ANT Process can be resolved to update the target undername or root record.
