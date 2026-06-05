import type {
  CustomTab,
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
import {
  BUILTIN_TAB_GROUP_ID,
  DEFAULT_CUSTOM_TAB_GROUP_ID,
  type TabGroup,
} from '#shared/types/tab-groups';
import type {
  AppFontId,
  CodeFontId,
  UserFontSettings,
  UserSettings,
} from '#shared/types/user-settings';

const APP_FONTS = new Set<AppFontId>(['harmonyos-sans', 'misans-latin', 'system']);
const CODE_FONTS = new Set<CodeFontId>(['maple-mono', 'jetbrains-mono', 'system']);

const REQUIRED_BUILTIN_GROUP: TabGroup = {
  id: BUILTIN_TAB_GROUP_ID,
  name: 'Built-in Views',
  parentId: null,
  collapsed: false,
  source: 'system',
};

export const DEFAULT_USER_FONT_SETTINGS: UserFontSettings = {
  appFont: 'harmonyos-sans',
  codeFont: 'maple-mono',
};

const hasOwn = (value: object, key: string) => {
  return Object.prototype.hasOwnProperty.call(value, key);
};

const normalizeString = (value: unknown, maxLength = 240) => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
};

const normalizeStringList = (values: unknown) => {
  if (!Array.isArray(values)) {
    return undefined;
  }

  return values.flatMap((value) => {
    const normalized = normalizeString(value);
    return normalized ? [normalized] : [];
  });
};

export function normalizeSystemFontFamily(value: unknown) {
  const normalized = normalizeString(value, 120);
  if (!normalized || /["\\;,{}()\r\n\f]/u.test(normalized)) {
    return undefined;
  }

  return normalized;
}

export function createDefaultTabGroups(): TabGroup[] {
  return [
    { ...REQUIRED_BUILTIN_GROUP },
    {
      id: DEFAULT_CUSTOM_TAB_GROUP_ID,
      name: 'General',
      parentId: null,
      collapsed: false,
      source: 'github-search',
    },
  ];
}

export function createDefaultUserSettings(): UserSettings {
  return {
    version: 1,
    fonts: { ...DEFAULT_USER_FONT_SETTINGS },
    tabGroups: createDefaultTabGroups(),
    customTabs: [],
  };
}

export function cloneTabGroup(group: TabGroup): TabGroup {
  return { ...group };
}

export function cloneTabGroups(groups: TabGroup[]) {
  return groups.map((group) => cloneTabGroup(group));
}

const cloneQuery = (query: CustomTabQuery = {}): CustomTabQuery => {
  return {
    ...query,
    labels: query.labels ? [...query.labels] : undefined,
    scopes: query.scopes ? [...query.scopes] : undefined,
  };
};

export function cloneCustomTab(tab: CustomTab): CustomTab {
  return {
    ...tab,
    query: cloneQuery(tab.query),
  };
}

export function cloneCustomTabs(tabs: CustomTab[]) {
  return tabs.map((tab) => cloneCustomTab(tab));
}

export function normalizeTabGroup(group: unknown): TabGroup | null {
  if (!group || typeof group !== 'object' || Array.isArray(group)) {
    return null;
  }

  const candidate = group as Partial<TabGroup>;
  const id = normalizeString(candidate.id);
  const name = normalizeString(candidate.name);

  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
    parentId:
      typeof candidate.parentId === 'string' && candidate.parentId.trim().length > 0
        ? candidate.parentId.trim()
        : null,
    collapsed: typeof candidate.collapsed === 'boolean' ? candidate.collapsed : false,
    source:
      candidate.source === 'system' || candidate.source === 'github-search'
        ? candidate.source
        : 'github-search',
  };
}

export function ensureRequiredTabGroups(groups: TabGroup[]) {
  const groupMap = new Map(groups.map((group) => [group.id, cloneTabGroup(group)]));
  const builtinGroup = groupMap.get(BUILTIN_TAB_GROUP_ID);

  if (builtinGroup) {
    groupMap.delete(BUILTIN_TAB_GROUP_ID);
  }

  const resolvedBuiltin: TabGroup = {
    ...(builtinGroup ?? REQUIRED_BUILTIN_GROUP),
    id: BUILTIN_TAB_GROUP_ID,
    name: REQUIRED_BUILTIN_GROUP.name,
    parentId: null,
    source: 'system',
  };

  return [resolvedBuiltin, ...groupMap.values()];
}

export function normalizeTabGroups(value: unknown, fallback = createDefaultTabGroups()) {
  if (!Array.isArray(value)) {
    return cloneTabGroups(fallback);
  }

  const groups = value
    .map((entry) => normalizeTabGroup(entry))
    .filter((entry): entry is TabGroup => entry !== null);

  return groups.length > 0 ? ensureRequiredTabGroups(groups) : cloneTabGroups(fallback);
}

