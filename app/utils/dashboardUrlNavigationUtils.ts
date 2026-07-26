import type { LocationQueryRaw } from 'vue-router';

import getQueryParamValue from './getQueryParamValue';
import { isGitHubApiHost, isGitHubWebHost, parseUrl } from './githubUrlUtils';
import {
  buildRepoFileDashboardQuery,
  parseMarkdownRepoResource,
  type MarkdownRepoContext,
  type MarkdownRepoResource,
} from './markdownRepoPathUtils';
import parseGitHubMarkdownTarget from './parseGitHubMarkdownTarget';
import parseGitHubRepoPath from './parseGitHubRepoPath';

type PullRequestDashboardView = 'diff';
export type GitHubFileDashboardView = 'blob' | 'tree';

const PULL_REQUEST_DIFF_VIEW_SEGMENTS = new Set(['changes', 'files']);
const GITHUB_WEB_ORIGIN = 'https://github.com';

export const DASHBOARD_DETAIL_QUERY_KEYS = [
  'issue',
  'pr',
  'prReview',
  'discussion',
  'release',
  'releaseTag',
  'repo',
  'path',
  'branch',
  'url',
] as const;

export type DashboardDetailQueryKey = (typeof DASHBOARD_DETAIL_QUERY_KEYS)[number];

export type ReleaseDashboardRef =
  | {
      kind: 'id';
      id: number;
    }
  | {
      kind: 'tag';
      tag: string;
    };

export interface DashboardNavigationEntry {
  type:
    | 'dashboard'
    | 'issue'
    | 'pull-request'
    | 'pull-request-review'
    | 'discussion'
    | 'release'
    | 'releases-list'
    | 'repository'
    | 'notification'
    | 'file'
    | 'profile'
    | 'package'
    | 'wiki'
    | 'starred'
    | 'settings'
    | 'tabs-settings';
  data?: {
    owner?: string;
    repo?: string;
    number?: number;
    tab?: string;
    path?: string;
    branch?: string;
    releaseRef?: ReleaseDashboardRef;
    user?: string;
    packageType?: string;
    packageName?: string;
    packageOrganization?: boolean;
  };
}

interface DashboardNavigationQueryOptions {
  /** Fallback `tab` for repository entries recorded without one. */
  repositoryTab?: string;
}

export function clearDashboardDetailQuery(query: LocationQueryRaw): LocationQueryRaw {
  return {
    ...query,
    issue: undefined,
    pr: undefined,
    prReview: undefined,
    discussion: undefined,
    release: undefined,
    releaseTag: undefined,
    repo: undefined,
    path: undefined,
    branch: undefined,
    url: undefined,
  };
}

interface DashboardTabSwitchQueryOptions {
  currentQuery?: LocationQueryRaw;
  resetQuery?: boolean;
}

export function buildDashboardTabSwitchQuery(
  tabId: string,
  options: DashboardTabSwitchQueryOptions = {}
): LocationQueryRaw {
  if (options.resetQuery) {
    return { tab: tabId };
  }

  return {
    ...clearDashboardDetailQuery(options.currentQuery ?? {}),
    tab: tabId,
    page: undefined,
  };
}

export function serializeDashboardDetailTarget(owner: string, repo: string, number: number) {
  return `${owner}/${repo}/${number}`;
}

export interface DashboardDetailTarget {
  owner: string;
  repo: string;
  number: number;
}

/** Inverse of {@link serializeDashboardDetailTarget} for `owner/repo/number` query values. */
export function parseDashboardDetailTarget(value: unknown): DashboardDetailTarget | null {
  const rawValue = getQueryParamValue(value);
  if (!rawValue) return null;

  const segments = rawValue.split('/').filter(Boolean);
  if (segments.length !== 3) return null;

  const [owner, repo, numberSegment] = segments;

  if (!numberSegment || !/^\d+$/.test(numberSegment)) {
    return null;
  }

  const number = Number.parseInt(numberSegment, 10);

  if (!owner || !repo || !Number.isSafeInteger(number) || number < 1) return null;

  return { owner, repo, number };
}

export interface DashboardReleaseTarget {
  owner: string;
  repo: string;
  releaseRef: ReleaseDashboardRef;
}

