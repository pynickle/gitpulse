import type { ComputedRef, Ref, WatchStopHandle } from 'vue';
import { computed, readonly, watch } from 'vue';

import type {
  UserAppearanceSettings,
  UserFontSettings,
  UserLayoutSettings,
  UserNavigationSettings,
  UserNotificationBehaviorSettings,
  UserSettings,
  UserSettingsPatch,
} from '#shared/types/user-settings';
import {
  createDefaultUserSettings,
  mergeUserSettingsPatch,
  normalizeSystemFontFamily,
  normalizeUserSettings,
} from '#shared/utils/user-settings';

import getFetchErrorMessage from '../../utils/getFetchErrorMessage';
import { createUserSettingsApi, type UserSettingsApi } from './api';
import { getAppFontStack, getCodeFontStack } from './fonts';

export type UserSettingsStatus = 'idle' | 'switching' | 'loading' | 'loaded' | 'saving' | 'error';

export interface UserSettingsRequestState {
  status: UserSettingsStatus;
  activeLogin: string | null;
  loadedLogin: string | null;
  confirmedLogin: string | null;
  loginRevision: number;
  loadRevision: number;
  saveRevision: number;
  pendingSaves: number;
  error: string | null;
}

export interface UserSettingsStore {
  settings: Ref<UserSettings>;
  status: Readonly<Ref<UserSettingsStatus>>;
  loaded: Readonly<Ref<boolean>>;
  loading: Readonly<Ref<boolean>>;
  saving: Readonly<Ref<boolean>>;
  error: Readonly<Ref<string | null>>;
  appFontFamily: ComputedRef<string>;
  codeFontFamily: ComputedRef<string>;
  loadSettings: (options?: { force?: boolean }) => Promise<UserSettings | null>;
  updateSettings: (patch: UserSettingsPatch) => Promise<UserSettings | null>;
  updateFonts: (fonts: Partial<UserFontSettings>) => Promise<UserSettings | null>;
  updateAppearance: (appearance: Partial<UserAppearanceSettings>) => Promise<UserSettings | null>;
  updateNotificationBehavior: (
    notificationBehavior: Partial<UserNotificationBehaviorSettings>
  ) => Promise<UserSettings | null>;
  updateNavigation: (navigation: Partial<UserNavigationSettings>) => Promise<UserSettings | null>;
  updateLayout: (layout: Partial<UserLayoutSettings>) => Promise<UserSettings | null>;
  handleLoginChanged: () => void;
  ensureLoginWatcher: () => void;
}

export interface CreateUserSettingsActionsOptions {
  api: UserSettingsApi;
  activeLogin: Readonly<Ref<string | null>>;
  settings: Ref<UserSettings>;
  confirmedSettings: Ref<UserSettings>;
  requestState: Ref<UserSettingsRequestState>;
}

interface LoadRequest {
  login: string;
  loginRevision: number;
  loadRevision: number;
  promise: Promise<UserSettings | null>;
}

const USER_SETTINGS_STORE_KEY = '_gitpulseUserSettingsStore';

export function createInitialUserSettingsRequestState(): UserSettingsRequestState {
  return {
    status: 'idle',
    activeLogin: null,
    loadedLogin: null,
    confirmedLogin: null,
    loginRevision: 0,
    loadRevision: 0,
    saveRevision: 0,
    pendingSaves: 0,
    error: null,
  };
}

export const normalizeUserSettingsLogin = (login: unknown) => {
  return typeof login === 'string' && login.trim().length > 0 ? login.trim().toLowerCase() : null;
};

