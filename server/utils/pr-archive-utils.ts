import type { Octokit } from '@octokit/core';

import type { PullRequestArchiveAction, PullRequestArchiveResult } from '#shared/types/pulls';

type GitHubClient = Octokit;

const ARCHIVE_MUTATIONS: Record<
  PullRequestArchiveAction,
  { operation: string; input: string; field: string }
> = {
  archive: {
    operation: 'ArchivePullRequest',
    input: 'ArchivePullRequestInput',
    field: 'archivePullRequest',
  },
  unarchive: {
    operation: 'UnarchivePullRequest',
    input: 'UnarchivePullRequestInput',
    field: 'unarchivePullRequest',
  },
};

function buildArchiveMutation(action: PullRequestArchiveAction) {
  const { operation, input, field } = ARCHIVE_MUTATIONS[action];
  return `mutation ${operation}($input: ${input}!) {
  ${field}(input: $input) {
    pullRequest {
      number
    }
  }
}`;
}

/**
 * GitHub exposes no `isArchived` on a pull request node and no field at all in
 * its REST payload, so the only way to read the flag is the `is:archived` search
 * qualifier. It is ignored without a repository scope, which is why the caller
 * always queries one repository.
 */
export const ARCHIVED_PULL_REQUEST_SEARCH_QUERY = 'is:pr is:archived';

const ARCHIVED_SEARCH_PAGE_SIZE = 100;

const trimString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

async function resolvePullRequestNodeId(
  octokit: GitHubClient,
  owner: string,
  repo: string,
  pullNumber: number
) {
  const { data } = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
    owner,
    repo,
    pull_number: pullNumber,
  });
  const pullRequestId = trimString((data as { node_id?: string | null }).node_id);

  if (!pullRequestId) {
    throw createError({
      statusCode: 502,
      statusMessage: 'Pull request is missing a node id',
    });
  }

  return pullRequestId;
}

/**
 * Archive or unarchive one pull request.
 *
 * Archiving is GraphQL-only — GitHub ships no REST endpoint for it — so the
 * numeric route parameter is resolved to the node id the mutation requires.
 * Unarchiving does not reopen the pull request; it stays closed.
 */
export async function setPullRequestArchived(
  octokit: GitHubClient,
  owner: string,
  repo: string,
  pullNumber: number,
  action: PullRequestArchiveAction
): Promise<PullRequestArchiveResult> {
  const pullRequestId = await resolvePullRequestNodeId(octokit, owner, repo, pullNumber);

  await octokit.graphql(buildArchiveMutation(action), { input: { pullRequestId } });

  return { archived: action === 'archive' };
}

/**
 * The pull request numbers of one repository that are currently archived.
 *
 * The search index lags behind the mutation by a few seconds, so a caller must
 * not treat a missing number as proof that a just-archived pull request is
 * public again.
 */
export async function fetchArchivedPullRequestNumbers(
  octokit: GitHubClient,
  owner: string,
  repo: string
): Promise<number[]> {
  const numbers: number[] = [];
  let page = 1;

  while (true) {
    const { data } = await octokit.request('GET /search/issues', {
      q: `repo:${owner}/${repo} ${ARCHIVED_PULL_REQUEST_SEARCH_QUERY}`,
      per_page: ARCHIVED_SEARCH_PAGE_SIZE,
      page,
    });

    const items = data.items ?? [];
    numbers.push(
      ...items.flatMap((item: { number?: number; pull_request?: unknown }) =>
        typeof item.number === 'number' && item.pull_request ? [item.number] : []
      )
    );

    // The search API caps at 1000 results regardless of how many exist, so stop
    // once a short page says there is nothing more to read.
    if (items.length < ARCHIVED_SEARCH_PAGE_SIZE) return numbers;
    page += 1;
  }
}
