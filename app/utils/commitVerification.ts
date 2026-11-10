import type { CommitVerification } from '#shared/types/repos';

/** What a commit row paints. Unsigned commits paint nothing. */
export type CommitVerificationMark = 'verified' | 'unverified';

/**
 * GitHub's default (non-vigilant) badge, read from the verification record.
 * `verified` wins. `unsigned` stays absent. Every other reason is unverified.
 */
export function commitVerificationMark(
  verification: CommitVerification | null | undefined
): CommitVerificationMark | null {
  if (!verification?.reason) return null;
  if (verification.verified) return 'verified';
  if (verification.reason === 'unsigned') return null;
  return 'unverified';
}
