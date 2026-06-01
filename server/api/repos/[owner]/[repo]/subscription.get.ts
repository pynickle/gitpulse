import { hasGitHubErrorStatus } from '../../../../utils/github-auth-utils';

export default defineEventHandler(async (event) => {
  const { owner, repo } = event.context.params as {
    owner: string;
    repo: string;
  };

  if (!owner || !repo) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required parameters',
    });
  }

  const octokit = await getGitHubClient(event);

  try {
    const { data } = await octokit.request('GET /repos/{owner}/{repo}/subscription', {
      owner,
      repo,
    });
    return {
      subscribed: data.subscribed,
      ignored: data.ignored,
    };
  } catch (error: unknown) {
    if (hasGitHubErrorStatus(error, 404)) {
      return { subscribed: false, ignored: false };
    }
    throwGitHubRouteError(error, 'Failed to get subscription status');
  }
});
