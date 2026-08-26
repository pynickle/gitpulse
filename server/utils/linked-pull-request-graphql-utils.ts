import type { Octokit } from '@octokit/core';

import type {
  LinkedPullRequestConnection,
  LinkedPullRequestDisplayState,
  LinkedPullRequestIdentity,
  LinkedPullRequestNode,
} from '#shared/types/linked-pull-requests';
import { toLinkedPullRequestListSummary } from '#shared/utils/linked-pull-requests';

export const LINKED_PULL_REQUEST_LIST_NODE_FIELDS = `closedByPullRequestsReferences(first: 1, includeClosedPrs: true) { totalCount nodes { number repository { name owner { login } } } }`;

export const LINKED_PULL_REQUEST_PICKER_NODE_FIELDS = `closedByPullRequestsReferences(first: 20, includeClosedPrs: true) { totalCount nodes { number title updatedAt state isDraft mergedAt author { login } repository { name owner { login } } } }`;

export interface GraphQLLinkedPullRequestRepository {
  name?: string | null;
  owner?: { login?: string | null } | null;
}

export interface GraphQLLinkedPullRequestNode {
  number?: number | null;
  title?: string | null;
  updatedAt?: string | null;
  state?: string | null;
  isDraft?: boolean | null;
  merged?: boolean | null;
  mergedAt?: string | null;
  author?: { login?: string | null } | null;
  repository?: GraphQLLinkedPullRequestRepository | null;
}

export interface GraphQLLinkedPullRequestConnection {
  totalCount?: number | null;
  nodes?: (GraphQLLinkedPullRequestNode | null)[] | null;
}

interface GraphQLLinkedPullRequestRepositoryResult {
  issue?: {
    closedByPullRequestsReferences?: GraphQLLinkedPullRequestConnection | null;
  } | null;
}

interface GraphQLLinkedPullRequestBatchResponse {
  [key: string]: GraphQLLinkedPullRequestRepositoryResult | null | undefined;
}

export interface LinkedPullRequestGraphQLClient {
  graphql: <T>(query: string, variables?: Record<string, unknown>) => Promise<T>;
}

const SEARCH_ATTACH_CHUNK_SIZE = 50;

