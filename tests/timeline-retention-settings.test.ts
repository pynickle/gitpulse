import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

import { createError } from 'h3';

import * as validation from '../server/utils/zod-validation-utils';
import {
  createDefaultUserSettings,
  mergeUserSettingsPatch,
  normalizeUserSettings,
} from '../shared/utils/user-settings';
mock.module('#server/utils/zod-validation-utils', () => validation);
for (const [alias, path] of [
  ['#shared/types/custom-search', '../shared/types/custom-search'],
  ['#shared/types/tab-groups', '../shared/types/tab-groups'],
  ['#shared/types/release-follows', '../shared/types/release-follows'],
  ['#shared/types/user-settings', '../shared/types/user-settings'],
  ['#shared/utils/user-settings', '../shared/utils/user-settings'],
] as const) {
  const module = await import(path);
  mock.module(alias, () => module);
}
const { parseUserSettingsPatchBody } =
  await import('../server/utils/user-settings-validation-utils');
const previousCreateError = globalThis.createError;
beforeEach(() => {
  globalThis.createError = createError;
});
afterEach(() => {
  globalThis.createError = previousCreateError;
});

describe('account publication-time retention preference', () => {
  test('defaults existing accounts to 30 days and preserves unrelated settings', () => {
    const initial = createDefaultUserSettings();
    expect(initial.releaseTimeline.retentionDays).toBe(30);
    const changed = mergeUserSettingsPatch(initial, { releaseTimeline: { retentionDays: 90 } });
    expect(changed.releaseTimeline).toEqual({ showReactions: true, retentionDays: 90 });
    expect(changed.fonts).toEqual(initial.fonts);
    expect(
      normalizeUserSettings({ releaseTimeline: { showReactions: false } }).releaseTimeline
    ).toEqual({ showReactions: false, retentionDays: 30 });
  });

  test.each([1, 30, 90])('accepts %s whole days', (retentionDays) => {
    expect(parseUserSettingsPatchBody({ releaseTimeline: { retentionDays } })).toEqual({
      releaseTimeline: { retentionDays },
    });
  });

  test.each([0, 91, 1.5, '30', null])('rejects invalid retention %s', (retentionDays) => {
    expect(() => parseUserSettingsPatchBody({ releaseTimeline: { retentionDays } })).toThrow(
      'Invalid settings request body'
    );
  });
});
