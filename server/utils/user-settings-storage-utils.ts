import { Redis } from '@upstash/redis';

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
const UPSTASH_WRITE_LOCK_TTL_MS = 10_000;
const UPSTASH_WRITE_LOCK_ATTEMPTS = 50;
const UPSTASH_WRITE_LOCK_INITIAL_DELAY_MS = 25;
const UPSTASH_WRITE_LOCK_MAX_DELAY_MS = 250;
const UPSTASH_RELEASE_WRITE_LOCK_SCRIPT = `
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

type UserSettingsStorageDriver = 'fs' | 'upstash';
type UserSettingsStorageAdapterFactory = (
  context: UserSettingsStorageContext
) => UserSettingsStorageAdapter;
type UpstashRedisClient = Pick<Redis, 'eval' | 'get' | 'set'>;
type UserSettingsStorageContext = {
  driver: string;
  base?: string;
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
  redis: UpstashRedisClient,
  lockKey: string,
  lockToken: string
) => {
  try {
    await redis.eval(UPSTASH_RELEASE_WRITE_LOCK_SCRIPT, [lockKey], [lockToken]);
  } catch (error) {
    console.warn('[user-settings] Failed to release Upstash write lock.', error);
  }
};

const runWithUpstashWriteLock = async <T>(
  redis: UpstashRedisClient,
  settingsKey: string,
  task: () => Promise<T>
) => {
  const lockKey = getWriteLockKey(settingsKey);
  const lockToken = createWriteLockToken();
  let delay = UPSTASH_WRITE_LOCK_INITIAL_DELAY_MS;

  for (let attempt = 1; attempt <= UPSTASH_WRITE_LOCK_ATTEMPTS; attempt++) {
    const result = await redis.set(lockKey, lockToken, {
      nx: true,
      px: UPSTASH_WRITE_LOCK_TTL_MS,
    });

    if (result === 'OK') {
      try {
        return await task();
      } finally {
        await releaseUpstashWriteLock(redis, lockKey, lockToken);
      }
    }

    if (attempt < UPSTASH_WRITE_LOCK_ATTEMPTS) {
      await wait(delay);
      delay = Math.min(delay * 2, UPSTASH_WRITE_LOCK_MAX_DELAY_MS);
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

export function getUserSettingsStorageAdapter() {
  const driver = getConfiguredUserSettingsStorageDriver();
  const context = {
    driver,
    base: getConfiguredUserSettingsStorageBase(driver),
    upstashCredentials:
      driver === 'upstash' ? resolveOptionalUpstashRedisCredentials(process.env) : undefined,
  };
  const signature = [
    context.driver,
    context.base ?? '',
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
