# Next Steps

## Release Checks

- Build the package with `pnpm run build`.
- Run unit and integration tests with `pnpm test`.
- Verify the CLI help for `deploy` and `upload`.
- Confirm the action inputs match the CLI flags.

## Manual Smoke Tests

Upload a folder:

```bash
permaweb-deploy upload --wallet ./wallet.json --deploy-folder ./dist
```

Publish a namespace name:

```bash
permaweb-deploy deploy --use-names --name my-app --wallet ./wallet.json
```

Publish a direct legacy reference:

```bash
permaweb-deploy deploy --use-names --reference-id REFERENCE_ID --wallet ./wallet.json
```

## Notes

The deploy command can update carrier-backed names by namespace name and legacy references by name or direct reference ID. Upload-only flows remain available for all supported signer types.
