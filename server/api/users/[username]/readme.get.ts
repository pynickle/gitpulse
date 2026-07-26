import { Buffer } from 'node:buffer';

import { hasGitHubErrorStatus, throwGitHubRouteError } from '#server/utils/github-auth-utils';
import { extractUsername } from '#server/utils/github-user-utils';
import { getStringQueryParam } from '#server/utils/repo-route-utils';
import type { UserReadmeResponse } from '#shared/types/users';

const EMPTY_README: UserReadmeResponse = {
  content: null,
  htmlUrl: null,
  repo: null,
  branch: null,
  path: null,
};

/**
 * Profile README. Users keep theirs in the special `username/username`
 * repository; organizations (requested via `?account=organization`) keep
 * theirs in the `org/.github` repository at `profile/README.md`.
 * Returns nulls (not 404) when the repository or its README does not exist,
 * mirroring GitHub's own profile page behavior.
 */
export default definePrivateApiCoalescedEventHandler(async (event) => {
  const username = extractUsername(event);
  const isOrganization = getStringQueryParam(getQuery(event).account) === 'organization';
  const repo = isOrganization ? '.github' : username;

  try {
    const octokit = await getGitHubClient(event);
    const [readmeResult, repoResult] = await Promise.allSettled([
      isOrganization
        ? octokit.request('GET /repos/{owner}/{repo}/readme/{dir}', {
            owner: username,
            repo,
            dir: 'profile',
          })
        : octokit.request('GET /repos/{owner}/{repo}/readme', {
            owner: username,
            repo,
          }),
      octokit.request('GET /repos/{owner}/{repo}', {
        owner: username,
        repo,
      }),
    ]);

    if (readmeResult.status === 'rejected') {
      if (hasGitHubErrorStatus(readmeResult.reason, 404)) {
        return EMPTY_README;
      }
      throw readmeResult.reason;
    }

    const readme = readmeResult.value.data;
    const defaultBranch =
      repoResult.status === 'fulfilled' ? (repoResult.value.data.default_branch ?? null) : null;

    return {
      content: Buffer.from(readme.content || '', 'base64').toString('utf-8'),
      htmlUrl: readme.html_url,
      repo: `${username}/${repo}`,
      branch: defaultBranch,
      path: readme.path || null,
    } satisfies UserReadmeResponse;
  } catch (error: unknown) {
    throwGitHubRouteError(error, 'Failed to fetch profile README');
  }
});
