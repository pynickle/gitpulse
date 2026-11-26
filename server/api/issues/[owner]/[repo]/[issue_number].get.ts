import { getGitHubSessionContext, throwGitHubRouteError } from '#server/utils/github-auth-utils';
import { fetchIssueReactionSummary } from '#server/utils/github-reaction-utils';
import { fetchIssueDuplicateTarget } from '#server/utils/issue-duplicate-target-utils';
import { fetchIssueParentTarget } from '#server/utils/sub-issue-graphql-utils';
import type { ReactionSummaryPayload } from '#shared/types/reactions';

export default definePrivateApiCoalescedEventHandler(async (event) => {
  try {
    const { owner, repo, issue_number } = event.context.params as {
      owner: string;
      repo: string;
      issue_number: string;
    };
    const issueNumber = parsePaginationNumber(issue_number, 0);

    if (!owner || !repo || issueNumber < 1) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required parameters',
      });
    }

    const { octokit, userLogin } = await getGitHubSessionContext(event);

    const [issue, reactionSummary] = await Promise.all([
      octokit.request('GET /repos/{owner}/{repo}/issues/{issue_number}', {
        owner,
        repo,
        issue_number: issueNumber,
      }),
      fetchIssueReactionSummary(
        octokit,
        {
          owner,
          repo,
          targetId: issueNumber,
        },
        userLogin
      ).catch((error: unknown): ReactionSummaryPayload => {
        console.warn('Failed to fetch GitHub issue reactions:', error);
        return { items: [] };
      }),
    ]);

    const [duplicateOf, parentIssue] = await Promise.all([
      issue.data.state_reason === 'duplicate'
        ? fetchIssueDuplicateTarget(octokit, owner, repo, issueNumber)
        : undefined,
      issue.data.parent_issue_url
        ? fetchIssueParentTarget(octokit, owner, repo, issueNumber)
        : undefined,
    ]);

    return {
      ...issue.data,
      reactions: reactionSummary.items,
      ...(typeof reactionSummary.canReact === 'boolean'
        ? { canReact: reactionSummary.canReact }
        : {}),
      ...(duplicateOf ? { duplicate_of: duplicateOf } : {}),
      ...(parentIssue ? { parent_issue: parentIssue } : {}),
    };
  } catch (error: unknown) {
    console.error('Error fetching GitHub issue:', error);
    throwGitHubRouteError(error, 'Failed to fetch issue');
  }
});
