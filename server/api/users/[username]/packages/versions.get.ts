import { getGitHubSessionContext, throwGitHubRouteError } from '#server/utils/github-auth-utils';
import {
  isPackageType,
  listAccountPackageVersions,
  mapGitHubPackageVersionToSummary,
  requestPackagesWithScopeFallback,
  resolvePackagesAccountScope,
} from '#server/utils/github-packages-utils';
import { buildLinkedPaginationMeta, parsePaginationNumber } from '#server/utils/github-pagination';
import { extractUsername } from '#server/utils/github-user-utils';
import type { PackageVersionListResponse, PackageVersionSummary } from '#shared/types/packages';

/** Published versions for the package detail page, newest first. */
export default definePrivateApiCoalescedEventHandler(async (event) => {
  const username = extractUsername(event);
  const query = getQuery(event);
  const page = parsePaginationNumber(query.page, 1);
  const perPage = parsePaginationNumber(query.per_page, 30, 100);
  const rawType = Array.isArray(query.type) ? query.type[0] : query.type;
  const rawName = Array.isArray(query.name) ? query.name[0] : query.name;
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
    } satisfies PackageVersionListResponse;
  } catch (error: unknown) {
    throwGitHubRouteError(error, 'Failed to fetch package versions');
  }
});
