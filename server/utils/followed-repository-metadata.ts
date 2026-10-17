import {
  fetchFollowedRepositoryMetadataLookups,
  type ReleaseTimelineGraphQLClient,
} from '#server/utils/release-timeline-graphql-utils';
import type {
  FollowedRepository,
  FollowedRepositoryMetadataResult,
  RepositoryIdentityLookup,
} from '#shared/types/release-follows';
import { applyFollowRenames, normalizeFollowedRepositories } from '#shared/utils/release-follows';

interface FollowedRepositoryMetadataSettings {
  followedRepositories?: FollowedRepository[] | null;
}

/**
 * The lookup set is the client's current follows. A new follow is visible
 * before its settings save lands, so stored settings alone would omit it.
 */
export function followedRepositoriesFromMetadataBody(body: unknown): FollowedRepository[] {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return [];
  const repositories = (body as { repositories?: unknown }).repositories;
  if (!Array.isArray(repositories)) return [];
  return normalizeFollowedRepositories(repositories);
}

export async function loadFollowedRepositoryMetadata(deps: {
  octokit: ReleaseTimelineGraphQLClient;
  readSettings: () => Promise<FollowedRepositoryMetadataSettings>;
  renameFollows: (lookups: Record<string, RepositoryIdentityLookup>) => Promise<unknown>;
  follows?: FollowedRepository[];
}): Promise<FollowedRepositoryMetadataResult> {
  const settings = await deps.readSettings();
  const stored = settings.followedRepositories ?? [];
  const follows = deps.follows ?? stored;
  if (follows.length === 0) {
    return { repositories: {}, renamed: false };
  }

  const repositories = await fetchFollowedRepositoryMetadataLookups(deps.octokit, follows);
  const identityLookups: Record<string, RepositoryIdentityLookup> = {};
  for (const [id, item] of Object.entries(repositories)) {
    identityLookups[id] =
      item.status === 'available'
        ? { status: 'available', owner: item.owner, name: item.name }
        : { status: item.status };
  }

  const renamed = applyFollowRenames(stored, identityLookups);
  if (renamed) {
    try {
      await deps.renameFollows(identityLookups);
    } catch (error: unknown) {
      console.warn('Failed to write back renamed Followed Repositories:', error);
    }
  }

  return { repositories, renamed: Boolean(renamed) };
}
