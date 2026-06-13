import { describe, expect, mock, test } from 'bun:test';

import { computed, ref } from 'vue';

import * as tabGroups from '../shared/types/tab-groups';
import type { UserSettings, UserSettingsPatch } from '../shared/types/user-settings';

mock.module('#shared/types/tab-groups', () => tabGroups);

const userSettingsUtils = await import('../shared/utils/user-settings');
mock.module('#shared/utils/user-settings', () => userSettingsUtils);

const { createDefaultUserSettings, mergeUserSettingsPatch } = userSettingsUtils;
const { createInitialUserSettingsRequestState, createUserSettingsActions } =
  await import('../app/composables/user-settings/store');

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

const createDeferred = <T>(): Deferred<T> => {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
};

const tick = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const createSettings = (patch: UserSettingsPatch = {}): UserSettings => {
  return mergeUserSettingsPatch(createDefaultUserSettings(), patch);
};

const createHarness = (initialLogin: string | null = 'octocat') => {
  const login = ref(initialLogin);
  const settings = ref(createDefaultUserSettings());
  const confirmedSettings = ref(createDefaultUserSettings());
  const requestState = ref(createInitialUserSettingsRequestState());
  const loadRequests: Deferred<UserSettings>[] = [];
  const saveRequests: Array<{
    patch: UserSettingsPatch;
    deferred: Deferred<UserSettings>;
  }> = [];

  const store = createUserSettingsActions({
    activeLogin: computed(() => login.value),
    settings,
    confirmedSettings,
    requestState,
    api: {
      load() {
        const deferred = createDeferred<UserSettings>();
        loadRequests.push(deferred);
        return deferred.promise;
      },
      save(patch) {
        const deferred = createDeferred<UserSettings>();
        saveRequests.push({ patch, deferred });
        return deferred.promise;
      },
    },
  });

  return {
    login,
    settings,
    confirmedSettings,
    requestState,
    loadRequests,
    saveRequests,
    store,
  };
};

const markLoaded = (harness: ReturnType<typeof createHarness>, settings = createSettings()) => {
  harness.settings.value = settings;
  harness.confirmedSettings.value = settings;
  harness.requestState.value = {
    ...harness.requestState.value,
    status: 'loaded',
    activeLogin: harness.login.value,
    loadedLogin: harness.login.value,
    confirmedLogin: harness.login.value,
    loginRevision: harness.requestState.value.loginRevision + 1,
  };
};

