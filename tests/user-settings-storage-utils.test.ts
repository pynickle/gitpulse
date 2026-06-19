import { afterEach, describe, expect, mock, test } from 'bun:test';

import { createDefaultUserSettings } from '../shared/utils/user-settings';
import * as userSettingsStorageEnv from '../shared/utils/user-settings-storage-env';

mock.module('#shared/utils/user-settings-storage-env', () => userSettingsStorageEnv);

const originalDriver = process.env.NUXT_GITPULSE_USER_SETTINGS_STORAGE_DRIVER;
const originalBase = process.env.NUXT_GITPULSE_USER_SETTINGS_STORAGE_BASE;
const originalRedisUrl = process.env.NUXT_GITPULSE_USER_SETTINGS_STORAGE_REDIS_URL;
const originalFallbackRedisUrl = process.env.REDIS_URL;

const createClient = mock(() => new FakeRedisClient());

mock.module('redis', () => ({
  createClient,
}));

const storageUtils = await import('../server/utils/user-settings-storage-utils');
const REDIS_URL_ENV_KEY = 'NUXT_GITPULSE_USER_SETTINGS_STORAGE_REDIS_URL';

type RedisSetOptions = {
  NX?: true;
  PX?: number;
};

type RedisEvalOptions = {
  keys: string[];
  arguments: string[];
};

class FakeRedisClient {
  values = new Map<string, string>();
  setCalls: Array<{ key: string; value: string; options?: RedisSetOptions }> = [];
  evalCalls: Array<{ script: string; options: RedisEvalOptions }> = [];

  async get(key: string) {
    return this.values.get(key) ?? null;
  }

  async set(key: string, value: string, options?: RedisSetOptions) {
    this.setCalls.push({ key, value, options });

    if (options?.NX && this.values.has(key)) {
      return null;
    }

    this.values.set(key, value);
    return 'OK';
  }

  async eval(script: string, options: RedisEvalOptions) {
    this.evalCalls.push({ script, options });
    this.values.delete(options.keys[0]);
    return 1;
  }

  on() {}

  async connect() {
    return this;
  }
}

const restoreEnvValue = (key: string, value: string | undefined) => {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
};

afterEach(() => {
  restoreEnvValue('NUXT_GITPULSE_USER_SETTINGS_STORAGE_DRIVER', originalDriver);
  restoreEnvValue('NUXT_GITPULSE_USER_SETTINGS_STORAGE_BASE', originalBase);
  restoreEnvValue(REDIS_URL_ENV_KEY, originalRedisUrl);
  restoreEnvValue('REDIS_URL', originalFallbackRedisUrl);
  createClient.mockClear();
  storageUtils.clearCachedUserSettingsStorageAdapterForTesting();
});

describe('createRedisUserSettingsStorageAdapter', () => {
  test('reads missing redis settings as null', async () => {
    const redis = new FakeRedisClient();
    const adapter = storageUtils.createRedisUserSettingsStorageAdapter({
      base: 'gitpulse:test',
      redis,
    });

    expect(await adapter.read('Octo Cat')).toBeNull();
  });

  test('writes settings as JSON and reads them back from the namespaced key', async () => {
    const redis = new FakeRedisClient();
    const adapter = storageUtils.createRedisUserSettingsStorageAdapter({
      base: 'gitpulse:test',
      redis,
    });
    const settings = createDefaultUserSettings();

    await adapter.write('Octo Cat', settings);

    expect(redis.values.get('gitpulse:test:users:octo%20cat')).toBe(JSON.stringify(settings));
    expect(await adapter.read(' octo CAT ')).toEqual(settings);
  });

  test('surfaces malformed redis JSON instead of returning defaults', async () => {
    const redis = new FakeRedisClient();
    redis.values.set('gitpulse:test:users:octocat', '{bad json');
    const adapter = storageUtils.createRedisUserSettingsStorageAdapter({
      base: 'gitpulse:test',
      redis,
    });

    await expect(adapter.read('octocat')).rejects.toThrow();
  });

  test('wraps redis updates with SET NX PX and release script locking', async () => {
    const redis = new FakeRedisClient();
    const adapter = storageUtils.createRedisUserSettingsStorageAdapter({
      base: 'gitpulse:test',
      redis,
    });
    const settings = createDefaultUserSettings();

    const updated = await adapter.update('octocat', () => settings);

    expect(updated).toEqual(settings);
    expect(redis.values.get('gitpulse:test:users:octocat')).toBe(JSON.stringify(settings));
    expect(redis.setCalls[0]).toMatchObject({
      key: 'gitpulse:test:users:octocat:write-lock',
      options: { NX: true, PX: 10_000 },
    });
    expect(redis.evalCalls).toHaveLength(1);
    expect(redis.evalCalls[0].options.keys).toEqual(['gitpulse:test:users:octocat:write-lock']);
  });
});

describe('getUserSettingsStorageAdapter', () => {
  test('selects the redis adapter without using the Nitro storage mount', async () => {
    process.env.NUXT_GITPULSE_USER_SETTINGS_STORAGE_DRIVER = 'redis';
    process.env.NUXT_GITPULSE_USER_SETTINGS_STORAGE_REDIS_URL = 'redis://localhost:6379';

    const adapter = storageUtils.getUserSettingsStorageAdapter();

    expect(await adapter.read('octocat')).toBeNull();
    expect(createClient).toHaveBeenCalledWith({ url: 'redis://localhost:6379' });
  });

  test('does not fall back to REDIS_URL for redis storage', async () => {
    process.env.NUXT_GITPULSE_USER_SETTINGS_STORAGE_DRIVER = 'redis';
    delete process.env[REDIS_URL_ENV_KEY];
    process.env.REDIS_URL = 'redis://localhost:6379';

    const adapter = storageUtils.getUserSettingsStorageAdapter();

    await expect(adapter.read('octocat')).rejects.toThrow(
      'NUXT_GITPULSE_USER_SETTINGS_STORAGE_REDIS_URL'
    );
  });
});
