import type {
  CustomTab,
  CustomTabSource,
  CustomTabSubtitleMode,
  GitHubPullSearchQuery,
  GitHubSearchArchivedFilter,
  GitHubSearchEndpoint,
  GitHubSearchItemType,
  GitHubSearchQuery,
  GitHubSearchScope,
  GitHubSearchVisibilityFilter,
} from '#shared/types/custom-search';
import type {
  DashboardNotification,
  DashboardNotificationRepository,
  DashboardNotificationSubject,
  NotificationLabel,
  NotificationSubjectState,
  NotificationSubjectStateStatus,
} from '#shared/types/notifications';
import type {
  AppFontId,
  CodeFontId,
  NotificationTodoItem,
  NotificationReadMarkDelaySeconds,
  NotificationReadMarkMode,
  ShikiDarkThemeId,
  ShikiLightThemeId,
  UserAppearanceSettings,
  UserFontSettings,
  UserNotificationBehaviorSettings,
  UserSettings,
} from '#shared/types/user-settings';

import {
  CUSTOM_TAB_SOURCES,
  CUSTOM_TAB_SUBTITLE_MODES,
  GITHUB_SEARCH_ARCHIVED_FILTERS,
  GITHUB_SEARCH_DRAFT_FILTERS,
  GITHUB_SEARCH_ENDPOINTS,
  GITHUB_SEARCH_ISSUE_STATES,
  GITHUB_SEARCH_PULL_STATES,
  GITHUB_SEARCH_REVIEW_FILTERS,
  GITHUB_SEARCH_SCOPES,
  GITHUB_SEARCH_VISIBILITY_FILTERS,
} from '../types/custom-search';
import {
  BUILTIN_TAB_GROUP_ID,
  DEFAULT_CUSTOM_TAB_GROUP_ID,
  TAB_GROUP_SOURCES,
  type TabGroup,
} from '../types/tab-groups';
import {
  APP_FONT_IDS,
  CODE_FONT_IDS,
  NOTIFICATION_READ_MARK_DELAY_SECONDS,
  NOTIFICATION_READ_MARK_MODE_IDS,
  SHIKI_DARK_THEME_IDS,
  SHIKI_LIGHT_THEME_IDS,
} from '../types/user-settings';

const APP_FONTS = new Set<AppFontId>(APP_FONT_IDS);
const CODE_FONTS = new Set<CodeFontId>(CODE_FONT_IDS);
const NOTIFICATION_READ_MARK_MODES = new Set<NotificationReadMarkMode>(
  NOTIFICATION_READ_MARK_MODE_IDS
);
const NOTIFICATION_READ_MARK_DELAYS = new Set<NotificationReadMarkDelaySeconds>(
  NOTIFICATION_READ_MARK_DELAY_SECONDS
);
const SHIKI_LIGHT_THEMES = new Set<ShikiLightThemeId>(SHIKI_LIGHT_THEME_IDS);
const SHIKI_DARK_THEMES = new Set<ShikiDarkThemeId>(SHIKI_DARK_THEME_IDS);
const NOTIFICATION_SUBJECT_STATES = new Set<NotificationSubjectState>(['open', 'closed', 'merged']);
const NOTIFICATION_SUBJECT_STATE_STATUSES = new Set<NotificationSubjectStateStatus>([
  'pending',
  'loaded',
  'error',
  'unavailable',
]);

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

export const DEFAULT_USER_APPEARANCE_SETTINGS: UserAppearanceSettings = {
  shikiLightTheme: 'github-light',
  shikiDarkTheme: 'github-dark',
};

export const DEFAULT_USER_NOTIFICATION_BEHAVIOR_SETTINGS: UserNotificationBehaviorSettings = {
  readMarkMode: 'delayed',
  readMarkDelaySeconds: 10,
};

const hasOwn = (value: object, key: string) => {
  return Object.prototype.hasOwnProperty.call(value, key);
};

const isOneOf = <TValue extends string>(
  values: readonly TValue[],
  value: unknown
): value is TValue => {
  return typeof value === 'string' && values.includes(value as TValue);
};

const normalizeString = (value: unknown, maxLength = 240) => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
};

const normalizeDateTimeString = (value: unknown) => {
  const normalized = normalizeString(value, 80);
  if (!normalized) return undefined;

  return Number.isNaN(Date.parse(normalized)) ? undefined : normalized;
};

const normalizeNotificationId = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return normalizeString(value);
};

