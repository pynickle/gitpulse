# Stack Rebase uses GitHub's server-side cascading rebase

A Stack cannot merge until its history is linear. GitHub's pull request page repairs that with one Rebase stack action for the whole Stack. GitPulse offers that same Stack Rebase from the Merge Box, and a Layer is not offered a Branch Update. Partial rebases and conflict editing stay in `gh stack rebase`, because GitPulse has no checkout. Rebuilding the rebase from git ref updates was rejected.

**Consequences**: The action calls GitHub's server-side rebase. The published stacks REST surface lists create, add, and unstack, and does not list a rebase. The button ships when that call is identified, and not as a substitute built in GitPulse. While the history is not linear, the Merge Box offers Stack Rebase and does not offer Stack Merge. Stack Detail offers neither.
