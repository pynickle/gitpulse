import type { Octokit } from '@octokit/core';

import { getPartialGraphQLData } from '#server/utils/github-graphql-utils';
import type { CheckRollupContext, PullRequestCheckRollup } from '#shared/types/pr-checks';
import { CHECK_ROLLUP_CONTEXT_LIMIT } from '#shared/utils/pr-checks';

/**
 * Rollup fields for the server-side batch attach.
 *
 * `contexts(first: 100)` caps the list, so a Pull Request with more contexts
 * shows a tone and a total without a passed fraction rather than a silently
 * under-counted one. `CheckRun.isRequired` is deliberately absent: it cannot be
 * requested inside a rollup query — GitHub answers UNPROCESSABLE and blanks every
 * CheckRun node.
 */
export const PR_CHECK_ROLLUP_NODE_FIELDS = `statusCheckRollup { state contexts(first: ${CHECK_ROLLUP_CONTEXT_LIMIT}) { totalCount nodes { __typename ... on CheckRun { name status conclusion detailsUrl checkSuite { app { name } } } ... on StatusContext { context state targetUrl creator { login } } } } }`;

interface GraphQLCheckRunNode {
  __typename?: 'CheckRun' | string | null;
  name?: string | null;
  status?: string | null;
  conclusion?: string | null;
  detailsUrl?: string | null;
  checkSuite?: { app?: { name?: string | null } | null } | null;
}

interface GraphQLStatusContextNode {
  __typename?: 'StatusContext' | string | null;
  context?: string | null;
  state?: string | null;
  targetUrl?: string | null;
  creator?: { login?: string | null } | null;
}

type GraphQLStatusCheckContextNode = GraphQLCheckRunNode & GraphQLStatusContextNode;

interface GraphQLContextConnection {
  totalCount?: number | null;
  nodes?: (GraphQLStatusCheckContextNode | null)[] | null;
}

interface GraphQLStatusCheckRollup {
  state?: string | null;
  contexts?: GraphQLContextConnection | null;
}

interface GraphQLPullRequestResult {
  pullRequest?: { statusCheckRollup?: GraphQLStatusCheckRollup | null } | null;
}

interface GraphQLCheckRollupBatchResponse {
  [key: string]: GraphQLPullRequestResult | null | undefined;
}

export interface CheckRollupGraphQLClient {
  graphql: <T>(query: string, variables?: Record<string, unknown>) => Promise<T>;
}

export const PULL_REQUEST_CHECK_ROLLUP_ATTACH_CHUNK_SIZE = 50;

const API_REPOSITORY_PATH = /\/repos\/([^/]+)\/([^/]+)\/?$/i;

const parseRepositoryUrl = (
  value: unknown
): Pick<{ owner: string; repo: string }, 'owner' | 'repo'> | null => {
  if (typeof value !== 'string' || !value) return null;

  const match = value.match(API_REPOSITORY_PATH) ?? value.match(/^([^/]+)\/([^/]+)$/);
  const owner = match?.[1];
  const repo = match?.[2];
  if (!owner || !repo) return null;

  return { owner, repo };
};

const isPullRequestSearchItem = (item: Record<string, unknown>) =>
  typeof item.pull_request === 'object' && item.pull_request !== null;

const nonEmptyString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const toPositiveCount = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return Math.trunc(value);
};

const toContextNode = (node: GraphQLStatusCheckContextNode | null): CheckRollupContext | null => {
  if (!node) return null;

  const isStatusContext = node.__typename === 'StatusContext';

  return {
    __typename: nonEmptyString(node.__typename),
    name: nonEmptyString(isStatusContext ? node.context : node.name),
    // A StatusContext reports its outcome on `state`, its conclusion equivalent.
    conclusion: nonEmptyString(isStatusContext ? node.state : node.conclusion),
    status: isStatusContext ? null : nonEmptyString(node.status),
    detailsUrl: nonEmptyString(isStatusContext ? node.targetUrl : node.detailsUrl),
    checkSuite: isStatusContext ? null : (node.checkSuite ?? null),
    creator: isStatusContext ? (node.creator ?? null) : null,
  };
};

/** Maps GitHub's rollup payload onto the near-raw rollup every surface reads. */
export function mapPullRequestCheckRollup(
  rollup: GraphQLStatusCheckRollup | null | undefined
): PullRequestCheckRollup | null {
  // No contexts connection means GitHub reported no rollup at all.
  if (!rollup || !rollup.contexts) return null;

  const nodes = Array.isArray(rollup.contexts.nodes) ? rollup.contexts.nodes : [];
  const contexts: PullRequestCheckRollup['contexts'] = {
    totalCount: toPositiveCount(rollup.contexts.totalCount),
    nodes: nodes.map((node) => toContextNode(node)),
  };

  return { state: nonEmptyString(rollup.state), contexts };
}

