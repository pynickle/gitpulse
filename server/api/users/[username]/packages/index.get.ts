import { getGitHubSessionContext, throwGitHubRouteError } from '#server/utils/github-auth-utils';
import {
  isPackageType,
  listAccountPackages,
  listPackagesAcrossTypes,
  mapGitHubPackageToSummary,
  requestPackagesWithScopeFallback,
  resolvePackagesAccountScope,
  sortPackagesByUpdatedAt,
  type GitHubPackageResponse,
} from '#server/utils/github-packages-utils';
import {
  buildLinkedPaginationMeta,
  paginateCollection,
  parsePaginationNumber,
} from '#server/utils/github-pagination';
import { extractUsername } from '#server/utils/github-user-utils';
import type { PackageSummary, UserPackageListResponse } from '#shared/types/packages';

function mapPackages(rawItems: GitHubPackageResponse[]): PackageSummary[] {
  return rawItems
    .map((raw) => mapGitHubPackageToSummary(raw))
    .filter((pkg): pkg is PackageSummary => pkg !== null);
}

/**
 * Packages for the profile "Packages" tab. `?type=` narrows to one registry
 * with GitHub's own pagination; without it every type is fetched and merged.
 * Requires the `read:packages` token scope.
 */
export default definePrivateApiCoalescedEventHandler(async (event) => {
  const username = extractUsername(event);
  const query = getQuery(event);
  const page = parsePaginationNumber(query.page, 1);
  const perPage = parsePaginationNumber(query.per_page, 30, 100);
  const rawType = Array.isArray(query.type) ? query.type[0] : query.type;
  const typeFilter = isPackageType(rawType) ? rawType : 'all';

  try {
    const { octokit, userLogin } = await getGitHubSessionContext(event);
    const scope = resolvePackagesAccountScope(username, userLogin, query.account);

    if (typeFilter !== 'all') {
      const { items, linkHeader } = await requestPackagesWithScopeFallback(scope, (activeScope) =>
        listAccountPackages(octokit, activeScope, username, typeFilter, { page, perPage })
      );

      return {
        items: mapPackages(items),
        pagination: buildLinkedPaginationMeta({ page, perPage, linkHeader }),
        truncated: false,
      } satisfies UserPackageListResponse;
    }

    const { items, truncated } = await requestPackagesWithScopeFallback(scope, (activeScope) =>
      listPackagesAcrossTypes(octokit, activeScope, username)
    );
    const sorted = sortPackagesByUpdatedAt(mapPackages(items));
    const paged = paginateCollection(sorted, { page, perPage });

    return {
      items: paged.items,
      pagination: paged.pagination,
      truncated,
    } satisfies UserPackageListResponse;
  } catch (error: unknown) {
    throwGitHubRouteError(error, 'Failed to fetch packages');
  }
});
