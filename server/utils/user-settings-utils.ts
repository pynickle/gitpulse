import type { H3Event } from 'h3';

import type { UserSettings } from '#shared/types/user-settings';
import {
  createDefaultUserSettings,
  mergeUserSettingsPatch,
  normalizeUserSettings,
} from '#shared/utils/user-settings';

const STORAGE_MOUNT = 'userSettings';
const userSettingsWriteQueues = new Map<string, Promise<unknown>>();

const getSettingsKey = (userLogin: string) => {
  return `users:${encodeURIComponent(userLogin.trim().toLowerCase())}`;
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

export async function getUserSettingsLogin(event: H3Event) {
  const session = await getUserSession(event);
  const userLogin = session.user?.login?.trim();

  if (!userLogin) {
    throw createError({
      statusCode: 401,
      statusMessage: 'User session not found',
    });
  }

  return userLogin;
}

export async function readUserSettings(userLogin: string) {
  const storage = useStorage(STORAGE_MOUNT);
  const storedSettings = await storage.getItem<UserSettings>(getSettingsKey(userLogin));

  return normalizeUserSettings(storedSettings, createDefaultUserSettings());
}

export async function saveUserSettings(userLogin: string, settings: UserSettings) {
  const settingsKey = getSettingsKey(userLogin);
  const storage = useStorage(STORAGE_MOUNT);
  const nextSettings: UserSettings = {
    ...normalizeUserSettings(settings),
    updatedAt: new Date().toISOString(),
  };

  await storage.setItem(settingsKey, nextSettings);
  return nextSettings;
}

export async function patchUserSettings(userLogin: string, patch: unknown) {
  const settingsKey = getSettingsKey(userLogin);

  return enqueueUserSettingsWrite(settingsKey, async () => {
    const currentSettings = await readUserSettings(userLogin);
    const nextSettings = mergeUserSettingsPatch(currentSettings, patch);

    return saveUserSettings(userLogin, nextSettings);
  });
}
