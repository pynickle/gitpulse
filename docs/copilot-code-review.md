# Copilot code review

GitPulse treats Copilot's requested-reviewer identity and submitted-review bot as
one reviewer, using GitHub identity data. Copilot work events retain the human
requester separately from the service doing the work.

Reviewers holds the effort selection for the next request. The request picker
only displays that selection. Changing the selection does not start a review or
save a separate GitHub preference. Requesting or re-requesting sends the selected
effort through GitHub's Copilot review API. Without an explicit choice, GitHub
resolves its defaults, including effort previously used on the same PR.

The editor is enabled when GitHub offers Copilot through the PR's
`suggestedReviewerActors`. GitHub's official CLI uses this same availability
signal. It is checked again on the server before a Copilot request is sent.
An existing pending request is retained independently of suggestions; its effort
editor stays disabled. Closed PRs cannot request another review.

Repository write access and PR authorship are not Copilot eligibility rules:
paid Copilot users can request reviews in repositories they can access. An
organization or repository can block external licenses. In personal repositories,
that restriction limits requests to the owner and direct collaborators. Members
without a license can use code review on their own organization PRs when the
organization enables both paid usage and unlicensed-member access.

GitPulse therefore uses the offered Bot rather than guessing eligibility from
login, repository role, or earlier Copilot reviews. The offer is a preflight
signal; GitHub's mutation still enforces current licenses, quota, policy and
pending-request conflicts. Public APIs do not expose a complete independent
per-actor entitlement check. Repository settings supply available levels when
the token has administration access; lack of settings access does not prevent
a review request.

Historical effort comes from `PullRequestReview.copilotCodeReviewEffort` and is
displayed on the submitted review and its reviewer. REST timeline request events
do not expose that parameter on the verified example, so GitPulse does not attach
the current selection to historical request events. Unknown effort stays unknown.

Human and team requests use their existing API. When a mixed selection partly
succeeds, the client refreshes reviewer state before displaying the failure.
Removing a pending request uses the ordinary reviewer-removal API and does not
promise cancellation of running Copilot work.

Sources:

- [Review effort and default resolution](https://docs.github.com/copilot/concepts/agents/code-review#review-effort-level)
- [Copilot review requests](https://docs.github.com/en/rest/pulls/copilot-code-review)
- [Repository settings and available effort levels](https://docs.github.com/en/rest/copilot/copilot-code-review)
- [GraphQL review metadata](https://docs.github.com/en/graphql/reference/objects#pullrequestreview)
- [Who can request reviews and external-license restrictions](https://github.blog/changelog/2026-10-07-copilot-code-review-new-organization-billing-options-and-controls/)
- [Official CLI availability check](https://github.com/cli/cli/blob/18374541e44ad568208c2f45b14cc51c201121bd/api/queries_pr_review.go)
