import type { RepoCommitListItemPayload } from '#shared/types/repos';
import type { TimelineCommit } from '~/composables/usePRTimelineEvents';

/**
 * The payload both timeline commit cards hand to the shared commit row.
 * `fallbackHref` supplies the card's own commit URL when GitHub's payload
 * carries neither `commitUrl` nor `url`.
 */
export function buildTimelineCommitPayload(
  commit: TimelineCommit | null | undefined,
  fallbackHref: (sha: string) => string
): RepoCommitListItemPayload | null {
  const sha = commit?.oid?.trim() ?? '';
  if (!sha) return null;

  const login = commit?.author?.user?.login?.trim() || null;

  return {
    sha,
    shortSha: sha.slice(0, 7),
    message: commit?.message?.split('\n')[0]?.trimEnd() ?? '',
    committedAt: commit?.committedDate || null,
    author: {
      login,
      name: commit?.author?.name || null,
      avatarUrl: commit?.author?.user?.avatarUrl || null,
    },
    htmlUrl: commit?.commitUrl || commit?.url || fallbackHref(sha),
    verification: commit?.verification ?? null,
    checkRollup: commit?.checkRollup ?? null,
  };
}
