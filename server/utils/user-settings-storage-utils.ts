import { Redis } from '@upstash/redis';
import { createClient, type RedisClientType } from 'redis';

import type { UserSettings } from '#shared/types/user-settings';
import {
  defaultUserSettingsStorageBase,
  normalizeOptionalString,
  normalizeUserSettingsStorageDriver,
  resolveOptionalUpstashRedisCredentials,
  resolveUpstashRedisCredentials,
  type UpstashRedisCredentials,
} from '#shared/utils/user-settings-storage-env';

const STORAGE_MOUNT = 'userSettings';
const REDIS_URL_ENV_KEY = 'NUXT_GITPULSE_USER_SETTINGS_STORAGE_REDIS_URL';
const REMOTE_WRITE_LOCK_TTL_MS = 10_000;
const REMOTE_WRITE_LOCK_ATTEMPTS = 50;
const REMOTE_WRITE_LOCK_INITIAL_DELAY_MS = 25;
const REMOTE_WRITE_LOCK_MAX_DELAY_MS = 250;
const RELEASE_WRITE_LOCK_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end

return 0
`;
const userSettingsWriteQueues = new Map<string, Promise<unknown>>();
let cachedUserSettingsStorageAdapter:
  | {
      signature: string;
      adapter: UserSettingsStorageAdapter;
    }
  | undefined;

type UserSettingsStorageDriver = 'fs' | 'redis' | 'upstash';
type UserSettingsStorageAdapterFactory = (
  context: UserSettingsStorageContext
) => UserSettingsStorageAdapter;
type UpstashRedisClient = Pick<Redis, 'eval' | 'get' | 'set'>;
type RedisClient = Pick<RedisClientType, 'eval' | 'get' | 'set'>;
type UserSettingsStorageContext = {
  driver: string;
  base?: string;
  redisUrl?: string;
  upstashCredentials?: UpstashRedisCredentials;
};

export type UserSettingsStorageUpdater = (
  currentSettings: UserSettings | null
) => Promise<UserSettings> | UserSettings;

export interface UserSettingsStorageAdapter {
  read: (userLogin: string) => Promise<UserSettings | null>;
  write: (userLogin: string, settings: UserSettings) => Promise<void>;
  update: (userLogin: string, updater: UserSettingsStorageUpdater) => Promise<UserSettings>;
}

const USER_SETTINGS_STORAGE_ADAPTERS: Record<
  UserSettingsStorageDriver,
  UserSettingsStorageAdapterFactory
> = {
  fs: () => createNitroUserSettingsStorageAdapter(),
  redis: (context) =>
    createRedisUserSettingsStorageAdapter({
      base: context.base,
      url: context.redisUrl,
    }),
  upstash: (context) =>
    createUpstashRedisUserSettingsStorageAdapter({
      base: context.base,
      credentials: context.upstashCredentials,
    }),
};

const normalizeStorageBase = (base: string | undefined) => {
  return normalizeOptionalString(base)
    ?.replace(/[:/\\]+/g, ':')
    .replace(/^:+|:+$/g, '');
};

const getConfiguredUserSettingsStorageDriver = () => {
  return normalizeUserSettingsStorageDriver(process.env.NUXT_GITPULSE_USER_SETTINGS_STORAGE_DRIVER);
};

const getConfiguredUserSettingsStorageBase = (driver: string) => {
  return (
    normalizeOptionalString(process.env.NUXT_GITPULSE_USER_SETTINGS_STORAGE_BASE) ??
    defaultUserSettingsStorageBase(driver)
  );
};

const getConfiguredRedisUrl = () => {
  const redisUrl = normalizeOptionalString(process.env[REDIS_URL_ENV_KEY]);

  if (redisUrl) {
    return redisUrl;
  }

  throw new Error(
    `GitPulse user settings storage is configured for Redis, but no usable Redis URL was found. Set ${REDIS_URL_ENV_KEY}.`
  );
};

const getSettingsKey = (userLogin: string) => {
  return `users:${encodeURIComponent(userLogin.trim().toLowerCase())}`;
};

const getNamespacedSettingsKey = (base: string | undefined, userLogin: string) => {
  const settingsKey = getSettingsKey(userLogin);
  const normalizedBase = normalizeStorageBase(base);

  return normalizedBase ? `${normalizedBase}:${settingsKey}` : settingsKey;
};

const enqueueUserSettingsWrite = <T>(settingsKey: string, task: () => Promise<T>) => {
  const previousWrite = userSettingsWriteQueues.get(settingsKey) ?? Promise.resolve();
  const nextWrite = previousWrite.catch(() => undefined).then(task);
  const queuedWrite = nextWrite.finally(() => {
    if (userSettingsWriteQueues.get(settingsKey) === queuedWrite) {
      userSettingsWriteQueues.delete(settingsKey);
    }
  });

  userSettingsWriteQueues.set(settingsKey, queuedWrite);
  return queuedWrite;
};

const wait = (milliseconds: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
};

const createWriteLockToken = () => {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}:${Math.random()}`;
};

