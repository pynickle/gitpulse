# Pull Request check summaries read GitHub's own rollup, not REST check runs

GitPulse already computes a check summary for the PR Review Workspace merge box by paging
`GET /repos/{owner}/{repo}/commits/{ref}/check-runs` and bucketing every run it returns. On a real
commit (refined-github/refined-github @ `5f443c7`) that endpoint returns 33 runs while
`statusCheckRollup.contexts` returns 9, because REST re-reports runs superseded by later re-runs and
bot checks created by unrelated events on the same commit. Pull Request cards and the merge box now
both read `pullRequest.statusCheckRollup` instead: `state` is GitHub's aggregate verdict and
`contexts` is the deduplicated set GitHub shows on the Checks tab. `success + neutral + skipped`
count as passed, because GitHub's docs state a skipped job reports Success and does not block a
merge, and a neutral conclusion does not block either.

**Consequences**: `buildChecksSummary` and its REST pagination are gone, and the merge box shares its
checks row, bucketing, and expanded list with the new Check Status Chip and Check List Modal.
`contexts(first: 100)` caps the list, so a Pull Request with more than 100 contexts shows a tone and
a total without a passed fraction rather than a silently under-counted one. Legacy commit statuses
now count alongside check runs, which check runs alone never covered. `CheckRun.isRequired` cannot be
requested inside a rollup query — GitHub answers `UNPROCESSABLE` and blanks every CheckRun node — so
no required badge is shown.
