import type { Octokit } from '@octokit/core';

import type {
  RepoBranch,
  RepoBranchAssociatedPull,
  RepoBranchDetail,
  RepoBranchLastCommit,
  RepoBranchesDetailResponse,
} from '#shared/types/repos';

import {
  mapGitHubCommitToCommitListItem,
  type GitHubCommitListItem,
} from './repo-latest-commit-utils';

type GitHubClient = Octokit;

/** Cap concurrent tip/compare/PR lookups so large repos stay rate-limit friendly. */
const ENRICHMENT_CONCURRENCY = 6;

/** Per-branch associated PR ceiling (newest first from GitHub). */
const ASSOCIATED_PULLS_PER_BRANCH = 5;

interface ListedBranch {
  name: string;
  sha: string;
  protected: boolean;
}

interface GitHubPullListItem {
  number?: number | null;
  title?: string | null;
  state?: string | null;
  draft?: boolean | null;
  merged_at?: string | null;
  html_url?: string | null;
  head?: {
    ref?: string | null;
  } | null;
}

function trimString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Run `worker` over `items` with a fixed concurrency pool.
 * Results stay in input order.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];

  const limit = Math.max(1, Math.min(concurrency, items.length));
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const runWorker = async () => {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await worker(items[current]!, current);
    }
  };

  await Promise.all(Array.from({ length: limit }, () => runWorker()));
  return results;
}

export function mapCommitToBranchLastCommit(
  commit: GitHubCommitListItem | null | undefined
): RepoBranchLastCommit | null {
  const mapped = mapGitHubCommitToCommitListItem(commit);
  if (!mapped) return null;

  return {
    sha: mapped.sha,
    shortSha: mapped.shortSha,
    message: mapped.message || null,
    committedAt: mapped.committedAt,
    author: mapped.author,
  };
}

export function mapGitHubPullToAssociatedPull(
  pull: GitHubPullListItem | null | undefined
): RepoBranchAssociatedPull | null {
  const number =
    typeof pull?.number === 'number' && Number.isSafeInteger(pull.number) ? pull.number : 0;
  if (number < 1 || !pull) return null;

  const title = trimString(pull.title) || `#${number}`;
  const state = pull.state === 'open' ? 'open' : 'closed';
  const merged = Boolean(trimString(pull.merged_at));

  return {
    number,
    title,
    state,
    merged,
    draft: Boolean(pull.draft),
    htmlUrl: trimString(pull.html_url) || null,
  };
}

async function listAllBranches(
  octokit: GitHubClient,
  owner: string,
  repo: string
): Promise<ListedBranch[]> {
  const branches: ListedBranch[] = [];
  const perPage = 100;
  let page = 1;

  while (true) {
    const { data } = await octokit.request('GET /repos/{owner}/{repo}/branches', {
      owner,
      repo,
      page,
      per_page: perPage,
    });

    for (const branch of data) {
      const name = trimString(branch.name);
      const sha = trimString(branch.commit?.sha);
      if (!name || !sha) continue;

      branches.push({
        name,
        sha,
        protected: Boolean(branch.protected),
      });
    }

    if (data.length < perPage) {
      return branches;
    }

    page += 1;
  }
}

async function fetchDefaultBranch(
  octokit: GitHubClient,
  owner: string,
  repo: string
): Promise<string> {
  const { data } = await octokit.request('GET /repos/{owner}/{repo}', {
    owner,
    repo,
  });

  return trimString(data.default_branch);
}

async function fetchBranchLastCommit(
  octokit: GitHubClient,
  owner: string,
  repo: string,
  sha: string
): Promise<RepoBranchLastCommit | null> {
  try {
    const { data } = await octokit.request('GET /repos/{owner}/{repo}/commits/{ref}', {
      owner,
      repo,
      ref: sha,
    });

    return mapCommitToBranchLastCommit(data as GitHubCommitListItem);
  } catch {
    return null;
  }
}

