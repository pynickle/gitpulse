import type { Octokit } from '@octokit/core';

import { getPartialGraphQLData } from '#server/utils/github-graphql-utils';
import type { IssueDuplicateTarget } from '#shared/types/issues';

interface GraphQLIssueReference {
  number?: number | null;
  title?: string | null;
  url?: string | null;
  state?: string | null;
  repository?: { name?: string | null; owner?: { login?: string | null } | null } | null;
}

const ISSUE_REFERENCE_FIELDS = 'number title url state repository { name owner { login } }';

const ISSUE_DUPLICATE_TARGET_QUERY = `
  query IssueDuplicateTarget($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $number) { duplicateOf { ${ISSUE_REFERENCE_FIELDS} } }
    }
  }
`;

// REST close events carry the duplicate reason but not its target; GraphQL's
// ClosedEvent does, and shares the REST event's node ID.
const CLOSED_EVENT_DUPLICATE_TARGETS_QUERY = `
  query ClosedEventDuplicateTargets($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on ClosedEvent { id duplicateOf { ... on Issue { ${ISSUE_REFERENCE_FIELDS} } } }
    }
  }
`;

/** Duplicate Target in the timeline reference shape the Issue detail and timeline render. */
function toDuplicateTarget(
  issue: GraphQLIssueReference | null | undefined
): IssueDuplicateTarget | undefined {
  const owner = issue?.repository?.owner?.login;
  const name = issue?.repository?.name;
  if (!issue?.number || !owner || !name) return undefined;

  return {
    resourceType: 'issue',
    number: issue.number,
    title: issue.title ?? undefined,
    url: issue.url ?? undefined,
    state: issue.state?.toLowerCase(),
    repository: { name, nameWithOwner: `${owner}/${name}`, owner: { login: owner } },
  };
}

export async function fetchIssueDuplicateTarget(
  octokit: Octokit,
  owner: string,
  repo: string,
  number: number
) {
  type Response = { repository?: { issue?: { duplicateOf?: GraphQLIssueReference | null } } };
  const data = await octokit
    .graphql<Response>(ISSUE_DUPLICATE_TARGET_QUERY, { owner, repo, number })
    .catch((error: unknown) => getPartialGraphQLData<Response>(error));

  return toDuplicateTarget(data?.repository?.issue?.duplicateOf);
}

/** Adds `duplicate_of` to each REST `closed` timeline event whose reason is duplicate. */
export async function attachClosedEventDuplicateTargets(
  octokit: Octokit,
  rawEvents: Record<string, any>[]
) {
  const duplicateCloses = rawEvents.filter(
    (rawEvent) =>
      rawEvent.event === 'closed' &&
      rawEvent.state_reason === 'duplicate' &&
      typeof rawEvent.node_id === 'string'
  );
  if (!duplicateCloses.length) return;

  type Response = {
    nodes?: Array<{ id?: string; duplicateOf?: GraphQLIssueReference | null } | null>;
  };
  const data = await octokit
    .graphql<Response>(CLOSED_EVENT_DUPLICATE_TARGETS_QUERY, {
      ids: duplicateCloses.map((rawEvent) => rawEvent.node_id),
    })
    .catch((error: unknown) => getPartialGraphQLData<Response>(error));

  const targets = new Map(
    (data?.nodes ?? []).flatMap((node) => (node?.id ? [[node.id, node.duplicateOf]] : []))
  );
  for (const rawEvent of duplicateCloses) {
    rawEvent.duplicate_of = toDuplicateTarget(targets.get(rawEvent.node_id));
  }
}
