import { describe, expect, test } from 'bun:test';

import type { NavigationEntry } from '../app/composables/useNavigationHistory';
import {
  applyLogicalNavigationEvent,
  createLogicalNavigationState,
} from '../app/utils/navigationEntryRouting';
import shouldCloseReviewWorkspaceAfterSubmit from '../app/utils/prReviewNavigation';

const targetPullRequest = {
  owner: 'acme',
  repo: 'widget',
  pullNumber: 42,
} as const;

describe('PR review workspace submit navigation', () => {
  test('returns to PR details when previous history entry is the matching PR detail route', () => {
    const previousEntry: NavigationEntry = {
      type: 'pull-request',
      data: {
        owner: 'acme',
        repo: 'widget',
        number: 42,
        tab: 'pulls',
      },
    };

    expect(
      shouldCloseReviewWorkspaceAfterSubmit({
        previousEntry,
        ...targetPullRequest,
      })
    ).toBe(true);
  });

  test('does not force PR details when previous history entry is missing or not matching', () => {
    const entries: ReadonlyArray<NavigationEntry | null> = [
      null,
      { type: 'dashboard' },
      {
        type: 'pull-request',
        data: {
          owner: 'acme',
          repo: 'widget',
          number: 41,
          tab: 'pulls',
        },
      },
      {
        type: 'pull-request-review',
        data: {
          owner: 'acme',
          repo: 'widget',
          number: 42,
          tab: 'pulls',
        },
      },
      {
        type: 'repository',
        data: {
          owner: 'acme',
          repo: 'widget',
        },
      },
    ];

    for (const previousEntry of entries) {
      expect(
        shouldCloseReviewWorkspaceAfterSubmit({
          previousEntry,
          ...targetPullRequest,
        })
      ).toBe(false);
    }
  });

  test('reads the matching PR from a dashboard → PR → review sequence', () => {
    let result = applyLogicalNavigationEvent(createLogicalNavigationState(), {
      type: 'route',
      route: { path: '/dashboard', query: { tab: 'pulls' } },
      position: 0,
    });
    result = applyLogicalNavigationEvent(result.state, {
      type: 'route',
      route: { path: '/dashboard', query: { tab: 'pulls', pr: 'acme/widget/42' } },
      position: 1,
    });
    result = applyLogicalNavigationEvent(result.state, {
      type: 'route',
      route: { path: '/dashboard', query: { tab: 'pulls', prReview: 'acme/widget/42' } },
      position: 2,
    });

    expect(
      shouldCloseReviewWorkspaceAfterSubmit({
        previousEntry: result.snapshot.previousEntry,
        ...targetPullRequest,
      })
    ).toBe(true);
  });
});
