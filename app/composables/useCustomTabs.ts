import { watch } from 'vue';

export type {
  CustomTabArchived,
  CustomTabDraft,
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

import type {
  CustomTab,
  CustomTabQuery,
  CustomTabSearchScope,
  CustomTabSource,
} from '#shared/types/custom-search';
export type { CustomTab } from '#shared/types/custom-search';

export interface CreateCustomTabInput {
  id?: string;
  groupId: string;
  name: string;
  source?: CustomTabSource;
  query?: CustomTabQuery;
}

export interface UpdateCustomTabInput {
  groupId?: string;
  name?: string;
  source?: CustomTabSource;
  query?: CustomTabQuery;
}

const STORAGE_KEY = 'gitpulse:dashboard:custom-tabs';

const DEFAULT_CUSTOM_TABS: CustomTab[] = [];

let hasHydratedStoredTabs = false;

const cloneQuery = (query: CustomTabQuery = {}) => {
  return {
    ...query,
    labels: query.labels ? [...query.labels] : undefined,
    scopes: query.scopes ? [...query.scopes] : undefined,
  };
};

const normalizeString = (value: unknown) => {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
};

const cloneTab = (tab: CustomTab): CustomTab => {
  return {
    ...tab,
    query: cloneQuery(tab.query),
  };
};

const cloneTabs = (tabs: CustomTab[]) => {
  return tabs.map((tab) => cloneTab(tab));
};

const normalizeQuery = (query: unknown): CustomTabQuery => {
  if (!query || typeof query !== 'object') {
    return {};
  }

  const candidate = query as Partial<CustomTabQuery>;
  const state = candidate.state;
  const normalizedState =
    state === 'open' || state === 'closed' || state === 'all' ? state : undefined;
  const type = candidate.type;
  const normalizedType = type === 'issues' || type === 'pulls' || type === 'all' ? type : undefined;
  const sort = candidate.sort;
  const normalizedSort =
    sort === 'best-match' ||
    sort === 'comments' ||
    sort === 'reactions' ||
    sort === 'interactions' ||
    sort === 'created' ||
    sort === 'updated'
      ? sort
      : undefined;
  const order = candidate.order;
  const normalizedOrder = order === 'asc' || order === 'desc' ? order : undefined;
  const visibility = candidate.visibility;
  const normalizedVisibility =
    visibility === 'any' || visibility === 'public' || visibility === 'private'
      ? visibility
      : undefined;
  const archived = candidate.archived;
  const normalizedArchived =
    archived === 'exclude' || archived === 'include' || archived === 'only' ? archived : undefined;
  const draft = candidate.draft;
  const normalizedDraft =
    draft === 'any' || draft === 'draft' || draft === 'ready' ? draft : undefined;
  const review = candidate.review;
  const normalizedReview =
    review === 'any' ||
    review === 'none' ||
    review === 'required' ||
    review === 'approved' ||
    review === 'changes_requested'
      ? review
      : undefined;

  const labels = Array.isArray(candidate.labels)
    ? candidate.labels.filter(
        (label): label is string => typeof label === 'string' && label.length > 0
      )
    : undefined;
  const scopes = Array.isArray(candidate.scopes)
    ? candidate.scopes.filter(
        (scope): scope is CustomTabSearchScope =>
          scope === 'title' || scope === 'body' || scope === 'comments'
      )
    : undefined;
  const perPage =
    typeof candidate.perPage === 'number' && Number.isFinite(candidate.perPage)
      ? Math.min(Math.max(Math.trunc(candidate.perPage), 1), 100)
      : undefined;

  return {
    text: normalizeString(candidate.text),
    type: normalizedType,
    repo: normalizeString(candidate.repo),
    org: normalizeString(candidate.org),
    user: normalizeString(candidate.user),
    labels,
    author: normalizeString(candidate.author),
    assignee: normalizeString(candidate.assignee),
    mentions: normalizeString(candidate.mentions),
    commenter: normalizeString(candidate.commenter),
    involves: normalizeString(candidate.involves),
    milestone: normalizeString(candidate.milestone),
    state: normalizedState,
    scopes,
    visibility: normalizedVisibility,
    archived: normalizedArchived,
    draft: normalizedDraft,
    review: normalizedReview,
    base: normalizeString(candidate.base),
    head: normalizeString(candidate.head),
    sort: normalizedSort,
    order: normalizedOrder,
    perPage,
  };
};

const normalizeTab = (tab: unknown): CustomTab | null => {
  if (!tab || typeof tab !== 'object') {
    return null;
  }

  const candidate = tab as Partial<CustomTab>;
  if (typeof candidate.id !== 'string' || candidate.id.length === 0) {
    return null;
  }

  if (typeof candidate.groupId !== 'string' || candidate.groupId.length === 0) {
    return null;
  }

  if (typeof candidate.name !== 'string' || candidate.name.length === 0) {
    return null;
  }

  return {
    id: candidate.id,
    groupId: candidate.groupId,
    name: candidate.name,
    source: candidate.source === 'github-search' ? candidate.source : 'github-search',
    query: normalizeQuery(candidate.query),
  };
};

const readStoredTabs = (): CustomTab[] | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return null;
    }

    const tabs = parsed
      .map((entry) => normalizeTab(entry))
      .filter((entry): entry is CustomTab => entry !== null);
    return tabs;
  } catch {
    return null;
  }
};

const writeStoredTabs = (tabs: CustomTab[]) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
};

const createTabId = () => {
  return `custom-tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

export function useCustomTabs(initialTabs: CustomTab[] = DEFAULT_CUSTOM_TABS) {
  const customTabs = useState<CustomTab[]>('gitpulse-custom-tabs', () => cloneTabs(initialTabs));

  if (import.meta.client && !hasHydratedStoredTabs) {
    const storedTabs = readStoredTabs();
    customTabs.value = storedTabs ?? cloneTabs(initialTabs);
    hasHydratedStoredTabs = true;
  }

  watch(
    customTabs,
    (nextTabs) => {
      writeStoredTabs(nextTabs);
    },
    { deep: true }
  );

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
      source: input.source ?? 'github-search',
      query: cloneQuery(input.query),
    };

    customTabs.value = [...customTabs.value, tab];
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
      query: updates.query ? cloneQuery(updates.query) : target.query,
    };

    customTabs.value = customTabs.value.map((tab) => {
      if (tab.id !== tabId) {
        return tab;
      }

      return updatedTab;
    });

    return updatedTab;
  };

  const deleteCustomTab = (tabId: string) => {
    const exists = customTabs.value.some((tab) => tab.id === tabId);
    if (!exists) {
      return false;
    }

    customTabs.value = customTabs.value.filter((tab) => tab.id !== tabId);
    return true;
  };

  const resetCustomTabs = () => {
    customTabs.value = cloneTabs(initialTabs);
    return customTabs.value;
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
