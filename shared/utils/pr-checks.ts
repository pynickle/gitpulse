import type {
  CheckOutcomeGroup,
  CheckRollupContext,
  CheckRollupContextConnection,
  CheckStatusTone,
  PullRequestCheckRollup,
  PullRequestChecksView,
} from '#shared/types/pr-checks';

/**
 * Contexts are capped at 100 per pull request. A rollup that reports more
 * contexts than were fetched is truncated: the chip then shows a tone and a
 * total without a passed fraction rather than a silently under-counted one.
 */
export const CHECK_ROLLUP_CONTEXT_LIMIT = 100;

/**
 * Group order inside the Check List Modal and the merge box checks row:
 * problems first, then in-flight work, then the quieter outcomes.
 */
export const CHECK_OUTCOME_GROUP_ORDER: readonly CheckOutcomeGroup[] = [
  'failure',
  'pending',
  'success',
  'neutral',
  'skipped',
];

/** Conclusions GitHub reports for a check that is not going to pass. */
const FAILURE_CONCLUSIONS = new Set<string>([
  'FAILURE',
  'CANCELLED',
  'TIMED_OUT',
  'STARTUP_FAILURE',
  'ACTION_REQUIRED',
  'STALE',
]);

/** Conclusions GitHub reports for a check that has no outcome yet. */
const PENDING_CONCLUSIONS = new Set<string>([
  'PENDING',
  'EXPECTED',
  'REQUESTED',
  'QUEUED',
  'WAITING',
]);

/** Contexts without a reported outcome read as in progress. */
const REPORTED_STATUSES = new Set<string>(['COMPLETED']);

/** Rollup states whose aggregate verdict already settles the tone. */
const FAILED_ROLLUP_STATES: ReadonlySet<string> = new Set(['FAILURE', 'ERROR']);
const PENDING_ROLLUP_STATES: ReadonlySet<string> = new Set(['PENDING', 'EXPECTED']);

const EMPTY_APP_SORT_KEY = '\uffff';

const normalizePart = (value: unknown): string =>
  typeof value === 'string' ? value.trim().toUpperCase() : '';

const nonEmptyString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const toPositiveCount = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 0;
  return Math.trunc(value);
};

/**
 * Buckets one context by outcome. Every conclusion GitHub can report maps onto
 * one of the five groups, so no state can fall through unhandled: an unrecognized
 * conclusion counts as a failure rather than padding the passed count.
 */
const toOutcomeGroup = (context: CheckRollupContext): CheckOutcomeGroup => {
  const conclusion = normalizePart(context.conclusion);

  if (conclusion === 'SUCCESS') return 'success';
  if (conclusion === 'NEUTRAL') return 'neutral';
  if (conclusion === 'SKIPPED') return 'skipped';
  if (FAILURE_CONCLUSIONS.has(conclusion)) return 'failure';
  if (PENDING_CONCLUSIONS.has(conclusion)) return 'pending';

  // No conclusion: a context declared but not yet reported reads as in progress.
  if (!REPORTED_STATUSES.has(normalizePart(context.status))) return 'pending';

  return 'failure';
};

const toCheckAppName = (context: CheckRollupContext): string | null =>
  nonEmptyString(context.checkSuite?.app?.name) ?? nonEmptyString(context.creator?.login);

const toCheckAppLogoUrl = (context: CheckRollupContext): string | null =>
  nonEmptyString(context.checkSuite?.app?.logoUrl) ?? nonEmptyString(context.avatarUrl);

const toCheckSummary = (context: CheckRollupContext): string | null =>
  nonEmptyString(context.title) ?? nonEmptyString(context.description);

