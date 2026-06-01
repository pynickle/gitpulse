export default defineEventHandler(async (event) => {
  try {
    const { owner, repo } = event.context.params as {
      owner: string;
      repo: string;
    };

    const octokit = await getGitHubClient(event);
    const { data } = await octokit.request('GET /repos/{owner}/{repo}/license', {
      owner,
      repo,
    });

    return {
      name: data.license?.name || null,
      key: data.license?.key || null,
      spdxId: data.license?.spdx_id || null,
      url: data.license?.url || null,
      htmlUrl: data.html_url,
    };
  } catch (error: any) {
    if (error.status === 404) {
      return { name: null, key: null, spdxId: null, url: null, htmlUrl: null };
    }
    throwGitHubRouteError(error, 'Failed to fetch license');
  }
});
