import {
  GitMergeIcon,
  GitPullRequestClosedIcon,
  GitPullRequestDraftIcon,
  GitPullRequestIcon,
} from '@lucide/vue';
import type { Component } from 'vue';

/**
 * UI-facing pull request lifecycle states. `draft` is a refinement of open —
 * merged/closed always win over draft.
 */
export type PullRequestDisplayState = 'open' | 'draft' | 'merged' | 'closed';

export interface PullRequestStateInput {
  state?: string | null;
  merged?: boolean | null;
  merged_at?: string | null;
  draft?: boolean | null;
}

export interface PullRequestStateVisual {
  state: PullRequestDisplayState;
  icon: Component;
  /** CSS color for standalone icon usage (headers, badges). */
  color: string;
}

const VISUALS: Record<PullRequestDisplayState, Omit<PullRequestStateVisual, 'state'>> = {
  open: {
    icon: GitPullRequestIcon,
    color: 'var(--gitpulse-success)',
  },
  draft: {
    icon: GitPullRequestDraftIcon,
    color: 'var(--gitpulse-text-muted)',
  },
  merged: {
    icon: GitMergeIcon,
    color: 'var(--gitpulse-info)',
  },
  closed: {
    icon: GitPullRequestClosedIcon,
    color: 'var(--gitpulse-text-strong)',
  },
};

/**
 * Resolve the display state from GitHub-shaped PR fields.
 * Precedence: merged → closed → draft (open only) → open.
 */
export function resolvePullRequestDisplayState(
  input: PullRequestStateInput | null | undefined
): PullRequestDisplayState {
  if (!input) return 'closed';

  if (input.merged || input.merged_at) return 'merged';
  if (input.state === 'closed') return 'closed';
  if (input.draft) return 'draft';
  if (input.state === 'open' || !input.state) return 'open';

  return 'closed';
}

/** Icon + color for a PR state, including draft. */
export default function getPullRequestStateVisual(
  input: PullRequestStateInput | null | undefined
): PullRequestStateVisual {
  const state = resolvePullRequestDisplayState(input);
  return {
    state,
    ...VISUALS[state],
  };
}

export function getPullRequestStateIcon(
  input: PullRequestStateInput | null | undefined
): Component {
  return getPullRequestStateVisual(input).icon;
}
