import { describe, expect, test } from 'bun:test';

import shouldOpenReleaseDrawer from '../app/utils/shouldOpenReleaseDrawer';

const host = (
  ignored: boolean,
  parent: { closest: (selector: string) => unknown } | null = null
) => {
  const node = {
    ignored,
    parent,
    closest(selector: string) {
      if (selector.includes('data-release-drawer-ignore') && this.ignored) {
        return this;
      }
      return this.parent?.closest(selector) ?? null;
    },
  };
  return node;
};

describe('shouldOpenReleaseDrawer', () => {
  test('opens for a click on the remaining card area', () => {
    expect(shouldOpenReleaseDrawer(host(false))).toBe(true);
  });

  test('does not open for a click on an ignored control', () => {
    expect(shouldOpenReleaseDrawer(host(true))).toBe(false);
  });

  test('does not open for a click nested inside an ignored control', () => {
    const repoName = host(true);
    const inner = host(false, repoName);
    expect(shouldOpenReleaseDrawer(inner)).toBe(false);
  });

  test('opens for a text node whose parent is not ignored', () => {
    expect(
      shouldOpenReleaseDrawer({
        parentElement: host(false),
      })
    ).toBe(true);
  });

  test('does not open for a text node inside an ignored control', () => {
    expect(
      shouldOpenReleaseDrawer({
        parentElement: host(true),
      })
    ).toBe(false);
  });

  test('does not open when the click target is missing', () => {
    expect(shouldOpenReleaseDrawer(null)).toBe(false);
  });
});