const normalizeNotificationNumber = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    return undefined;
  }

  return value;
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
    appearance: { ...DEFAULT_USER_APPEARANCE_SETTINGS },
    notificationBehavior: { ...DEFAULT_USER_NOTIFICATION_BEHAVIOR_SETTINGS },
    tabGroups: createDefaultTabGroups(),
    customTabs: [],
    notificationTodos: [],
  };
}

export function cloneTabGroup(group: TabGroup): TabGroup {
  return { ...group };
}

export function cloneTabGroups(groups: TabGroup[]) {
  return groups.map((group) => cloneTabGroup(group));
}

const cloneQuery = (query: GitHubSearchQuery): GitHubSearchQuery => {
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

const cloneNotificationLabels = (labels?: NotificationLabel[]) => {
  return labels?.map((label) => ({ ...label }));
};

const cloneDashboardNotificationSubject = (
  subject?: DashboardNotificationSubject
): DashboardNotificationSubject | undefined => {
  if (!subject) return undefined;

  return {
    ...subject,
    labels: cloneNotificationLabels(subject.labels),
  };
};

const cloneDashboardNotificationRepository = (
  repository?: DashboardNotificationRepository
): DashboardNotificationRepository | undefined => {
  if (!repository) return undefined;

  return {
    ...repository,
    owner: repository.owner ? { ...repository.owner } : undefined,
  };
};

export function cloneDashboardNotification(
  notification: DashboardNotification
): DashboardNotification {
  return {
    ...notification,
    subject: cloneDashboardNotificationSubject(notification.subject),
    repository: cloneDashboardNotificationRepository(notification.repository),
  };
}

export function cloneNotificationTodoItem(item: NotificationTodoItem): NotificationTodoItem {
  return {
    ...item,
    notification: cloneDashboardNotification(item.notification),
  };
}

export function cloneNotificationTodos(items: NotificationTodoItem[]) {
  return items.map((item) => cloneNotificationTodoItem(item));
}

const normalizeNotificationLabels = (value: unknown) => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const labels = value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return [];
    }

    const candidate = entry as Partial<NotificationLabel>;
    const name = normalizeString(candidate.name);
    const color = normalizeString(candidate.color, 32);
    return name && color ? [{ name, color }] : [];
  });

  return labels.length > 0 ? labels : undefined;
};

const normalizeDashboardNotificationSubject = (
  value: unknown
): DashboardNotificationSubject | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const candidate = value as Partial<DashboardNotificationSubject>;
  const state = NOTIFICATION_SUBJECT_STATES.has(candidate.state as NotificationSubjectState)
    ? (candidate.state as NotificationSubjectState)
    : undefined;
  const stateStatus = NOTIFICATION_SUBJECT_STATE_STATUSES.has(
    candidate.stateStatus as NotificationSubjectStateStatus
  )
    ? (candidate.stateStatus as NotificationSubjectStateStatus)
    : undefined;

  return {
    title: normalizeString(candidate.title),
    type: normalizeString(candidate.type),
    url: normalizeString(candidate.url, 1000),
    number: normalizeNotificationNumber(candidate.number),
    state,
    isAnswered: typeof candidate.isAnswered === 'boolean' ? candidate.isAnswered : undefined,
    stateStatus,
    labels: normalizeNotificationLabels(candidate.labels),
    authorLogin: normalizeString(candidate.authorLogin),
    authorAvatarUrl: normalizeString(candidate.authorAvatarUrl, 1000),
  };
};

const normalizeDashboardNotificationRepository = (
  value: unknown
): DashboardNotificationRepository | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const candidate = value as Partial<DashboardNotificationRepository>;
  const owner =
    candidate.owner && typeof candidate.owner === 'object' && !Array.isArray(candidate.owner)
      ? {
          login: normalizeString(candidate.owner.login),
          avatar_url: normalizeString(candidate.owner.avatar_url, 1000),
        }
      : undefined;

  return {
    full_name: normalizeString(candidate.full_name),
    url: normalizeString(candidate.url, 1000),
    owner,
  };
};

export function normalizeDashboardNotification(value: unknown): DashboardNotification | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Partial<DashboardNotification>;
  const id = normalizeNotificationId(candidate.id);
  if (!id) {
    return null;
  }

  return {
    id,
    subject: normalizeDashboardNotificationSubject(candidate.subject),
    repository: normalizeDashboardNotificationRepository(candidate.repository),
    unread: false,
    updated_at: normalizeDateTimeString(candidate.updated_at),
    reason: normalizeString(candidate.reason),
    html_url: normalizeString(candidate.html_url, 1000),
  };
}

