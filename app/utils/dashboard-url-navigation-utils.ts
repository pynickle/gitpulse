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

export type PullRequestDashboardView = 'diff';

const PULL_REQUEST_DIFF_VIEW_SEGMENTS = new Set(['changes', 'files']);

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
      view?: PullRequestDashboardView;
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
  const query: LocationQueryRaw = {
    pr: `${target.owner}/${target.repo}/${target.number}`,
    prView: target.view,
  };

  return {
    type: 'pull-request',
    owner: target.owner,
    repo: target.repo,
    number: target.number,
    view: target.view,
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

  const detailTarget = parseGitHubMarkdownTarget(rawValue);
  if (detailTarget) {
    if (detailTarget.type === 'issue') {
      return createIssueTarget(detailTarget.owner, detailTarget.repo, detailTarget.number);
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
