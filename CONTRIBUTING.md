# Contributing

Thanks for taking the time to improve GitPulse. This guide covers commit
messages and the checks that run before commits.

## Prerequisites

- Use Bun. This project is Bun-only.
- Install dependencies from the repository root:

```bash
bun install
```

`bun install` also runs the `prepare` script, which installs the `prek`
pre-commit hook.

If the hook is missing or you cloned the repository before hooks were installed,
run:

```bash
bunx prek install
```

## Pre-Commit Checks

GitPulse uses `prek` for pre-commit checks. The hook configuration lives in
`prek.toml` and currently runs:

```bash
bun run fmt:check
bun run lint
```

These commands run against the repository, not just the files staged for the
commit. Fix any failures before committing.

To run the same hooks manually on the full repository:

```bash
bunx prek run --all-files
```

## Commit Messages

Commit messages should follow the
[Conventional Commits](https://www.conventionalcommits.org) format:

```text
<type>(<scope>): <description>
```

Use one of these types:

```text
feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert
```

The scope is optional. Keep the description concise and imperative.

If you use AI to draft commit messages, you can use the
[conventional-commit skill](https://www.skills.sh/github/awesome-copilot/conventional-commit).

## Format and Lint

Formatting is handled by Oxfmt, and linting is handled by Oxlint.

Check formatting and linting:

```bash
bun run fmt:check
bun run lint
```

Apply automatic fixes:

```bash
bun run fmt
bun run lint:fix
```

Review the diff after automatic fixes. `lint:fix` may not resolve every issue;
re-run `bun run lint` and handle remaining diagnostics manually.

The root lint script ignores `extension/`. Use the extension-specific commands
when working on the browser extension.

## Before Opening a Pull Request

Run the core quality checks from the repository root:

```bash
bun run fmt:check
bun run lint
bun test
```

If you changed the browser extension, also run:

```bash
bun run extension:test
```

Do not bypass `prek` unless there is an exceptional reason. If you must bypass a
hook locally, run the same checks manually before pushing.