const toNonEmptyString = (value: unknown): string | null => {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

const API_REPOSITORY_PATH = /\/repos\/([^/]+)\/([^/]+)\/?$/i;

const parseRepositoryUrl = (
  value: unknown
): Pick<LinkedPullRequestIdentity, 'owner' | 'repo'> | null => {
  if (typeof value !== 'string' || !value) return null;
  const match = value.match(API_REPOSITORY_PATH) ?? value.match(/^([^/]+)\/([^/]+)$/);
  const owner = match?.[1];
  const repo = match?.[2];
  if (!owner || !repo) return null;
  return { owner, repo };
};

const isPullRequestSearchItem = (item: Record<string, unknown>) => {
  return typeof item.pull_request === 'object' && item.pull_request !== null;
};

export function mapLinkedPullRequestDisplayState(
  node:
    | Pick<GraphQLLinkedPullRequestNode, 'state' | 'isDraft' | 'merged' | 'mergedAt'>
    | null
    | undefined
): LinkedPullRequestDisplayState {
  if (!node) return 'closed';
  if (node.merged || node.mergedAt) return 'merged';

  const state = node.state?.toLowerCase();
  if (state === 'merged') return 'merged';
  if (state === 'closed') return 'closed';
  if (node.isDraft) return 'draft';
  if (state === 'open' || !state) return 'open';

  return 'closed';
}

const mapNode = (node: GraphQLLinkedPullRequestNode | null): LinkedPullRequestNode | null => {
  if (!node) return null;

  return {
    owner: toNonEmptyString(node.repository?.owner?.login),
    repo: toNonEmptyString(node.repository?.name),
    number:
      typeof node.number === 'number' && Number.isSafeInteger(node.number) ? node.number : null,
    title: toNonEmptyString(node.title),
    authorLogin: toNonEmptyString(node.author?.login),
    updatedAt: toNonEmptyString(node.updatedAt),
    state: mapLinkedPullRequestDisplayState(node),
  };
};

export function mapLinkedPullRequestConnection(
  connection: GraphQLLinkedPullRequestConnection | null | undefined
): LinkedPullRequestConnection {
  const totalCount =
    typeof connection?.totalCount === 'number' && Number.isSafeInteger(connection.totalCount)
      ? connection.totalCount
      : null;
  const nodes = Array.isArray(connection?.nodes)
    ? connection.nodes
        .map((node) => mapNode(node))
        .filter((node): node is LinkedPullRequestNode => node !== null)
    : [];

  return { totalCount, nodes };
}

const getPartialGraphQLData = <T>(error: unknown): T | null => {
  if (
    error &&
    typeof error === 'object' &&
    'data' in error &&
    error.data &&
    typeof error.data === 'object'
  ) {
    return error.data as T;
  }

  return null;
};

const buildLinkedPullRequestListQuery = (
  targets: Array<{ owner: string; repo: string; number: number }>
) => {
  const variables: string[] = [];
  const fields: string[] = [];
  const values: Record<string, string | number> = {};

  targets.forEach((target, index) => {
    variables.push(`$owner${index}: String!`, `$repo${index}: String!`, `$number${index}: Int!`);
    values[`owner${index}`] = target.owner;
    values[`repo${index}`] = target.repo;
    values[`number${index}`] = target.number;
    fields.push(
      `subject${index}: repository(owner: $owner${index}, name: $repo${index}) { issue(number: $number${index}) { ${LINKED_PULL_REQUEST_LIST_NODE_FIELDS} } }`
    );
  });

  return {
    query: `query LinkedPullRequestList(${variables.join(', ')}) { ${fields.join('\n')} }`,
    variables: values,
  };
};

export const LINKED_PULL_REQUEST_PICKER_QUERY = `
  query LinkedPullRequestPicker($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $number) {
        ${LINKED_PULL_REQUEST_PICKER_NODE_FIELDS}
      }
    }
  }
`;

export async function fetchLinkedPullRequestPickerConnection(
  octokit: LinkedPullRequestGraphQLClient | Octokit,
  owner: string,
  repo: string,
  number: number
): Promise<LinkedPullRequestConnection> {
  let payload: {
    repository?: GraphQLLinkedPullRequestRepositoryResult | null;
  };

  try {
    payload = await octokit.graphql(LINKED_PULL_REQUEST_PICKER_QUERY, { owner, repo, number });
  } catch (error: unknown) {
    const partial = getPartialGraphQLData<typeof payload>(error);
    if (!partial) throw error;
    payload = partial;
  }

  return mapLinkedPullRequestConnection(payload.repository?.issue?.closedByPullRequestsReferences);
}

const attachSummaryToIssue = (
  item: Record<string, unknown>,
  connection: LinkedPullRequestConnection,
  issue: Pick<LinkedPullRequestIdentity, 'owner' | 'repo'>
) => {
  const summary = toLinkedPullRequestListSummary(connection, issue);
  if (!summary) return item;

  return {
    ...item,
    linkedPullRequestCount: summary.count,
    linkedPullRequest: summary.identity ?? undefined,
  };
};

export async function attachLinkedPullRequestSummaries<T>(
  octokit: LinkedPullRequestGraphQLClient | Octokit,
  items: T[]
): Promise<T[]> {
  const issueTargets: Array<{
    index: number;
    owner: string;
    repo: string;
    number: number;
  }> = [];

  items.forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    const record = item as Record<string, unknown>;
    if (isPullRequestSearchItem(record)) return;

    const repoPath = parseRepositoryUrl(record.repository_url);
    const number =
      typeof record.number === 'number' && Number.isSafeInteger(record.number) && record.number >= 1
        ? record.number
        : null;
    if (!repoPath || number === null) return;

    issueTargets.push({ index, owner: repoPath.owner, repo: repoPath.repo, number });
  });

  if (issueTargets.length === 0) {
    return items;
  }

  const summariesByIndex = new Map<number, LinkedPullRequestConnection>();

  try {
    for (let offset = 0; offset < issueTargets.length; offset += SEARCH_ATTACH_CHUNK_SIZE) {
      const chunk = issueTargets.slice(offset, offset + SEARCH_ATTACH_CHUNK_SIZE);
      const { query, variables } = buildLinkedPullRequestListQuery(chunk);

      let payload: GraphQLLinkedPullRequestBatchResponse;
      try {
        payload = await octokit.graphql<GraphQLLinkedPullRequestBatchResponse>(query, variables);
      } catch (error: unknown) {
        const partial = getPartialGraphQLData<GraphQLLinkedPullRequestBatchResponse>(error);
        if (!partial) throw error;
        payload = partial;
      }

      chunk.forEach((target, chunkIndex) => {
        const repository = payload[`subject${chunkIndex}`];
        summariesByIndex.set(
          target.index,
          mapLinkedPullRequestConnection(repository?.issue?.closedByPullRequestsReferences)
        );
      });
    }
  } catch {
    return items;
  }

  return items.map((item, index) => {
    const connection = summariesByIndex.get(index);
    if (!connection || !item || typeof item !== 'object' || Array.isArray(item)) {
      return item;
    }

    const record = item as Record<string, unknown>;
    const repoPath = parseRepositoryUrl(record.repository_url);
    if (!repoPath) return item;

    return attachSummaryToIssue(record, connection, repoPath) as T;
  });
}
