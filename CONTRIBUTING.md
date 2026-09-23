# Contributing

Thanks for taking the time to improve GitPulse. This guide covers commit messages guidelines and necessary checks before opening a PR.

## Prerequisites

- Use Bun as package manager.
- Install dependencies from the repository root:

```bash
bun install
```

`bun install` also runs the `prepare` script, which installs the `prek` pre-commit hook.

## Pre-Commit Checks

GitPulse uses `prek` for pre-commit checks. The hook configuration lives in
`prek.toml` and currently runs:

```bash
bun run fmt:check
bun run lint
```

Fix any failures before committing.

## Commit Messages

Commit messages should follow the [Conventional Commits](https://www.conventionalcommits.org) format:

```text
<type>(<scope>): <description>
```

Use one of these types:

```text
feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert
```

The scope is optional. Keep the description concise and imperative.

If you use AI to draft commit messages, you can use the [conventional-commit skill](https://www.skills.sh/github/awesome-copilot/conventional-commit).

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
bunx nuxi typecheck
bun test
```

If you changed the browser extension, also run:

```bash
bun run extension:test
```

If you changed a component's template or styles, also run `bun run generate`.
`nuxi typecheck` does not catch Vite pre-transform failures — a `<Transition>`
given more than one child, or a suffix nested inside a `:deep()` selector — so
the checks above can all pass while the app fails to build.

Do not bypass `prek` unless there is an exceptional reason. If you must bypass a
hook locally, run the same checks manually before pushing.
