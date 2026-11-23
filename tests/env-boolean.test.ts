import { describe, expect, test } from 'bun:test';

import { normalizeEnvBoolean } from '../shared/utils/env-boolean';

describe('normalizeEnvBoolean', () => {
  test('accepts the long and short spellings of yes and no', () => {
    for (const value of ['1', 'true', 'TRUE', 'yes', 'on', ' Yes ']) {
      expect(normalizeEnvBoolean(value, false)).toBe(true);
    }
    for (const value of ['0', 'false', 'FALSE', 'no', 'off', ' No ']) {
      expect(normalizeEnvBoolean(value, true)).toBe(false);
    }
  });

  test('keeps the default for a blank, missing, or unrecognized value', () => {
    for (const value of [undefined, null, '', '   ', 'maybe', '2', 0, 1, {}, []]) {
      expect(normalizeEnvBoolean(value, true)).toBe(true);
      expect(normalizeEnvBoolean(value, false)).toBe(false);
    }
  });

  test('passes a boolean through unchanged', () => {
    expect(normalizeEnvBoolean(true, false)).toBe(true);
    expect(normalizeEnvBoolean(false, true)).toBe(false);
  });
});
