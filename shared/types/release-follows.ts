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
