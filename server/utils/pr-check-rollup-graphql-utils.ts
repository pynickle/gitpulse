import type { Octokit } from '@octokit/core';

import { getPartialGraphQLData } from '#server/utils/github-graphql-utils';
import type { CheckRollupContext, PullRequestCheckRollup } from '#shared/types/pr-checks';
import type { PullRequestMergeability } from '#shared/types/pulls';
import { CHECK_ROLLUP_CONTEXT_LIMIT } from '#shared/utils/pr-checks';
import { readPullRequestMergeability } from '#shared/utils/pull-request-conflicts';

/**
 * Rollup fields for the server-side batch attach.
 *
 * `contexts(first: 100)` caps the list, so a Pull Request with more contexts
 * shows a tone and a total without a passed fraction rather than a silently
 * under-counted one. `CheckRun.isRequired` is deliberately absent: it cannot be
 * requested inside a rollup query — GitHub answers UNPROCESSABLE and blanks every
 * CheckRun node.
 */
export const PR_CHECK_ROLLUP_NODE_FIELDS = `statusCheckRollup { state contexts(first: ${CHECK_ROLLUP_CONTEXT_LIMIT}) { totalCount nodes { __typename ... on CheckRun { name status conclusion detailsUrl title startedAt completedAt checkSuite { app { name logoUrl } } } ... on StatusContext { context state targetUrl description avatarUrl createdAt creator { login } } } } }`;

interface GraphQLCheckRunNode {
  __typename?: string | null;
  name?: string | null;
  status?: string | null;
  conclusion?: string | null;
  detailsUrl?: string | null;
  title?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  checkSuite?: { app?: { name?: string | null; logoUrl?: string | null } | null } | null;
}

interface GraphQLStatusContextNode {
  __typename?: string | null;
  context?: string | null;
  state?: string | null;
  targetUrl?: string | null;
  description?: string | null;
  avatarUrl?: string | null;
  createdAt?: string | null;
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
  pullRequest?: {
    statusCheckRollup?: GraphQLStatusCheckRollup | null;
    mergeable?: string | null;
  } | null;
}

interface AttachedPullRequestListFields {
  checkRollup?: PullRequestCheckRollup;
  mergeable?: PullRequestMergeability;
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
  const checkSuite = isStatusContext
    ? null
    : node.checkSuite
      ? {
          app: node.checkSuite.app
            ? {
                name: nonEmptyString(node.checkSuite.app.name),
                logoUrl: nonEmptyString(node.checkSuite.app.logoUrl),
              }
            : null,
        }
      : null;

