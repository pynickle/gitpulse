---
status: accepted
---

# The pre-commit hook set guards what the formatter cannot see

GitPulse runs its commit hooks through `prek`, installed by `bun install` through the `prepare` script.
`prek.toml` carried one native builtin — `fix-byte-order-marker` — and two local hooks that run
`bun run fmt:check` and `bun run lint`. Those two already own formatting and linting: oxfmt 0.76 parses
and rewrites js, ts, vue, json, jsonc, markdown, yaml, toml, css and html, and type-aware oxlint covers
the app, server, shared and test trees. What nothing owned was the mistakes and the file kinds that
neither tool parses or looks at.

A survey of the 33 builtin hooks in prek 0.5.10 against the tracked tree (`docs/research/prek-builtin-hooks.md`)
located them: the XML under `flutter/android`, the JSONC that oxfmt is explicitly told to ignore
(`.github/renovate.jsonc`), unresolved merge markers, oversized additions to a repository that already
tracks 73 images, case and Windows-name collisions for a tree that is developed on Windows and macOS,
and a private key pasted into a file — this repository holds a GitHub token, a personal password, a
cookie secret and a native login handoff, so a leaked key is the one mistake here with no undo.

## Decision

**The hook set extends the formatter to what the formatter cannot see, and nothing else.** Formatting,
whitespace and linting stay with oxfmt and oxlint; the builtin hooks take the file kinds and the
mistakes those two do not parse. `prek.toml` declares, in this order: `fix-byte-order-marker`,
`trailing-whitespace` (with `--markdown-linebreak-ext=md`), `end-of-file-fixer`, `mixed-line-ending`,
`check-added-large-files`, `check-case-conflict`, `check-illegal-windows-names`, `check-merge-conflict`,
`check-xml`, `detect-private-key`, `check-json` and `check-jsonc`.

The four hooks that rewrite come first because prek runs hooks in configuration order: the read-only
checks then judge the bytes that will actually be committed, and the two local hooks that run
`fmt:check` and `lint` judge them last. `mixed-line-ending` keeps its `--fix=auto` default, which only
rewrites a file that mixes endings — a file that is uniformly CRLF is left alone.

`.json` and `.jsonc` need two hooks rather than one. `check-jsonc` selects `.jsonc` files only, and an
explicit `types` **replaces** the builtin default instead of widening it — and types are a conjunction,
so `types = ["json", "jsonc"]` selects no file at all (verified against the installed 0.5.10 binary).
`check-json` therefore covers `.json` and `check-jsonc` covers `.jsonc`.

`tsconfig.json` is excluded from `check-json` because it is JSONC — the Nuxt template ships a `//`
comment on its second line — and `check-jsonc` does not reach `.json`. It is validated by nothing. That
is accepted: it is a four-line project-references stub whose body is `"files": []`.

**Generated files are excluded from the hooks that rewrite.** A file a tool produces is not a file a
hook should edit: the next regeneration overwrites the fix and the hook reports the same violation
again. The four rewriting hooks therefore skip the build products tracked in this tree —
`**/*.g.dart` (build_runner, json_serializable and the generated palette), `bun.lock`, `pubspec.lock`
and `*.py.lock` — plus `.nuxtrc`, written by `nuxt-skill-hub` during `nuxt prepare`, and
`flutter/assets/document_viewer/`. Flutter's `ios/` and `android/` scaffolding is deliberately **not**
on that list: those files are generated once by `flutter create` and edited by hand ever after, so
`Info.plist`, `AndroidManifest.xml` and the Gradle files stay under the hooks.

## Consequences

- **The guard is local, and it advises rather than enforces.** CI still runs `fmt:check`, `lint`,
  typecheck, tests and a build, and it does not run `prek`. Adding a CI job would have repeated
  `fmt:check` and `lint` — the two local hooks run exactly those — and was rejected as duplication.
  The cost is stated plainly: `git commit --no-verify`, or a contributor who never ran `bun install`,
  bypasses every hook above. These hooks catch mistakes early; they do not make them impossible.
- **A commit can be interrupted once.** A hook that rewrites a file reports it as a failure. The file
  is fixed, the commit is not: re-stage it and commit again. `CONTRIBUTING.md` says so, and no longer
  restates the hook list — `prek.toml` is the single source of truth, which removes the drift that had
  left the BOM fixer undocumented.
- **The existing tree was normalised once, in the same change.** Four files were missing a final
  newline: `flutter/analysis_options.yaml`, `flutter/AGENTS.md`,
  `flutter/android/app/src/main/res/values/colors.xml` and an iOS LaunchImage README. Fixing them once
  means the hooks do not interrupt anyone's unrelated commit.
- **Line endings belong to `.gitattributes`, not to a hook.** `* text=auto eol=lf` governs both sides:
  the index is LF, and a checkout writes LF on Windows too. Forty-eight files in the maintainer's
  worktree were still CRLF because they had been written before the attribute existed — Git never
  rewrites a file already on disk — and they were re-checked-out in this change at no cost to the diff,
  the index having been LF all along. `mixed-line-ending` in `auto` mode does not touch a
  uniformly-CRLF file, so no hook fights a checkout and no hook repairs one. When a CRLF file is
  missing its final newline the two hooks do run in sequence — the newline appender adds an LF, which
  makes the file mixed, which the next hook normalises back to CRLF — but the index normalises both to
  LF, so the committed bytes never change.

## Considered and rejected

- **`normalize-indentation`** — defaults to spaces at tab size 4 while `.editorconfig` says
  `indent_size=2`, and it is not language aware: Vue SFC templates, YAML block scalars, Markdown code
  fences and Dart multiline strings would all be re-indented by four columns. Highest-risk hook of
  the 33 for this repository.
- **`pretty-format-json`** — sorts object keys and forces LF, which fights both oxfmt's key order and
  the hand ordering in `i18n/locales/*.json`.
- **`check-vcs-permalinks`** — 17 existing `/blob/main/` links would fail on the first commit; that is
  a documentation-debt task, not a commit gate.
- **`replace-pattern`** — a batch migration tool, not a standing guard.
- **`deny-pattern` for focused tests** — would need a `files` regex to avoid failing on the many
  places `docs/` and `.agents/skills/` quote `.only(` in prose. Deferred rather than shipped noisy.
- **`no-commit-to-branch`, `check-signed-commit`, `check-commit-trailers`** — workflow policy rather
  than hygiene, and trailers would require a `commit-msg` hook this repository never installs.
- **`file-contents-sorter`, `requirements-txt-fixer`, `check-json5`, `check-symlinks`,
  `destroyed-symlinks`, the two shebang hooks, `forbid-new-submodules`** — no file in the tree can
  satisfy them, so they would be configuration that never runs.
