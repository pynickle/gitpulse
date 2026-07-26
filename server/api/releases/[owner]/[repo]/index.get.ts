import { getGitHubClient, throwGitHubRouteError } from '#server/utils/github-auth-utils';
import { buildLinkedPaginationMeta, parsePaginationNumber } from '#server/utils/github-pagination';
import type { ReleaseListItem } from '#shared/types/releases';

export default definePrivateApiCoalescedEventHandler(async (event) => {
  try {
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
    const query = getQuery(event);
    const page = parsePaginationNumber(query.page, 1);
    const perPage = parsePaginationNumber(query.per_page, 20, 100);

    const { data: releases, headers } = await octokit.request(
      'GET /repos/{owner}/{repo}/releases',
      {
        owner,
        repo,
        page,
        per_page: perPage,
      }
    );

    const items: ReleaseListItem[] = releases.map((release) => ({
      id: release.id,
      tag_name: release.tag_name,
      name: release.name,
      draft: release.draft,
      prerelease: release.prerelease,
      created_at: release.created_at,
      published_at: release.published_at,
      html_url: release.html_url,
      author: release.author
        ? {
            login: release.author.login,
            avatar_url: release.author.avatar_url,
            html_url: release.author.html_url,
          }
        : null,
      assets_count: release.assets?.length ?? 0,
      download_count: (release.assets ?? []).reduce(
        (total, asset) => total + (asset.download_count ?? 0),
        0
      ),
    }));

    return {
      items,
      pagination: buildLinkedPaginationMeta({
        page,
        perPage,
        linkHeader: headers.link,
      }),
    };
  } catch (error: unknown) {
    console.error('Error fetching GitHub releases:', error);
    throwGitHubRouteError(error, 'Failed to fetch releases');
  }
});