  return {
    __typename: nonEmptyString(node.__typename),
    name: nonEmptyString(isStatusContext ? node.context : node.name),
    // A StatusContext reports its outcome on `state`, its conclusion equivalent.
    conclusion: nonEmptyString(isStatusContext ? node.state : node.conclusion),
    status: isStatusContext ? null : nonEmptyString(node.status),
    detailsUrl: nonEmptyString(isStatusContext ? node.targetUrl : node.detailsUrl),
    title: isStatusContext ? null : nonEmptyString(node.title),
    startedAt: isStatusContext ? null : nonEmptyString(node.startedAt),
    completedAt: isStatusContext ? null : nonEmptyString(node.completedAt),
    description: isStatusContext ? nonEmptyString(node.description) : null,
    avatarUrl: isStatusContext ? nonEmptyString(node.avatarUrl) : null,
    createdAt: isStatusContext ? nonEmptyString(node.createdAt) : null,
    checkSuite,
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

const COMMIT_CHECK_ROLLUP_CHUNK = 50;

interface GraphQLCommitCheckRollupNode {
  statusCheckRollup?: GraphQLStatusCheckRollup | null;
}

interface GraphQLCommitCheckRollupResult {
  repository?: Record<string, GraphQLCommitCheckRollupNode | null> | null;
}

/**
 * One Check Rollup per SHA in the requested repository. A fork's Commit node id
 * can refer to the same SHA but carry none of the base repository's checks.
 * A failed pass returns whatever chunks resolved, so the commit list still paints.
 */
export async function fetchCommitCheckRollups(
  octokit: CheckRollupGraphQLClient | Octokit,
  owner: string,
  repo: string,
  shas: readonly (string | null | undefined)[]
): Promise<Map<string, PullRequestCheckRollup>> {
  const unique: string[] = [];
  const seen = new Set<string>();

  for (const value of shas) {
    const id = typeof value === 'string' ? value.trim() : '';
    if (!id || seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
  }

  const rollups = new Map<string, PullRequestCheckRollup>();
  if (unique.length === 0) return rollups;

  try {
    for (let offset = 0; offset < unique.length; offset += COMMIT_CHECK_ROLLUP_CHUNK) {
      const chunk = unique.slice(offset, offset + COMMIT_CHECK_ROLLUP_CHUNK);
      const definitions = ['$owner: String!', '$repo: String!'];
      const fields: string[] = [];
      const variables: Record<string, string> = { owner, repo };
      chunk.forEach((sha, index) => {
        definitions.push(`$oid${index}: GitObjectID!`);
        variables[`oid${index}`] = sha;
        fields.push(
          `commit${index}: object(oid: $oid${index}) { ... on Commit { ${PR_CHECK_ROLLUP_NODE_FIELDS} } }`
        );
      });
      const query = `query CommitCheckRollups(${definitions.join(', ')}) {
        repository(owner: $owner, name: $repo) { ${fields.join('\n')} }
      }`;
      let payload: GraphQLCommitCheckRollupResult;

      try {
        payload = await octokit.graphql<GraphQLCommitCheckRollupResult>(query, variables);
      } catch (error: unknown) {
        const partial = getPartialGraphQLData<GraphQLCommitCheckRollupResult>(error);
        if (!partial) throw error;
        payload = partial;
      }

      chunk.forEach((sha, index) => {
        const rollup = mapPullRequestCheckRollup(
          payload.repository?.[`commit${index}`]?.statusCheckRollup
        );
        if (rollup) rollups.set(sha, rollup);
      });
    }
  } catch (error: unknown) {
    console.warn('Failed to fetch commit Check Rollups:', error);
  }

  return rollups;
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
      `subject${index}: repository(owner: $owner${index}, name: $repo${index}) { pullRequest(number: $number${index}) { mergeable ${PR_CHECK_ROLLUP_NODE_FIELDS} } }`
    );
  });

  return {
    query: `query PullRequestCheckRollups(${variables.join(', ')}) { ${fields.join('\n')} }`,
    variables: values,
  };
};

/**
 * Attaches each pull request item's Check Rollup, and its mergeability, in one
 * aliased GraphQL query per chunk. Mergeability rides that request so a conflict
 * marker does not cost a second round trip. Items that are not pull requests are
 * left untouched, and the whole pass degrades silently so one failed query never
 * blanks a list.
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

  const attachedByIndex = new Map<number, AttachedPullRequestListFields>();

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
        const pullRequest = payload[`subject${chunkIndex}`]?.pullRequest;
        const rollup = mapPullRequestCheckRollup(pullRequest?.statusCheckRollup);
        const mergeable = readPullRequestMergeability(pullRequest?.mergeable);
        if (!rollup && !mergeable) return;

        attachedByIndex.set(target.index, {
          ...(rollup ? { checkRollup: rollup } : {}),
          ...(mergeable ? { mergeable } : {}),
        });
      });
    }
  } catch {
    return items;
  }

  if (attachedByIndex.size === 0) {
    return items;
  }

  return items.map((item, index) => {
    const attached = attachedByIndex.get(index);
    if (!attached || !item || typeof item !== 'object' || Array.isArray(item)) {
      return item;
    }

    return { ...(item as Record<string, unknown>), ...attached } as T;
  });
}
