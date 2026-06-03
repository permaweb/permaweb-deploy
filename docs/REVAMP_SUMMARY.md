# Revamp Summary

`permaweb-deploy` is now split into two flows:

- `upload`: upload a file or folder without changing a name.
- `deploy`: upload a file or folder, then optionally publish a Permaweb Names reference update.

## Current CLI

```bash
permaweb-deploy upload --wallet ./wallet.json --deploy-folder ./dist
permaweb-deploy deploy --use-names --name my-app --wallet ./wallet.json
permaweb-deploy deploy --use-names --reference-id REFERENCE_ID --wallet ./wallet.json
```

## Publishing

Names publishing uses `@permaweb/references` and accepts either a namespace name or a direct reference ID. The default namespace can be overridden with `--names-namespace`.

## Uploads

Legacy ANS-104 remains the default uploader at `https://up.arweave.net`. HyperBEAM can be selected with `--uploader-type hyperbeam` and an explicit node URL.
