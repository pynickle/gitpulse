# Merge Box status reads GraphQL plus Branch Rulesets, and a sole active Layer uses standard branch actions

GitPulse previously inferred review requirements solely from REST reviews and requested reviewers,
checked `Branch Update` eligibility without `viewerCanUpdateBranch`, and gated any pull request with
Stack metadata behind `Stack Rebase` and `Stack Merge`. Real repositories expose three mismatches:
Repository Rulesets do not populate GraphQL `baseRef.branchProtectionRule` and can leave
`pullRequest.reviewDecision` as `null` on fork pull requests even when approvals or thread
resolution are required (observed on `PCL-Community/PCL-CE#3897`); a fork pull request with
`maintainerCanModify` can have `viewerCanUpdateBranch: true` while head-repo write permissions and
`viewerCanEditFiles` are both false; and a Stack whose lower Layers have already merged leaves a
single open Layer targeting the Trunk directly (observed on `PCL-Community/PCL-CE#3853`).

Merge Box status therefore consolidates pull request state in GraphQL (`reviewDecision`,
`mergeStateStatus`, `mergeable`, `viewerCanUpdateBranch`, `viewerCanEditFiles`, `maintainerCanModify`,
`reviewThreads`, commit signatures, `branchProtectionRule`, `autoMergeRequest`, `mergeQueueEntry`,
and `statusCheckRollup`) alongside REST `GET /repos/{owner}/{repo}/rules/branches/{base}` and
`compare`. Review, checks, branch currency, and stack rows each own their specific requirements,
while the mergeability row lists only remaining uncovered blockers (such as unresolved review
threads, unsigned commits, conflicts, or ruleset constraints). A Layer whose Stack still has active
inter-layer dependencies keeps the Stack status row as its single branch-currency surface (with
inline `Stack Rebase`) and hides the separate Branch Currency row; a sole remaining active Layer
targeting the Trunk directly displays the Stack row for context while regaining standard
`Branch Update` and single-PR merge.

**Consequences**: `Merge Method Availability` now intersects repository settings with target branch
ruleset `allowed_merge_methods`. `Branch Currency` displays `compare`'s `base_commit.sha` so the
displayed SHA matches `behind_by`. Open pull requests skip head-branch delete/restore probes, which
only apply after a pull request is closed or merged. `mergeableState === 'behind'` disables the
merge action rather than letting a doomed request fail on submit.
