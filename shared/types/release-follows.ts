import type { ReactionSummaryItem } from './reactions';

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
  /** Readable complete release notes, normalized for timeline search. */
  notesSearchText: string;
  publishedAt: string | null;
  isDraft: boolean;
  isPrerelease: boolean;
  assetCount: number;
  htmlUrl: string | null;
  reactions: ReactionSummaryItem[];
}

export type RepositoryReleaseLookup =
  | {
      status: 'available';
      owner: string;
      name: string;
      hasOlderReleases: boolean;
      endCursor?: string | null;
      incomplete?: boolean;
      releases: RepositoryReleaseItem[];
    }
  | { status: 'unavailable' }
  | { status: 'transient' };

export type RepositoryIdentityLookup =
  | { status: 'available'; owner: string; name: string }
  | { status: 'unavailable' }
  | { status: 'transient' };

/** Recognition details for one Followed Repository. Star Count is present only after a successful read. */
export type FollowedRepositoryMetadata =
  | {
      status: 'available';
      owner: string;
      name: string;
      description: string | null;
      primaryLanguage: string | null;
      starCount: number;
    }
  | { status: 'unavailable' }
  | { status: 'transient' };

export interface FollowedRepositoryMetadataResult {
  repositories: Record<string, FollowedRepositoryMetadata>;
  renamed: boolean;
}

export type ClassifiableLookup = { status: string; incomplete?: boolean };

export interface LookupClassification {
  availableIds: string[];
  unavailableIds: string[];
  transientIds: string[];
}

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
  reactions: ReactionSummaryItem[];
}

export interface ReleaseTimelineGroup {
  date: string;
  items: TimelineRelease[];
}

export interface ReleaseTimeline {
  pages?: Record<string, RepositoryReleaseLookup>;
  refresh?: { previousBaseline: string | null; startedAt: string };
  persistenceError?: string;
  groups: ReleaseTimelineGroup[];
  unavailableIds: string[];
  transientIds: string[];
}

/** One bounded round, with continuation state for each requested repository. */
export interface ReleaseTimelinePage extends ReleaseTimeline {
  pages: Record<string, RepositoryReleaseLookup>;
  refresh?: { previousBaseline: string | null; startedAt: string };
  persistenceError?: string;
}
export interface ReleaseTimelineRequest {
  cursors?: Record<string, string | null>;
}
