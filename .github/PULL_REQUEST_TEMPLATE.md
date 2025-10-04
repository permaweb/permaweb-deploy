## Description

<!-- Describe your changes in detail -->

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Changeset

- [ ] I have added a changeset (`pnpm changeset`)
- [ ] No changeset needed (docs only, tests, etc.)

## Testing

- [ ] I have tested these changes locally
- [ ] I have added tests that prove my fix is effective or that my feature works

## Snapshot Release

A release candidate (RC) version is automatically published when this PR is created or updated:

- The snapshot workflow will publish an RC version to npm with the `@rc` tag
- The RC version will be commented on this PR for testing
- Install with: `pnpm add permaweb-deploy@<version>` (see comment below)
