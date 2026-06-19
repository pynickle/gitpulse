import { describe, expect, test } from 'bun:test';

import { defaultUserSettingsStorageBase } from '../shared/utils/user-settings-storage-env';

describe('user settings storage env', () => {
  test('uses the shared settings namespace for redis by default', () => {
    expect(defaultUserSettingsStorageBase('redis')).toBe('gitpulse:user-settings');
  });
});
