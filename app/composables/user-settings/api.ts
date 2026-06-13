import type { UserSettings, UserSettingsPatch } from '#shared/types/user-settings';

export type UserSettingsApiFetch = <T>(
  url: string,
  options?: {
    method?: string;
    body?: UserSettingsPatch;
  }
) => Promise<T>;

export interface UserSettingsApi {
  load: () => Promise<UserSettings>;
  save: (patch: UserSettingsPatch) => Promise<UserSettings>;
}

export function createUserSettingsApi(apiFetch: UserSettingsApiFetch): UserSettingsApi {
  return {
    load() {
      return apiFetch<UserSettings>('/api/settings');
    },
    save(patch) {
      return apiFetch<UserSettings>('/api/settings', {
        method: 'PUT',
        body: patch,
      });
    },
  };
}
