import type { Octokit } from '@octokit/core';

import { hasGitHubErrorStatus } from '#server/utils/github-auth-utils';
import type { PackageSummary, PackageType, PackageVersionSummary } from '#shared/types/packages';

export const PACKAGE_TYPES: readonly PackageType[] = [
  'npm',
  'maven',
  'rubygems',
  'docker',
  'nuget',
  'container',
];

/**
 * Namespace variants the packages REST endpoints distinguish. `self` uses the
 * authenticated-user endpoints so private packages show on your own profile.
 */
export type PackagesAccountScope = 'self' | 'user' | 'org';

/** GitHub caps list endpoints at 100 per page. */
const ALL_TYPES_PER_PAGE = 100;
/** Per-type page cap for the merged all-type view (300 packages per type). */
const ALL_TYPES_MAX_PAGES = 3;

export interface GitHubPackageResponse {
  id: number | string;
  name?: string | null;
  package_type?: string | null;
  visibility?: string | null;
  version_count?: number | null;
  html_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  owner?: { login?: string | null } | null;
  repository?: {
    full_name?: string | null;
    description?: string | null;
    private?: boolean | null;
  } | null;
}

export interface GitHubPackageVersionResponse {
  id: number | string;
  name?: string | null;
  html_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  metadata?: {
    container?: { tags?: unknown } | null;
    docker?: { tag?: unknown; tags?: unknown } | null;
  } | null;
}

export function isPackageType(value: unknown): value is PackageType {
  return typeof value === 'string' && (PACKAGE_TYPES as readonly string[]).includes(value);
}

/**
 * Pick the endpoint namespace: the session user's own login gets `self`;
 * otherwise the `?account=organization` hint (same convention as the profile
 * README route) selects the org namespace.
 */
export function resolvePackagesAccountScope(
  username: string,
  sessionLogin: string,
  accountHint: unknown
): PackagesAccountScope {
  if (username.toLowerCase() === sessionLogin.toLowerCase()) {
    return 'self';
  }

  const hint = Array.isArray(accountHint) ? accountHint[0] : accountHint;
  return hint === 'organization' ? 'org' : 'user';
}

/**
 * The account hint is best-effort — hand-edited URLs may omit it — so a
 * user-namespace 404 retries once against the org namespace before failing.
 */
export async function requestPackagesWithScopeFallback<T>(
  scope: PackagesAccountScope,
  request: (scope: PackagesAccountScope) => Promise<T>
): Promise<T> {
  try {
    return await request(scope);
  } catch (error) {
    if (scope === 'user' && hasGitHubErrorStatus(error, 404)) {
      return request('org');
    }
    throw error;
  }
}

export async function listAccountPackages(
  octokit: Octokit,
  scope: PackagesAccountScope,
  username: string,
  packageType: PackageType,
  options: { page: number; perPage: number }
): Promise<{ items: GitHubPackageResponse[]; linkHeader?: string }> {
  const params = {
    package_type: packageType,
    page: options.page,
    per_page: options.perPage,
  };

  const response =
    scope === 'self'
      ? await octokit.request('GET /user/packages', params)
      : scope === 'org'
        ? await octokit.request('GET /orgs/{org}/packages', { org: username, ...params })
        : await octokit.request('GET /users/{username}/packages', { username, ...params });

  return {
    items: Array.isArray(response.data) ? (response.data as GitHubPackageResponse[]) : [],
    linkHeader: response.headers.link,
  };
}

/**
 * GitHub's list endpoint requires a `package_type`, so the "all" view fans out
 * one paged fetch per type. Individual type failures are tolerated as long as
 * at least one type succeeds; a total failure rethrows the first error so
 * scope/permission problems still surface.
 */
export async function listPackagesAcrossTypes(
  octokit: Octokit,
  scope: PackagesAccountScope,
  username: string
): Promise<{ items: GitHubPackageResponse[]; truncated: boolean }> {
  let truncated = false;

  const results = await Promise.allSettled(
    PACKAGE_TYPES.map(async (packageType) => {
      const collected: GitHubPackageResponse[] = [];

      for (let page = 1; page <= ALL_TYPES_MAX_PAGES; page += 1) {
        const { items } = await listAccountPackages(octokit, scope, username, packageType, {
          page,
          perPage: ALL_TYPES_PER_PAGE,
        });
        collected.push(...items);

        if (items.length < ALL_TYPES_PER_PAGE) {
          return collected;
        }
      }

      truncated = true;
      return collected;
    })
  );

  const fulfilled = results.filter(
    (result): result is PromiseFulfilledResult<GitHubPackageResponse[]> =>
      result.status === 'fulfilled'
  );

  if (fulfilled.length === 0 && results.length > 0) {
    throw (results[0] as PromiseRejectedResult).reason;
  }

  return { items: fulfilled.flatMap((result) => result.value), truncated };
}

export async function getAccountPackage(
  octokit: Octokit,
  scope: PackagesAccountScope,
  username: string,
  packageType: PackageType,
  packageName: string
): Promise<GitHubPackageResponse> {
  const params = { package_type: packageType, package_name: packageName };

  const response =
    scope === 'self'
      ? await octokit.request('GET /user/packages/{package_type}/{package_name}', params)
      : scope === 'org'
        ? await octokit.request('GET /orgs/{org}/packages/{package_type}/{package_name}', {
            org: username,
            ...params,
          })
        : await octokit.request('GET /users/{username}/packages/{package_type}/{package_name}', {
            username,
            ...params,
          });

  return response.data as GitHubPackageResponse;
}

