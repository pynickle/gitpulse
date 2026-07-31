import { describe, expect, test } from 'bun:test';

import {
  GitMergeIcon,
  GitPullRequestClosedIcon,
  GitPullRequestDraftIcon,
  GitPullRequestIcon,
} from '@lucide/vue';

import getPullRequestStateVisual, {
  getPullRequestStateIcon,
  resolvePullRequestDisplayState,
} from '../app/utils/getPullRequestStateVisual';

describe('resolvePullRequestDisplayState', () => {
  test('prefers merged over every other signal', () => {
    expect(
      resolvePullRequestDisplayState({
        state: 'closed',
        merged: true,
        draft: true,
      })
    ).toBe('merged');

    expect(
      resolvePullRequestDisplayState({
        state: 'open',
        merged_at: '2024-01-01T00:00:00Z',
        draft: true,
      })
    ).toBe('merged');
  });

  test('prefers closed over draft', () => {
    expect(
      resolvePullRequestDisplayState({
        state: 'closed',
        draft: true,
      })
    ).toBe('closed');
  });

  test('treats open draft as draft', () => {
    expect(
      resolvePullRequestDisplayState({
        state: 'open',
        draft: true,
      })
    ).toBe('draft');

    // Missing state with draft still surfaces as draft (open-by-default).
    expect(resolvePullRequestDisplayState({ draft: true })).toBe('draft');
  });

  test('returns open for non-draft open pulls', () => {
    expect(resolvePullRequestDisplayState({ state: 'open' })).toBe('open');
    expect(resolvePullRequestDisplayState({ state: 'open', draft: false })).toBe('open');
  });

  test('defaults nullish input to closed', () => {
    expect(resolvePullRequestDisplayState(null)).toBe('closed');
    expect(resolvePullRequestDisplayState(undefined)).toBe('closed');
    expect(resolvePullRequestDisplayState({})).toBe('open');
  });
});

describe('getPullRequestStateVisual', () => {
  test('maps each state to the expected lucide icon', () => {
    expect(getPullRequestStateIcon({ state: 'open' })).toBe(GitPullRequestIcon);
    expect(getPullRequestStateIcon({ state: 'open', draft: true })).toBe(GitPullRequestDraftIcon);
    expect(getPullRequestStateIcon({ merged: true })).toBe(GitMergeIcon);
    expect(getPullRequestStateIcon({ state: 'closed' })).toBe(GitPullRequestClosedIcon);
  });

  test('returns icon + color together', () => {
    expect(getPullRequestStateVisual({ state: 'open', draft: true })).toMatchObject({
      state: 'draft',
      icon: GitPullRequestDraftIcon,
      color: 'var(--gitpulse-text-muted)',
    });
  });
});
