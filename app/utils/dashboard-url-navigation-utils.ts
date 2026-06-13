import type { LocationQueryRaw } from 'vue-router';

import { isGitHubApiHost, isGitHubWebHost, parseUrl } from './github-url-utils';
import {
  buildRepoFileDashboardQuery,
  parseMarkdownRepoResource,
  type MarkdownRepoContext,
  type MarkdownRepoResource,
} from './markdown-repo-path-utils';
import parseGitHubMarkdownTarget from './parseGitHubMarkdownTarget';
import parseGitHubRepoPath from './parseGitHubRepoPath';

type PullRequestDashboardView = 'diff';

const PULL_REQUEST_DIFF_VIEW_SEGMENTS = new Set(['changes', 'files']);

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
    | 'repository'
    | 'notification'
    | 'file';
  data?: {
    owner?: string;
    repo?: string;
    number?: number;
    tab?: string;
    path?: string;
    branch?: string;
    releaseRef?: ReleaseDashboardRef;
  };
}

interface DashboardNavigationQueryOptions {
  defaultTab?: string;
  repositoryTab?: string;
  normalizeBranch?: (
    entry: DashboardNavigationEntry,
    branch: string | undefined
  ) => string | undefined;
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

function getNavigationBranch(
  entry: DashboardNavigationEntry,
  options: DashboardNavigationQueryOptions
) {
  return options.normalizeBranch?.(entry, entry.data?.branch) ?? entry.data?.branch;
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
      tab: data.tab ?? options.defaultTab,
      issue: serializeDashboardDetailTarget(data.owner, data.repo, data.number),
    };
  }

  if (entry.type === 'pull-request' && data?.owner && data.repo && data.number) {
    return {
      tab: data.tab ?? options.defaultTab,
      pr: serializeDashboardDetailTarget(data.owner, data.repo, data.number),
    };
  }

  if (entry.type === 'pull-request-review' && data?.owner && data.repo && data.number) {
    return {
      tab: data.tab ?? options.defaultTab,
      prReview: serializeDashboardDetailTarget(data.owner, data.repo, data.number),
    };
  }

  if (entry.type === 'discussion' && data?.owner && data.repo && data.number) {
    return {
      tab: data.tab ?? options.defaultTab,
      discussion: serializeDashboardDetailTarget(data.owner, data.repo, data.number),
    };
  }

  if (entry.type === 'release' && data?.owner && data.repo) {
    const releaseRef =
      data.releaseRef ?? (data.number ? { kind: 'id' as const, id: data.number } : null);
    if (!releaseRef) return null;

    return {
      tab: data.tab ?? options.defaultTab,
      ...serializeReleaseQuery(data.owner, data.repo, releaseRef),
    };
  }

  if (entry.type === 'repository' && data?.owner && data.repo) {
    return {
      tab: data.tab ?? options.repositoryTab ?? options.defaultTab,
      repo: serializeDashboardRepoTarget(data.owner, data.repo),
      branch: getNavigationBranch(entry, options),
    };
  }

  if (entry.type === 'file' && data?.owner && data.repo) {
    return {
      tab: data.tab,
      repo: serializeDashboardRepoTarget(data.owner, data.repo),
      path: data.path ?? '',
      branch: getNavigationBranch(entry, options),
    };
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

function decodePathSegment(segment: string) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
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
  if (target.view === 'diff') {
    return createPullRequestReviewTarget(target);
  }

  const query: LocationQueryRaw = {
    pr: `${target.owner}/${target.repo}/${target.number}`,
  };

  return {
    type: 'pull-request',
    owner: target.owner,
    repo: target.repo,
    number: target.number,
    query,
    hash: target.hash,
  };
}

function createPullRequestReviewTarget(target: PullRequestUrlTarget): DashboardUrlTarget {
  const query: LocationQueryRaw = {
    prReview: `${target.owner}/${target.repo}/${target.number}`,
  };

  return {
    type: 'pull-request-review',
    owner: target.owner,
    repo: target.repo,
    number: target.number,
    query,
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
  return {
    type: 'file',
    owner: resource.owner,
    repo: resource.repo,
    path: resource.path,
    branch: resource.branch,
    query: buildRepoFileDashboardQuery(resource),
    hash: resource.hash,
  };
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
      return createIssueTarget(detailTarget.owner, detailTarget.repo, detailTarget.number);
    }

    if (detailTarget.type === 'discussion') {
      return createDiscussionTarget(detailTarget.owner, detailTarget.repo, detailTarget.number);
    }

    return createPullRequestTarget({
      owner: detailTarget.owner,
      repo: detailTarget.repo,
      number: detailTarget.number,
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