export async function listAccountPackageVersions(
  octokit: Octokit,
  scope: PackagesAccountScope,
  username: string,
  packageType: PackageType,
  packageName: string,
  options: { page: number; perPage: number }
): Promise<{ items: GitHubPackageVersionResponse[]; linkHeader?: string }> {
  const params = {
    package_type: packageType,
    package_name: packageName,
    page: options.page,
    per_page: options.perPage,
  };

  const response =
    scope === 'self'
      ? await octokit.request('GET /user/packages/{package_type}/{package_name}/versions', params)
      : scope === 'org'
        ? await octokit.request('GET /orgs/{org}/packages/{package_type}/{package_name}/versions', {
            org: username,
            ...params,
          })
        : await octokit.request(
            'GET /users/{username}/packages/{package_type}/{package_name}/versions',
            { username, ...params }
          );

  return {
    items: Array.isArray(response.data) ? (response.data as GitHubPackageVersionResponse[]) : [],
    linkHeader: response.headers.link,
  };
}

export function mapGitHubPackageToSummary(
  raw: GitHubPackageResponse | null | undefined
): PackageSummary | null {
  if (!raw || raw.id === undefined || raw.id === null) {
    return null;
  }

  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!name || !isPackageType(raw.package_type)) {
    return null;
  }

  const repositoryFullName =
    typeof raw.repository?.full_name === 'string' ? raw.repository.full_name : '';

  return {
    id: raw.id,
    name,
    packageType: raw.package_type,
    visibility: typeof raw.visibility === 'string' && raw.visibility ? raw.visibility : 'public',
    versionCount: typeof raw.version_count === 'number' ? raw.version_count : null,
    htmlUrl: raw.html_url ?? null,
    createdAt: raw.created_at ?? null,
    updatedAt: raw.updated_at ?? null,
    ownerLogin: raw.owner?.login ?? null,
    repository: repositoryFullName
      ? {
          fullName: repositoryFullName,
          description: raw.repository?.description ?? null,
          private: Boolean(raw.repository?.private),
        }
      : null,
  };
}

function toTagArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

/** GitHub caps the version list endpoint at 100 per page. */
const TAGGED_VERSIONS_PER_PAGE = 100;
/** Page cap for the tagged-only scan (newest 300 versions). */
const TAGGED_VERSIONS_MAX_PAGES = 3;

/**
 * Tagged-only view: GitHub has no server-side tag filter, so scan the newest
 * pages, keep versions that carry at least one tag, and let the route
 * re-paginate the filtered collection. `truncated` flags a hit on the scan
 * cap, meaning older tagged versions may be missing.
 */
export async function collectTaggedPackageVersions(
  octokit: Octokit,
  scope: PackagesAccountScope,
  username: string,
  packageType: PackageType,
  packageName: string
): Promise<{ items: PackageVersionSummary[]; truncated: boolean }> {
  const tagged: PackageVersionSummary[] = [];

  for (let page = 1; page <= TAGGED_VERSIONS_MAX_PAGES; page += 1) {
    const { items } = await listAccountPackageVersions(
      octokit,
      scope,
      username,
      packageType,
      packageName,
      { page, perPage: TAGGED_VERSIONS_PER_PAGE }
    );

    for (const raw of items) {
      const version = mapGitHubPackageVersionToSummary(raw);
      if (version && version.tags.length > 0) {
        tagged.push(version);
      }
    }

    if (items.length < TAGGED_VERSIONS_PER_PAGE) {
      return { items: tagged, truncated: false };
    }
  }

  return { items: tagged, truncated: true };
}

export function mapGitHubPackageVersionToSummary(
  raw: GitHubPackageVersionResponse | null | undefined
): PackageVersionSummary | null {
  if (!raw || raw.id === undefined || raw.id === null) {
    return null;
  }

  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!name) {
    return null;
  }

  // Legacy docker metadata has used both `tag` and `tags` across payloads.
  const tags = [
    ...toTagArray(raw.metadata?.container?.tags),
    ...toTagArray(raw.metadata?.docker?.tags ?? raw.metadata?.docker?.tag),
  ];

  return {
    id: raw.id,
    name,
    htmlUrl: raw.html_url ?? null,
    createdAt: raw.created_at ?? null,
    updatedAt: raw.updated_at ?? null,
    tags,
  };
}

/** Most recently published first; undated entries sort last by name. */
export function sortPackagesByUpdatedAt(items: PackageSummary[]): PackageSummary[] {
  return [...items].sort((a, b) => {
    const aTime = a.updatedAt ? Date.parse(a.updatedAt) : Number.NaN;
    const bTime = b.updatedAt ? Date.parse(b.updatedAt) : Number.NaN;
    const aValid = Number.isFinite(aTime);
    const bValid = Number.isFinite(bTime);

    if (aValid && bValid && aTime !== bTime) {
      return bTime - aTime;
    }
    if (aValid !== bValid) {
      return aValid ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}