export function createUserSettingsActions({
  api,
  activeLogin,
  settings,
  confirmedSettings,
  requestState,
}: CreateUserSettingsActionsOptions): UserSettingsStore {
  let activeLoad: LoadRequest | null = null;
  let saveQueue: Promise<unknown> = Promise.resolve();
  let stopLoginWatcher: WatchStopHandle | null = null;

  const transition = (patch: Partial<UserSettingsRequestState>) => {
    requestState.value = {
      ...requestState.value,
      ...patch,
    };
  };

  const replaceWithDefaults = () => {
    settings.value = createDefaultUserSettings();
    confirmedSettings.value = createDefaultUserSettings();
  };

  const resetForLogin = (nextLogin: string | null) => {
    activeLoad = null;
    saveQueue = Promise.resolve();
    replaceWithDefaults();

    transition({
      status: nextLogin ? 'switching' : 'idle',
      activeLogin: nextLogin,
      loadedLogin: null,
      confirmedLogin: null,
      loginRevision: requestState.value.loginRevision + 1,
      loadRevision: requestState.value.loadRevision + 1,
      saveRevision: requestState.value.saveRevision + 1,
      pendingSaves: 0,
      error: null,
    });
  };

  const syncActiveLogin = () => {
    const nextLogin = activeLogin.value;
    if (requestState.value.activeLogin === nextLogin) {
      return;
    }

    resetForLogin(nextLogin);
  };

  const isCurrentLogin = (login: string, loginRevision: number) => {
    return activeLogin.value === login && requestState.value.loginRevision === loginRevision;
  };

  const setConfirmedSettings = (login: string, nextSettings: UserSettings) => {
    confirmedSettings.value = normalizeUserSettings(nextSettings);
    transition({ confirmedLogin: login });
  };

  const getRollbackSettings = (login: string, fallback: UserSettings) => {
    return requestState.value.confirmedLogin === login ? confirmedSettings.value : fallback;
  };

  const loaded = computed(
    () => activeLogin.value !== null && requestState.value.loadedLogin === activeLogin.value
  );
  const loading = computed(
    () => requestState.value.status === 'loading' || requestState.value.status === 'switching'
  );
  const saving = computed(() => requestState.value.pendingSaves > 0);
  const status = computed(() => requestState.value.status);
  const error = computed(() => requestState.value.error);
  const appFontFamily = computed(() => getAppFontStack(settings.value.fonts));
  const codeFontFamily = computed(() => getCodeFontStack(settings.value.fonts));

  const enqueueSettingsSave = <T>(task: () => Promise<T>) => {
    const nextSave = saveQueue.catch(() => undefined).then(task);
    saveQueue = nextSave.catch(() => undefined);
    return nextSave;
  };

  const loadSettings = async (options: { force?: boolean } = {}) => {
    syncActiveLogin();

    const targetLogin = activeLogin.value;
    if (!targetLogin) {
      resetForLogin(null);
      return null;
    }

    if (loaded.value && !options.force) {
      return settings.value;
    }

    if (
      !options.force &&
      activeLoad &&
      activeLoad.login === targetLogin &&
      activeLoad.loginRevision === requestState.value.loginRevision
    ) {
      return activeLoad.promise;
    }

    const loginRevision = requestState.value.loginRevision;
    const loadRevision = requestState.value.loadRevision + 1;

    transition({
      status: 'loading',
      activeLogin: targetLogin,
      loadRevision,
      error: null,
    });

    let loadPromise: Promise<UserSettings | null>;
    loadPromise = (async () => {
      try {
        const response = await api.load();
        if (
          !isCurrentLogin(targetLogin, loginRevision) ||
          requestState.value.loadRevision !== loadRevision
        ) {
          return null;
        }

        const nextSettings = normalizeUserSettings(response);
        settings.value = nextSettings;
        setConfirmedSettings(targetLogin, nextSettings);
        transition({
          status: 'loaded',
          loadedLogin: targetLogin,
          error: null,
        });

        return settings.value;
      } catch (loadError) {
        if (
          isCurrentLogin(targetLogin, loginRevision) &&
          requestState.value.loadRevision === loadRevision
        ) {
          transition({
            status: 'error',
            error: getFetchErrorMessage(loadError, 'Unable to load settings.'),
          });
        }

        return null;
      } finally {
        if (activeLoad?.loadRevision === loadRevision) {
          activeLoad = null;
        }
      }
    })();

    activeLoad = {
      login: targetLogin,
      loginRevision,
      loadRevision,
      promise: loadPromise,
    };

    return loadPromise;
  };

  const finishSave = (loginRevision: number) => {
    if (requestState.value.loginRevision !== loginRevision) {
      return;
    }

    const pendingSaves = Math.max(0, requestState.value.pendingSaves - 1);
    const nextStatus =
      pendingSaves > 0
        ? 'saving'
        : requestState.value.status === 'saving'
          ? loaded.value
            ? 'loaded'
            : 'idle'
          : requestState.value.status;

    transition({
      pendingSaves,
      status: nextStatus,
    });
  };

  const updateSettings = async (patch: UserSettingsPatch) => {
    syncActiveLogin();

    const targetLogin = activeLogin.value;
    if (!targetLogin) {
      resetForLogin(null);
      transition({
        status: 'error',
        error: 'Unable to save settings without a user session.',
      });
      return null;
    }

    if (!loaded.value) {
      const loadedSettings = await loadSettings();
      if (!loadedSettings || activeLogin.value !== targetLogin) {
        return null;
      }
    }

    const loginRevision = requestState.value.loginRevision;
    const previousSettings = settings.value;
    const optimisticSettings = mergeUserSettingsPatch(previousSettings, patch);
    const saveRevision = requestState.value.saveRevision + 1;

    settings.value = optimisticSettings;
    transition({
      status: 'saving',
      activeLogin: targetLogin,
      loadedLogin: targetLogin,
      saveRevision,
      pendingSaves: requestState.value.pendingSaves + 1,
      error: null,
    });

    return enqueueSettingsSave(async () => {
      try {
        if (!isCurrentLogin(targetLogin, loginRevision)) {
          return null;
        }

        const response = await api.save(patch);
        const nextSettings = normalizeUserSettings(response, optimisticSettings);

        if (isCurrentLogin(targetLogin, loginRevision)) {
          setConfirmedSettings(targetLogin, nextSettings);
        }

        if (
          isCurrentLogin(targetLogin, loginRevision) &&
          requestState.value.saveRevision === saveRevision
        ) {
          settings.value = nextSettings;
          transition({
            status: 'loaded',
            loadedLogin: targetLogin,
            error: null,
          });
        }

        return nextSettings;
      } catch (saveError) {
        if (
          isCurrentLogin(targetLogin, loginRevision) &&
          requestState.value.saveRevision === saveRevision
        ) {
          settings.value = normalizeUserSettings(
            getRollbackSettings(targetLogin, previousSettings)
          );
          transition({
            status: 'error',
            error: getFetchErrorMessage(saveError, 'Unable to save settings.'),
          });
        }

        return null;
      } finally {
        finishSave(loginRevision);
      }
    });
  };

  const updateFonts = (fonts: Partial<UserFontSettings>) => {
    const nextFonts: Partial<UserFontSettings> = {
      ...fonts,
      appSystemFont: normalizeSystemFontFamily(fonts.appSystemFont),
      codeSystemFont: normalizeSystemFontFamily(fonts.codeSystemFont),
    };

    return updateSettings({ fonts: nextFonts });
  };

  const updateAppearance = (appearance: Partial<UserAppearanceSettings>) => {
    return updateSettings({ appearance });
  };

  const updateNotificationBehavior = (
    notificationBehavior: Partial<UserNotificationBehaviorSettings>
  ) => {
    return updateSettings({ notificationBehavior });
  };

  const updateNavigation = (navigation: Partial<UserNavigationSettings>) => {
    return updateSettings({ navigation });
  };

  const updateLayout = (layout: Partial<UserLayoutSettings>) => {
    return updateSettings({ layout });
  };

  const handleLoginChanged = () => {
    syncActiveLogin();
  };

  const ensureLoginWatcher = () => {
    if (!import.meta.client || stopLoginWatcher) {
      return;
    }

    stopLoginWatcher = watch(
      activeLogin,
      (nextLogin) => {
        handleLoginChanged();
        if (nextLogin) {
          void loadSettings();
        }
      },
      { immediate: true }
    );
  };

  return {
    settings,
    status: readonly(status),
    loaded: readonly(loaded),
    loading: readonly(loading),
    saving: readonly(saving),
    error: readonly(error),
    appFontFamily,
    codeFontFamily,
    loadSettings,
    updateSettings,
    updateFonts,
    updateAppearance,
    updateNotificationBehavior,
    updateNavigation,
    updateLayout,
    handleLoginChanged,
    ensureLoginWatcher,
  };
}

export function useUserSettingsStore() {
  const nuxtApp = useNuxtApp() as ReturnType<typeof useNuxtApp> & {
    [USER_SETTINGS_STORE_KEY]?: UserSettingsStore;
  };

  if (nuxtApp[USER_SETTINGS_STORE_KEY]) {
    return nuxtApp[USER_SETTINGS_STORE_KEY];
  }

  const apiFetch = useGitPulseApiFetch();
  const { user } = useUserSession();
  const activeLogin = computed(() => normalizeUserSettingsLogin(user.value?.login));
  const settings = useState<UserSettings>('gitpulse-user-settings', () =>
    createDefaultUserSettings()
  );
  const confirmedSettings = useState<UserSettings>('gitpulse-user-settings-confirmed', () =>
    createDefaultUserSettings()
  );
  const requestState = useState<UserSettingsRequestState>(
    'gitpulse-user-settings-request-state',
    () => createInitialUserSettingsRequestState()
  );

  const store = createUserSettingsActions({
    api: createUserSettingsApi(apiFetch),
    activeLogin,
    settings,
    confirmedSettings,
    requestState,
  });

  store.ensureLoginWatcher();
  nuxtApp[USER_SETTINGS_STORE_KEY] = store;

  return store;
}
