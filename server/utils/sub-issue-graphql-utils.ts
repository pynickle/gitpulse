import type { Octokit } from '@octokit/core';

import { getPartialGraphQLData } from '#server/utils/github-graphql-utils';
import type { IssueReferenceTarget } from '#shared/types/issues';
import type {
  SubIssueConnection,
  SubIssueDisplayState,
  SubIssueNode,
} from '#shared/types/sub-issues';
import { readSubIssueProgress } from '#shared/utils/sub-issues';

export const SUB_ISSUE_SUMMARY_NODE_FIELDS = `subIssuesSummary { total completed }`;

interface GraphQLIssueRepository {
  name?: string | null;
  owner?: { login?: string | null } | null;
}

export interface GraphQLSubIssueSummary {
  total?: number | null;
  completed?: number | null;
}

export interface GraphQLSubIssueNode {
  number?: number | null;
  title?: string | null;
  state?: string | null;
  stateReason?: string | null;
  repository?: GraphQLIssueRepository | null;
  subIssuesSummary?: GraphQLSubIssueSummary | null;
}

export interface GraphQLSubIssueConnection {
  totalCount?: number | null;
  nodes?: (GraphQLSubIssueNode | null)[] | null;
}

interface GraphQLParentIssueReference {
  number?: number | null;
  title?: string | null;
  url?: string | null;
  state?: string | null;
  repository?: GraphQLIssueRepository | null;
}

interface GraphQLIssueHierarchyResult {
  issue?: {
    subIssuesSummary?: GraphQLSubIssueSummary | null;
    subIssues?: GraphQLSubIssueConnection | null;
  } | null;
}

export interface SubIssueGraphQLClient {
  graphql: <T>(query: string, variables?: Record<string, unknown>) => Promise<T>;
}

const toNonEmptyString = (value: unknown): string | null => {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

export function mapSubIssueDisplayState(
  node: Pick<GraphQLSubIssueNode, 'state' | 'stateReason'> | null | undefined
): SubIssueDisplayState {
  if (!node?.state) return 'open';

  if (node.state.toUpperCase() === 'CLOSED') {
    switch (node.stateReason?.toUpperCase()) {
      case 'COMPLETED':
        return 'completed';
      case 'NOT_PLANNED':
        return 'notPlanned';
      default:
        return 'closed';
    }
  }

  return 'open';
}

const mapSubIssueNode = (node: GraphQLSubIssueNode | null): SubIssueNode | null => {
  if (!node) return null;

  return {
    owner: toNonEmptyString(node.repository?.owner?.login),
    repo: toNonEmptyString(node.repository?.name),
    number:
      typeof node.number === 'number' && Number.isSafeInteger(node.number) ? node.number : null,
    title: toNonEmptyString(node.title),
    state: mapSubIssueDisplayState(node),
    subIssuesSummary: readSubIssueProgress(node.subIssuesSummary),
  };
};

export function mapSubIssueConnection(
  issueNode:
    | {
        subIssuesSummary?: GraphQLSubIssueSummary | null;
        subIssues?: GraphQLSubIssueConnection | null;
      }
    | null
    | undefined
): SubIssueConnection {
  const connection = issueNode?.subIssues;
  const summary = readSubIssueProgress(issueNode?.subIssuesSummary);
  const totalCount =
    typeof connection?.totalCount === 'number' && Number.isSafeInteger(connection.totalCount)
      ? connection.totalCount
      : (summary?.total ?? null);
  const completedCount = summary?.completed ?? null;
  const nodes = Array.isArray(connection?.nodes)
    ? connection.nodes
        .map((node) => mapSubIssueNode(node))
        .filter((node): node is SubIssueNode => node !== null)
    : [];

  return {
    totalCount,
    completedCount,
    nodes,
  };
}

// GitHub permits up to 100 direct sub-issues per parent.
const SUB_ISSUES_QUERY = `
  query SubIssues($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $number) {
        ${SUB_ISSUE_SUMMARY_NODE_FIELDS}
        subIssues(first: 100) {
          totalCount
          nodes {
            number
            title
            state
            stateReason
            repository { name owner { login } }
            ${SUB_ISSUE_SUMMARY_NODE_FIELDS}
          }
        }
      }
    }
  }
`;

export async function fetchSubIssueConnection(
  octokit: SubIssueGraphQLClient | Octokit,
  owner: string,
  repo: string,
  number: number
): Promise<SubIssueConnection> {
  let payload: {
    repository?: GraphQLIssueHierarchyResult | null;
  };

  try {
    payload = await octokit.graphql(SUB_ISSUES_QUERY, { owner, repo, number });
  } catch (error: unknown) {
    const partial = getPartialGraphQLData<typeof payload>(error);
    if (!partial) throw error;
    payload = partial;
  }

  return mapSubIssueConnection(payload.repository?.issue);
}

const ISSUE_PARENT_QUERY = `
  query IssueParentTarget($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $number) {
        parent {
          number
          title
          url
          state
          repository { name owner { login } }
        }
      }
    }
  }
`;

export async function fetchIssueParentTarget(
  octokit: SubIssueGraphQLClient | Octokit,
  owner: string,
  repo: string,
  number: number
): Promise<IssueReferenceTarget | undefined> {
  type Response = { repository?: { issue?: { parent?: GraphQLParentIssueReference | null } } };

  const data = await octokit
    .graphql<Response>(ISSUE_PARENT_QUERY, { owner, repo, number })
    .catch((error: unknown) => getPartialGraphQLData<Response>(error));

  const parent = data?.repository?.issue?.parent;
  const parentOwner = toNonEmptyString(parent?.repository?.owner?.login);
  const parentRepo = toNonEmptyString(parent?.repository?.name);
  if (!parent?.number || !parentOwner || !parentRepo) return undefined;

  return {
    resourceType: 'issue',
    number: parent.number,
    title: parent.title ?? undefined,
    url: parent.url ?? undefined,
    state: parent.state?.toLowerCase(),
    repository: {
      name: parentRepo,
      nameWithOwner: `${parentOwner}/${parentRepo}`,
      owner: { login: parentOwner },
    },
  };
}
