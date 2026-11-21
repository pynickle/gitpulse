import type { Octokit } from '@octokit/core';

import type {
  PullRequestStack,
  PullRequestStackLayer,
  PullRequestStackLayerState,
} from '#shared/types/pulls';

type GitHubClient = Octokit;

interface GitHubStackMembership {
  base?: { ref?: string | null } | null;
  size?: number | null;
  position?: number | null;
  number?: number | null;
}

interface GitHubStackPullRequest {
  number?: number | null;
  title?: string | null;
  state?: string | null;
  draft?: boolean | null;
  merged_at?: string | null;
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
    });
  }

  const trunk = (resource?.base?.ref ?? membership.base?.ref ?? '').trim();
  const count = positiveInteger(membership.size) ?? (layers.length >= 1 ? layers.length : null);
  const listedPlace = layers.findIndex((layer) => layer.number === pullNumber);
  const place = positiveInteger(membership.position) ?? (listedPlace >= 0 ? listedPlace + 1 : null);

  if (!trunk || count == null || place == null) return null;

  return {
    trunk,
    count,
    place,
    layers,
    // No published stack field reports linearity. Do not guess it from SHAs.
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
    return normalizePullRequestStack(membership, data, pullNumber);
  } catch (error: unknown) {
    console.warn('Failed to fetch pull request stack:', error);
    return normalizePullRequestStack(membership, null, pullNumber);
  }
}
