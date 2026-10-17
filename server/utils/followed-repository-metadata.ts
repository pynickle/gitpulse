import {
  fetchFollowedRepositoryMetadataLookups,
  type ReleaseTimelineGraphQLClient,
} from '#server/utils/release-timeline-graphql-utils';
import type {
  FollowedRepository,
  FollowedRepositoryMetadataResult,
  RepositoryIdentityLookup,
} from '#shared/types/release-follows';
import { applyFollowRenames } from '#shared/utils/release-follows';

interface FollowedRepositoryMetadataSettings {
  followedRepositories?: FollowedRepository[] | null;
}

export async function loadFollowedRepositoryMetadata(deps: {
  octokit: ReleaseTimelineGraphQLClient;
  readSettings: () => Promise<FollowedRepositoryMetadataSettings>;
  renameFollows: (lookups: Record<string, RepositoryIdentityLookup>) => Promise<unknown>;
}): Promise<FollowedRepositoryMetadataResult> {
  const settings = await deps.readSettings();
  const follows = settings.followedRepositories ?? [];
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

  const renamed = applyFollowRenames(follows, identityLookups);
  if (renamed) {
    try {
      await deps.renameFollows(identityLookups);
    } catch (error: unknown) {
      console.warn('Failed to write back renamed Followed Repositories:', error);
    }
  }

  return { repositories, renamed: Boolean(renamed) };
}
