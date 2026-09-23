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

const toGroupedChecks = (nodes: CheckRollupContext[]) => {
  const groups = new Map<CheckOutcomeGroup, PullRequestChecksView['groups'][number]['checks']>();

  nodes.forEach((node, index) => {
    const name = nonEmptyString(node.name);
    if (!name) return;

    const outcome = toOutcomeGroup(node);
    const group = groups.get(outcome) ?? [];
    group.push({
      key: `${name}:${index}`,
      name,
      appName: toCheckAppName(node),
      detailsUrl: nonEmptyString(node.detailsUrl),
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
  // No fraction when the list is truncated or empty: the chip shows a tone and a
  // total, or nothing at all.
  const passedCount =
    isTruncated || totalCount === 0
      ? null
      : (groupOf('success')?.checks.length ?? 0) +
        (groupOf('neutral')?.checks.length ?? 0) +
        (groupOf('skipped')?.checks.length ?? 0);
  const failedCount =
    isTruncated || totalCount === 0 ? null : (groupOf('failure')?.checks.length ?? 0);

  return {
    isVisible: totalCount > 0,
    tone,
    passedCount,
    failedCount,
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
