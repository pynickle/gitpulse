import type { FreshnessResponse } from '#server/utils/freshness-response-utils';
import { throwGitHubRouteError } from '#server/utils/github-auth-utils';
import { parsePaginationNumber } from '#server/utils/github-pagination';
import { createFreshnessSignature } from '#shared/utils/freshness';

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

    const octokit = await getGitHubClient(event);
    const { data: pullRequest } = await octokit.request(
      'GET /repos/{owner}/{repo}/pulls/{pull_number}',
      {
        owner,
        repo,
        pull_number: pullNumber,
      }
    );

    return {
      signature: createFreshnessSignature({
        id: pullRequest.id,
        number: pullRequest.number,
        state: pullRequest.state,
        draft: pullRequest.draft,
        merged_at: pullRequest.merged_at,
        updated_at: pullRequest.updated_at,
        comments: pullRequest.comments,
        review_comments: pullRequest.review_comments,
        commits: pullRequest.commits,
        head: pullRequest.head?.sha,
        base: pullRequest.base?.sha,
      }),
      itemCount: 1,
      latestUpdatedAt: pullRequest.updated_at ?? null,
    } satisfies FreshnessResponse;
  } catch (error: unknown) {
    console.error('Error checking GitHub pull request freshness:', error);
    throwGitHubRouteError(error, 'Failed to check pull request freshness');
  }
});
