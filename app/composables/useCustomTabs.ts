import type {
  CustomTab,
  CustomTabQuery,
  CustomTabSource,
  CustomTabSubtitleMode,
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
  CustomTabSubtitleMode,
  CustomTabVisibility,
} from '#shared/types/custom-search';

export interface CreateCustomTabInput {
  id?: string;
  groupId: string;
  name: string;
  subtitle?: string;
  subtitleMode?: CustomTabSubtitleMode;
  source?: CustomTabSource;
  query?: CustomTabQuery;
}

export interface UpdateCustomTabInput {
  groupId?: string;
  name?: string;
  subtitle?: string;
  subtitleMode?: CustomTabSubtitleMode;
  source?: CustomTabSource;
  query?: CustomTabQuery;
}

const DEFAULT_CUSTOM_TABS: CustomTab[] = [];

const normalizeOptionalString = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const resolveSubtitleState = (mode: CustomTabSubtitleMode | undefined, subtitle?: string) => {
  const normalizedSubtitle = normalizeOptionalString(subtitle);
  const resolvedMode = mode ?? (normalizedSubtitle ? 'custom' : 'auto');

  if (resolvedMode !== 'custom') {
    return { subtitleMode: resolvedMode, subtitle: undefined };
  }

  if (!normalizedSubtitle) {
    return { subtitleMode: 'auto' as const, subtitle: undefined };
  }

  return { subtitleMode: 'custom' as const, subtitle: normalizedSubtitle };
};

const createTabId = () => {
  return `custom-tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

export function useCustomTabs(initialTabs: CustomTab[] = DEFAULT_CUSTOM_TABS) {
  const { settings, loadSettings, updateSettings } = useUserSettings();

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

    const subtitleState = resolveSubtitleState(input.subtitleMode, input.subtitle);

    const tab: CustomTab = {
      id,
      groupId: input.groupId,
      name: input.name,
      ...subtitleState,
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

    const inferredMode =
      updates.subtitleMode ??
      (updates.subtitle !== undefined
        ? normalizeOptionalString(updates.subtitle)
          ? 'custom'
          : 'auto'
        : target.subtitleMode);
    const subtitleState =
      updates.subtitleMode === undefined && updates.subtitle === undefined
        ? { subtitleMode: target.subtitleMode, subtitle: target.subtitle }
        : resolveSubtitleState(inferredMode, updates.subtitle ?? target.subtitle);

    const updatedTab: CustomTab = {
      ...target,
      ...updates,
      ...subtitleState,
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
