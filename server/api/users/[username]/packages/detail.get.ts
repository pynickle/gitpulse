import { getGitHubSessionContext, throwGitHubRouteError } from '#server/utils/github-auth-utils';
import {
  getAccountPackage,
  isPackageType,
  mapGitHubPackageToSummary,
  requestPackagesWithScopeFallback,
  resolvePackagesAccountScope,
} from '#server/utils/github-packages-utils';
import { extractUsername } from '#server/utils/github-user-utils';
import type { PackageDetailResponse } from '#shared/types/packages';

/**
 * Single package for the detail page. `type`/`name` are query params because
 * container image names may contain `/`.
 */
export default definePrivateApiCoalescedEventHandler(async (event) => {
  const username = extractUsername(event);
  const query = getQuery(event);
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
    const raw = await requestPackagesWithScopeFallback(scope, (activeScope) =>
      getAccountPackage(octokit, activeScope, username, rawType, packageName)
    );
    const pkg = mapGitHubPackageToSummary(raw);

    if (!pkg) {
      throw createError({
        statusCode: 502,
        statusMessage: 'Unexpected package payload from GitHub',
      });
    }

    return { package: pkg } satisfies PackageDetailResponse;
  } catch (error: unknown) {
    throwGitHubRouteError(error, 'Failed to fetch package');
  }
});
