import { getGitHubClient, throwGitHubRouteError } from '#server/utils/github-auth-utils';
import { fetchRepositoryStack } from '#server/utils/pr-stack-utils';

export default definePrivateApiCoalescedEventHandler(async (event) => {
  try {
    const { owner, repo, stack_number } = event.context.params as {
      owner: string;
      repo: string;
      stack_number: string;
    };
    const stackNumber = parsePaginationNumber(stack_number, 0);

    if (!owner || !repo || stackNumber < 1) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required parameters',
      });
    }

    const octokit = await getGitHubClient(event);
    const pull = parsePaginationNumber(getQuery(event).pull, 0);
    return fetchRepositoryStack(octokit, owner, repo, stackNumber, pull >= 1 ? pull : undefined);
  } catch (error: unknown) {
    console.error('Error fetching GitHub stack:', error);
    throwGitHubRouteError(error, 'Failed to fetch stack');
  }
});
