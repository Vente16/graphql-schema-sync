# Contributing to graphql-schema-sync

Thank you for your interest in contributing. This document covers how to get set up and submit changes.

## Development setup

Requirements: Node.js 18+, [pnpm](https://pnpm.io/).

```bash
git clone <repository-url>
cd graphql-schema-sync
pnpm install
pnpm run build
pnpm test
```

## Project scripts

| Command              | Purpose                                   |
| -------------------- | ----------------------------------------- |
| `pnpm run build`     | Build `dist/` with tsup                   |
| `pnpm test`          | Run Vitest unit tests                     |
| `pnpm run typecheck` | TypeScript check                          |
| `pnpm demo`          | End-to-end demo (mock servers + generate) |
| `pnpm demo:serve`    | Start mock GraphQL servers only           |
| `pnpm demo:generate` | Run sync against the demo config          |

## Making changes

1. Create a branch from `main`.
2. Keep changes focused — one concern per pull request when possible.
3. Add or update tests for behavior changes in `src/__tests__/`.
4. Run `pnpm run build`, `pnpm test`, and `pnpm run typecheck` before opening a PR.
5. Update `CHANGELOG.md` under **Unreleased** (or the appropriate version section) for user-facing changes.

## Pull requests

- Fill out the PR template completely.
- Link related issues when applicable.
- Ensure CI checks pass — each push to a PR runs `pnpm run lint`, `pnpm test`, and `pnpm run build` via [GitHub Actions](.github/workflows/ci.yml).

## Reporting issues

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md) and include:

- A clear **description**
- **Context** (environment, config, what you expected)
- **Steps to reproduce**
- **npm version** of `graphql-schema-sync`

## Code style

- Match existing TypeScript patterns in `src/`.
- Prefer minimal, focused diffs over large refactors.
- Avoid unrelated formatting or drive-by changes.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