async function fetchAheadBehind(
  octokit: GitHubClient,
  owner: string,
  repo: string,
  base: string,
  head: string
): Promise<{ aheadBy: number | null; behindBy: number | null }> {
  if (!base || !head || base === head) {
    return { aheadBy: null, behindBy: null };
  }

  try {
    // REST compare always returns ahead_by / behind_by; per_page only trims the
    // commit list payload, not the counts.
    const { data } = await octokit.request('GET /repos/{owner}/{repo}/compare/{basehead}', {
      owner,
      repo,
      basehead: `${base}...${head}`,
      per_page: 1,
    });

    const aheadBy = typeof data.ahead_by === 'number' ? data.ahead_by : null;
    const behindBy = typeof data.behind_by === 'number' ? data.behind_by : null;

    return { aheadBy, behindBy };
  } catch {
    return { aheadBy: null, behindBy: null };
  }
}

async function fetchAssociatedPulls(
  octokit: GitHubClient,
  owner: string,
  repo: string,
  branchName: string
): Promise<RepoBranchAssociatedPull[]> {
  try {
    // Prefer head-branch match over commit association — matches GitHub's
    // "pull request for this branch" semantics.
    const { data } = await octokit.request('GET /repos/{owner}/{repo}/pulls', {
      owner,
      repo,
      state: 'all',
      head: `${owner}:${branchName}`,
      per_page: ASSOCIATED_PULLS_PER_BRANCH,
      sort: 'updated',
      direction: 'desc',
    });

    return data
      .map((pull) => mapGitHubPullToAssociatedPull(pull as GitHubPullListItem))
      .filter((pull): pull is RepoBranchAssociatedPull => Boolean(pull));
  } catch {
    return [];
  }
}

async function enrichBranch(
  octokit: GitHubClient,
  owner: string,
  repo: string,
  branch: ListedBranch,
  defaultBranch: string
): Promise<RepoBranchDetail> {
  const isDefault = Boolean(defaultBranch) && branch.name === defaultBranch;

  const [lastCommit, compare, associatedPulls] = await Promise.all([
    fetchBranchLastCommit(octokit, owner, repo, branch.sha),
    isDefault
      ? Promise.resolve({ aheadBy: null as number | null, behindBy: null as number | null })
      : fetchAheadBehind(octokit, owner, repo, defaultBranch, branch.name),
    fetchAssociatedPulls(octokit, owner, repo, branch.name),
  ]);

  const base: RepoBranch = {
    name: branch.name,
    sha: branch.sha,
    protected: branch.protected,
  };

  return {
    ...base,
    isDefault,
    lastCommit,
    aheadBy: compare.aheadBy,
    behindBy: compare.behindBy,
    associatedPulls,
  };
}

function sortBranchDetails(items: RepoBranchDetail[]): RepoBranchDetail[] {
  const defaultBranch = items.find((item) => item.isDefault);
  const others = items
    .filter((item) => !item.isDefault)
    .sort((left, right) => {
      const leftAt = left.lastCommit?.committedAt ?? '';
      const rightAt = right.lastCommit?.committedAt ?? '';
      if (leftAt !== rightAt) {
        return rightAt.localeCompare(leftAt);
      }
      return left.name.localeCompare(right.name);
    });

  return defaultBranch ? [defaultBranch, ...others] : others;
}

/**
 * Fetch every branch and enrich via REST only:
 * - tip commit (author / date / message)
 * - compare against default branch (ahead / behind)
 * - pulls whose head ref matches the branch
 */
export async function fetchRepoBranchDetails(
  octokit: GitHubClient,
  owner: string,
  repo: string
): Promise<RepoBranchesDetailResponse> {
  const [listed, defaultBranch] = await Promise.all([
    listAllBranches(octokit, owner, repo),
    fetchDefaultBranch(octokit, owner, repo),
  ]);

  const enriched = await mapWithConcurrency(listed, ENRICHMENT_CONCURRENCY, (branch) =>
    enrichBranch(octokit, owner, repo, branch, defaultBranch)
  );

  return {
    defaultBranch,
    items: sortBranchDetails(enriched),
  };
}
