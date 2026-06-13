import { useUserSettingsStore } from './user-settings/store';

export {
  builtinAppFontOptions,
  builtinCodeFontOptions,
  getAppFontStack,
  getCodeFontStack,
  type BuiltinFontOption,
} from './user-settings/fonts';
export {
  createUserSettingsApi,
  type UserSettingsApi,
  type UserSettingsApiFetch,
} from './user-settings/api';
export {
  createInitialUserSettingsRequestState,
  createUserSettingsActions,
  normalizeUserSettingsLogin,
  useUserSettingsStore,
  type CreateUserSettingsActionsOptions,
  type UserSettingsRequestState,
  type UserSettingsStatus,
  type UserSettingsStore,
} from './user-settings/store';

export function useUserSettings() {
  return useUserSettingsStore();
}
