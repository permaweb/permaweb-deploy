# Permaweb Deploy

`permaweb-deploy` uploads static sites, folders, or individual files to Arweave and can optionally update a Permaweb Name with the deployed transaction or manifest ID.

> **Package rename:** The npm package has moved from `permaweb-deploy` to `@permaweb/deploy`. The CLI command remains `permaweb-deploy`.

The CLI uses legacy ANS-104 bundlers for the default upload path, supports HyperBEAM bundlers when selected explicitly, and publishes names updates through [`@permaweb/references`](https://www.npmjs.com/package/@permaweb/references).

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Installation Options](#installation-options)
- [Prerequisites](#prerequisites)
- [CLI Usage](#cli-usage)
- [Names Publishing](#names-publishing)
- [Bundlers](#bundlers)
- [Command Options](#command-options)
- [Deduplication](#deduplication)
- [Package Scripts](#package-scripts)
- [GitHub Action](#github-action)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [Dependencies](#dependencies)
- [License](#license)

## Features

- **Arweave uploads:** Upload a folder or a single file.
- **Names publishing:** Update a Permaweb Name after upload.
- **Legacy bundler uploads:** Use legacy ANS-104 upload endpoints by default.
- **HyperBEAM uploads:** Sign ANS-104 items and post them to a HyperBEAM bundler route.
- **Arweave manifests:** Create manifest `0.2.0` documents for folder deployments, with SPA fallback detection.
- **Dedupe cache:** Reuse unchanged uploads from `.permaweb-deploy/transaction-cache.json`.
- **GitHub Action:** Deploy from CI and optionally update a namespace name.

## Quick Start

Install the CLI in your project:

```bash
pnpm add -D @permaweb/deploy
```

Make your Arweave JWK available with either `DEPLOY_KEY` or `--wallet`:

```bash
export DEPLOY_KEY=$(base64 -i wallet.json)
```

If you prefer not to export a key, pass `--wallet ./wallet.json` to the commands below.

Upload a built static folder:

```bash
permaweb-deploy upload --deploy-folder ./dist
```

Deploy and update a Permaweb Name:

```bash
permaweb-deploy deploy --use-names --name my-app --deploy-folder ./dist
```

Or deploy and update a direct reference ID:

```bash
permaweb-deploy deploy --use-names --reference-id REFERENCE_ID --deploy-folder ./dist
```

For repeatable project scripts, add a build-and-deploy command:

```json
{
  "scripts": {
    "build": "vite build",
    "deploy": "pnpm build && permaweb-deploy deploy --use-names --name my-app"
  }
}
```

## Installation Options

```bash
pnpm add -D @permaweb/deploy
```

```bash
npm install --save-dev @permaweb/deploy
```

```bash
yarn add --dev @permaweb/deploy
```

## Prerequisites

For the default Arweave signer, store your Arweave JWK as base64:

```bash
base64 -i wallet.json
```

Set the encoded value as `DEPLOY_KEY`, or pass `--wallet ./wallet.json`.

Names updates currently require `--sig-type arweave`. Legacy references are signed as ANS-104 data items; carrier-backed names are signed as Arweave transactions. Ethereum, Polygon, and KYVE signers remain supported for upload-only flows.

Use a dedicated deployment wallet and make sure it has enough upload credits/balance for the selected legacy bundler.

## CLI Usage

Upload only:

```bash
permaweb-deploy deploy --wallet ./wallet.json --deploy-folder ./dist
permaweb-deploy upload --wallet ./wallet.json --deploy-file ./dist/index.html
DEPLOY_KEY=$(base64 -i wallet.json) permaweb-deploy upload --deploy-folder ./dist
```

Upload and update a namespace name:

```bash
permaweb-deploy deploy --use-names --name my-app --wallet ./wallet.json
```

Upload and update a direct reference ID:

```bash
permaweb-deploy deploy --use-names --reference-id REFERENCE_ID --wallet ./wallet.json
```

Advanced: use a custom namespace root reference or namespace manifest ID:

```bash
permaweb-deploy deploy \
  --use-names \
  --name my-app \
  --names-namespace NAMESPACE_ROOT_OR_MANIFEST_ID \
  --wallet ./wallet.json
```

Deploy a specific target:

```bash
permaweb-deploy deploy --use-names --name my-app --wallet ./wallet.json --deploy-folder ./build
permaweb-deploy deploy --use-names --name my-app --wallet ./wallet.json --deploy-file ./path/to/file.txt
```

## Names Publishing

`--name` resolves the name inside the configured namespace manifest and updates either the carrier target or the legacy reference value. `--reference-id` bypasses namespace lookup and updates a legacy reference directly.

The default namespace is the current mainnet names namespace exported by `@permaweb/references`. Override it with `--names-namespace` when you want to publish against another namespace root reference or manifest ID.

Useful flags:

- `--use-names`: update a Permaweb Name after upload.
- `--name, -n`: namespace name to update.
- `--reference-id`: legacy reference ID to update directly.
- `--names-namespace`: namespace root reference or manifest ID used to resolve `--name`.
- `--names-gateway`: gateway for namespace/reference reads and carrier transaction posting. Default: `https://arweave.net`.
- `--names-graphql`: GraphQL endpoint for reference and carrier discovery. Default: `<names-gateway>/graphql`.
- `--names-node`: HyperBEAM node for carrier-backed names reads. Defaults to `--names-gateway`.

## Bundlers

By default, uploads use the legacy ANS-104 endpoint at `https://up.arweave.net`. Pass `--uploader` to choose a different base URL.

```bash
permaweb-deploy upload --wallet ./wallet.json --deploy-folder ./dist --uploader https://up.arweave.net
```

HyperBEAM upload:

```bash
permaweb-deploy upload \
  --wallet ./wallet.json \
  --deploy-folder ./dist \
  --uploader-type hyperbeam
```

When `--uploader-type hyperbeam` is set and `--uploader` is omitted, the CLI discovers active [PermawebOS HyperBEAM](https://ao.arweave.net/#/stake/bundle) uploaders and randomly selects a usable node. HyperBEAM uploads always check that the selected or pinned node wallet has more than 0 AR before posting data, because the node must be able to seed data to Arweave. Pass `--uploader https://hyperbeam.example.com` to pin a specific node and bypass discovery.

List discoverable HyperBEAM uploaders:

```bash
permaweb-deploy hyperbeam-uploaders
permaweb-deploy hyperbeam-uploaders --json
```

HyperBEAM auto-fund:

```bash
permaweb-deploy upload \
  --wallet ./wallet.json \
  --deploy-folder ./dist \
  --uploader-type hyperbeam \
  --hyperbeam-auto-fund
```

HyperBEAM uploads require an Arweave JWK signer. The default route is `/~bundler@1.0/item?codec-device=ans104@1.0`; override it with `--hyperbeam-upload-path` if your node exposes a different route.

## Command Options

`deploy` supports upload flags plus names publishing flags:

- `--deploy-folder, -d`: folder to deploy. Default: `./dist`.
- `--deploy-file, -f`: deploy a single file instead of a folder.
- `--sig-type, -s`: signer type. Choices: `arweave`, `ethereum`, `polygon`, `kyve`. Default: `arweave`.
- `--wallet, -w`: path to wallet file.
- `--private-key, -k`: private key or JWK JSON string.
- `--no-dedupe`: disable dedupe cache.
- `--dedupe-cache-max-entries`: LRU cache size. Default: `10000`.
- `--uploader`: bundler service base URL. Legacy uploads default to `https://up.arweave.net`; HyperBEAM uploads auto-discover an active PermawebOS uploader when omitted.
- `--uploader-type`: upload protocol, `legacy` or `hyperbeam`. Default: `legacy`.
- `--hyperbeam-upload-path`: HyperBEAM bundler route.
- `--hyperbeam-auto-fund`: fund the HyperBEAM local ledger before upload.
- `--hyperbeam-fund-amount`: optional minimum HyperBEAM local ledger balance override.
- `--hyperbeam-token-id`: advanced AO token process ID override.
- `--hyperbeam-ledger-id`: advanced local HyperBEAM ledger ID override.
- `--hyperbeam-ao-state-url`: AO state endpoint used while waiting for auto-fund assignment.
- `--use-names`, `--name`, `--reference-id`, `--names-namespace`, `--names-gateway`, `--names-graphql`, `--names-node`: names publishing options.

`upload` accepts upload, wallet, signer, bundler, and dedupe flags only.

## Deduplication

The dedupe cache avoids re-uploading unchanged files. It hashes each deployed file and stores transaction IDs in `.permaweb-deploy/transaction-cache.json`.

Disable dedupe:

```bash
permaweb-deploy deploy --use-names --name my-app --wallet ./wallet.json --no-dedupe
```

Limit cache size:

```bash
permaweb-deploy deploy --use-names --name my-app --wallet ./wallet.json --dedupe-cache-max-entries 1000
```

## Package Scripts

```json
{
  "scripts": {
    "build": "vite build",
    "deploy": "pnpm build && permaweb-deploy deploy --use-names --name <NAME>",
    "deploy:ref": "pnpm build && permaweb-deploy deploy --use-names --reference-id <REFERENCE_ID>"
  }
}
```

```bash
DEPLOY_KEY=$(base64 -i wallet.json) pnpm deploy
```

## GitHub Action

```yaml
- uses: permaweb/permaweb-deploy@v1
  with:
    deploy-key: ${{ secrets.DEPLOY_KEY }}
    name: myapp
    deploy-folder: ./dist
```

Use a direct reference ID:

```yaml
- uses: permaweb/permaweb-deploy@v1
  with:
    deploy-key: ${{ secrets.DEPLOY_KEY }}
    reference-id: ${{ secrets.NAMES_REFERENCE_ID }}
    deploy-folder: ./dist
```

PR preview names:

```yaml
name: Deploy PR Preview

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  deploy-preview:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - uses: permaweb/permaweb-deploy@v1
        with:
          deploy-key: ${{ secrets.DEPLOY_KEY }}
          preview: 'true'
          github-token: ${{ secrets.GITHUB_TOKEN }}
          deploy-folder: ./dist
```

When `preview` is enabled, the action generates a namespace name from the repository and PR number, deploys the content, updates that name, and posts or updates a PR comment.

Action inputs for names publishing:

- `name`: namespace name to update.
- `reference-id`: legacy reference ID to update directly.
- `names-namespace`: namespace root reference or manifest ID.
- `names-gateway`: gateway for namespace/reference reads and carrier transaction posting.
- `names-graphql`: GraphQL endpoint for reference and carrier discovery.
- `names-node`: HyperBEAM node for carrier-backed names reads.
- `auto-name`: generate a namespace name from PR number or branch name.
- `preview`: enable `auto-name` and post a PR comment.

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
```

Project layout:

```text
permaweb-deploy/
├── src/commands
├── src/constants
├── src/prompts
├── src/types
├── src/utils
├── src/workflows
├── tests
└── bin
```

## Troubleshooting

- **`DEPLOY_KEY environment variable not set`:** pass `--wallet`, pass `--private-key`, or set `DEPLOY_KEY`.
- **`Names updates currently require --sig-type arweave`:** use an Arweave JWK for names updates.
- **`Name [...] is not controlled by signer in namespace ...`:** verify the namespace manifest contains the name and use the wallet that controls it.
- **`signer is not reference authority`:** use the wallet that controls the target legacy reference.
- **`deploy-folder does not exist`:** check the build output path.
- **`deploy-file does not exist`:** check the file path.
- **Legacy upload rejected:** check the upload endpoint response and retry with another legacy bundler if needed.

## Dependencies

- **@permaweb/references** - Permaweb Names reads and writes.
- **@dha-team/arbundles** - ANS-104 data item signing.
- **@permaweb/aoconnect** - AO network connectivity.
- **@permaweb/hyperbalance** - HyperBEAM auto-fund support.
- **@oclif/core** - CLI framework.
- **mime-types** - MIME type detection.

## License

ISC