const toDurationSeconds = (startedAt: string | null, completedAt: string | null): number | null => {
  if (!startedAt || !completedAt) return null;
  const start = Date.parse(startedAt);
  const end = Date.parse(completedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const seconds = Math.round((end - start) / 1000);
  return seconds > 0 ? seconds : null;
};

const toGroupedChecks = (nodes: CheckRollupContext[]) => {
  const groups = new Map<CheckOutcomeGroup, PullRequestChecksView['groups'][number]['checks']>();

  nodes.forEach((node, index) => {
    const name = nonEmptyString(node.name);
    if (!name) return;

    const outcome = toOutcomeGroup(node);
    const startedAt = nonEmptyString(node.startedAt);
    const completedAt = nonEmptyString(node.completedAt);
    const group = groups.get(outcome) ?? [];
    group.push({
      key: `${name}:${index}`,
      name,
      appName: toCheckAppName(node),
      appLogoUrl: toCheckAppLogoUrl(node),
      detailsUrl: nonEmptyString(node.detailsUrl),
      status: nonEmptyString(node.status),
      conclusion: nonEmptyString(node.conclusion),
      startedAt,
      completedAt,
      createdAt: nonEmptyString(node.createdAt),
      summary: toCheckSummary(node),
      durationSeconds: toDurationSeconds(startedAt, completedAt),
    });
    groups.set(outcome, group);
  });

  for (const checks of groups.values()) {
    checks.sort((left, right) => {
      const leftKey = left.appName ?? EMPTY_APP_SORT_KEY;
      const rightKey = right.appName ?? EMPTY_APP_SORT_KEY;
      if (leftKey === rightKey) return 0;
      return leftKey < rightKey ? -1 : 1;
    });
  }

  return CHECK_OUTCOME_GROUP_ORDER.flatMap((kind) => {
    const checks = groups.get(kind);
    return checks?.length ? [{ kind, checks }] : [];
  });
};

const toRollupTone = (state: string, groups: CheckOutcomeGroup[]): CheckStatusTone => {
  if (FAILED_ROLLUP_STATES.has(state) || groups.includes('failure')) return 'danger';
  if (PENDING_ROLLUP_STATES.has(state) || groups.includes('pending')) return 'warning';
  return 'success';
};

const toConnection = (contexts: CheckRollupContextConnection | null | undefined) => {
  const nodes = Array.isArray(contexts?.nodes) ? contexts.nodes : [];
  const parsedNodes = nodes.filter((node): node is CheckRollupContext => Boolean(node));
  const rolledUpTotal = toPositiveCount(contexts?.totalCount);

  return { parsedNodes, rolledUpTotal };
};

/**
 * Resolves a Check Rollup into the view model the Check Status Chip, the Check
 * List Modal, and the merge box checks row all read, so the three surfaces
 * cannot drift.
 */
export function toPullRequestChecksView(
  rollup: PullRequestCheckRollup | null | undefined
): PullRequestChecksView {
  const state = normalizePart(rollup?.state);
  const { parsedNodes, rolledUpTotal } = toConnection(rollup?.contexts);
  const groups = toGroupedChecks(parsedNodes);
  const tone = toRollupTone(
    state,
    groups.map((group) => group.kind)
  );

  const totalCount = Math.max(parsedNodes.length, rolledUpTotal);
  const isTruncated = rolledUpTotal > parsedNodes.length;
  const groupOf = (kind: CheckOutcomeGroup) => groups.find((group) => group.kind === kind);
  // No fraction or per-outcome count when the list is truncated or empty: the
  // chip shows a tone and a total, or nothing at all.
  const canCount = !isTruncated && totalCount > 0;
  const successCount = canCount ? (groupOf('success')?.checks.length ?? 0) : null;
  const neutralCount = canCount ? (groupOf('neutral')?.checks.length ?? 0) : null;
  const skippedCount = canCount ? (groupOf('skipped')?.checks.length ?? 0) : null;
  const failedCount = canCount ? (groupOf('failure')?.checks.length ?? 0) : null;
  const pendingCount = canCount ? (groupOf('pending')?.checks.length ?? 0) : null;
  const passedCount =
    canCount && successCount !== null && neutralCount !== null && skippedCount !== null
      ? successCount + neutralCount + skippedCount
      : null;

  return {
    isVisible: totalCount > 0,
    tone,
    passedCount,
    failedCount,
    pendingCount,
    successCount,
    neutralCount,
    skippedCount,
    totalCount,
    isTruncated,
    summaryKind: tone === 'danger' ? 'failed' : tone === 'warning' ? 'pending' : 'passed',
    groups,
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** Reads a Check Rollup off a list item or a Notification Subject. */
export function readPullRequestCheckRollup(value: unknown): PullRequestCheckRollup | null {
  if (!isRecord(value)) return null;

  const rollup = value.checkRollup;
  return isRecord(rollup) ? (rollup as PullRequestCheckRollup) : null;
}

type TranslateFn = (key: string, params?: Record<string, unknown>) => string;

/**
 * Formats a compact non-zero duration (e.g. `42s`, `1m 36s`, `1h 5m`).
 * Returns an empty string for non-positive or non-finite values.
 */
export function formatCompactCheckDuration(seconds: number, t: TranslateFn): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const totalSeconds = Math.max(1, Math.round(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) {
    return minutes > 0
      ? t('dashboard.checks.durationHoursMinutes', { h: hours, m: minutes })
      : t('dashboard.checks.durationHours', { h: hours });
  }
  if (minutes > 0) {
    return secs > 0
      ? t('dashboard.checks.durationMinutesSeconds', { m: minutes, s: secs })
      : t('dashboard.checks.durationMinutes', { m: minutes });
  }
  return t('dashboard.checks.durationSeconds', { s: secs });
}

/**
 * Formats the non-zero outcome breakdown summary shared by the Check Status Chip
 * tooltip/accessible name, Check List Modal header, and Merge Box Checks row.
 * Falls back to `overLimit` when truncated so no surface invents a fraction.
 */
export function formatCheckBreakdownSummary(view: PullRequestChecksView, t: TranslateFn): string {
  if (view.isTruncated) {
    return t('dashboard.checks.overLimit', {
      total: view.totalCount,
      limit: CHECK_ROLLUP_CONTEXT_LIMIT,
    });
  }

  const parts: string[] = [];
  if (view.failedCount) {
    parts.push(t('dashboard.checks.count_failure', { count: view.failedCount }));
  }
  if (view.pendingCount) {
    parts.push(t('dashboard.checks.count_pending', { count: view.pendingCount }));
  }
  if (view.successCount) {
    parts.push(t('dashboard.checks.count_success', { count: view.successCount }));
  }
  if (view.neutralCount) {
    parts.push(t('dashboard.checks.count_neutral', { count: view.neutralCount }));
  }
  if (view.skippedCount) {
    parts.push(t('dashboard.checks.count_skipped', { count: view.skippedCount }));
  }

  if (parts.length > 0) {
    return parts.join(t('dashboard.checks.countSeparator'));
  }

  const counts = {
    passed: view.passedCount ?? 0,
    failed: view.failedCount ?? 0,
    total: view.totalCount,
  };
  if (view.summaryKind === 'failed') return t('dashboard.checks.summaryFailed', counts);
  if (view.summaryKind === 'pending') return t('dashboard.checks.summaryPending', counts);
  return t('dashboard.checks.summaryPassed', counts);
}