export const PULL_REQUEST_CHECK_ROLLUP_QUERY = `
  query PullRequestCheckRollup($id: ID!) {
    node(id: $id) { ... on PullRequest { ${PR_CHECK_ROLLUP_NODE_FIELDS} } }
  }
`;

interface GraphQLNodeResult {
  node?: { statusCheckRollup?: GraphQLStatusCheckRollup | null } | null;
}

/**
 * Reads one pull request's Check Rollup for the PR Review Workspace, which has
 * the REST pull request but no rollup. Resolves to `null` on failure so a rollup
 * error never blanks the detail surface.
 */
export async function fetchPullRequestCheckRollup(
  octokit: CheckRollupGraphQLClient | Octokit,
  nodeId: string | null
): Promise<PullRequestCheckRollup | null> {
  if (!nodeId) return null;

  try {
    const payload = await octokit.graphql<GraphQLNodeResult>(PULL_REQUEST_CHECK_ROLLUP_QUERY, {
      id: nodeId,
    });
    return mapPullRequestCheckRollup(payload.node?.statusCheckRollup);
  } catch (error: unknown) {
    const partial = getPartialGraphQLData<GraphQLNodeResult>(error);
    if (!partial) {
      console.warn('Failed to fetch the pull request Check Rollup:', error);
      return null;
    }

    return mapPullRequestCheckRollup(partial.node?.statusCheckRollup);
  }
}

const buildCheckRollupQuery = (targets: Array<{ owner: string; repo: string; number: number }>) => {
  const variables: string[] = [];
  const fields: string[] = [];
  const values: Record<string, string | number> = {};

  targets.forEach((target, index) => {
    variables.push(`$owner${index}: String!`, `$repo${index}: String!`, `$number${index}: Int!`);
    values[`owner${index}`] = target.owner;
    values[`repo${index}`] = target.repo;
    values[`number${index}`] = target.number;
    fields.push(
      `subject${index}: repository(owner: $owner${index}, name: $repo${index}) { pullRequest(number: $number${index}) { ${PR_CHECK_ROLLUP_NODE_FIELDS} } }`
    );
  });

  return {
    query: `query PullRequestCheckRollups(${variables.join(', ')}) { ${fields.join('\n')} }`,
    variables: values,
  };
};

/**
 * Attaches each pull request item's Check Rollup in one aliased GraphQL query
 * per chunk, mirroring the Linked Pull Request Count attach. Items that are not
 * pull requests are left untouched, and the whole pass degrades silently so one
 * failed rollup never blanks a list.
 */
export async function attachPullRequestCheckRollups<T>(
  octokit: CheckRollupGraphQLClient | Octokit,
  items: T[]
): Promise<T[]> {
  const pullTargets: Array<{ index: number; owner: string; repo: string; number: number }> = [];

  items.forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;

    const record = item as Record<string, unknown>;
    if (!isPullRequestSearchItem(record)) return;

    const repoPath = parseRepositoryUrl(record.repository_url);
    const number =
      typeof record.number === 'number' && Number.isSafeInteger(record.number) && record.number >= 1
        ? record.number
        : null;
    if (!repoPath || number === null) return;

    pullTargets.push({ index, owner: repoPath.owner, repo: repoPath.repo, number });
  });

  if (pullTargets.length === 0) {
    return items;
  }

  const rollupsByIndex = new Map<number, PullRequestCheckRollup>();

  try {
    for (
      let offset = 0;
      offset < pullTargets.length;
      offset += PULL_REQUEST_CHECK_ROLLUP_ATTACH_CHUNK_SIZE
    ) {
      const chunk = pullTargets.slice(offset, offset + PULL_REQUEST_CHECK_ROLLUP_ATTACH_CHUNK_SIZE);
      const { query, variables } = buildCheckRollupQuery(chunk);

      let payload: GraphQLCheckRollupBatchResponse;
      try {
        payload = await octokit.graphql<GraphQLCheckRollupBatchResponse>(query, variables);
      } catch (error: unknown) {
        const partial = getPartialGraphQLData<GraphQLCheckRollupBatchResponse>(error);
        if (!partial) throw error;
        payload = partial;
      }

      chunk.forEach((target, chunkIndex) => {
        const rollup = mapPullRequestCheckRollup(
          payload[`subject${chunkIndex}`]?.pullRequest?.statusCheckRollup
        );
        if (rollup) {
          rollupsByIndex.set(target.index, rollup);
        }
      });
    }
  } catch {
    return items;
  }

  if (rollupsByIndex.size === 0) {
    return items;
  }

  return items.map((item, index) => {
    const rollup = rollupsByIndex.get(index);
    if (!rollup || !item || typeof item !== 'object' || Array.isArray(item)) {
      return item;
    }

    return { ...(item as Record<string, unknown>), checkRollup: rollup } as T;
  });
}