export function normalizeNotificationTodoItem(value: unknown): NotificationTodoItem | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Partial<NotificationTodoItem>;
  const notification = normalizeDashboardNotification(candidate.notification);
  const id = normalizeString(candidate.id) ?? (notification ? String(notification.id) : undefined);
  const addedAt = normalizeDateTimeString(candidate.addedAt);

  if (!id || !addedAt || !notification) {
    return null;
  }

  return {
    id,
    addedAt,
    notification,
  };
}

export function normalizeNotificationTodos(value: unknown, fallback: NotificationTodoItem[] = []) {
  if (!Array.isArray(value)) {
    return cloneNotificationTodos(fallback);
  }

  return value
    .map((entry) => normalizeNotificationTodoItem(entry))
    .filter((entry): entry is NotificationTodoItem => entry !== null);
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
    source: isOneOf(TAB_GROUP_SOURCES, candidate.source) ? candidate.source : 'github-search',
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

type GitHubSearchQueryCandidate = Partial<Omit<GitHubPullSearchQuery, 'type'>> & {
  type?: unknown;
  repositoryId?: unknown;
};

const appendLegacyLabelRepositoryId = (
  endpoint: GitHubSearchEndpoint,
  syntax: string | undefined,
  repositoryId: string | undefined
) => {
  if (endpoint !== 'labels' || !repositoryId) {
    return syntax;
  }

  const normalizedSyntax = syntax?.trim();
  if (normalizedSyntax?.includes('repository_id:')) {
    return normalizedSyntax;
  }

  return `repository_id:${repositoryId} ${normalizedSyntax ?? ''}`.trim();
};

const normalizeQuery = (query: unknown): GitHubSearchQuery => {
  if (!query || typeof query !== 'object' || Array.isArray(query)) {
    return { type: 'issues' };
  }

  const candidate = query as GitHubSearchQueryCandidate;
  const type: GitHubSearchItemType = candidate.type === 'pulls' ? 'pulls' : 'issues';
  const endpoint: GitHubSearchEndpoint = isOneOf(GITHUB_SEARCH_ENDPOINTS, candidate.endpoint)
    ? candidate.endpoint
    : 'issues';
  const state = candidate.state;
  const visibility = candidate.visibility;
  const normalizedVisibility: GitHubSearchVisibilityFilter | undefined = isOneOf(
    GITHUB_SEARCH_VISIBILITY_FILTERS,
    visibility
  )
    ? visibility
    : undefined;
  const archived = candidate.archived;
  const normalizedArchived: GitHubSearchArchivedFilter | undefined = isOneOf(
    GITHUB_SEARCH_ARCHIVED_FILTERS,
    archived
  )
    ? archived
    : undefined;
  const sourceScopes = candidate.scopes;
  const scopes = Array.isArray(sourceScopes)
    ? sourceScopes.filter((scope): scope is GitHubSearchScope =>
        isOneOf(GITHUB_SEARCH_SCOPES, scope)
      )
    : undefined;
  const perPage =
    typeof candidate.perPage === 'number' && Number.isFinite(candidate.perPage)
      ? Math.min(Math.max(Math.trunc(candidate.perPage), 1), 100)
      : undefined;

  const sharedQuery = {
    endpoint,
    syntax: appendLegacyLabelRepositoryId(
      endpoint,
      normalizeString(candidate.syntax),
      normalizeString(candidate.repositoryId)
    ),
    text: normalizeString(candidate.text),
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
    scopes,
    visibility: normalizedVisibility,
    archived: normalizedArchived,
    perPage,
  };

  if (type === 'pulls') {
    const draft = candidate.draft;
    const review = candidate.review;

    return {
      ...sharedQuery,
      type,
      state: isOneOf(GITHUB_SEARCH_PULL_STATES, state) ? state : undefined,
      draft: isOneOf(GITHUB_SEARCH_DRAFT_FILTERS, draft) ? draft : undefined,
      review: isOneOf(GITHUB_SEARCH_REVIEW_FILTERS, review) ? review : undefined,
      base: normalizeString(candidate.base),
      head: normalizeString(candidate.head),
    };
  }

  return {
    ...sharedQuery,
    type,
    state: isOneOf(GITHUB_SEARCH_ISSUE_STATES, state) ? state : undefined,
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
  const source: CustomTabSource = isOneOf(CUSTOM_TAB_SOURCES, candidate.source)
    ? candidate.source
    : 'github-search';

  if (!id || !groupId || !name) {
    return null;
  }

  const subtitle = normalizeString(candidate.subtitle);
  const requestedSubtitleMode = isOneOf(CUSTOM_TAB_SUBTITLE_MODES, candidate.subtitleMode)
    ? candidate.subtitleMode
    : undefined;
  const subtitleMode: CustomTabSubtitleMode =
    requestedSubtitleMode === 'none' ? 'none' : subtitle ? 'custom' : 'none';

  return {
    id,
    groupId,
    name,
    subtitle: subtitleMode === 'custom' ? subtitle : undefined,
    subtitleMode,
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

export function normalizeUserAppearanceSettings(
  value: unknown,
  fallback: UserAppearanceSettings = DEFAULT_USER_APPEARANCE_SETTINGS
): UserAppearanceSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...fallback };
  }

  const candidate = value as Partial<UserAppearanceSettings>;

  return {
    shikiLightTheme: SHIKI_LIGHT_THEMES.has(candidate.shikiLightTheme as ShikiLightThemeId)
      ? (candidate.shikiLightTheme as ShikiLightThemeId)
      : fallback.shikiLightTheme,
    shikiDarkTheme: SHIKI_DARK_THEMES.has(candidate.shikiDarkTheme as ShikiDarkThemeId)
      ? (candidate.shikiDarkTheme as ShikiDarkThemeId)
      : fallback.shikiDarkTheme,
  };
}

export function normalizeUserNotificationBehaviorSettings(
  value: unknown,
  fallback: UserNotificationBehaviorSettings = DEFAULT_USER_NOTIFICATION_BEHAVIOR_SETTINGS
): UserNotificationBehaviorSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...fallback };
  }

  const candidate = value as Partial<UserNotificationBehaviorSettings>;

  return {
    readMarkMode: NOTIFICATION_READ_MARK_MODES.has(
      candidate.readMarkMode as NotificationReadMarkMode
    )
      ? (candidate.readMarkMode as NotificationReadMarkMode)
      : fallback.readMarkMode,
    readMarkDelaySeconds: NOTIFICATION_READ_MARK_DELAYS.has(
      candidate.readMarkDelaySeconds as NotificationReadMarkDelaySeconds
    )
      ? (candidate.readMarkDelaySeconds as NotificationReadMarkDelaySeconds)
      : fallback.readMarkDelaySeconds,
  };
}

