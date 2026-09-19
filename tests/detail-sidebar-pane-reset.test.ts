import { describe, expect, test } from 'bun:test';

import resolveDetailSidebarHiddenState from '../app/utils/resolveDetailSidebarHiddenState';
import resolveDetailSidebarSheetOpen from '../app/utils/resolveDetailSidebarSheetOpen';

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

  test('the mobile sheet default starts panes hidden instead of expanded', () => {
    expect(resolveDetailSidebarHiddenState(null, 'issue:issue-o-r-1', false, true)).toBe(true);
    expect(
      resolveDetailSidebarHiddenState('issue:issue-o-r-1', 'issue:issue-o-r-2', false, true)
    ).toBe(true);
    expect(resolveDetailSidebarHiddenState('issue:issue-o-r-1', null, false, true)).toBe(true);
    expect(resolveDetailSidebarHiddenState(null, null, false, true)).toBe(true);
  });

  test('the mobile sheet default keeps an explicit choice on the same pane', () => {
    expect(
      resolveDetailSidebarHiddenState('issue:issue-o-r-1', 'issue:issue-o-r-1', false, true)
    ).toBe(false);
    expect(
      resolveDetailSidebarHiddenState('issue:issue-o-r-1', 'issue:issue-o-r-1', true, true)
    ).toBe(true);
  });
});

describe('resolveDetailSidebarSheetOpen', () => {
  test('opens only in the sheet viewport with a sidebar pane and expanded state', () => {
    expect(resolveDetailSidebarSheetOpen(true, true, false)).toBe(true);
  });

  test('a hidden sidebar is a closed sheet', () => {
    expect(resolveDetailSidebarSheetOpen(true, true, true)).toBe(false);
  });

  test('never opens on the desktop viewport', () => {
    expect(resolveDetailSidebarSheetOpen(true, false, false)).toBe(false);
    expect(resolveDetailSidebarSheetOpen(true, false, true)).toBe(false);
  });

  test('never opens for panes without a Detail Sidebar', () => {
    expect(resolveDetailSidebarSheetOpen(false, true, false)).toBe(false);
  });
});
