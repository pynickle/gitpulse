import { throwGitHubRouteError } from '../../../../utils/github-auth-utils';

export default defineEventHandler(async (event) => {
  try {
    const { owner, repo } = event.context.params as {
      owner: string;
      repo: string;
    };

    const octokit = await getGitHubClient(event);

    const { data: labels } = await octokit.request('GET /repos/{owner}/{repo}/labels', {
      owner,
      repo,
    });

    return labels;
  } catch (error: unknown) {
    console.error('Error fetching repository labels:', error);

    throwGitHubRouteError(error, 'Failed to fetch repository labels');
  }
});
