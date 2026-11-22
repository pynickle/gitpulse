import { getGitHubSessionContext, throwGitHubRouteError } from '#server/utils/github-auth-utils';
import { fetchIssueReactionSummary } from '#server/utils/github-reaction-utils';
import { fetchPullHeadBranchState } from '#server/utils/pr-head-branch-utils';
import { createEmptyPRReviewerSummary } from '#server/utils/pr-reviewers-utils';
import { signStackRebaseSnapshot } from '#server/utils/pr-stack-rebase-utils';
import { fetchPullRequestStack } from '#server/utils/pr-stack-utils';

export default definePrivateApiCoalescedEventHandler(async (event) => {
  try {
    const { owner, repo, pull_number } = event.context.params as {
      owner: string;
      repo: string;
      pull_number: string;
    };
    const pullNumber = parsePaginationNumber(pull_number, 0);

    if (!owner || !repo || pullNumber < 1) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required parameters',
      });
    }

    const { octokit, userLogin } = await getGitHubSessionContext(event);

    const [pullRequest, reactionSummary] = await Promise.all([
      octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
        owner,
        repo,
        pull_number: pullNumber,
      }),
      fetchIssueReactionSummary(
        octokit,
        {
          owner,
          repo,
          targetId: pullNumber,
        },
        userLogin
      ).catch((error: unknown) => {
        console.warn('Failed to fetch GitHub pull request reactions:', error);
        return { items: [] };
      }),
    ]);

    const [headBranch, stack] = await Promise.all([
      fetchPullHeadBranchState(octokit, pullRequest.data).catch((error: unknown) => {
        console.warn('Failed to fetch pull request head branch action state:', error);
        return null;
      }),
      fetchPullRequestStack(octokit, owner, repo, pullNumber, pullRequest.data.stack),
    ]);

    if (stack?.number && stack.history === 'not-linear' && !stack.hasConflicts) {
      const secret = useRuntimeConfig(event).appSecret;
      for (const layer of stack.layers) {
        if (!layer.headSha || !layer.baseRef || !layer.baseSha) continue;
        layer.rebaseProof = signStackRebaseSnapshot(secret, owner, repo, layer.number, {
          stackNumber: stack.number,
          baseRef: layer.baseRef,
          baseSha: layer.baseSha,
          expectedHeadOid: layer.headSha,
        });
      }
    }

    return {
      ...pullRequest.data,
      head_branch: headBranch,
      reviewers: createEmptyPRReviewerSummary(),
      reactions: reactionSummary.items,
      stack,
    };
  } catch (error: unknown) {
    console.error('Error fetching GitHub pull request:', error);
    throwGitHubRouteError(error, 'Failed to fetch pull request');
  }
});
