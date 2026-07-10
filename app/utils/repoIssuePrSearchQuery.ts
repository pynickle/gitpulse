export type RepoIssuePrKind = 'issues' | 'pulls';
export type RepoIssuePrState = 'open' | 'closed' | 'merged' | 'all';

/** Normalize state for the active list kind (issues cannot be merged). */
export const normalizeRepoIssuePrState = (
  kind: RepoIssuePrKind,
  state: RepoIssuePrState
): RepoIssuePrState => {
  if (kind === 'issues' && state === 'merged') {
    return 'open';
  }
  return state;
};

export const buildRepoIssuePrSearchQuery = (
  owner: string,
  repo: string,
  kind: RepoIssuePrKind,
  state: RepoIssuePrState = 'open'
) => {
  const typeQualifier = kind === 'pulls' ? 'is:pr' : 'is:issue';
  const normalizedState = normalizeRepoIssuePrState(kind, state);
  const parts = [typeQualifier, 'archived:false', `repo:${owner}/${repo}`];

  if (normalizedState === 'open') {
    parts.push('state:open');
  } else if (normalizedState === 'closed') {
    parts.push('state:closed');
    if (kind === 'pulls') {
      parts.push('-is:merged');
    }
  } else if (normalizedState === 'merged') {
    parts.push('is:merged');
  }

  parts.push('sort:updated-desc');
  return parts.join(' ');
};
