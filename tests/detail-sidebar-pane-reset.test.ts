import { describe, expect, test } from 'bun:test';

import resolveDetailSidebarHiddenState from '../app/utils/resolveDetailSidebarHiddenState';

describe('resolveDetailSidebarHiddenState', () => {
  test('first open resolves to expanded even when the flag is currently hidden', () => {
    expect(resolveDetailSidebarHiddenState(null, 'pull-request:pr-o-r-1', true)).toBe(false);
    expect(resolveDetailSidebarHiddenState(null, 'pull-request:pr-o-r-1', false)).toBe(false);
  });

  test('re-entering the same pane keeps the current state (return from review)', () => {
    expect(
      resolveDetailSidebarHiddenState('pull-request:pr-o-r-1', 'pull-request:pr-o-r-1', true)
    ).toBe(true);
    expect(
      resolveDetailSidebarHiddenState('pull-request:pr-o-r-1', 'pull-request:pr-o-r-1', false)
    ).toBe(false);
  });

  test('entering a different pane resolves to expanded', () => {
    expect(
      resolveDetailSidebarHiddenState('pull-request:pr-o-r-1', 'issue:issue-o-r-2', true)
    ).toBe(false);
    expect(
      resolveDetailSidebarHiddenState('pull-request:pr-o-r-1', 'pull-request:pr-o-r-9', true)
    ).toBe(false);
  });

  test('a closed overlay resolves to expanded so the next open starts expanded', () => {
    expect(resolveDetailSidebarHiddenState('pull-request:pr-o-r-1', null, true)).toBe(false);
    expect(resolveDetailSidebarHiddenState(null, null, true)).toBe(false);
  });
});
