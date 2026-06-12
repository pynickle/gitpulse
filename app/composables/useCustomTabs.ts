import type {
  CustomTab,
  CustomTabQuery,
  CustomTabSource,
} from '#shared/types/custom-search';
import { cloneCustomTabs, normalizeCustomTabs } from '#shared/utils/user-settings';

export type {
  CustomTab,
  CustomTabArchived,
  CustomTabDraft,
  CustomTabMerged,
  CustomTabOrder,
  CustomTabQuery,
  CustomTabReview,
  CustomTabSearchScope,
  CustomTabSearchType,
  CustomTabSort,
  CustomTabSource,
  CustomTabState,
  CustomTabVisibility,
} from '#shared/types/custom-search';

export interface CreateCustomTabInput {
  id?: string;
  groupId: string;
  name: string;
  subtitle?: string;
  source?: CustomTabSource;
  query?: CustomTabQuery;
}

export interface UpdateCustomTabInput {
  groupId?: string;
  name?: string;
  subtitle?: string;
  source?: CustomTabSource;
  query?: CustomTabQuery;
}

const buildLegacyStorageKey = (login: string): string => {
  return `gitpulse:dashboard:custom-tabs:${login}`;
};

const DEFAULT_CUSTOM_TABS: CustomTab[] = [];

let migratedLegacyTabsLogin: string | null = null;

const normalizeOptionalString = (value: unknown) => {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
};

const readLegacyStoredTabs = (login: string): CustomTab[] | null => {
  if (!import.meta.client) {
    return null;
  }

  const raw = window.localStorage.getItem(buildLegacyStorageKey(login));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    const tabs = normalizeCustomTabs(parsed);
    return tabs.length > 0 ? tabs : null;
  } catch {
    return null;
  }
};

const removeLegacyStoredTabs = (login: string) => {
  if (!import.meta.client) {
    return;
  }

  window.localStorage.removeItem(buildLegacyStorageKey(login));
};

const createTabId = () => {
  return `custom-tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

export function useCustomTabs(initialTabs: CustomTab[] = DEFAULT_CUSTOM_TABS) {
  const { user } = useUserSession();
  const login = computed(() => user.value?.login ?? 'anonymous');
  const { settings, loaded, loadSettings, updateSettings } = useUserSettings();

  if (import.meta.client) {
    void loadSettings();
  }

  const fallbackTabs = computed(() => normalizeCustomTabs(initialTabs));
  const customTabs = computed<CustomTab[]>({
    get() {
      return settings.value.customTabs.length > 0
        ? settings.value.customTabs
        : cloneCustomTabs(fallbackTabs.value);
    },
    set(nextTabs) {
      void setCustomTabs(nextTabs);
    },
  });

  const setCustomTabs = async (nextTabs: CustomTab[]) => {
    const normalizedTabs = normalizeCustomTabs(nextTabs, fallbackTabs.value);
    await updateSettings({ customTabs: normalizedTabs });
    return normalizedTabs;
  };

  const migrateLegacyTabs = (nextLogin: string) => {
    if (
      !import.meta.client ||
      !loaded.value ||
      nextLogin === 'anonymous' ||
      migratedLegacyTabsLogin === nextLogin ||
      settings.value.customTabs.length > 0
    ) {
      return;
    }

    migratedLegacyTabsLogin = nextLogin;
    const legacyTabs = readLegacyStoredTabs(nextLogin);
    if (!legacyTabs) {
      return;
    }

    void setCustomTabs(legacyTabs).then(() => removeLegacyStoredTabs(nextLogin));
  };

  watch([login, loaded], ([nextLogin]) => migrateLegacyTabs(nextLogin), { immediate: true });

  const getCustomTabById = (tabId: string) => {
    return customTabs.value.find((tab) => tab.id === tabId);
  };

  const getCustomTabsByGroupId = (groupId: string) => {
    return customTabs.value.filter((tab) => tab.groupId === groupId);
  };

  const createCustomTab = (input: CreateCustomTabInput) => {
    const id = input.id && input.id.length > 0 ? input.id : createTabId();
    if (getCustomTabById(id)) {
      return null;
    }

    const tab: CustomTab = {
      id,
      groupId: input.groupId,
      name: input.name,
      subtitle: normalizeOptionalString(input.subtitle),
      source: input.source ?? 'github-search',
      query: input.query ?? {},
    };

    void setCustomTabs([...customTabs.value, tab]);
    return tab;
  };

  const updateCustomTab = (tabId: string, updates: UpdateCustomTabInput) => {
    const target = getCustomTabById(tabId);
    if (!target) {
      return null;
    }

    const updatedTab: CustomTab = {
      ...target,
      ...updates,
      subtitle:
        updates.subtitle === undefined
          ? target.subtitle
          : normalizeOptionalString(updates.subtitle),
      query: updates.query ?? target.query,
    };

    void setCustomTabs(
      customTabs.value.map((tab) => {
        if (tab.id !== tabId) {
          return tab;
        }

        return updatedTab;
      })
    );

    return updatedTab;
  };

  const deleteCustomTab = (tabId: string) => {
    const exists = customTabs.value.some((tab) => tab.id === tabId);
    if (!exists) {
      return false;
    }

    void setCustomTabs(customTabs.value.filter((tab) => tab.id !== tabId));
    return true;
  };

  const resetCustomTabs = () => {
    const nextTabs = cloneCustomTabs(fallbackTabs.value);
    void setCustomTabs(nextTabs);
    return nextTabs;
  };

  return {
    customTabs,
    getCustomTabById,
    getCustomTabsByGroupId,
    createCustomTab,
    updateCustomTab,
    deleteCustomTab,
    resetCustomTabs,
  };
}
