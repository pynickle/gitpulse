import type { RepoCommitListItemPayload, RepoLatestCommitPayload } from '#shared/types/repos';

interface GitHubCommitUser {
  login?: string | null;
  avatar_url?: string | null;
}

interface GitHubCommitIdentity {
  name?: string | null;
  email?: string | null;
  date?: string | null;
}

/**
 * Subset of GitHub's commit list item used for the latest-commit summary.
 * @see https://docs.github.com/en/rest/commits/commits#list-commits
 */
export interface GitHubCommitListItem {
  sha?: string | null;
  html_url?: string | null;
  author?: GitHubCommitUser | null;
  committer?: GitHubCommitUser | null;
  commit?: {
    message?: string | null;
    author?: GitHubCommitIdentity | null;
    committer?: GitHubCommitIdentity | null;
  } | null;
}

function trimString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function firstLine(message: string): string {
  const newline = message.search(/\r?\n/);
  return newline === -1 ? message : message.slice(0, newline).trimEnd();
}

/** Build the public GitHub commits list URL for a repo ref (branch/tag/sha). */
export function buildRepoCommitsUrl(owner: string, repo: string, ref?: string | null): string {
  const base = `https://github.com/${owner}/${repo}/commits`;
  const branch = trimString(ref);
  if (!branch) return base;
  return `${base}/${branch.split('/').map(encodeURIComponent).join('/')}`;
}

/**
 * Map a GitHub commit list item into the client-facing commit list entry.
 * Returns null when the item has no usable sha.
 */
export function mapGitHubCommitToCommitListItem(
  commit: GitHubCommitListItem | null | undefined
): RepoCommitListItemPayload | null {
  const sha = trimString(commit?.sha);
  if (!sha || !commit) return null;

  const messageRaw = trimString(commit.commit?.message);
  const authorLogin = trimString(commit.author?.login) || null;
  const authorName = trimString(commit.commit?.author?.name) || null;
  const committedAt =
    trimString(commit.commit?.committer?.date) || trimString(commit.commit?.author?.date) || null;

  return {
    sha,
    shortSha: sha.slice(0, 7),
    message: messageRaw ? firstLine(messageRaw) : '',
    committedAt,
    author: {
      login: authorLogin,
      name: authorName,
      avatarUrl: trimString(commit.author?.avatar_url) || null,
    },
    htmlUrl: trimString(commit.html_url) || null,
  };
}

/**
 * Map a GitHub commit list item into the client-facing latest-commit payload.
 * Returns null when the item has no usable sha.
 */
export function mapGitHubCommitToLatestCommit(
  commit: GitHubCommitListItem | null | undefined,
  options: { owner: string; repo: string; ref?: string | null }
): RepoLatestCommitPayload | null {
  const listItem = mapGitHubCommitToCommitListItem(commit);
  if (!listItem) return null;

  return {
    ...listItem,
    commitsUrl: buildRepoCommitsUrl(options.owner, options.repo, options.ref),
  };
}
