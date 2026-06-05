import type { H3Event } from 'h3';

import type { UserSettings } from '#shared/types/user-settings';
import {
  createDefaultUserSettings,
  mergeUserSettingsPatch,
  normalizeUserSettings,
} from '#shared/utils/user-settings';

import {
  getUserSettingsStorageAdapter,
  type UserSettingsStorageAdapter,
} from './user-settings-storage-utils';

type UserSettingsService = {
  read: (userLogin: string) => Promise<UserSettings>;
  save: (userLogin: string, settings: UserSettings) => Promise<UserSettings>;
  patch: (userLogin: string, patch: unknown) => Promise<UserSettings>;
};

const normalizeStoredUserSettings = (storedSettings: UserSettings | null) => {
  return normalizeUserSettings(storedSettings, createDefaultUserSettings());
};

const prepareUserSettingsForWrite = (settings: UserSettings): UserSettings => {
  return {
    ...normalizeUserSettings(settings),
    updatedAt: new Date().toISOString(),
  };
};

export function createUserSettingsService(
  storage: UserSettingsStorageAdapter = getUserSettingsStorageAdapter()
): UserSettingsService {
  return {
    async read(userLogin) {
      return normalizeStoredUserSettings(await storage.read(userLogin));
    },
    async save(userLogin, settings) {
      const nextSettings = prepareUserSettingsForWrite(settings);

      await storage.write(userLogin, nextSettings);
      return nextSettings;
    },
    async patch(userLogin, patch) {
      return storage.update(userLogin, (storedSettings) => {
        const currentSettings = normalizeStoredUserSettings(storedSettings);
        const nextSettings = mergeUserSettingsPatch(currentSettings, patch);

        return prepareUserSettingsForWrite(nextSettings);
      });
    },
  };
}

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
  return createUserSettingsService().read(userLogin);
}

export async function saveUserSettings(userLogin: string, settings: UserSettings) {
  return createUserSettingsService().save(userLogin, settings);
}

export async function patchUserSettings(userLogin: string, patch: unknown) {
  return createUserSettingsService().patch(userLogin, patch);
}
