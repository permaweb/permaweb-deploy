# Names Migration Guide

This version publishes namespace updates through `@permaweb/references`.

## Deploy Commands

Upload only:

```bash
permaweb-deploy deploy --wallet ./wallet.json --deploy-folder ./dist
```

Upload and update a namespace name:

```bash
permaweb-deploy deploy --use-names --name my-app --wallet ./wallet.json
```

Upload and update a direct reference:

```bash
permaweb-deploy deploy --use-names --reference-id REFERENCE_ID --wallet ./wallet.json
```

## Package Scripts

```json
{
  "scripts": {
    "build": "pnpm build",
    "deploy": "pnpm build && permaweb-deploy deploy --use-names --name my-app"
  }
}
```

## Names Options

- `--use-names`: update a Permaweb Names reference after upload.
- `--name`: resolve and update a name inside the configured namespace.
- `--reference-id`: update a reference directly.
- `--names-namespace`: override the namespace root reference or manifest ID.
- `--names-gateway`: gateway used for reference and namespace reads.
- `--names-graphql`: GraphQL endpoint for reference discovery.

Names updates require an Arweave JWK signer.
