# Stack Rebase cascades from the Trunk on the server

A Stack cannot merge until its history is linear. GitHub's pull request page repairs that with one Rebase stack action for the whole Stack. GitPulse offers Stack Rebase from the Merge Box. Partial rebases and conflict editing stay in `gh stack rebase`.

The published GitHub API has no whole-Stack rebase. After confirmation, GitPulse rebases all active Layers from the Trunk upward inside a single temporary bare Git repository on the server (so no work tree is ever checked out), computes each Layer's fork point before rewriting lower Layers, and verifies every Layer cleanly before performing one atomic leased push across all rebased branches. If any Layer conflicts or fails validation, no remote branch is modified. Rewritten commits preserve their original author and use GitPulse as committer. Repositories that require signed commits can reject the push.