const getWriteLockKey = (settingsKey: string) => {
  return `${settingsKey}:write-lock`;
};

const releaseUpstashWriteLock = async (
  redis: Pick<UpstashRedisClient, 'eval'>,
  lockKey: string,
  lockToken: string
) => {
  try {
    await redis.eval(RELEASE_WRITE_LOCK_SCRIPT, [lockKey], [lockToken]);
  } catch (error) {
    console.warn('[user-settings] Failed to release remote write lock.', error);
  }
};

const releaseRedisWriteLock = async (
  redis: Pick<RedisClient, 'eval'>,
  lockKey: string,
  lockToken: string
) => {
  try {
    await redis.eval(RELEASE_WRITE_LOCK_SCRIPT, {
      keys: [lockKey],
      arguments: [lockToken],
    });
  } catch (error) {
    console.warn('[user-settings] Failed to release remote write lock.', error);
  }
};

const runWithUpstashWriteLock = async <T>(
  redis: UpstashRedisClient,
  settingsKey: string,
  task: () => Promise<T>
) => {
  const lockKey = getWriteLockKey(settingsKey);
  const lockToken = createWriteLockToken();
  let delay = REMOTE_WRITE_LOCK_INITIAL_DELAY_MS;

  for (let attempt = 1; attempt <= REMOTE_WRITE_LOCK_ATTEMPTS; attempt++) {
    const result = await redis.set(lockKey, lockToken, {
      nx: true,
      px: REMOTE_WRITE_LOCK_TTL_MS,
    });

    if (result === 'OK') {
      try {
        return await task();
      } finally {
        await releaseUpstashWriteLock(redis, lockKey, lockToken);
      }
    }

    if (attempt < REMOTE_WRITE_LOCK_ATTEMPTS) {
      await wait(delay);
      delay = Math.min(delay * 2, REMOTE_WRITE_LOCK_MAX_DELAY_MS);
    }
  }

  throw new Error('Timed out while acquiring GitPulse user settings storage lock.');
};

const runWithRedisWriteLock = async <T>(
  redis: Pick<RedisClient, 'eval' | 'set'>,
  settingsKey: string,
  task: () => Promise<T>
) => {
  const lockKey = getWriteLockKey(settingsKey);
  const lockToken = createWriteLockToken();
  let delay = REMOTE_WRITE_LOCK_INITIAL_DELAY_MS;

  for (let attempt = 1; attempt <= REMOTE_WRITE_LOCK_ATTEMPTS; attempt++) {
    const result = await redis.set(lockKey, lockToken, {
      NX: true,
      PX: REMOTE_WRITE_LOCK_TTL_MS,
    });

    if (result === 'OK') {
      try {
        return await task();
      } finally {
        await releaseRedisWriteLock(redis, lockKey, lockToken);
      }
    }

    if (attempt < REMOTE_WRITE_LOCK_ATTEMPTS) {
      await wait(delay);
      delay = Math.min(delay * 2, REMOTE_WRITE_LOCK_MAX_DELAY_MS);
    }
  }

  throw new Error('Timed out while acquiring GitPulse user settings storage lock.');
};

export function createNitroUserSettingsStorageAdapter(): UserSettingsStorageAdapter {
  const storage = useStorage(STORAGE_MOUNT);

  return {
    async read(userLogin) {
      return storage.getItem<UserSettings>(getSettingsKey(userLogin));
    },
    async write(userLogin, settings) {
      await storage.setItem(getSettingsKey(userLogin), settings);
    },
    async update(userLogin, updater) {
      const settingsKey = getSettingsKey(userLogin);

      return enqueueUserSettingsWrite(settingsKey, async () => {
        const currentSettings = await storage.getItem<UserSettings>(settingsKey);
        const nextSettings = await updater(currentSettings);

        await storage.setItem(settingsKey, nextSettings);
        return nextSettings;
      });
    },
  };
}

