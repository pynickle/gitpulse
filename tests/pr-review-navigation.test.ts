import { describe, expect, test } from 'bun:test';

import { ref, type Ref } from 'vue';

import type { NavigationEntry } from '../app/composables/useNavigationHistory';
import { useNavigationHistory } from '../app/composables/useNavigationHistory';
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

  test('collapses the review entry while keeping the dashboard to PR path', () => {
    const state = new Map<string, Ref<unknown>>();
    const originalUseState = globalThis.useState;

    globalThis.useState = ((key: string, init: () => unknown) => {
      if (!state.has(key)) {
        state.set(key, ref(init()));
      }

      return state.get(key);
    }) as typeof globalThis.useState;

    try {
      const navigation = useNavigationHistory();

      const pullRequestEntry: NavigationEntry = {
        type: 'pull-request',
        data: { owner: 'acme', repo: 'widget', number: 42, tab: 'pulls' },
      };

      // Route-derived flow: dashboard tab -> PR detail -> PR review.
      navigation.applyRouteChange({ type: 'dashboard', data: { tab: 'pulls' } }, { kind: 'reset' });
      navigation.applyRouteChange(pullRequestEntry, { kind: 'push' });
      navigation.applyRouteChange(
        {
          type: 'pull-request-review',
          data: { owner: 'acme', repo: 'widget', number: 42, tab: 'pulls' },
        },
        { kind: 'push' }
      );

      expect(
        shouldCloseReviewWorkspaceAfterSubmit({
          previousEntry: navigation.previousEntry.value,
          ...targetPullRequest,
        })
      ).toBe(true);

      // Closing the review navigates to ?pr=; the review entry collapses onto
      // the pull request without leaving a duplicate on the stack.
      navigation.applyRouteChange(pullRequestEntry, { kind: 'push' });

      expect(navigation.navigationHistory.value).toEqual([
        { type: 'dashboard', data: { tab: 'pulls' } },
      ]);
      expect(navigation.currentEntry.value).toEqual(pullRequestEntry);
    } finally {
      globalThis.useState = originalUseState;
    }
  });
});
