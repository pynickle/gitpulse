import { describe, expect, test } from 'bun:test';

import type {
  CheckRollupContext,
  CheckRollupContextConnection,
  PullRequestCheckRollup,
} from '../shared/types/pr-checks';
import {
  CHECK_OUTCOME_GROUP_ORDER,
  CHECK_ROLLUP_CONTEXT_LIMIT,
  readPullRequestCheckRollup,
  toPullRequestChecksView,
} from '../shared/utils/pr-checks';

const checkRun = (
  name: string,
  conclusion: string | null,
  status = 'COMPLETED',
  appName: string | null = null,
  detailsUrl: string | null = null
): CheckRollupContext => ({
  __typename: 'CheckRun',
  name,
  conclusion,
  status,
  detailsUrl,
  checkSuite: appName ? { app: { name: appName } } : null,
});

const rollup = (
  state: string,
  nodes: CheckRollupContext[],
  totalCount: number | null = null
): PullRequestCheckRollup => ({
  state,
  contexts: {
    totalCount: totalCount ?? nodes.length,
    nodes,
  } satisfies CheckRollupContextConnection,
});

describe('Check Rollup presentation view', () => {
  test('shows nothing for a rollup with no contexts', () => {
    expect(toPullRequestChecksView(rollup('SUCCESS', []))).toEqual({
      isVisible: false,
      tone: 'success',
      passedCount: null,
      failedCount: null,
      totalCount: 0,
      isTruncated: false,
      summaryKind: 'passed',
      groups: [],
    });
    expect(toPullRequestChecksView(null).isVisible).toBe(false);
    expect(toPullRequestChecksView(undefined).isVisible).toBe(false);
    expect(toPullRequestChecksView({ state: 'PENDING' }).isVisible).toBe(false);
    expect(toPullRequestChecksView({ state: 'PENDING', contexts: null }).isVisible).toBe(false);
  });

  test('counts success, neutral, and skipped as passed', () => {
    // GitHub reports a skipped job as Success and does not block a merge on a
    // neutral conclusion, so all three count toward the passed numerator.
    const view = toPullRequestChecksView(
      rollup('SUCCESS', [
        checkRun('build', 'SUCCESS'),
        checkRun('lint', 'SUCCESS'),
        checkRun('typecheck', 'NEUTRAL'),
        checkRun('deploy-preview', 'SKIPPED'),
      ])
    );

    expect(view).toMatchObject({ isVisible: true, tone: 'success', passedCount: 4, totalCount: 4 });
    expect(view.groups.map((group) => group.kind)).toEqual(['success', 'neutral', 'skipped']);
    expect(view.groups[0]?.checks).toEqual([
      { key: 'build:0', name: 'build', appName: null, detailsUrl: null },
      { key: 'lint:1', name: 'lint', appName: null, detailsUrl: null },
    ]);
  });

  test('reads a neutral conclusion without breaking the green check', () => {
    // 8 success + 1 neutral yields rollup state SUCCESS.
    const nodes = [
      ...Array.from({ length: 8 }, (_, index) => checkRun(`suite-${index}`, 'SUCCESS')),
      checkRun('informational', 'NEUTRAL'),
    ];

    const view = toPullRequestChecksView(rollup('SUCCESS', nodes));

    expect(view.tone).toBe('success');
    expect(view.passedCount).toBe(9);
    expect(view.totalCount).toBe(9);
  });

  test('counts a skipped job as passed next to successes', () => {
    // 99 success + 1 skipped yields SUCCESS.
    const nodes = [
      ...Array.from({ length: 99 }, (_, index) => checkRun(`job-${index}`, 'SUCCESS')),
      checkRun('docs', 'SKIPPED'),
    ];

    const view = toPullRequestChecksView(rollup('SUCCESS', nodes));

    expect(view.tone).toBe('success');
    expect(view.passedCount).toBe(100);
  });

  test('reports danger when any check failed', () => {
    const view = toPullRequestChecksView(
      rollup('FAILURE', [
        checkRun('build', 'SUCCESS'),
        checkRun('test', 'FAILURE'),
        checkRun('deploy', 'SKIPPED'),
      ])
    );

    expect(view).toMatchObject({
      tone: 'danger',
      summaryKind: 'failed',
      passedCount: 2,
      failedCount: 1,
      totalCount: 3,
    });
    expect(view.groups.map((group) => group.kind)).toEqual(['failure', 'success', 'skipped']);
  });

  test('counts neutral and skipped as passed but never as failures', () => {
    const view = toPullRequestChecksView(
      rollup('SUCCESS', [checkRun('info', 'NEUTRAL'), checkRun('docs', 'SKIPPED')])
    );

    expect(view).toMatchObject({ passedCount: 2, failedCount: 0, totalCount: 2 });
  });

  test('leaves the failed count null so a truncated rollup cannot under-report', () => {
    const nodes = Array.from({ length: CHECK_ROLLUP_CONTEXT_LIMIT }, (_, index) =>
      checkRun(`job-${index}`, 'SUCCESS')
    );

    const view = toPullRequestChecksView(rollup('FAILURE', nodes, 148));

    expect(view).toMatchObject({ isTruncated: true, totalCount: 148 });
    expect(view.passedCount).toBeNull();
    expect(view.failedCount).toBeNull();
  });

  test('reports danger when the rollup state itself failed', () => {
    expect(toPullRequestChecksView(rollup('FAILURE', [checkRun('build', 'SUCCESS')])).tone).toBe(
      'danger'
    );
  });

  test('reports danger when the rollup state itself errored', () => {
    // A rollup that errored counts as a failure rather than silently green.
    expect(toPullRequestChecksView(rollup('ERROR', [checkRun('build', 'SUCCESS')])).tone).toBe(
      'danger'
    );
    expect(
      toPullRequestChecksView(rollup('ERROR', [checkRun('build', 'SUCCESS')])).summaryKind
    ).toBe('failed');
  });

  test('reports warning while checks are still running', () => {
    const view = toPullRequestChecksView(
      rollup('PENDING', [
        checkRun('build', 'SUCCESS'),
        checkRun('test', null, 'IN_PROGRESS'),
        checkRun('deploy', null, 'QUEUED'),
      ])
    );

    expect(view).toMatchObject({
      tone: 'warning',
      summaryKind: 'pending',
      passedCount: 1,
      totalCount: 3,
    });
    expect(view.groups.map((group) => group.kind)).toEqual(['pending', 'success']);
  });

  test('reports warning for a rollup still expected', () => {
    const view = toPullRequestChecksView(
      rollup('EXPECTED', [checkRun('build', null, 'REQUESTED')])
    );

    expect(view).toMatchObject({ tone: 'warning', summaryKind: 'pending' });
  });

  test('reads a check declared but not yet reported as in progress', () => {
    const view = toPullRequestChecksView(
      rollup('PENDING', [checkRun('required-check', null, null)])
    );

    expect(view.tone).toBe('warning');
    expect(view.groups[0]?.kind).toBe('pending');
    expect(view.groups[0]?.checks[0]?.name).toBe('required-check');
  });

  test('counts cancelled, timed out, startup failure, action required, and stale as failures', () => {
    const view = toPullRequestChecksView(
      rollup('FAILURE', [
        checkRun('cancelled', 'CANCELLED'),
        checkRun('timed-out', 'TIMED_OUT'),
        checkRun('startup-failure', 'STARTUP_FAILURE'),
        checkRun('action-required', 'ACTION_REQUIRED'),
        checkRun('stale', 'STALE'),
      ])
    );

    expect(view).toMatchObject({ tone: 'danger', passedCount: 0, totalCount: 5 });
    expect(view.groups).toHaveLength(1);
    expect(view.groups[0]?.kind).toBe('failure');
    expect(view.groups[0]?.checks.map((check) => check.name)).toEqual([
      'cancelled',
      'timed-out',
      'startup-failure',
      'action-required',
      'stale',
    ]);
  });

  test('counts an unknown conclusion as a failure so nothing falls through unhandled', () => {
    const view = toPullRequestChecksView(rollup('SUCCESS', [checkRun('mystery', 'WHATEVER')]));

    expect(view.tone).toBe('danger');
    expect(view.groups[0]?.kind).toBe('failure');
  });

  test('counts a legacy commit status through its state conclusion', () => {
    // Legacy commit statuses carry their outcome on the context itself.
    const view = toPullRequestChecksView(
      rollup('SUCCESS', [
        { __typename: 'StatusContext', name: 'ci/legacy', conclusion: 'SUCCESS' },
        { __typename: 'StatusContext', name: 'ci/legacy-pending', conclusion: 'PENDING' },
        { __typename: 'StatusContext', name: 'ci/legacy-failing', conclusion: 'FAILURE' },
      ])
    );

    expect(view).toMatchObject({ tone: 'danger', passedCount: 1, totalCount: 3 });
    expect(view.groups.map((group) => group.kind)).toEqual(['failure', 'pending', 'success']);
  });

  test('orders groups failure, pending, success, neutral, skipped', () => {
    expect(CHECK_OUTCOME_GROUP_ORDER).toEqual([
      'failure',
      'pending',
      'success',
      'neutral',
      'skipped',
    ]);

    const view = toPullRequestChecksView(
      rollup('FAILURE', [
        checkRun('skipped-job', 'SKIPPED'),
        checkRun('informational', 'NEUTRAL'),
        checkRun('build', 'SUCCESS'),
        checkRun('test', null, 'IN_PROGRESS'),
        checkRun('e2e', 'FAILURE'),
      ])
    );

    expect(view.groups.map((group) => group.kind)).toEqual(CHECK_OUTCOME_GROUP_ORDER);
    expect(view.groups.every((group) => group.checks.length > 0)).toBe(true);
  });

  test('keeps checks from the same app adjacent inside a group', () => {
    const view = toPullRequestChecksView(
      rollup('FAILURE', [
        checkRun('build', 'FAILURE', 'COMPLETED', 'GitHub Actions'),
        checkRun('deploy', 'FAILURE', 'COMPLETED', 'Netlify'),
        checkRun('test', 'FAILURE', 'COMPLETED', 'GitHub Actions'),
      ])
    );

    expect(view.groups[0]?.checks.map((check) => check.appName)).toEqual([
      'GitHub Actions',
      'GitHub Actions',
      'Netlify',
    ]);
  });

  test('keeps checks with no app adjacent and last inside a group', () => {
    const view = toPullRequestChecksView(
      rollup('FAILURE', [
        checkRun('no-app', 'FAILURE', 'COMPLETED', null),
        checkRun('actions', 'FAILURE', 'COMPLETED', 'GitHub Actions'),
        checkRun('other-no-app', 'FAILURE', 'COMPLETED', ''),
      ])
    );

    expect(view.groups[0]?.checks.map((check) => check.name)).toEqual([
      'actions',
      'no-app',
      'other-no-app',
    ]);
  });

  test('reads the app behind a check for links and legacy statuses', () => {
    const view = toPullRequestChecksView(
      rollup('FAILURE', [
        checkRun(
          'build',
          'FAILURE',
          'COMPLETED',
          'GitHub Actions',
          'https://github.com/acme/run/1'
        ),
        {
          __typename: 'StatusContext',
          name: 'legacy',
          conclusion: 'FAILURE',
          creator: { login: 'old-bot' },
        },
      ])
    );

    expect(view.groups[0]?.checks).toEqual([
      {
        key: 'build:0',
        name: 'build',
        appName: 'GitHub Actions',
        detailsUrl: 'https://github.com/acme/run/1',
      },
      { key: 'legacy:1', name: 'legacy', appName: 'old-bot', detailsUrl: null },
    ]);
  });

  test('drops unnamed contexts instead of rendering a blank row', () => {
    const view = toPullRequestChecksView(
      rollup('SUCCESS', [checkRun('   ', 'SUCCESS'), checkRun('build', 'SUCCESS')])
    );

    expect(view.totalCount).toBe(2);
    expect(view.groups[0]?.checks).toHaveLength(1);
    expect(view.groups[0]?.checks[0]?.name).toBe('build');
  });

  test('hides the passed fraction when the rollup reports more contexts than were fetched', () => {
    const nodes = Array.from({ length: CHECK_ROLLUP_CONTEXT_LIMIT }, (_, index) =>
      checkRun(`job-${index}`, 'SUCCESS')
    );

    const view = toPullRequestChecksView(rollup('SUCCESS', nodes, 148));

    expect(view).toMatchObject({
      isVisible: true,
      tone: 'success',
      isTruncated: true,
      totalCount: 148,
    });
    expect(view.passedCount).toBeNull();
  });

  test('shows the passed fraction at exactly the rollup context limit', () => {
    const nodes = Array.from({ length: CHECK_ROLLUP_CONTEXT_LIMIT }, (_, index) =>
      checkRun(`job-${index}`, 'SUCCESS')
    );

    const view = toPullRequestChecksView(rollup('SUCCESS', nodes));

    expect(view.isTruncated).toBe(false);
    expect(view.passedCount).toBe(CHECK_ROLLUP_CONTEXT_LIMIT);
    expect(view.totalCount).toBe(CHECK_ROLLUP_CONTEXT_LIMIT);
  });

  test('keeps the rollup total when contexts were not fetched at all', () => {
    const view = toPullRequestChecksView({
      state: 'FAILURE',
      contexts: { totalCount: 12, nodes: [] },
    });

    expect(view).toMatchObject({
      isVisible: true,
      tone: 'danger',
      totalCount: 12,
      passedCount: null,
    });
    expect(view.isTruncated).toBe(true);
  });

  test('ignores null and malformed context nodes', () => {
    const view = toPullRequestChecksView({
      state: 'SUCCESS',
      contexts: { totalCount: 3, nodes: [null, checkRun('build', 'SUCCESS'), null] },
    });

    expect(view.totalCount).toBe(3);
    expect(view.groups[0]?.checks).toHaveLength(1);
  });

  test('gives every context a stable key so list rendering cannot collide', () => {
    const view = toPullRequestChecksView(
      rollup('SUCCESS', [checkRun('build', 'SUCCESS'), checkRun('build', 'SUCCESS')])
    );

    const keys = view.groups[0]?.checks.map((check) => check.key);
    expect(new Set(keys).size).toBe(2);
  });
});

describe('reading a Check Rollup off a list item', () => {
  test('returns the rollup when the item carries one', () => {
    const value = { checkRollup: rollup('SUCCESS', [checkRun('build', 'SUCCESS')]) };

    expect(readPullRequestCheckRollup(value)).toBe(value.checkRollup);
  });

  test('returns null for items without a rollup', () => {
    expect(readPullRequestCheckRollup({})).toBeNull();
    expect(readPullRequestCheckRollup(null)).toBeNull();
    expect(readPullRequestCheckRollup('rollup')).toBeNull();
    expect(readPullRequestCheckRollup({ checkRollup: 'nope' })).toBeNull();
  });
});
