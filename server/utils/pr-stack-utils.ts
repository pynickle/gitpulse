import type { Octokit } from '@octokit/core';

import { fetchBaseBehindCount } from '#server/utils/pr-merge-status-utils';
import type {
  PullRequestStack,
  PullRequestStackLayer,
  PullRequestStackLayerState,
} from '#shared/types/pulls';

type GitHubClient = Octokit;

interface GitHubStackMembership {
  base?: { ref?: string | null; sha?: string | null } | null;
  size?: number | null;
  position?: number | null;
  number?: number | null;
}

interface GitHubStackPullRequest {
  number?: number | null;
  node_id?: string;
  title?: string | null;
  state?: string | null;
  draft?: boolean | null;
  merged_at?: string | null;
  base?: { ref?: string | null; sha?: string | null } | null;
  head?: { sha?: string | null } | null;
}

interface GitHubStackResource {
  base?: { ref?: string | null } | null;
  pull_requests?: GitHubStackPullRequest[] | null;
}

const positiveInteger = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 ? value : null;

const layerState = (pull: GitHubStackPullRequest): PullRequestStackLayerState => {
  if (pull.merged_at) return 'merged';
  if (pull.state === 'closed') return 'closed';
  if (pull.draft) return 'draft';
  return 'open';
};

const normalizePullRequestStack = (
  membership: GitHubStackMembership,
  resource: GitHubStackResource | null,
  pullNumber: number
): PullRequestStack | null => {
  const layers: PullRequestStackLayer[] = [];

  for (const pull of resource?.pull_requests ?? []) {
    const number = positiveInteger(pull.number ?? null);
    if (number == null) continue;

    layers.push({
      number,
      title: typeof pull.title === 'string' ? pull.title : '',
      state: layerState(pull),
      ...(pull.head?.sha ? { headSha: pull.head.sha } : {}),
      ...(pull.base?.sha ? { baseSha: pull.base.sha } : {}),
      ...(pull.base?.ref ? { baseRef: pull.base.ref } : {}),
    });
  }

  const trunk = (resource?.base?.ref ?? membership.base?.ref ?? '').trim();
  const count = positiveInteger(membership.size) ?? (layers.length >= 1 ? layers.length : null);
  const listedPlace = layers.findIndex((layer) => layer.number === pullNumber);
  const place = positiveInteger(membership.position) ?? (listedPlace >= 0 ? listedPlace + 1 : null);

  if (!trunk || count == null || place == null) return null;

  return {
    trunk,
    number: positiveInteger(membership.number) ?? undefined,
    count,
    place,
    layers,
    history: 'unknown',
  };
};

const STACK_MERGEABILITY_QUERY = `query PullRequestStackMergeability($ids: [ID!]!) {
  nodes(ids: $ids) {
    ... on PullRequest { mergeable }
  }
}`;

export async function fetchPullRequestStack(
  octokit: GitHubClient,
  owner: string,
  repo: string,
  pullNumber: number,
  membership: GitHubStackMembership | null | undefined
): Promise<PullRequestStack | null> {
  if (!membership) return null;

  const stackNumber = positiveInteger(membership.number);
  if (stackNumber == null) return normalizePullRequestStack(membership, null, pullNumber);

  try {
    const { data } = await octokit.request('GET /repos/{owner}/{repo}/stacks/{stack_number}', {
      owner,
      repo,
      stack_number: stackNumber,
    });
    const stack = normalizePullRequestStack(membership, data, pullNumber);
    if (!stack || stack.count !== stack.layers.length) return stack;

    const active = (data.pull_requests ?? []).filter(
      (pull) => pull.state === 'open' && !pull.merged_at
    );
    if (!active.length) return stack;

    const behindCounts = await Promise.all(
      active.map(async (pull) =>
        pull.base?.ref && pull.head?.sha
          ? fetchBaseBehindCount(octokit, owner, repo, pull.base.ref, pull.head.sha)
          : null
      )
    );
    if (behindCounts.every((count) => count === 0)) {
      stack.history = 'linear';
    } else if (behindCounts.some((count) => count !== null && count > 0)) {
      stack.history = 'not-linear';
      try {
        const { nodes } = await octokit.graphql<{
          nodes: Array<{ mergeable?: string } | null>;
        }>(STACK_MERGEABILITY_QUERY, {
          ids: active.map((pull) => pull.node_id),
        });
        stack.hasConflicts = nodes.some((node) => node?.mergeable === 'CONFLICTING');
      } catch (error: unknown) {
        console.warn('Failed to check pull request stack conflicts:', error);
      }
    }
    return stack;
  } catch (error: unknown) {
    console.warn('Failed to fetch pull request stack:', error);
    return normalizePullRequestStack(membership, null, pullNumber);
  }
}
