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

const layersFromPulls = (
  pulls: GitHubStackPullRequest[] | null | undefined
): PullRequestStackLayer[] => {
  const layers: PullRequestStackLayer[] = [];

  for (const pull of pulls ?? []) {
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

  return layers;
};

const normalizePullRequestStack = (
  membership: GitHubStackMembership,
  resource: GitHubStackResource | null,
  pullNumber: number
): PullRequestStack | null => {
  const layers = layersFromPulls(resource?.pull_requests);

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

    await attachStackHistory(octokit, owner, repo, stack, data.pull_requests ?? []);
    return stack;
  } catch (error: unknown) {
    console.warn('Failed to fetch pull request stack:', error);
    return normalizePullRequestStack(membership, null, pullNumber);
  }
}

const PR_STACK_QUERY = `
  query PullRequestStack($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        stack {
          number
          baseRefName
          entries(first: 100) {
            nodes {
              position
              pullRequest {
                number
                title
                state
                isDraft
                mergedAt
                baseRefName
                headRefOid
              }
            }
          }
        }
      }
    }
  }
`;

interface GraphQLStackPullRequest {
  number?: number | null;
  title?: string | null;
  state?: string | null;
  isDraft?: boolean | null;
  mergedAt?: string | null;
  baseRefName?: string | null;
  headRefOid?: string | null;
}

interface GraphQLStackResponse {
  repository?: {
    pullRequest?: {
      stack?: {
        number?: number | null;
        baseRefName?: string | null;
        entries?: {
          nodes?: Array<{
            position?: number | null;
            pullRequest?: GraphQLStackPullRequest | null;
          } | null> | null;
        } | null;
      } | null;
    } | null;
  } | null;
}

const graphQLLayerState = (pull: GraphQLStackPullRequest): PullRequestStackLayerState => {
  if (pull.mergedAt || pull.state === 'MERGED') return 'merged';
  if (pull.state === 'CLOSED') return 'closed';
  if (pull.isDraft) return 'draft';
  return 'open';
};

async function fetchStackFromPullRequest(
  octokit: GitHubClient,
  owner: string,
  repo: string,
  stackNumber: number,
  viewerPullNumber: number
): Promise<PullRequestStack | null> {
  const response = (await octokit.graphql(PR_STACK_QUERY, {
    owner,
    repo,
    number: viewerPullNumber,
  })) as GraphQLStackResponse;
  const stack = response.repository?.pullRequest?.stack;
  if (!stack || stack.number !== stackNumber) return null;

  const trunk = (stack.baseRefName ?? '').trim();
  const nodes = [...(stack.entries?.nodes ?? [])].sort(
    (left, right) => (left?.position ?? 0) - (right?.position ?? 0)
  );
  const layers: PullRequestStackLayer[] = [];
  const pulls: GitHubStackPullRequest[] = [];

  for (const node of nodes) {
    const pull = node?.pullRequest;
    const number = positiveInteger(pull?.number ?? null);
    if (!pull || number == null) continue;
    layers.push({
      number,
      title: typeof pull.title === 'string' ? pull.title : '',
      state: graphQLLayerState(pull),
      ...(pull.headRefOid ? { headSha: pull.headRefOid } : {}),
      ...(pull.baseRefName ? { baseRef: pull.baseRefName } : {}),
    });
    pulls.push({
      number,
      title: pull.title,
      state: pull.state === 'OPEN' ? 'open' : 'closed',
      draft: pull.isDraft,
      merged_at: pull.mergedAt,
      base: { ref: pull.baseRefName },
      head: { sha: pull.headRefOid },
    });
  }

  if (!trunk || layers.length < 1) return null;

  const listed = layers.findIndex((layer) => layer.number === viewerPullNumber);
  const normalized: PullRequestStack = {
    number: stackNumber,
    trunk,
    count: layers.length,
    place: listed >= 0 ? listed + 1 : 0,
    layers,
    history: 'unknown',
  };
  await attachStackHistory(octokit, owner, repo, normalized, pulls);
  return normalized;
}

const emptyRepositoryStack = (stackNumber: number): PullRequestStack => ({
  number: stackNumber,
  trunk: '',
  count: 0,
  place: 0,
  layers: [],
  history: 'unknown',
});

/**
 * The stack named by `stackNumber`, including one the viewer has left.
 * `place` is 0 when the viewer is not a layer, so nothing is marked current
 * unless the caller finds the viewer in `layers`.
 */
export async function fetchRepositoryStack(
  octokit: GitHubClient,
  owner: string,
  repo: string,
  stackNumber: number,
  viewerPullNumber?: number
): Promise<PullRequestStack> {
  if (positiveInteger(stackNumber) == null) return emptyRepositoryStack(stackNumber);

  if (viewerPullNumber != null && viewerPullNumber >= 1) {
    try {
      const fromPull = await fetchStackFromPullRequest(
        octokit,
        owner,
        repo,
        stackNumber,
        viewerPullNumber
      );
      if (fromPull) return fromPull;
    } catch (error: unknown) {
      console.warn('Failed to fetch pull request stack from GraphQL:', error);
    }
  }

  try {
    const { data } = await octokit.request('GET /repos/{owner}/{repo}/stacks/{stack_number}', {
      owner,
      repo,
      stack_number: stackNumber,
    });
    const layers = layersFromPulls(data.pull_requests);

    const trunk = (data.base?.ref ?? '').trim();
    if (!trunk || layers.length < 1) return emptyRepositoryStack(stackNumber);

    const listed =
      viewerPullNumber == null
        ? -1
        : layers.findIndex((layer) => layer.number === viewerPullNumber);
    const stack: PullRequestStack = {
      number: stackNumber,
      trunk,
      count: layers.length,
      place: listed >= 0 ? listed + 1 : 0,
      layers,
      history: 'unknown',
    };
    await attachStackHistory(octokit, owner, repo, stack, data.pull_requests ?? []);
    return stack;
  } catch (error: unknown) {
    console.warn('Failed to fetch repository stack:', error);
    return emptyRepositoryStack(stackNumber);
  }
}

async function attachStackHistory(
  octokit: GitHubClient,
  owner: string,
  repo: string,
  stack: PullRequestStack,
  pulls: GitHubStackPullRequest[]
) {
  const active = pulls.filter((pull) => pull.state === 'open' && !pull.merged_at);
  if (!active.length) return;

  const behindCounts = await Promise.all(
    active.map(async (pull) =>
      pull.base?.ref && pull.head?.sha
        ? fetchBaseBehindCount(octokit, owner, repo, pull.base.ref, pull.head.sha)
        : null
    )
  );
  const behindByNumber = new Map<number, number | null>();
  active.forEach((pull, index) => {
    const number = positiveInteger(pull.number ?? null);
    if (number != null) {
      behindByNumber.set(number, behindCounts[index] ?? null);
    }
  });
  for (const layer of stack.layers) {
    if (behindByNumber.has(layer.number)) {
      layer.behindBy = behindByNumber.get(layer.number) ?? null;
    }
  }
  if (behindCounts.every((count) => count === 0)) {
    stack.history = 'linear';
  } else if (behindCounts.some((count) => count !== null && count > 0)) {
    stack.history = 'not-linear';
  }
}
