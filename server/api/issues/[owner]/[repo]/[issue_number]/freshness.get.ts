import type { FreshnessResponse } from '#server/utils/freshness-response-utils';
import { throwGitHubRouteError } from '#server/utils/github-auth-utils';
import { parsePaginationNumber } from '#server/utils/github-pagination';
import { createFreshnessSignature } from '#shared/utils/freshness';

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

    const octokit = await getGitHubClient(event);
    const { data: issue } = await octokit.request(
      'GET /repos/{owner}/{repo}/issues/{issue_number}',
      {
        owner,
        repo,
        issue_number: issueNumber,
      }
    );

    return {
      signature: createFreshnessSignature({
        id: issue.id,
        number: issue.number,
        state: issue.state,
        updated_at: issue.updated_at,
        comments: issue.comments,
        labels: issue.labels?.map((label) =>
          typeof label === 'string' ? label : { id: label.id, name: label.name }
        ),
      }),
      itemCount: 1,
      latestUpdatedAt: issue.updated_at ?? null,
    } satisfies FreshnessResponse;
  } catch (error: unknown) {
    console.error('Error checking GitHub issue freshness:', error);
    throwGitHubRouteError(error, 'Failed to check issue freshness');
  }
});
