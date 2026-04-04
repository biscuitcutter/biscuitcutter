# Contributing

Contributions are welcome, and they are greatly appreciated! Every little bit helps, and credit will always be given.

## Types of Contributions

### Report Bugs

Report bugs by opening an issue.

If you are reporting a bug, please include:

- Your operating system name and version.
- Your Node.js version (`node --version`).
- Any details about your local setup that might be helpful in troubleshooting.
- Detailed steps to reproduce the bug.

### Fix Bugs

Look through the GitHub issues for bugs. Anything tagged with "bug" is open to whoever wants to implement it.

### Implement Features

Look through the GitHub issues for features. Anything tagged with "enhancement" is open to whoever wants to implement it.

Please do not combine multiple feature enhancements into a single pull request.

### Write Documentation

BiscuitCutter could always use more documentation, whether as part of the official docs, in code comments, or even on the web in blog posts and articles.

### Submit Feedback

The best way to send feedback is to file an issue.

If you are proposing a feature:

- Explain in detail how it would work.
- Keep the scope as narrow as possible, to make it easier to implement.
- Remember that this is a volunteer-driven project, and that contributions are welcome!

## Setting Up the Code for Local Development

1. Fork the repo on GitHub.

2. Clone your fork locally:

   ```bash
   git clone git@github.com:your_name_here/biscuitcutter.git
   ```

3. Install dependencies from the repository root:

   ```bash
   cd biscuitcutter
   npm install
   ```

   This installs dependencies for all packages in the monorepo.

4. Create a branch for local development:

   ```bash
   git checkout -b name-of-your-bugfix-or-feature
   ```

   Now you can make your changes locally.

5. Build the project to ensure TypeScript compiles correctly:

   ```bash
   npm run build
   ```

6. When you're done making changes, run the tests:

   ```bash
   npm test
   ```

7. Commit your changes and push your branch to GitHub:

   ```bash
   git add .
   git commit -m "Your detailed description of your changes"
   git push origin name-of-your-bugfix-or-feature
   ```

8. Submit a pull request through GitHub.

## Monorepo Structure

This repository is organized as a monorepo using [npm workspaces](https://docs.npmjs.com/cli/using-npm/workspaces). Packages live under the `packages/` directory.

### Packages

| Package | Path | Description |
|---------|------|-------------|
| `biscuitcutter` | `packages/biscuitcutter` | The main CLI tool and core library |

### Running Commands

All commands should be run from the repository root. The root `package.json` delegates to workspace packages automatically:

```bash
# Build all packages
npm run build

# Test all packages
npm run test

# Lint all packages
npm run lint
```

To run a command in a specific package:

```bash
npm run build --workspace=biscuitcutter
npm run test --workspace=biscuitcutter
```

Or navigate into the package directory:

```bash
cd packages/biscuitcutter
npm test
```

### Adding a New Package

1. Create a new directory under `packages/`:

   ```bash
   mkdir packages/my-new-package
   ```

2. Add a `package.json` with at minimum `name`, `version`, and any scripts the root delegates (`build`, `test`, `lint`).

3. Run `npm install` from the root to link the new package into the workspace.

### Inter-package Dependencies

To depend on another package in the monorepo, add it to your `package.json` dependencies using the workspace protocol:

```json
{
  "dependencies": {
    "biscuitcutter": "*"
  }
}
```

npm workspaces will resolve this to the local copy. Run `npm install` from the root after adding the dependency.

### Changesets

This project uses [Changesets](https://github.com/changesets/changesets) to manage versioning and changelogs. When your PR includes changes that affect published packages, add a changeset:

```bash
npx changeset add
```

Or create a file manually at `.changeset/<name>.md`:

```markdown
---
"biscuitcutter": patch
---

One-line summary of the change
```

Use `patch` for bug fixes, `minor` for new features, and `major` for breaking changes. Skip the changeset for changes that don't affect published packages (e.g. CI config, README updates).

## Pull Request Guidelines

Before you submit a pull request, check that it meets these guidelines:

1. The pull request should include tests for new functionality.
2. If the pull request adds functionality, the docs should be updated.
3. The pull request should work for Node.js 18 and later.
4. Make sure all tests pass.

## Development Scripts

From the repository root:

- `npm run build` - Build all packages
- `npm test` - Run tests across all packages
- `npm run lint` - Lint all packages

From within a package directory (e.g. `packages/biscuitcutter`):

- `npm run build` - Compile TypeScript to JavaScript
- `npm run dev` - Watch mode for development
- `npm test` - Run tests once
- `npm run test:watch` - Run tests in watch mode

## Code Style

- Use TypeScript for all new code.
- Follow existing code conventions in the project.
- Use meaningful variable and function names.
- Add JSDoc comments for public APIs.
- Keep functions small and focused.

## Testing

Tests are written using [Vitest](https://vitest.dev/). Place test files in the `tests/` directory within each package, with the naming convention `*.test.ts`.

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

## Project Structure

```
biscuitcutter/
├── .changeset/                # Changeset config and pending changesets
├── .github/workflows/         # CI/CD workflows
├── packages/
│   └── biscuitcutter/         # Main package
│       ├── src/
│       │   ├── cli/           # Command-line interface
│       │   ├── config/        # Configuration handling
│       │   ├── core/          # Core business logic
│       │   ├── repository/    # Repository handling (git, zip, etc.)
│       │   ├── templating/    # Template engine
│       │   └── utils/         # Utility functions
│       ├── tests/             # Test files
│       └── dist/              # Compiled output (generated)
└── package.json               # Root workspace config
```

## Questions?

Feel free to open an issue if you have any questions about contributing.
