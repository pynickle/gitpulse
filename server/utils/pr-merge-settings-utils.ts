/**
 * The repository's own pull request merge policy: which merge methods it allows,
 * and the default commit title and message format it records for each method.
 *
 * GitHub reports a missing boolean as allowed and a missing format as the
 * "Default message" option, which is what a repository that never touched the
 * settings carries.
 */

export type PRMergeMethod = 'merge' | 'squash' | 'rebase';

export type PRMergeCommitTitle = 'PR_TITLE' | 'MERGE_MESSAGE';
export type PRMergeCommitMessage = 'BLANK' | 'PR_TITLE' | 'PR_BODY';
export type PRSquashCommitTitle = 'PR_TITLE' | 'COMMIT_OR_PR_TITLE';
export type PRSquashCommitMessage = 'BLANK' | 'PR_BODY' | 'COMMIT_MESSAGES';

export interface RepositoryMergeSettings {
  mergeCommitAllowed: boolean;
  squashMergeAllowed: boolean;
  rebaseMergeAllowed: boolean;
  mergeCommitTitle: PRMergeCommitTitle;
  mergeCommitMessage: PRMergeCommitMessage;
  squashMergeCommitTitle: PRSquashCommitTitle;
  squashMergeCommitMessage: PRSquashCommitMessage;
}

/** The order the merge box lists methods in, and the order it picks a default from. */
const PR_MERGE_METHOD_ORDER: readonly PRMergeMethod[] = ['merge', 'squash', 'rebase'];

interface GitHubRepositoryMergeSettingsResponse {
  allow_merge_commit?: boolean | null;
  allow_squash_merge?: boolean | null;
  allow_rebase_merge?: boolean | null;
  merge_commit_title?: string | null;
  merge_commit_message?: string | null;
  squash_merge_commit_title?: string | null;
  squash_merge_commit_message?: string | null;
}

function pickFormat<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

export function mapRepositoryMergeSettings(
  repository: GitHubRepositoryMergeSettingsResponse | null | undefined
): RepositoryMergeSettings {
  return {
    mergeCommitAllowed: repository?.allow_merge_commit !== false,
    squashMergeAllowed: repository?.allow_squash_merge !== false,
    rebaseMergeAllowed: repository?.allow_rebase_merge !== false,
    mergeCommitTitle: pickFormat<PRMergeCommitTitle>(
      repository?.merge_commit_title,
      ['PR_TITLE', 'MERGE_MESSAGE'],
      'MERGE_MESSAGE'
    ),
    mergeCommitMessage: pickFormat<PRMergeCommitMessage>(
      repository?.merge_commit_message,
      ['BLANK', 'PR_TITLE', 'PR_BODY'],
      'PR_TITLE'
    ),
    squashMergeCommitTitle: pickFormat<PRSquashCommitTitle>(
      repository?.squash_merge_commit_title,
      ['PR_TITLE', 'COMMIT_OR_PR_TITLE'],
      'COMMIT_OR_PR_TITLE'
    ),
    squashMergeCommitMessage: pickFormat<PRSquashCommitMessage>(
      repository?.squash_merge_commit_message,
      ['BLANK', 'PR_BODY', 'COMMIT_MESSAGES'],
      'COMMIT_MESSAGES'
    ),
  };
}

const isMethodAllowed = (settings: RepositoryMergeSettings, method: PRMergeMethod) => {
  if (method === 'merge') return settings.mergeCommitAllowed;
  if (method === 'squash') return settings.squashMergeAllowed;
  return settings.rebaseMergeAllowed;
};

/**
 * Which merge methods the box may offer. Unreadable settings offer every method:
 * GitHub remains the authority on whether a merge may proceed, and it rejects a
 * disabled method with its own message.
 */
export function resolveAllowedMergeMethods(
  settings: RepositoryMergeSettings | null
): PRMergeMethod[] {
  if (!settings) return [...PR_MERGE_METHOD_ORDER];

  const allowed = PR_MERGE_METHOD_ORDER.filter((method) => isMethodAllowed(settings, method));
  // GitHub requires at least one method, so an empty list means the payload lied.
  return allowed.length > 0 ? allowed : [...PR_MERGE_METHOD_ORDER];
}