/** Inverse of {@link serializeReleaseQuery} for `release`/`releaseTag` query values. */
export function parseDashboardReleaseQuery(
  releaseValue: unknown,
  releaseTagValue: unknown
): DashboardReleaseTarget | null {
  const releaseTag = getQueryParamValue(releaseTagValue);
  if (releaseTag) {
    const rawRelease = getQueryParamValue(releaseValue);
    if (!rawRelease) return null;

    const repoPath = parseGitHubRepoPath(rawRelease);
    if (!repoPath) return null;

    return {
      owner: repoPath.owner,
      repo: repoPath.repo,
      releaseRef: {
        kind: 'tag',
        tag: releaseTag,
      },
    };
  }

  const releaseIdTarget = parseDashboardDetailTarget(releaseValue);
  if (!releaseIdTarget) return null;

  return {
    owner: releaseIdTarget.owner,
    repo: releaseIdTarget.repo,
    releaseRef: {
      kind: 'id',
      id: releaseIdTarget.number,
    },
  };
}

export function serializeDashboardRepoTarget(owner: string, repo: string) {
  return `${owner}/${repo}`;
}

export function serializeReleaseQuery(
  owner: string,
  repo: string,
  releaseRef: ReleaseDashboardRef
) {
  if (releaseRef.kind === 'tag') {
    return {
      release: serializeDashboardRepoTarget(owner, repo),
      releaseTag: releaseRef.tag,
    };
  }

  return {
    release: serializeDashboardDetailTarget(owner, repo, releaseRef.id),
  };
}

export function buildDashboardQueryFromNavigationEntry(
  entry: DashboardNavigationEntry | null | undefined,
  options: DashboardNavigationQueryOptions = {}
): LocationQueryRaw | null {
  if (!entry || entry.type === 'dashboard' || entry.type === 'notification') {
    return null;
  }

  const data = entry.data;

  if (entry.type === 'issue' && data?.owner && data.repo && data.number) {
    return {
      tab: data.tab,
      issue: serializeDashboardDetailTarget(data.owner, data.repo, data.number),
    };
  }

  if (entry.type === 'pull-request' && data?.owner && data.repo && data.number) {
    return {
      tab: data.tab,
      pr: serializeDashboardDetailTarget(data.owner, data.repo, data.number),
    };
  }

  if (entry.type === 'pull-request-review' && data?.owner && data.repo && data.number) {
    return {
      tab: data.tab,
      prReview: serializeDashboardDetailTarget(data.owner, data.repo, data.number),
    };
  }

  if (entry.type === 'discussion' && data?.owner && data.repo && data.number) {
    return {
      tab: data.tab,
      discussion: serializeDashboardDetailTarget(data.owner, data.repo, data.number),
    };
  }

  if (entry.type === 'release' && data?.owner && data.repo) {
    const releaseRef =
      data.releaseRef ?? (data.number ? { kind: 'id' as const, id: data.number } : null);
    if (!releaseRef) return null;

    return {
      tab: data.tab,
      ...serializeReleaseQuery(data.owner, data.repo, releaseRef),
    };
  }

  if (entry.type === 'repository' && data?.owner && data.repo) {
    return {
      tab: data.tab ?? options.repositoryTab,
      repo: serializeDashboardRepoTarget(data.owner, data.repo),
      branch: data.branch,
    };
  }

  if (entry.type === 'file' && data?.owner && data.repo) {
    return {
      tab: data.tab,
      repo: serializeDashboardRepoTarget(data.owner, data.repo),
      path: data.path ?? '',
      branch: data.branch,
    };
  }

  return null;
}

export interface DashboardChildPageRoute {
  path: string;
  query: LocationQueryRaw;
}

/**
 * Entries for pages that live on their own child route (releases list,
 * profile, package) rather than behind a dashboard query. Callers must wrap
 * `path` with `localePath()` before pushing.
 */
