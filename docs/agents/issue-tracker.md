# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`
- **Read an issue**: `gh issue view <number> --comments`, also fetching labels.
- **List issues**: use `gh issue list` with appropriate `--label`, `--state`, and JSON filters.
- **Comment**: `gh issue comment <number> --body "..."`
- **Apply or remove labels**: `gh issue edit <number> --add-label "..."` or `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repository from `git remote -v`; `gh` does this automatically inside the clone.

## Pull requests as a triage surface

**PRs as a request surface: no.**

When enabled, external PRs use the same triage labels and states as issues through the corresponding `gh pr` commands.

GitHub shares one number space across issues and PRs. Resolve an ambiguous `#42` with `gh pr view 42`, then fall back to `gh issue view 42`.

## Skill operations

When a skill says "publish to the issue tracker," create a GitHub issue.

When a skill says "fetch the relevant ticket," run `gh issue view <number> --comments`.

## Wayfinding operations

The map is a single issue labelled `wayfinder:map`; child tickets are linked as GitHub sub-issues where available.

- Label children with `wayfinder:<type>`: `research`, `prototype`, `grilling`, or `task`.
- Represent blocking relationships with GitHub native issue dependencies.
- Claim a ticket with `gh issue edit <number> --add-assignee @me`.
- Resolve it by commenting with the answer, closing it, and updating the map's decisions.
