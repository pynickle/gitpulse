import { describe, expect, test } from 'bun:test';

import { createNotificationSubjectEnrichmentSession } from '../app/composables/notification-subject-enrichment/session';
import parseGitHubNotificationSubjectTarget from '../app/utils/parseGitHubNotificationSubjectTarget';
import type { DashboardNotification } from '../shared/types/notifications';
import { InMemoryNotificationSubjectEnrichmentAdapter } from './support/inMemoryNotificationSubjectEnrichmentAdapter';

const notification = (
  id: string,
  type: string,
  url: string,
  subject: DashboardNotification['subject'] = {}
): DashboardNotification => ({
  id,
  subject: {
    title: `Notification ${id}`,
    type,
    url,
    ...subject,
  },
});

describe('Notification Subject Enrichment', () => {
  test('returns pending and unavailable Notifications immediately without losing old data', () => {
    const input = [
      notification('issue', 'Issue', 'https://api.github.com/repos/acme/widgets/issues/1', {
        title: 'Last-known title',
        state: 'closed',
        stateStatus: 'loaded',
        authorLogin: 'octocat',
      }),
      notification('pull', 'PullRequest', 'https://api.github.com/repos/acme/widgets/pulls/2'),
      notification('discussion', 'Discussion', 'https://github.com/acme/widgets/discussions/3'),
      notification('release', 'Release', 'https://api.github.com/repos/acme/widgets/releases/4'),
      notification('malformed', 'Issue', 'https://example.com/acme/widgets/issues/5'),
      notification(
        'unsupported',
        'Commit',
        'https://api.github.com/repos/acme/widgets/commits/abc'
      ),
    ];
    const original = structuredClone(input);
    const adapter = new InMemoryNotificationSubjectEnrichmentAdapter();
    const session = createNotificationSubjectEnrichmentSession({
      adapter,
      parseSubject: parseGitHubNotificationSubjectTarget,
    });

    const run = session.start(input);

    expect(run.notifications.map((item) => item.id)).toEqual(input.map((item) => item.id));
    expect(run.notifications).toHaveLength(input.length);
    expect(run.notifications.map((item) => item.subject?.stateStatus)).toEqual([
      'pending',
      'pending',
      'pending',
      'unavailable',
      'unavailable',
      'unavailable',
    ]);
    expect(run.notifications[0]?.subject).toMatchObject({
      title: 'Last-known title',
      state: 'closed',
      authorLogin: 'octocat',
      stateStatus: 'pending',
      number: 1,
    });
    expect(run.notifications[3]?.subject).toMatchObject({
      stateStatus: 'unavailable',
      number: 4,
    });
    expect(input).toEqual(original);
    expect(run.notifications).not.toBe(input);
  });

  test('loads all supported fields onto every Notification for a deduplicated target', async () => {
    const input = [
      notification('first', 'Issue', 'https://api.github.com/repos/acme/widgets/issues/7'),
      notification('second', 'Issue', 'https://github.com/acme/widgets/issues/7'),
    ];
    const adapter = new InMemoryNotificationSubjectEnrichmentAdapter((targets) => {
      if (new Set(targets.map((target) => target.key)).size !== targets.length) {
        throw new Error('Duplicate targets are not accepted');
      }

      return [
        {
          key: 'acme/widgets/issues/7',
          title: 'Current title',
          updatedAt: '2026-08-12T01:02:03.000Z',
          state: 'closed',
          issueType: { name: 'Bug', color: 'ff0000' },
          labels: [{ name: 'priority', color: '008800' }],
          comments: 17,
          authorLogin: 'maintainer',
          authorAvatarUrl: 'https://avatars.githubusercontent.com/u/7?v=4',
        },
      ];
    });
    const session = createNotificationSubjectEnrichmentSession({
      adapter,
      parseSubject: parseGitHubNotificationSubjectTarget,
    });

    const outcome = await session.start(input).completion;

    expect(outcome.outcome).toBe('complete');
    if (outcome.outcome === 'stale') throw new Error('Expected applicable Notifications');
    expect(outcome.notifications).toHaveLength(2);
    for (const item of outcome.notifications) {
      expect(item.subject).toEqual({
        title: 'Current title',
        type: 'Issue',
        url:
          item.id === 'first'
            ? 'https://api.github.com/repos/acme/widgets/issues/7'
            : 'https://github.com/acme/widgets/issues/7',
        number: 7,
        state: 'closed',
        draft: undefined,
        isAnswered: undefined,
        stateStatus: 'loaded',
        issueType: { name: 'Bug', color: 'ff0000' },
        labels: [{ name: 'priority', color: '008800' }],
        comments: 17,
        authorLogin: 'maintainer',
        authorAvatarUrl: 'https://avatars.githubusercontent.com/u/7?v=4',
      });
      expect(item.updated_at).toBe('2026-08-12T01:02:03.000Z');
    }
  });

  test('applies pull request draft and discussion answer state', async () => {
    const adapter = new InMemoryNotificationSubjectEnrichmentAdapter(() => [
      {
        key: 'acme/widgets/pulls/2',
        title: 'Draft pull request',
        state: 'open',
        draft: true,
      },
      {
        key: 'acme/widgets/discussions/3',
        title: 'Answered discussion',
        isAnswered: true,
      },
    ]);
    const session = createNotificationSubjectEnrichmentSession({
      adapter,
      parseSubject: parseGitHubNotificationSubjectTarget,
    });
    const input = [
      notification('pull', 'PullRequest', 'https://api.github.com/repos/acme/widgets/pulls/2'),
      notification('discussion', 'Discussion', 'https://github.com/acme/widgets/discussions/3'),
    ];

    const outcome = await session.start(input).completion;

    expect(outcome.outcome).toBe('complete');
    if (outcome.outcome === 'stale') throw new Error('Expected applicable Notifications');
    expect(outcome.notifications[0]?.subject).toMatchObject({
      state: 'open',
      draft: true,
      stateStatus: 'loaded',
    });
    expect(outcome.notifications[1]?.subject).toMatchObject({
      isAnswered: true,
      stateStatus: 'loaded',
    });
  });

  test('loads more targets than one adapter batch accepts', async () => {
    const input = Array.from({ length: 51 }, (_, index) => {
      const number = index + 1;
      return notification(
        `issue-${number}`,
        'Issue',
        `https://api.github.com/repos/acme/widgets/issues/${number}`
      );
    });
    const adapter = new InMemoryNotificationSubjectEnrichmentAdapter((targets) => {
      return targets.map((target) => ({
        key: target.key,
        title: `Loaded ${target.number}`,
        state: 'open',
      }));
    });
    const session = createNotificationSubjectEnrichmentSession({
      adapter,
      parseSubject: parseGitHubNotificationSubjectTarget,
    });

    const outcome = await session.start(input).completion;

    expect(outcome.outcome).toBe('complete');
    if (outcome.outcome === 'stale') throw new Error('Expected applicable Notifications');
    expect(outcome.notifications).toHaveLength(51);
    expect(outcome.notifications[0]?.subject).toMatchObject({
      title: 'Loaded 1',
      stateStatus: 'loaded',
    });
    expect(outcome.notifications[50]?.subject).toMatchObject({
      title: 'Loaded 51',
      stateStatus: 'loaded',
    });
  });

  test('keeps successful targets when chunks, missing results, and invalid results fail', async () => {
    const input = Array.from({ length: 52 }, (_, index) => {
      const number = index + 1;
      return notification(
        `issue-${number}`,
        'Issue',
        `https://api.github.com/repos/acme/widgets/issues/${number}`,
        number === 51
          ? {
              title: 'Last-known 51',
              state: 'closed',
              stateStatus: 'loaded',
              authorLogin: 'previous-author',
            }
          : {}
      );
    });
    const adapter = new InMemoryNotificationSubjectEnrichmentAdapter((targets) => {
      if (targets.some((target) => target.number === 51)) {
        throw new Error('Simulated chunk failure');
      }

      return targets
        .filter((target) => target.number !== 2)
        .map((target) =>
          target.number === 3
            ? { key: target.key, title: 'Missing state' }
            : { key: target.key, title: `Loaded ${target.number}`, state: 'open' }
        );
    });
    const session = createNotificationSubjectEnrichmentSession({
      adapter,
      parseSubject: parseGitHubNotificationSubjectTarget,
    });

    const outcome = await session.start(input).completion;

    expect(outcome.outcome).toBe('partial');
    if (outcome.outcome === 'stale') throw new Error('Expected applicable Notifications');
    expect(outcome.notifications[0]?.subject).toMatchObject({
      title: 'Loaded 1',
      stateStatus: 'loaded',
    });
    expect(outcome.notifications[1]?.subject?.stateStatus).toBe('error');
    expect(outcome.notifications[2]?.subject?.stateStatus).toBe('error');
    expect(outcome.notifications[50]?.subject).toMatchObject({
      title: 'Last-known 51',
      state: 'closed',
      authorLogin: 'previous-author',
      stateStatus: 'error',
    });
    expect(outcome.notifications[51]?.subject?.stateStatus).toBe('error');
  });

  test('resolves complete adapter failure and preserves last-known metadata', async () => {
    const input = [
      notification('issue', 'Issue', 'https://api.github.com/repos/acme/widgets/issues/9', {
        title: 'Last-known title',
        state: 'open',
        stateStatus: 'loaded',
        labels: [{ name: 'saved', color: '123456' }],
        comments: 8,
      }),
    ];
    const adapter = new InMemoryNotificationSubjectEnrichmentAdapter(() => {
      throw new Error('Transport details must not escape');
    });
    const session = createNotificationSubjectEnrichmentSession({
      adapter,
      parseSubject: parseGitHubNotificationSubjectTarget,
    });

    const outcome = await session.start(input).completion;

    expect(outcome.outcome).toBe('failed');
    if (outcome.outcome === 'stale') throw new Error('Expected applicable Notifications');
    expect(outcome.notifications[0]?.subject).toMatchObject({
      title: 'Last-known title',
      state: 'open',
      labels: [{ name: 'saved', color: '123456' }],
      comments: 8,
      stateStatus: 'error',
    });
  });

  test('returns no applicable Notifications when an older run completes last', async () => {
    const adapter = new InMemoryNotificationSubjectEnrichmentAdapter();
    const session = createNotificationSubjectEnrichmentSession({
      adapter,
      parseSubject: parseGitHubNotificationSubjectTarget,
    });
    const firstRun = session.start([
      notification('first', 'Issue', 'https://api.github.com/repos/acme/widgets/issues/10'),
    ]);
    await Promise.resolve();
    const secondRun = session.start([
      notification('second', 'Issue', 'https://api.github.com/repos/acme/widgets/issues/11'),
    ]);
    await Promise.resolve();

    adapter.pending[1]?.resolve([
      {
        key: 'acme/widgets/issues/11',
        title: 'Newer result',
        state: 'open',
      },
    ]);
    const secondOutcome = await secondRun.completion;
    adapter.pending[0]?.resolve([
      {
        key: 'acme/widgets/issues/10',
        title: 'Older result',
        state: 'closed',
      },
    ]);
    const firstOutcome = await firstRun.completion;

    expect(secondOutcome.outcome).toBe('complete');
    if (secondOutcome.outcome === 'stale') throw new Error('Expected applicable Notifications');
    expect(secondOutcome.notifications[0]?.subject?.title).toBe('Newer result');
    expect(firstOutcome).toEqual({ outcome: 'stale' });
  });

  test('keeps parallel chunks in one run current when they complete out of order', async () => {
    const input = Array.from({ length: 51 }, (_, index) => {
      const number = index + 1;
      return notification(
        `issue-${number}`,
        'Issue',
        `https://api.github.com/repos/acme/widgets/issues/${number}`
      );
    });
    const adapter = new InMemoryNotificationSubjectEnrichmentAdapter();
    const session = createNotificationSubjectEnrichmentSession({
      adapter,
      parseSubject: parseGitHubNotificationSubjectTarget,
    });
    const run = session.start(input);
    await Promise.resolve();
    let completed = false;
    void run.completion.then(() => {
      completed = true;
    });

    const secondChunk = adapter.pending[1];
    secondChunk?.resolve(
      secondChunk.targets.map((target) => ({
        key: target.key,
        title: `Loaded ${target.number}`,
        state: 'open',
      }))
    );
    await Promise.resolve();
    expect(completed).toBe(false);

    const firstChunk = adapter.pending[0];
    firstChunk?.resolve(
      firstChunk.targets.map((target) => ({
        key: target.key,
        title: `Loaded ${target.number}`,
        state: 'open',
      }))
    );
    const outcome = await run.completion;

    expect(outcome.outcome).toBe('complete');
    if (outcome.outcome === 'stale') throw new Error('Expected applicable Notifications');
    expect(outcome.notifications.every((item) => item.subject?.stateStatus === 'loaded')).toBe(
      true
    );
  });

  test('loads the same target again on a later run', async () => {
    const adapter = new InMemoryNotificationSubjectEnrichmentAdapter((targets, requestIndex) => {
      return targets.map((target) => ({
        key: target.key,
        title: `Version ${requestIndex + 1}`,
        state: 'open',
      }));
    });
    const session = createNotificationSubjectEnrichmentSession({
      adapter,
      parseSubject: parseGitHubNotificationSubjectTarget,
    });
    const input = [
      notification('issue', 'Issue', 'https://api.github.com/repos/acme/widgets/issues/12'),
    ];

    const firstOutcome = await session.start(input).completion;
    const secondOutcome = await session.start(input).completion;

    if (firstOutcome.outcome === 'stale' || secondOutcome.outcome === 'stale') {
      throw new Error('Expected applicable Notifications');
    }
    expect(firstOutcome.notifications[0]?.subject?.title).toBe('Version 1');
    expect(secondOutcome.notifications[0]?.subject?.title).toBe('Version 2');
  });

  test('does not call the adapter when every subject is unavailable', async () => {
    const adapter = new InMemoryNotificationSubjectEnrichmentAdapter(() => {
      throw new Error('Unavailable subjects must not be requested');
    });
    const session = createNotificationSubjectEnrichmentSession({
      adapter,
      parseSubject: parseGitHubNotificationSubjectTarget,
    });
    const input = [
      notification('release', 'Release', 'https://api.github.com/repos/acme/widgets/releases/13'),
      notification('malformed', 'Issue', 'not-a-url'),
    ];

    const outcome = await session.start(input).completion;

    expect(outcome.outcome).toBe('not-needed');
    if (outcome.outcome === 'stale') throw new Error('Expected applicable Notifications');
    expect(outcome.notifications.map((item) => item.subject?.stateStatus)).toEqual([
      'unavailable',
      'unavailable',
    ]);
  });
});