export function buildChildPageRouteFromNavigationEntry(
  entry: DashboardNavigationEntry | null | undefined
): DashboardChildPageRoute | null {
  if (!entry) return null;

  const data = entry.data;

  if (entry.type === 'releases-list' && data?.owner && data.repo) {
    return {
      path: '/dashboard/releases',
      query: { repo: serializeDashboardRepoTarget(data.owner, data.repo) },
    };
  }

  // Profile entries without a user target the signed-in user's own profile.
  if (entry.type === 'profile') {
    return {
      path: '/dashboard/profile',
      query: { user: data?.user, tab: data?.tab },
    };
  }

  if (entry.type === 'package' && data?.user && data.packageType && data.packageName) {
    return {
      path: '/dashboard/package',
      query: {
        user: data.user,
        type: data.packageType,
        name: data.packageName,
        ...(data.packageOrganization ? { account: 'organization' } : {}),
      },
    };
  }

  if (entry.type === 'wiki' && data?.owner && data.repo) {
    return {
      path: '/dashboard/wiki',
      query: {
        repo: serializeDashboardRepoTarget(data.owner, data.repo),
        ...(data.path ? { page: data.path } : {}),
      },
    };
  }

  if (entry.type === 'starred') {
    return {
      path: '/dashboard/starred',
      query: data?.user ? { user: data.user } : {},
    };
  }

  if (entry.type === 'settings') {
    return { path: '/dashboard/settings', query: {} };
  }

  if (entry.type === 'tabs-settings') {
    return { path: '/dashboard/tabs', query: {} };
  }

  return null;
}

export type DashboardUrlTarget =
  | {
      type: 'issue';
      owner: string;
      repo: string;
      number: number;
      query: LocationQueryRaw;
      hash?: string;
    }
  | {
      type: 'pull-request';
      owner: string;
      repo: string;
      number: number;
      query: LocationQueryRaw;
      hash?: string;
    }
  | {
      type: 'pull-request-review';
      owner: string;
      repo: string;
      number: number;
      query: LocationQueryRaw;
      hash?: string;
    }
  | {
      type: 'discussion';
      owner: string;
      repo: string;
      number: number;
      query: LocationQueryRaw;
      hash?: string;
    }
  | {
      type: 'release';
      owner: string;
      repo: string;
      releaseRef: ReleaseDashboardRef;
      query: LocationQueryRaw;
      hash?: string;
    }
  | {
      type: 'repository';
      owner: string;
      repo: string;
      branch?: string;
      query: LocationQueryRaw;
      hash?: string;
    }
  | {
      type: 'file';
      owner: string;
      repo: string;
      path: string;
      branch?: string;
      view?: GitHubFileDashboardView;
      query: LocationQueryRaw;
      hash?: string;
    };

interface PullRequestUrlTarget {
  owner: string;
  repo: string;
  number: number;
  view?: PullRequestDashboardView;
  hash?: string;
}

export interface DashboardFileTargetOptions {
  branch?: string;
  hash?: string;
  view?: GitHubFileDashboardView;
}

function decodePathSegment(segment: string) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function encodePathSegments(value: string) {
  return value.split('/').filter(Boolean).map(encodeURIComponent).join('/');
}

function appendHash(value: string, hash: string | undefined) {
  return hash ? `${value}${hash}` : value;
}

function getPathSegments(url: URL) {
  return url.pathname.split('/').filter(Boolean).map(decodePathSegment);
}

