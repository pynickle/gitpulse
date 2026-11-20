import type { PullRequestMergeability } from '#shared/types/pulls';

const MERGEABILITIES = new Set<PullRequestMergeability>(['conflicting', 'mergeable', 'unknown']);

/**
 * GitHub GraphQL reports `MergeableState` in uppercase (`CONFLICTING`).
 * List payloads store the lowercased value.
 */
export function readPullRequestMergeability(value: unknown): PullRequestMergeability | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return MERGEABILITIES.has(normalized as PullRequestMergeability)
    ? (normalized as PullRequestMergeability)
    : null;
}

/**
 * Refined GitHub's conflict marker: an open pull request, including a draft,
 * whose mergeability is `CONFLICTING`. Closed and merged pulls stay unmarked.
 */
export function pullRequestHasConflicts(
  input:
    | {
        mergeable?: unknown;
        state?: string | null;
        draft?: boolean | null;
      }
    | null
    | undefined
): boolean {
  if (!input) return false;
  if (readPullRequestMergeability(input.mergeable) !== 'conflicting') return false;

  const state = typeof input.state === 'string' ? input.state.trim().toLowerCase() : '';
  if (state === 'closed' || state === 'merged') return false;
  return state === 'open' || input.draft === true;
}
