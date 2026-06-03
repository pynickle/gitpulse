import { Buffer } from 'node:buffer';

import { hasGitHubErrorStatus } from '#server/utils/github-auth-utils';

export default defineEventHandler(async (event) => {
  try {
    const { owner, repo } = event.context.params as {
      owner: string;
      repo: string;
    };

    const octokit = await getGitHubClient(event);
    const { data } = await octokit.request('GET /repos/{owner}/{repo}/readme', {
      owner,
      repo,
    });

    const content = Buffer.from(data.content || '', 'base64').toString('utf-8');

    return {
      content,
      htmlUrl: data.html_url,
      name: data.name,
      path: data.path,
      size: data.size,
      encoding: data.encoding,
    };
  } catch (error: unknown) {
    if (hasGitHubErrorStatus(error, 404)) {
      return { content: null, htmlUrl: null, name: null, path: null, size: 0 };
    }
    throwGitHubRouteError(error, 'Failed to fetch README');
  }
});
