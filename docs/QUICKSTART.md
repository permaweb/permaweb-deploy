# Quick Start

## Install

```bash
pnpm add -D @permaweb/deploy
```

## Configure A Wallet

For the default Arweave signer:

```bash
base64 -i wallet.json
```

Use the encoded value as `DEPLOY_KEY`, or pass the wallet path with `--wallet`.

## Upload Only

```bash
permaweb-deploy upload --wallet ./wallet.json --deploy-folder ./dist
```

## Upload And Publish A Name

```bash
permaweb-deploy deploy --use-names --name my-app --wallet ./wallet.json
```

## Upload And Publish A Reference

```bash
permaweb-deploy deploy --use-names --reference-id REFERENCE_ID --wallet ./wallet.json
```

## Common Scripts

```json
{
  "scripts": {
    "build": "vite build",
    "deploy": "pnpm build && permaweb-deploy deploy --use-names --name my-app"
  }
}
```
