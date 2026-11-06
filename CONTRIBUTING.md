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

GitPulse uses `prek` for pre-commit checks. The hook list lives in `prek.toml`,
which is the single source of truth; [the ADR](docs/adr/0048-prek-builtin-hook-selection.md)
records why each hook is there. It runs native `prek` builtins (byte-order marker, trailing whitespace,
end-of-file newline, mixed line endings, JSON/JSONC parse, added large files,
case conflicts, Windows-illegal names, merge markers, XML parse, private keys)
followed by `bun run fmt:check` and `bun run lint`.

Fix any failures before committing. Hooks that rewrite a file report it as a
failure, so when one does, re-stage the file and commit again.

CI runs the same hooks over every tracked file — `prek run --all-files`
through [`j178/prek-action`](https://github.com/j178/prek-action) — so a hook
failure fails the pull request. There is no separate format or lint CI job:
`bun run fmt:check` and `bun run lint` are the last two hooks, locally and in
CI.

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

The root lint config ignores `extension/` and `flutter/`. Use each package's
own checks when working on the browser extension or native client. Root formatting
also excludes `flutter/`, which uses Dart formatting.

## Before Opening a Pull Request

Run the core quality checks from the repository root:

```bash
bun run fmt:check
bun run lint
bunx nuxi typecheck
bun test --parallel
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

## Agent Guidance

`nuxt-skill-hub` regenerates project-specific guidance during `nuxt prepare`.
Keep the small `nuxt-gitpulse` wrapper skills in version control; the generated
`.nuxt/skill-hub/` tree stays local. See the [Skill Hub documentation](https://github.com/onmax/nuxt-skill-hub).

## Flutter Client

The native client is an independent package in `flutter/`. Use its pinned stable
Flutter SDK and committed lockfile; run Flutter formatting, analysis and tests
from that directory in addition to the root checks. Its HTTP contract tests need
Bun and the root dependencies. See [Flutter distribution and acceptance](docs/flutter-release.md)
for the commands, platform prerequisites, release signing and Android owner
acceptance. Flutter CI runs separately from the existing web/extension jobs.
