# Pull Request check summaries read GitHub's own rollup, not REST check runs

GitPulse already computes a check summary for the PR Review Workspace merge box by paging
`GET /repos/{owner}/{repo}/commits/{ref}/check-runs` and bucketing every run it returns. On a real
commit (refined-github/refined-github @ `5f443c7`) that endpoint returns 33 runs while
`statusCheckRollup.contexts` returns 9, because REST re-reports runs superseded by later re-runs and
bot checks created by unrelated events on the same commit. Pull Request cards and the merge box now
both read `pullRequest.statusCheckRollup` instead: `state` is GitHub's aggregate verdict and
`contexts` is the deduplicated set GitHub shows on the Checks tab. Because skipped and neutral
checks do not block a merge, `success + neutral + skipped` keep the overall rollup tone green and
form the compact Check Status Chip's `passed/total` fraction (so a green chip never reads like a
missing failure), while the Merge Box summary, Check List Modal summary, and chip tooltip break out
non-zero outcome buckets (such as `9 successful, 1 skipped`) instead of reporting skipped checks as
passed.

The shared rollup query also fetches lightweight per-context presentation fields — `CheckRun`
`checkSuite.app.logoUrl`, `startedAt`, `completedAt`, and `title`, plus `StatusContext` `avatarUrl`,
`description`, and `createdAt` — so both the Merge Box and the Check List Modal render app avatars,
run duration or relative completion time, and skip/status summaries without a second request (omitting
heavier nested `workflowRun` nodes from list batch queries).

**Consequences**: `buildChecksSummary` and its REST pagination are gone, and the merge box shares its
checks row, bucketing, and expanded list with the Check Status Chip and Check List Modal.
`contexts(first: 100)` caps the list, so a Pull Request with more than 100 contexts shows a tone and
a total without a passed fraction rather than a silently under-counted one. Legacy commit statuses
count alongside check runs, which check runs alone never covered. `CheckRun.isRequired` cannot be
requested inside a rollup query — GitHub answers `UNPROCESSABLE` and blanks every CheckRun node — so
no required badge is shown.
