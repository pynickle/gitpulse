import {
  FOLLOW_STORED_CAP,
  FOLLOW_VALID_CAP,
  type FollowAddError,
  type FollowAddResult,
  type FollowedRepository,
} from '../types/release-follows';

const toNonEmptyString = (value: unknown, maxLength = 240) => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
};

export function toFollowedRepository(value: unknown): FollowedRepository | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Partial<FollowedRepository>;
  const id = toNonEmptyString(candidate.id);
  const owner = toNonEmptyString(candidate.owner, 100);
  const name = toNonEmptyString(candidate.name, 100);

  if (!id || !owner || !name) {
    return null;
  }

  return { id, owner, name };
}

export function cloneFollowedRepositories(list: FollowedRepository[]) {
  return list.map((item) => ({ ...item }));
}

/**
 * Newest-follow first, unique by GraphQL id, at most 150 stored rows.
 * Invalid rows are dropped.
 */
export function normalizeFollowedRepositories(raw: unknown): FollowedRepository[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const seen = new Set<string>();
  const next: FollowedRepository[] = [];

  for (const entry of raw) {
    const repo = toFollowedRepository(entry);
    if (!repo || seen.has(repo.id)) {
      continue;
    }

    seen.add(repo.id);
    next.push(repo);

    if (next.length >= FOLLOW_STORED_CAP) {
      break;
    }
  }

  return next;
}

const countValidFollows = (list: FollowedRepository[], unavailableIds: ReadonlySet<string>) => {
  return list.reduce((count, item) => (unavailableIds.has(item.id) ? count : count + 1), 0);
};

export function getFollowAddBlock(
  list: FollowedRepository[],
  unavailableIds: ReadonlySet<string> = new Set()
): Exclude<FollowAddError, 'duplicate'> | null {
  if (list.length >= FOLLOW_STORED_CAP) {
    return 'stored-cap';
  }

  if (countValidFollows(list, unavailableIds) >= FOLLOW_VALID_CAP) {
    return 'valid-cap';
  }

  return null;
}

export function applyFollowAdd(
  list: FollowedRepository[],
  repo: FollowedRepository,
  unavailableIds: ReadonlySet<string> = new Set()
): FollowAddResult {
  const nextRepo = toFollowedRepository(repo);
  if (!nextRepo || list.some((item) => item.id === nextRepo.id)) {
    return { ok: false, error: 'duplicate' };
  }

  const block = getFollowAddBlock(list, unavailableIds);
  if (block) {
    return { ok: false, error: block };
  }

  return { ok: true, list: [nextRepo, ...cloneFollowedRepositories(list)] };
}

export function applyFollowRemove(list: FollowedRepository[], id: string): FollowedRepository[] {
  return list.filter((item) => item.id !== id).map((item) => ({ ...item }));
}

export function applyFollowClear(): FollowedRepository[] {
  return [];
}
