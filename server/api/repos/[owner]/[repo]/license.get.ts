import { hasGitHubErrorStatus } from '#server/utils/github-auth-utils';

function getStringQueryParam(value: unknown) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return typeof rawValue === 'string' && rawValue ? rawValue : undefined;
}

export default definePrivateApiCoalescedEventHandler(async (event) => {
  try {
    const { owner, repo } = event.context.params as {
      owner: string;
      repo: string;
    };

    const query = getQuery(event);
    const ref = getStringQueryParam(query.ref);
    const octokit = await getGitHubClient(event);
    const { data } = await octokit.request('GET /repos/{owner}/{repo}/license', {
      owner,
      repo,
      ref,
    });

    return {
      name: data.license?.name || null,
      key: data.license?.key || null,
      spdxId: data.license?.spdx_id || null,
      url: data.license?.url || null,
      htmlUrl: data.html_url,
      path: data.path,
    };
  } catch (error: unknown) {
    if (hasGitHubErrorStatus(error, 404)) {
      return { name: null, key: null, spdxId: null, url: null, htmlUrl: null, path: null };
    }
    throwGitHubRouteError(error, 'Failed to fetch license');
  }
});
