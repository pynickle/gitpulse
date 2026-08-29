/**
 * A GitPulse-local Release Follow identity.
 * `id` is GitHub's GraphQL node id (REST `node_id`), not the numeric REST id.
 */
export interface FollowedRepository {
  id: string;
  owner: string;
  name: string;
}

export const FOLLOW_VALID_CAP = 100;
export const FOLLOW_STORED_CAP = 150;

export type FollowAddError = 'valid-cap' | 'stored-cap' | 'duplicate';

export type FollowAddResult =
  | { ok: true; list: FollowedRepository[] }
  | { ok: false; error: FollowAddError };

export interface RepositoryReleaseItem {
  id: number;
  tagName: string;
  name: string | null;
  description: string | null;
  publishedAt: string | null;
  isDraft: boolean;
  isPrerelease: boolean;
  assetCount: number;
  htmlUrl: string | null;
}

export type RepositoryReleaseLookup =
  | {
      status: 'available';
      owner: string;
      name: string;
      hasOlderReleases: boolean;
      releases: RepositoryReleaseItem[];
    }
  | { status: 'unavailable' }
  | { status: 'transient' };

export interface TimelineRelease {
  repository: FollowedRepository;
  id: number;
  tagName: string;
  title: string;
  publishedAt: string;
  changelog: string;
  changelogTruncated: boolean;
  assetCount: number;
  isPrerelease: boolean;
  isOldestShown: boolean;
  htmlUrl: string | null;
}

export interface ReleaseTimelineGroup {
  date: string;
  items: TimelineRelease[];
}

export interface ReleaseTimeline {
  groups: ReleaseTimelineGroup[];
  unavailableIds: string[];
  transientIds: string[];
}
