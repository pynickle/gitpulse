import type { Octokit } from '@octokit/core';

import type { GraphQLReactionGroup } from '#shared/types/reactions';
import type {
  FollowedRepository,
  FollowedRepositoryMetadata,
  RepositoryIdentityLookup,
  RepositoryReleaseItem,
  RepositoryReleaseLookup,
} from '#shared/types/release-follows';
import { normalizeGraphQLReactionGroups } from '#shared/utils/reactions';
import { releaseNoteSearchText } from '#shared/utils/release-note-search-text';

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
  reactionGroups?: (GraphQLReactionGroup | null)[] | null;
}

export interface GraphQLRepositoryReleaseNode {
  id?: string | null;
  name?: string | null;
  nameWithOwner?: string | null;
  owner?: { login?: string | null } | null;
  releases?: {
    pageInfo?: { hasNextPage?: boolean | null; endCursor?: string | null } | null;
    nodes?: (GraphQLReleaseNode | null)[] | null;
  } | null;
}

export interface GraphQLRepositoryIdentityNode {
  id?: string | null;
  name?: string | null;
  nameWithOwner?: string | null;
  owner?: { login?: string | null } | null;
}

export interface GraphQLRepositoryMetadataNode extends GraphQLRepositoryIdentityNode {
  description?: string | null;
  primaryLanguage?: { name?: string | null } | null;
  stargazerCount?: number | null;
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

const FOLLOWED_REPOSITORY_METADATA_QUERY = `
query FollowedRepositoryMetadata($ids: [ID!]!) {
  nodes(ids: $ids) {
    ... on Repository {
      id
      name
      nameWithOwner
      owner { login }
      description
      primaryLanguage { name }
      stargazerCount
    }
  }
}
`;

const RELEASE_TIMELINE_REPOSITORY_FIELDS = `
    ... on Repository {
      id
      name
      nameWithOwner
      owner { login }
      releases(first: 100, orderBy: { field: CREATED_AT, direction: DESC }) {
        pageInfo { hasNextPage endCursor }
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
          reactionGroups {
            content
            viewerHasReacted
            reactors(first: 1) { totalCount }
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
    notesSearchText: releaseNoteSearchText(node.description ?? ''),
    publishedAt: toNonEmptyString(node.publishedAt),
    isDraft: Boolean(node.isDraft),
    isPrerelease: Boolean(node.isPrerelease),
    assetCount: toAssetCount(node.releaseAssets?.totalCount),
    htmlUrl: toNonEmptyString(node.url),
    reactions: normalizeGraphQLReactionGroups(node.reactionGroups, 'release'),
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
    endCursor: node.releases?.pageInfo?.endCursor ?? null,
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
  let errors: { path?: (string | number)[]; type?: string }[] = [];
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
    if (error && typeof error === 'object' && 'errors' in error && Array.isArray(error.errors)) {
      errors = error.errors;
    }
  }

  const nodes = Array.isArray(payload.nodes) ? payload.nodes : [];
  follows.forEach((follow, index) => {
    const node = index < nodes.length ? nodes[index] : undefined;
    const nodeErrors = errors.filter(
      (error) =>
        !error.path?.length ||
        (error.path[0] === 'nodes' && (error.path[1] === undefined || error.path[1] === index))
    );
    lookups[follow.id] =
      node === undefined || nodeErrors.some((error) => node !== null || error.type !== 'NOT_FOUND')
        ? ({ status: 'transient' } as T)
        : mapNode(node);
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
  options: { chunkSize?: number; cursors?: Record<string, string | null> } = {}
): Promise<Record<string, RepositoryReleaseLookup>> {
  const results = await Promise.all(
    chunkItems(follows, options.chunkSize ?? RELEASE_TIMELINE_CHUNK_SIZE).map(async (chunk) => {
      const variables: Record<string, unknown> = {};
      const declarations = chunk.map((follow, index) => {
        variables[`id${index}`] = follow.id;
        variables[`after${index}`] = options.cursors?.[follow.id] ?? null;
        return `$id${index}: ID!, $after${index}: String`;
      });
      const query = `query ReleaseTimelinePages(${declarations.join(', ')}) { ${chunk
        .map(
          (_, index) =>
            `repo${index}: node(id: $id${index}) { ${RELEASE_TIMELINE_REPOSITORY_FIELDS.replace('first: 100,', `first: 100, after: $after${index},`)} }`
        )
        .join('\n')} }`;
      type Payload = Record<string, GraphQLRepositoryReleaseNode | null>;
      let payload: Payload | null;
      let errors: { path?: (string | number)[]; type?: string }[] = [];
      try {
        payload = await octokit.graphql<Payload>(query, variables);
      } catch (error) {
        payload = getPartialGraphQLData<Payload>(error);
        if (error && typeof error === 'object' && 'errors' in error && Array.isArray(error.errors))
          errors = error.errors;
      }
      return Object.fromEntries(
        chunk.map((follow, index) => {
          const alias = `repo${index}`;
          const node = payload?.[alias];
          const nodeErrors = errors.filter((error) => error.path?.[0] === alias);
          if (
            node === undefined ||
            (node === null && nodeErrors.some((error) => error.type !== 'NOT_FOUND'))
          )
            return [follow.id, { status: 'transient' }];
          if (node === null) return [follow.id, { status: 'unavailable' }];
          const page = mapRepositoryReleaseLookup(node);
          if (page.status !== 'available') return [follow.id, { status: 'transient' }];
          const optionalFields = new Set([
            'reactionGroups',
            'releaseAssets',
            'description',
            'name',
            'url',
          ]);
          const incomplete =
            !Array.isArray(node.releases?.nodes) ||
            typeof node.releases?.pageInfo?.hasNextPage !== 'boolean' ||
            (page.hasOlderReleases && !page.endCursor) ||
            nodeErrors.some((error) => !optionalFields.has(String(error.path?.[4])));
          const lookup: RepositoryReleaseLookup = incomplete ? { ...page, incomplete: true } : page;
          return [follow.id, lookup];
        })
      );
    })
  );
  return Object.assign({}, ...results);
}

const isRepositoryMetadataNode = (node: GraphQLRepositoryMetadataNode) => {
  return (
    isRepositoryIdentityNode(node) ||
    typeof node.stargazerCount === 'number' ||
    typeof node.description === 'string' ||
    node.primaryLanguage != null
  );
};

export function mapRepositoryMetadataLookup(
  node: GraphQLRepositoryMetadataNode | null | undefined
): FollowedRepositoryMetadata {
  if (!node || !isRepositoryMetadataNode(node)) {
    return { status: 'unavailable' };
  }

  const starCount = node.stargazerCount;
  if (typeof starCount !== 'number' || !Number.isSafeInteger(starCount) || starCount < 0) {
    return { status: 'transient' };
  }

  const { owner, name } = resolveRepositoryIdentity(node);
  return {
    status: 'available',
    owner,
    name,
    description: toNonEmptyString(node.description),
    primaryLanguage: toNonEmptyString(node.primaryLanguage?.name),
    starCount,
  };
}

export async function fetchFollowedRepositoryMetadataLookups(
  octokit: ReleaseTimelineGraphQLClient | Octokit,
  follows: FollowedRepository[],
  options: { chunkSize?: number } = {}
): Promise<Record<string, FollowedRepositoryMetadata>> {
  return fetchFollowedRepositoryLookups(
    octokit,
    follows,
    FOLLOWED_REPOSITORY_METADATA_QUERY,
    (node) => mapRepositoryMetadataLookup(node as GraphQLRepositoryMetadataNode | null),
    options.chunkSize ?? FOLLOWED_REPOSITORY_IDENTITY_CHUNK_SIZE
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
