export type CopilotReviewEffort = 'lite' | 'balanced' | 'max';

export function normalizeCopilotReviewEffort(value: unknown): CopilotReviewEffort | undefined {
  const effort = typeof value === 'string' ? value.toLowerCase() : '';
  return effort === 'lite' || effort === 'balanced' || effort === 'max' ? effort : undefined;
}

type CopilotReviewerIdentity = {
  login?: string;
  id?: string | number;
  node_id?: string;
  nodeId?: string;
};

export function hidesUnrequestedCopilot({
  hiding,
  reviewerItems,
  requestedReviewers,
}: {
  hiding: boolean;
  reviewerItems?: ReadonlyArray<CopilotReviewerIdentity | null> | null;
  requestedReviewers?: ReadonlyArray<CopilotReviewerIdentity | null> | null;
}): boolean {
  if (!hiding) return false;

  const reviewers = reviewerItems?.length ? reviewerItems : (requestedReviewers ?? []);
  return !reviewers.some((reviewer) => isCopilotReviewer(reviewer));
}

export function isCopilotReviewer(
  user?: { login?: string; id?: string | number; node_id?: string; nodeId?: string } | null
): boolean {
  return Boolean(
    user &&
    (String(user.id) === '175728472' ||
      (user.node_id ?? user.nodeId) === 'BOT_kgDOCnlnWA' ||
      ['copilot', 'copilot-pull-request-reviewer', 'copilot-pull-request-reviewer[bot]'].includes(
        user.login?.toLowerCase() ?? ''
      ))
  );
}