const normalizeQuery = (query: unknown): CustomTabQuery => {
  if (!query || typeof query !== 'object' || Array.isArray(query)) {
    return {};
  }

  const candidate = query as Partial<CustomTabQuery>;
  const state = candidate.state;
  const normalizedState: CustomTabState | undefined =
    state === 'open' || state === 'closed' || state === 'all' ? state : undefined;
  const type = candidate.type;
  const normalizedType: CustomTabSearchType | undefined =
    type === 'issues' || type === 'pulls' || type === 'all' ? type : undefined;
  const sort = candidate.sort;
  const normalizedSort: CustomTabSort | undefined =
    sort === 'best-match' ||
    sort === 'comments' ||
    sort === 'reactions' ||
    sort === 'interactions' ||
    sort === 'created' ||
    sort === 'updated'
      ? sort
      : undefined;
  const order = candidate.order;
  const normalizedOrder: CustomTabOrder | undefined =
    order === 'asc' || order === 'desc' ? order : undefined;
  const visibility = candidate.visibility;
  const normalizedVisibility: CustomTabVisibility | undefined =
    visibility === 'any' || visibility === 'public' || visibility === 'private'
      ? visibility
      : undefined;
  const archived = candidate.archived;
  const normalizedArchived: CustomTabArchived | undefined =
    archived === 'exclude' || archived === 'include' || archived === 'only' ? archived : undefined;
  const draft = candidate.draft;
  const normalizedDraft: CustomTabDraft | undefined =
    draft === 'any' || draft === 'draft' || draft === 'ready' ? draft : undefined;
  const review = candidate.review;
  const normalizedReview: CustomTabReview | undefined =
    review === 'any' ||
    review === 'none' ||
    review === 'required' ||
    review === 'approved' ||
    review === 'changes_requested'
      ? review
      : undefined;
  const sourceScopes = candidate.scopes;
  const scopes = Array.isArray(sourceScopes)
    ? sourceScopes.filter(
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
    labels: normalizeStringList(candidate.labels),
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

export function normalizeCustomTab(tab: unknown): CustomTab | null {
  if (!tab || typeof tab !== 'object' || Array.isArray(tab)) {
    return null;
  }

  const candidate = tab as Partial<CustomTab>;
  const id = normalizeString(candidate.id);
  const groupId = normalizeString(candidate.groupId);
  const name = normalizeString(candidate.name);
  const source: CustomTabSource =
    candidate.source === 'github-search' ? candidate.source : 'github-search';

  if (!id || !groupId || !name) {
    return null;
  }

  return {
    id,
    groupId,
    name,
    subtitle: normalizeString(candidate.subtitle),
    source,
    query: normalizeQuery(candidate.query),
  };
}

export function normalizeCustomTabs(value: unknown, fallback: CustomTab[] = []) {
  if (!Array.isArray(value)) {
    return cloneCustomTabs(fallback);
  }

  return value
    .map((entry) => normalizeCustomTab(entry))
    .filter((entry): entry is CustomTab => entry !== null);
}

export function normalizeUserFontSettings(
  value: unknown,
  fallback: UserFontSettings = DEFAULT_USER_FONT_SETTINGS
): UserFontSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...fallback };
  }

  const candidate = value as Partial<UserFontSettings>;
  let appFont: AppFontId = APP_FONTS.has(candidate.appFont as AppFontId)
    ? (candidate.appFont as AppFontId)
    : fallback.appFont;
  let codeFont: CodeFontId = CODE_FONTS.has(candidate.codeFont as CodeFontId)
    ? (candidate.codeFont as CodeFontId)
    : fallback.codeFont;
  const appSystemFont = normalizeSystemFontFamily(
    candidate.appSystemFont ?? fallback.appSystemFont
  );
  const codeSystemFont = normalizeSystemFontFamily(
    candidate.codeSystemFont ?? fallback.codeSystemFont
  );

  if (appFont === 'system' && !appSystemFont) {
    appFont = fallback.appFont === 'system' ? DEFAULT_USER_FONT_SETTINGS.appFont : fallback.appFont;
  }

  if (codeFont === 'system' && !codeSystemFont) {
    codeFont =
      fallback.codeFont === 'system' ? DEFAULT_USER_FONT_SETTINGS.codeFont : fallback.codeFont;
  }

  return {
    appFont,
    codeFont,
    appSystemFont,
    codeSystemFont,
  };
}

export function normalizeUserSettings(value: unknown, fallback = createDefaultUserSettings()) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      ...fallback,
      fonts: { ...fallback.fonts },
      tabGroups: cloneTabGroups(fallback.tabGroups),
      customTabs: cloneCustomTabs(fallback.customTabs),
    };
  }

  const candidate = value as Partial<UserSettings>;

  return {
    version: 1 as const,
    fonts: normalizeUserFontSettings(candidate.fonts, fallback.fonts),
    tabGroups: normalizeTabGroups(candidate.tabGroups, fallback.tabGroups),
    customTabs: normalizeCustomTabs(candidate.customTabs, fallback.customTabs),
    updatedAt: normalizeString(candidate.updatedAt),
  };
}

export function mergeUserSettingsPatch(current: UserSettings, patch: unknown) {
  const base = normalizeUserSettings(current);
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return base;
  }

  const candidate = patch as Partial<UserSettings>;

  return {
    version: 1 as const,
    fonts: hasOwn(candidate, 'fonts')
      ? normalizeUserFontSettings({ ...base.fonts, ...candidate.fonts }, base.fonts)
      : { ...base.fonts },
    tabGroups: hasOwn(candidate, 'tabGroups')
      ? normalizeTabGroups(candidate.tabGroups, base.tabGroups)
      : cloneTabGroups(base.tabGroups),
    customTabs: hasOwn(candidate, 'customTabs')
      ? normalizeCustomTabs(candidate.customTabs, base.customTabs)
      : cloneCustomTabs(base.customTabs),
    updatedAt: base.updatedAt,
  };
}

export function isDefaultTabGroups(groups: TabGroup[]) {
  const normalized = normalizeTabGroups(groups);
  return (
    normalized.length === 2 &&
    normalized[0]?.id === BUILTIN_TAB_GROUP_ID &&
    normalized[1]?.id === DEFAULT_CUSTOM_TAB_GROUP_ID &&
    normalized[1]?.name === 'General'
  );
}