export function normalizeUserSettings(value: unknown, fallback = createDefaultUserSettings()) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      ...fallback,
      fonts: { ...fallback.fonts },
      appearance: { ...fallback.appearance },
      notificationBehavior: { ...fallback.notificationBehavior },
      tabGroups: cloneTabGroups(fallback.tabGroups),
      customTabs: cloneCustomTabs(fallback.customTabs),
      notificationTodos: cloneNotificationTodos(fallback.notificationTodos),
    };
  }

  const candidate = value as Partial<UserSettings>;

  return {
    version: 1 as const,
    fonts: normalizeUserFontSettings(candidate.fonts, fallback.fonts),
    appearance: normalizeUserAppearanceSettings(candidate.appearance, fallback.appearance),
    notificationBehavior: normalizeUserNotificationBehaviorSettings(
      candidate.notificationBehavior,
      fallback.notificationBehavior
    ),
    tabGroups: normalizeTabGroups(candidate.tabGroups, fallback.tabGroups),
    customTabs: normalizeCustomTabs(candidate.customTabs, fallback.customTabs),
    notificationTodos: normalizeNotificationTodos(
      candidate.notificationTodos,
      fallback.notificationTodos
    ),
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
    appearance: hasOwn(candidate, 'appearance')
      ? normalizeUserAppearanceSettings(
          { ...base.appearance, ...candidate.appearance },
          base.appearance
        )
      : { ...base.appearance },
    notificationBehavior: hasOwn(candidate, 'notificationBehavior')
      ? normalizeUserNotificationBehaviorSettings(
          { ...base.notificationBehavior, ...candidate.notificationBehavior },
          base.notificationBehavior
        )
      : { ...base.notificationBehavior },
    tabGroups: hasOwn(candidate, 'tabGroups')
      ? normalizeTabGroups(candidate.tabGroups, base.tabGroups)
      : cloneTabGroups(base.tabGroups),
    customTabs: hasOwn(candidate, 'customTabs')
      ? normalizeCustomTabs(candidate.customTabs, base.customTabs)
      : cloneCustomTabs(base.customTabs),
    notificationTodos: hasOwn(candidate, 'notificationTodos')
      ? normalizeNotificationTodos(candidate.notificationTodos, base.notificationTodos)
      : cloneNotificationTodos(base.notificationTodos),
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
