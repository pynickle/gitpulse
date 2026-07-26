import { getGitHubSessionContext, throwGitHubRouteError } from '#server/utils/github-auth-utils';
import {
  collectTaggedPackageVersions,
  isPackageType,
  listAccountPackageVersions,
  mapGitHubPackageVersionToSummary,
  requestPackagesWithScopeFallback,
  resolvePackagesAccountScope,
} from '#server/utils/github-packages-utils';
import {
  buildLinkedPaginationMeta,
  paginateCollection,
  parsePaginationNumber,
} from '#server/utils/github-pagination';
import { extractUsername } from '#server/utils/github-user-utils';
import type { PackageVersionListResponse, PackageVersionSummary } from '#shared/types/packages';

/**
 * Published versions for the package detail page, newest first.
 * `filter=tagged` narrows to versions carrying image tags (container/docker);
 * GitHub has no such filter, so the tagged view scans + re-paginates locally.
 */
export default definePrivateApiCoalescedEventHandler(async (event) => {
  const username = extractUsername(event);
  const query = getQuery(event);
  const page = parsePaginationNumber(query.page, 1);
  const perPage = parsePaginationNumber(query.per_page, 30, 100);
  const rawType = Array.isArray(query.type) ? query.type[0] : query.type;
  const rawName = Array.isArray(query.name) ? query.name[0] : query.name;
  const rawFilter = Array.isArray(query.filter) ? query.filter[0] : query.filter;
  const packageName = typeof rawName === 'string' ? rawName.trim() : '';

  if (!isPackageType(rawType) || !packageName) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A valid package type and name are required',
    });
  }

  try {
    const { octokit, userLogin } = await getGitHubSessionContext(event);
    const scope = resolvePackagesAccountScope(username, userLogin, query.account);

    if (rawFilter === 'tagged') {
      const { items: taggedVersions, truncated } = await requestPackagesWithScopeFallback(
        scope,
        (activeScope) =>
          collectTaggedPackageVersions(octokit, activeScope, username, rawType, packageName)
      );
      const { items, pagination } = paginateCollection(taggedVersions, { page, perPage });

      return { items, pagination, truncated } satisfies PackageVersionListResponse;
    }

    const { items, linkHeader } = await requestPackagesWithScopeFallback(scope, (activeScope) =>
      listAccountPackageVersions(octokit, activeScope, username, rawType, packageName, {
        page,
        perPage,
      })
    );

    return {
      items: items
        .map((raw) => mapGitHubPackageVersionToSummary(raw))
        .filter((version): version is PackageVersionSummary => version !== null),
      pagination: buildLinkedPaginationMeta({ page, perPage, linkHeader }),
      truncated: false,
    } satisfies PackageVersionListResponse;
  } catch (error: unknown) {
    throwGitHubRouteError(error, 'Failed to fetch package versions');
  }
});
