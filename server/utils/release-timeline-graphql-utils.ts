import type { Octokit } from '@octokit/core';

import type {
  FollowedRepository,
  RepositoryIdentityLookup,
  RepositoryReleaseItem,
  RepositoryReleaseLookup,
} from '#shared/types/release-follows';

export interface ReleaseTimelineGraphQLClient {
  graphql: <T>(query: string, variables?: Record<string, unknown>) => Promise<T>;
}

export interface GraphQLReleaseNode {
  databaseId?: number | null;
  url?: string | null;
  tagName?: string | null;
  name?: string | null;
  description?: string | null;
  publishedAt?: string | null;
  isDraft?: boolean | null;
  isPrerelease?: boolean | null;
  releaseAssets?: { totalCount?: number | null } | null;
}

export interface GraphQLRepositoryReleaseNode {
  id?: string | null;
  name?: string | null;
  nameWithOwner?: string | null;
  owner?: { login?: string | null } | null;
  releases?: {
    pageInfo?: { hasNextPage?: boolean | null } | null;
    nodes?: (GraphQLReleaseNode | null)[] | null;
  } | null;
}

export interface GraphQLRepositoryIdentityNode {
  id?: string | null;
  name?: string | null;
  nameWithOwner?: string | null;
  owner?: { login?: string | null } | null;
}

interface GraphQLNodesResponse<TNode> {
  nodes?: (TNode | null)[] | null;
}

export const RELEASE_TIMELINE_CHUNK_SIZE = 20;
export const FOLLOWED_REPOSITORY_IDENTITY_CHUNK_SIZE = 150;

const FOLLOWED_REPOSITORY_IDENTITY_QUERY = `
query FollowedRepositoryIdentities($ids: [ID!]!) {
  nodes(ids: $ids) {
    ... on Repository {
      id
      name
      nameWithOwner
      owner { login }
    }
  }
}
`;

const RELEASE_TIMELINE_NODES_QUERY = `
query ReleaseTimeline($ids: [ID!]!) {
  nodes(ids: $ids) {
    ... on Repository {
      id
      name
      nameWithOwner
      owner { login }
      releases(first: 30, orderBy: { field: CREATED_AT, direction: DESC }) {
        pageInfo { hasNextPage }
        nodes {
          databaseId
          url
          tagName
          name
          description
          publishedAt
          isDraft
          isPrerelease
          releaseAssets(first: 1) { totalCount }
        }
      }
    }
  }
}
`;

const toNonEmptyString = (value: unknown): string | null => {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

const parseNameWithOwner = (value: unknown): { owner: string; name: string } | null => {
  const raw = toNonEmptyString(value);
  if (!raw) return null;
  const [owner, name, ...rest] = raw.split('/');
  if (!owner || !name || rest.length > 0) return null;
  return { owner, name };
};

const toAssetCount = (value: unknown): number => {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
};

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

const mapReleaseNode = (node: GraphQLReleaseNode | null): RepositoryReleaseItem | null => {
  if (!node) return null;

  if (node.isDraft) {
    return null;
  }

  const id = node.databaseId;
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id < 1) {
    return null;
  }

  return {
    id,
    tagName: toNonEmptyString(node.tagName) ?? '',
    name: toNonEmptyString(node.name),
    description: typeof node.description === 'string' ? node.description : null,
    publishedAt: toNonEmptyString(node.publishedAt),
    isDraft: Boolean(node.isDraft),
    isPrerelease: Boolean(node.isPrerelease),
    assetCount: toAssetCount(node.releaseAssets?.totalCount),
    htmlUrl: toNonEmptyString(node.url),
  };
};

const isRepositoryIdentityNode = (node: GraphQLRepositoryIdentityNode) => {
  return Boolean(node.id || node.name || node.nameWithOwner || node.owner);
};

const isRepositoryNode = (node: GraphQLRepositoryReleaseNode) => {
  return isRepositoryIdentityNode(node) || Boolean(node.releases);
};

const resolveRepositoryIdentity = (
  node: GraphQLRepositoryIdentityNode
): { owner: string; name: string } => {
  const parsed = parseNameWithOwner(node.nameWithOwner);
  return {
    owner: parsed?.owner ?? toNonEmptyString(node.owner?.login) ?? '',
    name: parsed?.name ?? toNonEmptyString(node.name) ?? '',
  };
};

