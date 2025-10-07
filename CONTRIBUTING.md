# Contributing to Permaweb Deploy

Thank you for your interest in contributing to Permaweb Deploy! This document provides guidelines and instructions for contributing.

## Development Setup

1. **Fork and Clone**

   ```bash
   git clone https://github.com/YOUR_USERNAME/permaweb-deploy.git
   cd permaweb-deploy
   ```

2. **Install Dependencies**

   ```bash
   pnpm install
   ```

3. **Build the Project**

   ```bash
   pnpm build
   ```

4. **Run Tests**
   ```bash
   pnpm test
   ```

## Development Workflow

### Making Changes

1. Create a new branch:

   ```bash
   git checkout -b feat/my-new-feature
   ```

2. Make your changes

3. Write or update tests as needed

4. Run tests and linter:

   ```bash
   pnpm test
   pnpm lint
   ```

5. Format your code:
   ```bash
   pnpm format
   ```

### Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/). Your commit messages should follow this format:

```
type(scope): subject

body (optional)
footer (optional)
```

**Types:**

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that don't affect code meaning (formatting, etc.)
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Performance improvement
- `test`: Adding or updating tests
- `build`: Changes to build system or dependencies
- `ci`: Changes to CI configuration
- `chore`: Other changes that don't modify src or test files
- `revert`: Reverts a previous commit

**Examples:**

```
feat(deploy): add support for batch deployments

fix(uploader): handle empty manifest paths correctly

docs: update installation instructions
```

### Creating a Changeset

Before submitting your PR, create a changeset to describe your changes:

```bash
pnpm changeset
```

This will:

1. Ask you to select the type of change (patch, minor, major)
2. Prompt you to describe the change
3. Create a markdown file in `.changeset/` directory

### Pull Request Process

1. Update documentation if needed
2. Add tests for new features
3. Ensure all tests pass
4. Create a changeset (see above)
5. Push your branch and create a Pull Request
6. Wait for review and address any feedback

## Code Style

- We use ESLint with TypeScript plugins
- We use Prettier for code formatting
- Import sorting is enforced
- All code must pass linting: `pnpm lint`

## Testing

- Write unit tests for utility functions
- Place tests in `__tests__` folders next to the code
- Use Vitest for testing
- Aim for good test coverage

Example test:

```typescript
import { describe, expect, it } from 'vitest'
import { myFunction } from '../myFunction.js'

describe('myFunction', () => {
  it('should do something', () => {
    expect(myFunction('input')).toBe('expected output')
  })
})
```

## Project Structure

```
src/
├── commands/        # oclif commands
├── types/           # TypeScript type definitions
├── utils/           # Utility functions
│   └── __tests__/   # Unit tests
└── index.ts         # Main entry point
```

## Questions?

Feel free to:

- Open an issue for bugs or feature requests
- Start a discussion for questions
- Reach out to the maintainers

Thank you for contributing! 🚀