export function createUpstashRedisUserSettingsStorageAdapter(options: {
  base?: string;
  credentials?: UpstashRedisCredentials;
  redis?: UpstashRedisClient;
}): UserSettingsStorageAdapter {
  const redis =
    options.redis ??
    (() => {
      const credentials = options.credentials ?? resolveUpstashRedisCredentials(process.env);

      return new Redis(credentials);
    })();

  return {
    async read(userLogin) {
      return redis.get<UserSettings>(getNamespacedSettingsKey(options.base, userLogin));
    },
    async write(userLogin, settings) {
      await redis.set(getNamespacedSettingsKey(options.base, userLogin), settings);
    },
    async update(userLogin, updater) {
      const settingsKey = getNamespacedSettingsKey(options.base, userLogin);

      return enqueueUserSettingsWrite(settingsKey, async () => {
        return runWithUpstashWriteLock(redis, settingsKey, async () => {
          const currentSettings = await redis.get<UserSettings>(settingsKey);
          const nextSettings = await updater(currentSettings);

          await redis.set(settingsKey, nextSettings);
          return nextSettings;
        });
      });
    },
  };
}

export function createRedisUserSettingsStorageAdapter(options: {
  base?: string;
  url?: string;
  redis?: RedisClient;
}): UserSettingsStorageAdapter {
  const redis = options.redis;
  let redisPromise: Promise<RedisClient> | undefined;

  const getRedis = () => {
    if (redis) {
      return Promise.resolve(redis);
    }

    redisPromise ??= (async () => {
      const client = createClient({ url: options.url ?? getConfiguredRedisUrl() });
      client.on('error', (error) => {
        console.warn('[user-settings] Redis client error.', error);
      });

      await client.connect();
      return client as RedisClient;
    })();

    return redisPromise;
  };

  const readSettings = async (settingsKey: string) => {
    const client = await getRedis();
    const serializedSettings = await client.get(settingsKey);

    if (serializedSettings === null) {
      return null;
    }

    return JSON.parse(serializedSettings) as UserSettings;
  };

  const writeSettings = async (settingsKey: string, settings: UserSettings) => {
    const client = await getRedis();

    await client.set(settingsKey, JSON.stringify(settings));
  };

  return {
    async read(userLogin) {
      return readSettings(getNamespacedSettingsKey(options.base, userLogin));
    },
    async write(userLogin, settings) {
      await writeSettings(getNamespacedSettingsKey(options.base, userLogin), settings);
    },
    async update(userLogin, updater) {
      const settingsKey = getNamespacedSettingsKey(options.base, userLogin);

      return enqueueUserSettingsWrite(settingsKey, async () => {
        const client = await getRedis();

        return runWithRedisWriteLock(client, settingsKey, async () => {
          const currentSettings = await readSettings(settingsKey);
          const nextSettings = await updater(currentSettings);

          await writeSettings(settingsKey, nextSettings);
          return nextSettings;
        });
      });
    },
  };
}

export function getUserSettingsStorageAdapter() {
  const driver = getConfiguredUserSettingsStorageDriver();
  const context = {
    driver,
    base: getConfiguredUserSettingsStorageBase(driver),
    redisUrl:
      driver === 'redis' ? normalizeOptionalString(process.env[REDIS_URL_ENV_KEY]) : undefined,
    upstashCredentials:
      driver === 'upstash' ? resolveOptionalUpstashRedisCredentials(process.env) : undefined,
  };
  const signature = [
    context.driver,
    context.base ?? '',
    context.redisUrl ?? '',
    context.upstashCredentials?.url ?? '',
    context.upstashCredentials?.token ?? '',
  ].join(':');

  if (cachedUserSettingsStorageAdapter?.signature === signature) {
    return cachedUserSettingsStorageAdapter.adapter;
  }

  const createAdapter =
    USER_SETTINGS_STORAGE_ADAPTERS[driver as UserSettingsStorageDriver] ??
    createNitroUserSettingsStorageAdapter;

  const adapter = createAdapter(context);
  cachedUserSettingsStorageAdapter = { signature, adapter };

  return adapter;
}

export function clearCachedUserSettingsStorageAdapterForTesting() {
  cachedUserSettingsStorageAdapter = undefined;
}