function parsePositiveNumber(value: string | undefined) {
  if (!value || !/^\d+$/.test(value)) {
    return null;
  }

  const number = Number.parseInt(value, 10);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function createPullRequestTarget(target: PullRequestUrlTarget): DashboardUrlTarget {
  const isReview = target.view === 'diff';
  const type = isReview ? 'pull-request-review' : 'pull-request';
  const queryKey = isReview ? 'prReview' : 'pr';

  return {
    type,
    owner: target.owner,
    repo: target.repo,
    number: target.number,
    query: {
      [queryKey]: `${target.owner}/${target.repo}/${target.number}`,
    },
    hash: target.hash,
  };
}

function parseGitHubPullRequestUrl(value: string): PullRequestUrlTarget | null {
  const url = parseUrl(value);
  if (!url) return null;

  if (isGitHubWebHost(url.hostname)) {
    const [owner, repo, kind, numberSegment, viewSegment] = getPathSegments(url);
    const number = parsePositiveNumber(numberSegment);

    if (!owner || !repo || kind !== 'pull' || !number) {
      return null;
    }

    return {
      owner,
      repo,
      number,
      view:
        PULL_REQUEST_DIFF_VIEW_SEGMENTS.has(viewSegment ?? '') || url.hash.startsWith('#diff-')
          ? 'diff'
          : undefined,
      hash: url.hash || undefined,
    };
  }

  if (isGitHubApiHost(url.hostname)) {
    const [reposSegment, owner, repo, kind, numberSegment] = getPathSegments(url);
    const number = parsePositiveNumber(numberSegment);

    if (reposSegment !== 'repos' || !owner || !repo || kind !== 'pulls' || !number) {
      return null;
    }

    return {
      owner,
      repo,
      number,
      hash: url.hash || undefined,
    };
  }

  return null;
}

function createIssueTarget(
  owner: string,
  repo: string,
  number: number,
  hash?: string
): DashboardUrlTarget {
  return {
    type: 'issue',
    owner,
    repo,
    number,
    query: {
      issue: `${owner}/${repo}/${number}`,
    },
    hash,
  };
}

function createDiscussionTarget(
  owner: string,
  repo: string,
  number: number,
  hash?: string
): DashboardUrlTarget {
  return {
    type: 'discussion',
    owner,
    repo,
    number,
    query: {
      discussion: `${owner}/${repo}/${number}`,
    },
    hash,
  };
}

function createReleaseTarget(
  owner: string,
  repo: string,
  releaseRef: ReleaseDashboardRef,
  hash?: string
): DashboardUrlTarget {
  return {
    type: 'release',
    owner,
    repo,
    releaseRef,
    query: serializeReleaseQuery(owner, repo, releaseRef),
    hash,
  };
}

function parseGitHubReleaseUrl(value: string): DashboardUrlTarget | null {
  const url = parseUrl(value);
  if (!url) return null;

  if (isGitHubWebHost(url.hostname)) {
    const [owner, repo, releasesSegment, tagSegment, ...tagParts] = getPathSegments(url);

    if (
      !owner ||
      !repo ||
      releasesSegment !== 'releases' ||
      tagSegment !== 'tag' ||
      tagParts.length === 0
    ) {
      return null;
    }

    return createReleaseTarget(
      owner,
      repo,
      {
        kind: 'tag',
        tag: tagParts.join('/'),
      },
      url.hash || undefined
    );
  }

  if (!isGitHubApiHost(url.hostname)) return null;

  const [reposSegment, owner, repo, releasesSegment, releaseIdSegment, ...tagParts] =
    getPathSegments(url);
  const number = parsePositiveNumber(releaseIdSegment);

  if (reposSegment !== 'repos' || !owner || !repo || releasesSegment !== 'releases') {
    return null;
  }

  if (number) {
    return createReleaseTarget(owner, repo, { kind: 'id', id: number }, url.hash || undefined);
  }

  if (releaseIdSegment === 'tags' && tagParts.length > 0) {
    return createReleaseTarget(
      owner,
      repo,
      {
        kind: 'tag',
        tag: tagParts.join('/'),
      },
      url.hash || undefined
    );
  }

  return null;
}

function createRepoTarget(
  owner: string,
  repo: string,
  branch?: string,
  hash?: string
): DashboardUrlTarget {
  return {
    type: 'repository',
    owner,
    repo,
    branch,
    query: {
      repo: `${owner}/${repo}`,
      branch,
    },
    hash,
  };
}

function createFileTarget(resource: MarkdownRepoResource): DashboardUrlTarget {
  const target: DashboardUrlTarget = {
    type: 'file',
    owner: resource.owner,
    repo: resource.repo,
    path: resource.path,
    branch: resource.branch,
    query: buildRepoFileDashboardQuery(resource),
    hash: resource.hash,
  };

  if (resource.view) {
    target.view = resource.view;
  }

  return target;
}

export function createDashboardIssueTarget(
  owner: string,
  repo: string,
  number: number,
  hash?: string
) {
  return createIssueTarget(owner, repo, number, hash);
}

export function createDashboardPullRequestTarget(
  owner: string,
  repo: string,
  number: number,
  hash?: string
) {
  return createPullRequestTarget({ owner, repo, number, hash });
}

export function createDashboardPullRequestReviewTarget(
  owner: string,
  repo: string,
  number: number,
  hash?: string
) {
  return createPullRequestTarget({ owner, repo, number, view: 'diff', hash });
}

export function createDashboardDiscussionTarget(
  owner: string,
  repo: string,
  number: number,
  hash?: string
) {
  return createDiscussionTarget(owner, repo, number, hash);
}

export function createDashboardReleaseTarget(
  owner: string,
  repo: string,
  releaseRef: ReleaseDashboardRef,
  hash?: string
) {
  return createReleaseTarget(owner, repo, releaseRef, hash);
}

export function createDashboardRepositoryTarget(
  owner: string,
  repo: string,
  branch?: string,
  hash?: string
) {
  return createRepoTarget(owner, repo, branch, hash);
}

export function createDashboardFileTarget(
  owner: string,
  repo: string,
  path: string,
  options: DashboardFileTargetOptions = {}
) {
  return createFileTarget({ owner, repo, path, ...options });
}

export function parseDashboardUrlTarget(
  value: string | null | undefined,
  context: MarkdownRepoContext = {}
): DashboardUrlTarget | null {
  const rawValue = value?.trim();
  if (!rawValue) return null;

  const pullRequestUrl = parseGitHubPullRequestUrl(rawValue);
  if (pullRequestUrl) {
    return createPullRequestTarget(pullRequestUrl);
  }

  const releaseUrl = parseGitHubReleaseUrl(rawValue);
  if (releaseUrl) {
    return releaseUrl;
  }

  const detailTarget = parseGitHubMarkdownTarget(rawValue);
  if (detailTarget) {
    if (detailTarget.type === 'issue') {
      return createIssueTarget(
        detailTarget.owner,
        detailTarget.repo,
        detailTarget.number,
        detailTarget.hash
      );
    }

    if (detailTarget.type === 'discussion') {
      return createDiscussionTarget(
        detailTarget.owner,
        detailTarget.repo,
        detailTarget.number,
        detailTarget.hash
      );
    }

    return createPullRequestTarget({
      owner: detailTarget.owner,
      repo: detailTarget.repo,
      number: detailTarget.number,
      hash: detailTarget.hash,
    });
  }

  const resource = parseMarkdownRepoResource(rawValue, context);
  if (resource) {
    return createFileTarget(resource);
  }

  const repoTarget = parseUrl(rawValue) ? parseGitHubRepoPath(rawValue) : null;
  if (repoTarget) {
    const branch =
      context.branch &&
      context.owner?.toLowerCase() === repoTarget.owner.toLowerCase() &&
      context.repo?.toLowerCase() === repoTarget.repo.toLowerCase()
        ? context.branch
        : undefined;

    return createRepoTarget(repoTarget.owner, repoTarget.repo, branch);
  }

  return null;
}

export function buildGitHubUrlFromDashboardTarget(target: DashboardUrlTarget) {
  const repoUrl = `${GITHUB_WEB_ORIGIN}/${encodeURIComponent(target.owner)}/${encodeURIComponent(
    target.repo
  )}`;

  if (target.type === 'issue') {
    return appendHash(`${repoUrl}/issues/${target.number}`, target.hash);
  }

  if (target.type === 'pull-request') {
    return appendHash(`${repoUrl}/pull/${target.number}`, target.hash);
  }

  if (target.type === 'pull-request-review') {
    return appendHash(`${repoUrl}/pull/${target.number}/files`, target.hash);
  }

  if (target.type === 'discussion') {
    return appendHash(`${repoUrl}/discussions/${target.number}`, target.hash);
  }

  if (target.type === 'release') {
    if (target.releaseRef.kind === 'tag') {
      return appendHash(
        `${repoUrl}/releases/tag/${encodePathSegments(target.releaseRef.tag)}`,
        target.hash
      );
    }

    return appendHash(`${repoUrl}/releases`, target.hash);
  }

  if (target.type === 'file') {
    if (target.branch && target.path) {
      const fileView = target.view ?? 'blob';
      return appendHash(
        `${repoUrl}/${fileView}/${encodePathSegments(target.branch)}/${encodePathSegments(
          target.path
        )}`,
        target.hash
      );
    }

    return appendHash(repoUrl, target.hash);
  }

  if (target.branch) {
    return appendHash(`${repoUrl}/tree/${encodePathSegments(target.branch)}`, target.hash);
  }

  return appendHash(repoUrl, target.hash);
}
