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
const WRITE_LOCKED_SETTINGS_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  redis.call("SET", KEYS[2], ARGV[2])
  return 1
end
return 0
`;
const userSettingsWriteQueues = new Map<string, Promise<unknown>>();
const cachedUserSettingsStorageAdapters = new Map<
  string,
  { signature: string; adapter: unknown }
>();

type UpstashRedisClient = Pick<Redis, 'eval' | 'get' | 'set'>;
type RedisClient = Pick<RedisClientType, 'eval' | 'get' | 'set'>;
type UserSettingsStorageContext = {
  driver: string;
  base?: string;
  redisUrl?: string;
  upstashCredentials?: UpstashRedisCredentials;
  collection?: string;
};

export type UserSettingsStorageUpdater<T = UserSettings> = (
  currentSettings: T | null
) => Promise<T> | T;

export interface UserSettingsStorageAdapter<T = UserSettings> {
  read: (userLogin: string) => Promise<T | null>;
  write: (userLogin: string, settings: T) => Promise<void>;
  update: (userLogin: string, updater: UserSettingsStorageUpdater<T>) => Promise<T>;
}

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

// Filesystem storage maps ":" to "/". The settings document is a file at
// users/<login>, so a collection cannot be stored beneath that path.
export const getUserSettingsItemKey = (userLogin: string, collection = '') => {
  const login = encodeURIComponent(userLogin.trim().toLowerCase());
  if (!collection) return `users:${login}`;
  return `collections:${encodeURIComponent(collection)}:users:${login}`;
};

const getNamespacedSettingsKey = (base: string | undefined, userLogin: string, collection = '') => {
  const settingsKey = getUserSettingsItemKey(userLogin, collection);
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
  task: (lock: { key: string; token: string }) => Promise<T>
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
        return await task({ key: lockKey, token: lockToken });
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
  task: (lock: { key: string; token: string }) => Promise<T>
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
        return await task({ key: lockKey, token: lockToken });
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

export function createNitroUserSettingsStorageAdapter<T extends object = UserSettings>(
  collection = ''
): UserSettingsStorageAdapter<T> {
  const storage = useStorage(STORAGE_MOUNT);

  return {
    async read(userLogin) {
      return storage.getItem<T>(getUserSettingsItemKey(userLogin, collection));
    },
    async write(userLogin, settings) {
      await storage.setItem(getUserSettingsItemKey(userLogin, collection), settings);
    },
    async update(userLogin, updater) {
      const settingsKey = getUserSettingsItemKey(userLogin, collection);

      return enqueueUserSettingsWrite(settingsKey, async () => {
        const currentSettings = await storage.getItem<T>(settingsKey);
        const nextSettings = await updater(currentSettings);

        await storage.setItem(settingsKey, nextSettings);
        return nextSettings;
      });
    },
  };
}

export function createUpstashRedisUserSettingsStorageAdapter<
  T extends object = UserSettings,
>(options: {
  base?: string;
  collection?: string;
  credentials?: UpstashRedisCredentials;
  redis?: UpstashRedisClient;
}): UserSettingsStorageAdapter<T> {
  const redis =
    options.redis ??
    (() => {
      const credentials = options.credentials ?? resolveUpstashRedisCredentials(process.env);

      return new Redis(credentials);
    })();

  return {
    async read(userLogin) {
      return redis.get<T>(getNamespacedSettingsKey(options.base, userLogin, options.collection));
    },
    async write(userLogin, settings) {
      await redis.set(
        getNamespacedSettingsKey(options.base, userLogin, options.collection),
        settings
      );
    },
    async update(userLogin, updater) {
      const settingsKey = getNamespacedSettingsKey(options.base, userLogin, options.collection);

      return enqueueUserSettingsWrite(settingsKey, async () => {
        return runWithUpstashWriteLock(redis, settingsKey, async (lock) => {
          const currentSettings = await redis.get<T>(settingsKey);
          const nextSettings = await updater(currentSettings);

          const committed = await redis.eval(
            WRITE_LOCKED_SETTINGS_SCRIPT,
            [lock.key, settingsKey],
            [lock.token, JSON.stringify(nextSettings)]
          );
          if (committed !== 1)
            throw new Error('User data storage lock expired before saving. Retry the update.');
          return nextSettings;
        });
      });
    },
  };
}

export function createRedisUserSettingsStorageAdapter<T extends object = UserSettings>(options: {
  base?: string;
  collection?: string;
  url?: string;
  redis?: RedisClient;
}): UserSettingsStorageAdapter<T> {
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

    return JSON.parse(serializedSettings) as T;
  };

  const writeSettings = async (settingsKey: string, settings: T) => {
    const client = await getRedis();

    await client.set(settingsKey, JSON.stringify(settings));
  };

  return {
    async read(userLogin) {
      return readSettings(getNamespacedSettingsKey(options.base, userLogin, options.collection));
    },
    async write(userLogin, settings) {
      await writeSettings(
        getNamespacedSettingsKey(options.base, userLogin, options.collection),
        settings
      );
    },
    async update(userLogin, updater) {
      const settingsKey = getNamespacedSettingsKey(options.base, userLogin, options.collection);

      return enqueueUserSettingsWrite(settingsKey, async () => {
        const client = await getRedis();

        return runWithRedisWriteLock(client, settingsKey, async (lock) => {
          const currentSettings = await readSettings(settingsKey);
          const nextSettings = await updater(currentSettings);

          const committed = await client.eval(WRITE_LOCKED_SETTINGS_SCRIPT, {
            keys: [lock.key, settingsKey],
            arguments: [lock.token, JSON.stringify(nextSettings)],
          });
          if (committed !== 1)
            throw new Error('User data storage lock expired before saving. Retry the update.');
          return nextSettings;
        });
      });
    },
  };
}

export function getUserSettingsStorageAdapter<T extends object = UserSettings>(
  collection = ''
): UserSettingsStorageAdapter<T> {
  const driver = getConfiguredUserSettingsStorageDriver();
  const context: UserSettingsStorageContext = {
    collection,
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

  const cached = cachedUserSettingsStorageAdapters.get(collection);
  if (cached?.signature === signature) return cached.adapter as UserSettingsStorageAdapter<T>;

  const adapter =
    driver === 'redis'
      ? createRedisUserSettingsStorageAdapter<T>({
          base: context.base,
          collection,
          url: context.redisUrl,
        })
      : driver === 'upstash'
        ? createUpstashRedisUserSettingsStorageAdapter<T>({
            base: context.base,
            collection,
            credentials: context.upstashCredentials,
          })
        : createNitroUserSettingsStorageAdapter<T>(collection);
  cachedUserSettingsStorageAdapters.set(collection, { signature, adapter });

  return adapter;
}

export function clearCachedUserSettingsStorageAdapterForTesting() {
  cachedUserSettingsStorageAdapters.clear();
}