describe('user settings store', () => {
  test('ignores stale load responses after the active login changes', async () => {
    const harness = createHarness('octocat');

    const firstLoad = harness.store.loadSettings();
    expect(harness.loadRequests).toHaveLength(1);
    expect(harness.requestState.value.status).toBe('loading');

    harness.login.value = 'hubot';
    const secondLoad = harness.store.loadSettings();
    expect(harness.loadRequests).toHaveLength(2);

    harness.loadRequests[0]?.resolve(createSettings({ fonts: { appFont: 'misans-latin' } }));
    await expect(firstLoad).resolves.toBeNull();
    expect(harness.settings.value.fonts.appFont).toBe('harmonyos-sans');
    expect(harness.requestState.value.loadedLogin).toBeNull();

    harness.loadRequests[1]?.resolve(createSettings({ fonts: { codeFont: 'jetbrains-mono' } }));
    await expect(secondLoad).resolves.toMatchObject({
      fonts: { codeFont: 'jetbrains-mono' },
    });
    expect(harness.settings.value.fonts.codeFont).toBe('jetbrains-mono');
    expect(harness.requestState.value.loadedLogin).toBe('hubot');
  });

  test('rolls back the latest optimistic save when it fails', async () => {
    const harness = createHarness('octocat');
    const confirmed = createSettings({ fonts: { appFont: 'harmonyos-sans' } });
    markLoaded(harness, confirmed);

    const save = harness.store.updateSettings({ fonts: { appFont: 'misans-latin' } });
    await tick();

    expect(harness.settings.value.fonts.appFont).toBe('misans-latin');
    expect(harness.requestState.value.status).toBe('saving');
    expect(harness.saveRequests).toHaveLength(1);

    harness.saveRequests[0]?.deferred.reject(new Error('write failed'));
    await expect(save).resolves.toBeNull();

    expect(harness.settings.value.fonts.appFont).toBe('harmonyos-sans');
    expect(harness.requestState.value.status).toBe('error');
    expect(harness.requestState.value.pendingSaves).toBe(0);
    expect(harness.requestState.value.error).toBe('write failed');
  });

  test('does not run queued saves for a previous login after a login switch', async () => {
    const harness = createHarness('octocat');
    markLoaded(harness);

    const firstSave = harness.store.updateSettings({ fonts: { appFont: 'misans-latin' } });
    await tick();
    const secondSave = harness.store.updateSettings({ fonts: { codeFont: 'jetbrains-mono' } });
    await tick();

    expect(harness.saveRequests).toHaveLength(1);
    expect(harness.requestState.value.pendingSaves).toBe(2);

    harness.login.value = 'hubot';
    harness.store.handleLoginChanged();
    expect(harness.requestState.value.activeLogin).toBe('hubot');
    expect(harness.requestState.value.pendingSaves).toBe(0);

    harness.saveRequests[0]?.deferred.resolve(
      createSettings({ fonts: { appFont: 'misans-latin' } })
    );

    await expect(firstSave).resolves.toMatchObject({
      fonts: { appFont: 'misans-latin' },
    });
    await expect(secondSave).resolves.toBeNull();

    expect(harness.saveRequests).toHaveLength(1);
    expect(harness.settings.value).toEqual(createDefaultUserSettings());
    expect(harness.requestState.value.loadedLogin).toBeNull();
  });

  test('starts saves for a new login without waiting for a hung previous save', async () => {
    const harness = createHarness('octocat');
    markLoaded(harness, createSettings({ fonts: { appFont: 'harmonyos-sans' } }));

    const firstSave = harness.store.updateSettings({ fonts: { appFont: 'misans-latin' } });
    await tick();

    expect(harness.saveRequests).toHaveLength(1);
    expect(harness.requestState.value.status).toBe('saving');

    harness.login.value = 'hubot';
    harness.store.handleLoginChanged();
    markLoaded(harness, createSettings({ fonts: { codeFont: 'fira-code' } }));

    const secondSave = harness.store.updateSettings({ fonts: { codeFont: 'jetbrains-mono' } });
    await tick();

    expect(harness.saveRequests).toHaveLength(2);
    expect(harness.saveRequests[1]?.patch).toEqual({ fonts: { codeFont: 'jetbrains-mono' } });
    expect(harness.settings.value.fonts.appFont).toBe('harmonyos-sans');
    expect(harness.settings.value.fonts.codeFont).toBe('jetbrains-mono');

    harness.saveRequests[0]?.deferred.reject(new Error('stale write failed'));
    await expect(firstSave).resolves.toBeNull();

    expect(harness.settings.value.fonts.codeFont).toBe('jetbrains-mono');
    expect(harness.requestState.value.activeLogin).toBe('hubot');
    expect(harness.requestState.value.loadedLogin).toBe('hubot');
    expect(harness.requestState.value.error).toBeNull();

    harness.saveRequests[1]?.deferred.resolve(
      createSettings({ fonts: { codeFont: 'jetbrains-mono' } })
    );
    await expect(secondSave).resolves.toMatchObject({
      fonts: { codeFont: 'jetbrains-mono' },
    });

    expect(harness.settings.value.fonts.codeFont).toBe('jetbrains-mono');
    expect(harness.requestState.value.status).toBe('loaded');
    expect(harness.requestState.value.pendingSaves).toBe(0);
    expect(harness.requestState.value.error).toBeNull();
  });
});
