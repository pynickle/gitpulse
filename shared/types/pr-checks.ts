/**
 * GitHub's own Pull Request check summary — the `statusCheckRollup`.
 *
 * The rollup replaces REST check-run paging for every check surface: its
 * aggregate state is GitHub's verdict and its contexts are the deduplicated set
 * GitHub shows on the Checks tab, so the Pull Request Card, the Notification
 * Card, and the PR Review Workspace merge box cannot disagree.
 */

/** GitHub's aggregate verdict for a pull request's checks. */
export type CheckRollupState = 'SUCCESS' | 'FAILURE' | 'PENDING' | 'EXPECTED' | 'ERROR';

/**
 * One entry of the Check Rollup, in near-raw GitHub shape.
 *
 * `statusCheckRollup.contexts` returns a `StatusCheckContext` union of `CheckRun`
 * and legacy `StatusContext`. A `CheckRun` reports a lifecycle `status` plus a
 * `conclusion`; a `StatusContext` reports a single `state` that GitHub documents
 * as the outcome equivalent. Servers therefore set `conclusion` from a
 * `StatusContext.state` and leave `status` unset for it. No bucketing,
 * labelling, or counting decision is made here — all of that lives in
 * `shared/utils/pr-checks.ts`.
 */
export interface CheckRollupContext {
  /** `CheckRun` or `StatusContext`, when GitHub reports the union member. */
  __typename?: string | null;
  name?: string | null;
  /** CheckRun conclusion, or the StatusContext state. */
  conclusion?: string | null;
  /** CheckRun lifecycle status. Absent for a StatusContext. */
  status?: string | null;
  detailsUrl?: string | null;
  /** CheckRun output title (e.g. skip or failure summary). Absent for a StatusContext. */
  title?: string | null;
  /** CheckRun start timestamp. Absent for a StatusContext. */
  startedAt?: string | null;
  /** CheckRun completion timestamp. Absent for a StatusContext. */
  completedAt?: string | null;
  /** StatusContext description. Absent for a CheckRun. */
  description?: string | null;
  /** StatusContext avatar URL. Absent for a CheckRun. */
  avatarUrl?: string | null;
  /** StatusContext creation timestamp. Absent for a CheckRun. */
  createdAt?: string | null;
  /** CheckRun app — GitHub Actions, Netlify, or another integration. */
  checkSuite?: { app?: { name?: string | null; logoUrl?: string | null } | null } | null;
  /** StatusContext author. Absent for a CheckRun. */
  creator?: { login?: string | null } | null;
}

export interface CheckRollupContextConnection {
  totalCount?: number | null;
  nodes?: (CheckRollupContext | null)[] | null;
}

/** The rollup itself: GitHub's aggregate verdict plus its deduplicated contexts. */
export interface PullRequestCheckRollup {
  /**
   * GitHub's aggregate verdict. `CheckRollupState` lists the values seen today,
   * but GitHub adds states over time, so the field stays a plain string and
   * unknown values are read as no verdict rather than rejected.
   */
  state?: string | null;
  contexts?: CheckRollupContextConnection | null;
}

/** What a card, the modal, and the merge box checks row can each express. */
export type CheckStatusTone = 'success' | 'danger' | 'warning';

/** Outcome buckets. Cold outcomes fold into `failure`, unreported ones into `pending`. */
export type CheckOutcomeGroup = 'failure' | 'pending' | 'success' | 'neutral' | 'skipped';

/** Which summary line the modal and the merge box checks row show. */
export type CheckSummaryKind = 'passed' | 'failed' | 'pending';

export interface CheckListItem {
  /** Stable across renders, derived from the context's position in the rollup. */
  key: string;
  name: string;
  /** The app that produced the check, when GitHub reports one. */
  appName: string | null;
  /** App logo URL (CheckRun) or avatar URL (StatusContext), when reported. */
  appLogoUrl: string | null;
  /** Link to the check's run on GitHub, when GitHub reports one. */
  detailsUrl: string | null;
  /** CheckRun lifecycle status (e.g. IN_PROGRESS, QUEUED, COMPLETED), or null for StatusContext. */
  status: string | null;
  /** CheckRun conclusion or StatusContext state. */
  conclusion: string | null;
  /** CheckRun start timestamp. */
  startedAt: string | null;
  /** CheckRun completion timestamp. */
  completedAt: string | null;
  /** StatusContext creation timestamp. */
  createdAt: string | null;
  /** CheckRun title or StatusContext description. */
  summary: string | null;
  /** Positive run duration in seconds when both startedAt and completedAt are valid and completedAt > startedAt. */
  durationSeconds: number | null;
}

export interface CheckListGroup {
  kind: CheckOutcomeGroup;
  checks: CheckListItem[];
}

/**
 * The single view model behind the Check Status Chip, the Check List Modal, and
 * the PR Review Workspace merge box checks row.
 */
export interface PullRequestChecksView {
  /** False when the Check Rollup has no contexts — no chip, no row, no list. */
  isVisible: boolean;
  tone: CheckStatusTone;
  /**
   * success + neutral + skipped, because GitHub reports a skipped job as Success
   * and does not block a merge on a neutral conclusion. Null when the rollup is
   * truncated, so no surface shows an under-counted fraction.
   */
  passedCount: number | null;
  /**
   * failure-group contexts. Null together with `passedCount` when the rollup is
   * truncated: the remaining contexts could be either, so no surface may guess.
   */
  failedCount: number | null;
  /** pending-group contexts. Null when the rollup is truncated or empty. */
  pendingCount: number | null;
  /** success-group contexts. Null when the rollup is truncated or empty. */
  successCount: number | null;
  /** neutral-group contexts. Null when the rollup is truncated or empty. */
  neutralCount: number | null;
  /** skipped-group contexts. Null when the rollup is truncated or empty. */
  skippedCount: number | null;
  /** GitHub's own Checks tab count for this pull request's head commit. */
  totalCount: number;
  /** The rollup reported more contexts than the 100 asked for. */
  isTruncated: boolean;
  summaryKind: CheckSummaryKind;
  /** Non-empty groups only, in `CHECK_OUTCOME_GROUP_ORDER`. */
  groups: CheckListGroup[];
}