export function mapRepositoryReleaseLookup(
  node: GraphQLRepositoryReleaseNode | null | undefined
): RepositoryReleaseLookup {
  if (!node || !isRepositoryNode(node)) {
    return { status: 'unavailable' };
  }

  const { owner, name } = resolveRepositoryIdentity(node);

  return {
    status: 'available',
    owner,
    name,
    hasOlderReleases: Boolean(node.releases?.pageInfo?.hasNextPage),
    releases: Array.isArray(node.releases?.nodes)
      ? node.releases.nodes
          .map((release) => mapReleaseNode(release))
          .filter((release): release is RepositoryReleaseItem => release !== null)
      : [],
  };
}

const chunkItems = <T>(items: T[], chunkSize: number): T[][] => {
  const size = Math.max(1, chunkSize);
  const chunks: T[][] = [];
  for (let offset = 0; offset < items.length; offset += size) {
    chunks.push(items.slice(offset, offset + size));
  }
  return chunks;
};

export function mapRepositoryIdentityLookup(
  node: GraphQLRepositoryIdentityNode | null | undefined
): RepositoryIdentityLookup {
  if (!node || !isRepositoryIdentityNode(node)) {
    return { status: 'unavailable' };
  }

  const { owner, name } = resolveRepositoryIdentity(node);
  return { status: 'available', owner, name };
}

const fetchChunkLookups = async <T extends { status: string }>(
  octokit: ReleaseTimelineGraphQLClient | Octokit,
  follows: FollowedRepository[],
  query: string,
  mapNode: (node: GraphQLRepositoryReleaseNode | null) => T
): Promise<Record<string, T>> => {
  const lookups: Record<string, T> = {};
  const markTransient = () => {
    for (const follow of follows) {
      lookups[follow.id] = { status: 'transient' } as T;
    }
  };

  let payload: GraphQLNodesResponse<GraphQLRepositoryReleaseNode>;
  try {
    payload = await octokit.graphql<GraphQLNodesResponse<GraphQLRepositoryReleaseNode>>(query, {
      ids: follows.map((follow) => follow.id),
    });
  } catch (error: unknown) {
    const partial =
      getPartialGraphQLData<GraphQLNodesResponse<GraphQLRepositoryReleaseNode>>(error);
    if (!partial) {
      markTransient();
      return lookups;
    }
    payload = partial;
  }

  const nodes = Array.isArray(payload.nodes) ? payload.nodes : [];
  follows.forEach((follow, index) => {
    const node = index < nodes.length ? nodes[index] : undefined;
    lookups[follow.id] = node === undefined ? ({ status: 'transient' } as T) : mapNode(node);
  });

  return lookups;
};

const fetchFollowedRepositoryLookups = async <T extends { status: string }>(
  octokit: ReleaseTimelineGraphQLClient | Octokit,
  follows: FollowedRepository[],
  query: string,
  mapNode: (node: GraphQLRepositoryReleaseNode | null) => T,
  chunkSize: number
): Promise<Record<string, T>> => {
  if (follows.length === 0) {
    return {};
  }

  const chunkLookups = await Promise.all(
    chunkItems(follows, chunkSize).map((chunk) => fetchChunkLookups(octokit, chunk, query, mapNode))
  );

  return Object.assign({}, ...chunkLookups);
};

export async function fetchFollowedRepositoryReleaseLookups(
  octokit: ReleaseTimelineGraphQLClient | Octokit,
  follows: FollowedRepository[],
  options: { chunkSize?: number } = {}
): Promise<Record<string, RepositoryReleaseLookup>> {
  return fetchFollowedRepositoryLookups(
    octokit,
    follows,
    RELEASE_TIMELINE_NODES_QUERY,
    mapRepositoryReleaseLookup,
    options.chunkSize ?? RELEASE_TIMELINE_CHUNK_SIZE
  );
}

export async function fetchFollowedRepositoryIdentityLookups(
  octokit: ReleaseTimelineGraphQLClient | Octokit,
  follows: FollowedRepository[],
  options: { chunkSize?: number } = {}
): Promise<Record<string, RepositoryIdentityLookup>> {
  return fetchFollowedRepositoryLookups(
    octokit,
    follows,
    FOLLOWED_REPOSITORY_IDENTITY_QUERY,
    mapRepositoryIdentityLookup,
    options.chunkSize ?? FOLLOWED_REPOSITORY_IDENTITY_CHUNK_SIZE
  );
}
