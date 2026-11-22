# Stack Rebase cascades from the Trunk on the server

A Stack cannot merge until its history is linear. GitHub's pull request page repairs that with one Rebase stack action for the whole Stack. GitPulse offers Stack Rebase from the Merge Box. Partial rebases and conflict editing stay in `gh stack rebase`.

The published GitHub API has no whole-Stack rebase. After confirmation, GitPulse rebases Layers from the Trunk upward using temporary Git working directories on the server. Each push uses a lease on the confirmed head. Rebase stops on the first failure and leaves earlier successful pushes in place. Rewritten commits preserve their original author and use GitPulse as committer. Repositories that require signed commits can reject the push.
