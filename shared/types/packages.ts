/**
 * GitHub Packages payloads served by the `/api/users/{username}/packages*`
 * routes. Package `type`/`name` travel as query params (never path segments)
 * because container image names may contain `/`.
 */

import type { UserConnectionPaginationMeta } from '#shared/types/users';

/** Registry types GitHub's packages REST API distinguishes. */
export type PackageType = 'npm' | 'maven' | 'rubygems' | 'docker' | 'nuget' | 'container';

/** `all` fans out one request per package type server-side. */
export type PackageTypeFilter = PackageType | 'all';

/** Version list view: `tagged` keeps only versions carrying image tags. */
export type PackageVersionFilter = 'tagged' | 'all';

/** Source repository a package is linked to, when GitHub returns one. */
export interface PackageRepositorySummary {
  fullName: string;
  description: string | null;
  private: boolean;
}

/** Compact package entry shared by the list tab and the detail header. */
export interface PackageSummary {
  id: number | string;
  name: string;
  packageType: PackageType;
  visibility: string;
  versionCount: number | null;
  htmlUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  ownerLogin: string | null;
  repository: PackageRepositorySummary | null;
}

export interface UserPackageListResponse {
  items: PackageSummary[];
  pagination: UserConnectionPaginationMeta;
  /** True when the merged all-type listing hit its per-type fetch cap. */
  truncated: boolean;
}

export interface PackageDetailResponse {
  package: PackageSummary;
}

/** One published version; `name` is the digest for container images. */
export interface PackageVersionSummary {
  id: number | string;
  name: string;
  htmlUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  /** Container/Docker image tags; empty for registries without tags. */
  tags: string[];
}

export interface PackageVersionListResponse {
  items: PackageVersionSummary[];
  pagination: UserConnectionPaginationMeta;
  /** True when the tagged-only scan stopped at its version fetch cap. */
  truncated: boolean;
}
