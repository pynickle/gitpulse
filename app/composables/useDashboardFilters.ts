import { computed } from 'vue';
import type { LocationQueryRaw } from 'vue-router';

import type {
  GitHubSearchArchivedFilter,
  GitHubSearchOrder,
  GitHubSearchQuery,
  GitHubSearchReviewFilter,
  GitHubSearchSort,
} from '#shared/types/custom-search';
import type { DashboardNotification } from '#shared/types/notifications';

import getQueryParamValue from '../utils/getQueryParamValue';
import parseGitHubRepoPath from '../utils/parseGitHubRepoPath';
import type { DashboardTab } from './useDashboardTabs';

export type DashboardRouteState = 'all' | 'unread' | 'read' | 'open' | 'closed' | 'merged';

export interface DashboardRouteFilters {
  state?: DashboardRouteState;
  repo?: string;
  author?: string;
  labels: string[];
  reason?: string;
  subjectType?: string;
  subjectState?: 'open' | 'closed' | 'merged';
  review?: Exclude<GitHubSearchReviewFilter, 'any'>;
  archived?: GitHubSearchArchivedFilter;
  sort?: Exclude<GitHubSearchSort, 'best-match'>;
  order?: GitHubSearchOrder;
}

export interface DashboardFilterChip {
  key: keyof DashboardRouteFilters | 'labels';
  value: string;
  labelKey: string;
  labelValue: string;
}

export type DashboardFilterSource = Extract<
  DashboardTab,
  'notifications' | 'issues' | 'pulls' | 'repos'
>;

export interface NotificationFilterAdapter {
  apiParams: {
    all?: boolean;
    participating?: boolean;
    since?: string;
    before?: string;
  };
  local: {
    readState?: 'unread' | 'read';
    repo?: string;
    author?: string;
    labels: string[];
    reason?: string;
    subjectType?: string;
    subjectState?: 'open' | 'closed' | 'merged';
  };
  usesPageLocalPredicates: boolean;
}

export interface DashboardFilterSourceState {
  filters: DashboardRouteFilters;
  chips: DashboardFilterChip[];
  hasActiveFilters: boolean;
  notificationAdapter: NotificationFilterAdapter;
  issuePrQuery?: GitHubSearchQuery;
  overlayCustomTabQuery: (savedQuery: GitHubSearchQuery) => GitHubSearchQuery;
}

export const dashboardFilterQueryKeys = [
  'f_state',
  'f_repo',
  'f_author',
  'f_labels',
  'f_reason',
  'f_subject',
  'f_subject_state',
  'f_review',
  'f_archived',
  'f_sort',
  'f_order',
] as const;

type DashboardFilterQueryKey = (typeof dashboardFilterQueryKeys)[number];

const STATE_VALUES = new Set<DashboardRouteState>([
  'all',
  'unread',
  'read',
  'open',
  'closed',
  'merged',
]);
const REVIEW_VALUES = new Set<Exclude<GitHubSearchReviewFilter, 'any'>>([
  'none',
  'required',
  'approved',
  'changes_requested',
]);
const ARCHIVED_VALUES = new Set<GitHubSearchArchivedFilter>(['exclude', 'include', 'only']);
const SORT_VALUES = new Set<Exclude<GitHubSearchSort, 'best-match'>>([
  'comments',
  'reactions',
  'interactions',
  'created',
  'updated',
]);
const ISSUE_STATE_VALUES = new Set<DashboardRouteState>(['all', 'open', 'closed', 'merged']);
const SUBJECT_STATE_VALUES = new Set<NonNullable<DashboardRouteFilters['subjectState']>>([
  'open',
  'closed',
  'merged',
]);
const archivedChipOptionByValue: Record<GitHubSearchArchivedFilter, string> = {
  exclude: 'excludeArchived',
  include: 'includeArchived',
  only: 'onlyArchived',
};

const createEmptyDashboardRouteFilters = (): DashboardRouteFilters => ({ labels: [] });

export const hasNotificationPageLocalPredicates = (
  localFilters: NotificationFilterAdapter['local']
) => {
  return Boolean(
    localFilters.readState === 'read' ||
    localFilters.repo ||
    localFilters.reason ||
    localFilters.subjectType ||
    localFilters.subjectState
  );
};

const getStringValue = (query: Record<string, unknown>, key: DashboardFilterQueryKey) => {
  return getQueryParamValue(query[key])?.trim() || undefined;
};

const parseList = (value: string | undefined) => {
  return (
    value
      ?.split(',')
      .map((item) => item.trim())
      .filter(Boolean) ?? []
  );
};

const setQueryValue = (query: LocationQueryRaw, key: DashboardFilterQueryKey, value?: string) => {
  if (value) {
    query[key] = value;
    return;
  }

  delete query[key];
};

const getTrimmedFilterValue = (value: string | undefined) => {
  const trimmedValue = value?.trim();
  return trimmedValue && trimmedValue.length > 0 ? trimmedValue : undefined;
};

const getTrimmedFilterList = (values: string[] | undefined) => {
  return values?.map((value) => value.trim()).filter((value) => value.length > 0) ?? [];
};

export const parseDashboardRouteFilters = (
  query: Record<string, unknown>
): DashboardRouteFilters => {
  const state = getStringValue(query, 'f_state');
  const review = getStringValue(query, 'f_review');
  const archived = getStringValue(query, 'f_archived');
  const sort = getStringValue(query, 'f_sort');
  const order = getStringValue(query, 'f_order');
  const subjectState = getStringValue(query, 'f_subject_state');

  return {
    state: STATE_VALUES.has(state as DashboardRouteState)
      ? (state as DashboardRouteState)
      : undefined,
    repo: getStringValue(query, 'f_repo'),
    author: getStringValue(query, 'f_author'),
    labels: parseList(getStringValue(query, 'f_labels')),
    reason: getStringValue(query, 'f_reason'),
    subjectType: getStringValue(query, 'f_subject'),
    subjectState: SUBJECT_STATE_VALUES.has(
      subjectState as NonNullable<DashboardRouteFilters['subjectState']>
    )
      ? (subjectState as NonNullable<DashboardRouteFilters['subjectState']>)
      : undefined,
    review: REVIEW_VALUES.has(review as Exclude<GitHubSearchReviewFilter, 'any'>)
      ? (review as Exclude<GitHubSearchReviewFilter, 'any'>)
      : undefined,
    archived: ARCHIVED_VALUES.has(archived as GitHubSearchArchivedFilter)
      ? (archived as GitHubSearchArchivedFilter)
      : undefined,
    sort: SORT_VALUES.has(sort as Exclude<GitHubSearchSort, 'best-match'>)
      ? (sort as Exclude<GitHubSearchSort, 'best-match'>)
      : undefined,
    order: order === 'asc' || order === 'desc' ? order : undefined,
  };
};

export const serializeDashboardRouteFilters = (filters: DashboardRouteFilters) => {
  const query: LocationQueryRaw = {};

  setQueryValue(query, 'f_state', filters.state);
  setQueryValue(query, 'f_repo', filters.repo);
  setQueryValue(query, 'f_author', filters.author);
  setQueryValue(
    query,
    'f_labels',
    filters.labels.length > 0 ? filters.labels.join(',') : undefined
  );
  setQueryValue(query, 'f_reason', filters.reason);
  setQueryValue(query, 'f_subject', filters.subjectType);
  setQueryValue(query, 'f_subject_state', filters.subjectState);
  setQueryValue(query, 'f_review', filters.review);
  setQueryValue(query, 'f_archived', filters.archived);
  setQueryValue(query, 'f_sort', filters.sort);
  setQueryValue(query, 'f_order', filters.order);

  return query;
};

export const hasDashboardRouteFilters = (filters: DashboardRouteFilters) => {
  return Boolean(
    filters.state ||
    filters.repo ||
    filters.author ||
    filters.labels.length > 0 ||
    filters.reason ||
    filters.subjectType ||
    filters.subjectState ||
    filters.review ||
    filters.archived ||
    filters.sort ||
    filters.order
  );
};

export const createDashboardEffectiveFilters = (
  source: DashboardFilterSource,
  filters: DashboardRouteFilters
): DashboardRouteFilters => {
  const effective = createEmptyDashboardRouteFilters();

  if (source === 'repos') {
    return effective;
  }

  effective.repo = filters.repo;

  if (source === 'notifications') {
    if (filters.state === 'all' || filters.state === 'unread' || filters.state === 'read') {
      effective.state = filters.state;
    }
    effective.reason = filters.reason;
    effective.subjectType = filters.subjectType;
    effective.subjectState = filters.subjectState;
    return effective;
  }

  effective.author = filters.author;
  effective.labels = filters.labels;

  if (filters.state === 'all' || filters.state === 'open' || filters.state === 'closed') {
    effective.state = filters.state;
  } else if (source === 'pulls' && filters.state === 'merged') {
    effective.state = 'merged';
  }

  effective.archived = filters.archived;
  effective.sort = filters.sort;
  effective.order = filters.order;

  if (effective.state === 'open') {
    delete effective.state;
  }
  if (effective.archived === 'exclude') {
    delete effective.archived;
  }
  if (effective.sort === 'updated') {
    delete effective.sort;
  }
  if (effective.order === 'desc') {
    delete effective.order;
  }

  if (source === 'pulls') {
    effective.review = filters.review;
  }

  return effective;
};

export const clearDashboardRouteFilters = (query: LocationQueryRaw) => {
  const nextQuery = { ...query };
  for (const key of dashboardFilterQueryKeys) {
    delete nextQuery[key];
  }
  delete nextQuery.page;
  return nextQuery;
};

export const clearDashboardSourceFilters = (
  source: DashboardFilterSource,
  filters: DashboardRouteFilters
): DashboardRouteFilters => {
  const effectiveFilters = createDashboardEffectiveFilters(source, filters);
  const nextFilters: DashboardRouteFilters = {
    ...filters,
    labels: [...filters.labels],
  };

  for (const key of [
    'state',
    'repo',
    'author',
    'reason',
    'subjectType',
    'subjectState',
    'review',
    'archived',
    'sort',
    'order',
  ] as const) {
    if (effectiveFilters[key]) {
      delete nextFilters[key];
    }
  }

  if (effectiveFilters.labels.length > 0) {
    nextFilters.labels = [];
  }

  return nextFilters;
};

export const createDashboardFilterChips = (
  filters: DashboardRouteFilters
): DashboardFilterChip[] => {
  const chips: DashboardFilterChip[] = [];

  if (filters.state) {
    chips.push({
      key: 'state',
      value: filters.state,
      labelKey: 'dashboard.filters.chips.state',
      labelValue: `dashboard.filters.options.${filters.state}`,
    });
  }

  for (const key of [
    'repo',
    'author',
    'reason',
    'subjectType',
    'subjectState',
    'review',
    'archived',
    'sort',
    'order',
  ] as const) {
    const value = filters[key];
    if (value) {
      const labelValue =
        key === 'review' || key === 'sort' || key === 'order'
          ? `dashboard.filters.options.${value}`
          : key === 'archived'
            ? `dashboard.filters.options.${archivedChipOptionByValue[value as GitHubSearchArchivedFilter]}`
            : value;

      chips.push({
        key,
        value,
        labelKey: `dashboard.filters.chips.${key}`,
        labelValue,
      });
    }
  }

  for (const label of filters.labels) {
    chips.push({
      key: 'labels',
      value: label,
      labelKey: 'dashboard.filters.chips.label',
      labelValue: label,
    });
  }

  return chips;
};

export const buildNotificationFilterAdapter = (
  filters: DashboardRouteFilters
): NotificationFilterAdapter => {
  const readState =
    filters.state === 'read' || filters.state === 'unread' ? filters.state : undefined;
  const localFilters: NotificationFilterAdapter['local'] = {
    readState,
    repo: filters.repo,
    author: undefined,
    labels: [],
    reason: filters.reason,
    subjectType: filters.subjectType,
    subjectState: filters.subjectState,
  };

  return {
    apiParams: {
      all: filters.state === 'unread' ? undefined : true,
    },
    local: localFilters,
    usesPageLocalPredicates: hasNotificationPageLocalPredicates(localFilters),
  };
};

export const buildBuiltinIssuePrFilterQuery = (
  tab: Extract<DashboardTab, 'issues' | 'pulls'>,
  filters: DashboardRouteFilters,
  userLogin?: string
): GitHubSearchQuery => {
  const sharedQuery = {
    archived: filters.archived ?? ('exclude' as const),
    sort: filters.sort ?? ('updated' as const),
    order: filters.order ?? ('desc' as const),
    ...(userLogin ? { involves: userLogin } : {}),
    ...(filters.repo ? { repo: filters.repo } : {}),
    ...(filters.author ? { author: filters.author } : {}),
    ...(filters.labels.length > 0 ? { labels: filters.labels } : {}),
  };

  if (tab === 'pulls') {
    return {
      ...sharedQuery,
      type: 'pulls',
      state:
        filters.state === 'closed' || filters.state === 'all' || filters.state === 'merged'
          ? filters.state
          : 'open',
      ...(filters.review ? { review: filters.review } : {}),
    };
  }

  return {
    ...sharedQuery,
    type: 'issues',
    state: filters.state === 'closed' || filters.state === 'all' ? filters.state : 'open',
  };
};

export const buildCustomTabOverlayQuery = (
  savedQuery: GitHubSearchQuery,
  filters: DashboardRouteFilters
): GitHubSearchQuery => {
  const nextQuery: GitHubSearchQuery = { ...savedQuery };

  if (filters.repo) nextQuery.repo = filters.repo;
  if (filters.author) nextQuery.author = filters.author;
  if (filters.labels.length > 0) nextQuery.labels = filters.labels;
  if (filters.archived) nextQuery.archived = filters.archived;
  if (filters.sort) nextQuery.sort = filters.sort;
  if (filters.order) nextQuery.order = filters.order;
  if (filters.review && nextQuery.type === 'pulls') nextQuery.review = filters.review;

  if (filters.state === 'open' || filters.state === 'closed' || filters.state === 'all') {
    nextQuery.state = filters.state;
  } else if (filters.state === 'merged' && nextQuery.type === 'pulls') {
    nextQuery.state = 'merged';
  }

  return nextQuery;
};

export const applyNotificationLocalFilters = (
  items: DashboardNotification[],
  localFilters: NotificationFilterAdapter['local']
) => {
  return items.filter((notification) => {
    if (localFilters.readState === 'read' && notification.unread) return false;
    if (localFilters.readState === 'unread' && !notification.unread) return false;

    const repoName =
      notification.repository?.full_name ??
      parseGitHubRepoPath(notification.repository?.url)?.fullName ??
      '';
    if (localFilters.repo && repoName.toLowerCase() !== localFilters.repo.toLowerCase()) {
      return false;
    }

    if (
      localFilters.author &&
      notification.subject?.authorLogin?.toLowerCase() !== localFilters.author.toLowerCase()
    ) {
      return false;
    }

    if (localFilters.labels.length > 0) {
      const notificationLabels = new Set(
        (notification.subject?.labels ?? []).map((label) => label.name.toLowerCase())
      );
      if (!localFilters.labels.every((label) => notificationLabels.has(label.toLowerCase()))) {
        return false;
      }
    }

    if (localFilters.reason && notification.reason !== localFilters.reason) {
      return false;
    }

    if (localFilters.subjectType && notification.subject?.type !== localFilters.subjectType) {
      return false;
    }

    if (localFilters.subjectState && notification.subject?.state !== localFilters.subjectState) {
      return false;
    }

    return true;
  });
};

export const isIssuePrQueryFiltered = (filters: DashboardRouteFilters) => {
  return Boolean(
    (filters.state && ISSUE_STATE_VALUES.has(filters.state)) ||
    filters.repo ||
    filters.author ||
    filters.labels.length > 0 ||
    filters.review ||
    filters.archived ||
    filters.sort ||
    filters.order
  );
};

export const createDashboardFiltersFromCustomTabQuery = (
  query: GitHubSearchQuery
): DashboardRouteFilters => {
  const source: Extract<DashboardFilterSource, 'issues' | 'pulls'> =
    query.type === 'pulls' ? 'pulls' : 'issues';
  const filters: DashboardRouteFilters = {
    labels: getTrimmedFilterList(query.labels),
  };

  filters.repo = getTrimmedFilterValue(query.repo);
  filters.author = getTrimmedFilterValue(query.author);

  if (query.state === 'all') {
    filters.state = 'all';
  } else if (query.state === 'merged') {
    filters.state = 'merged';
  } else if (query.state === 'closed') {
    filters.state = 'closed';
  } else if (query.state === 'open') {
    filters.state = 'open';
  }

  if (
    query.type === 'pulls' &&
    REVIEW_VALUES.has(query.review as Exclude<GitHubSearchReviewFilter, 'any'>)
  ) {
    filters.review = query.review as Exclude<GitHubSearchReviewFilter, 'any'>;
  }

  if (ARCHIVED_VALUES.has(query.archived as GitHubSearchArchivedFilter)) {
    filters.archived = query.archived;
  }

  if (SORT_VALUES.has(query.sort as Exclude<GitHubSearchSort, 'best-match'>)) {
    filters.sort = query.sort as Exclude<GitHubSearchSort, 'best-match'>;
  }

  if (query.order === 'asc' || query.order === 'desc') {
    filters.order = query.order;
  }

  return createDashboardEffectiveFilters(source, filters);
};

export const normalizeCustomTabRouteFilterPatch = (
  patch: Partial<DashboardRouteFilters>
): Partial<DashboardRouteFilters> => {
  if (Object.hasOwn(patch, 'state') && patch.state === undefined) {
    return { ...patch, state: 'open' };
  }

  return patch;
};

const preserveCustomTabRouteState = (
  source: Extract<DashboardFilterSource, 'issues' | 'pulls'>,
  filters: DashboardRouteFilters,
  routeFilters: DashboardRouteFilters
) => {
  if (
    routeFilters.state === 'all' ||
    routeFilters.state === 'open' ||
    routeFilters.state === 'closed' ||
    (source === 'pulls' && routeFilters.state === 'merged')
  ) {
    filters.state = routeFilters.state;
  }

  return filters;
};

export const mergeDashboardRouteFilterOverlay = (
  baseFilters: DashboardRouteFilters,
  overlayFilters: DashboardRouteFilters
): DashboardRouteFilters => {
  const nextFilters: DashboardRouteFilters = {
    ...baseFilters,
    labels: overlayFilters.labels.length > 0 ? overlayFilters.labels : baseFilters.labels,
  };

  for (const key of [
    'state',
    'repo',
    'author',
    'reason',
    'subjectType',
    'subjectState',
    'review',
    'archived',
    'sort',
    'order',
  ] as const) {
    const value = overlayFilters[key];
    if (value) {
      (nextFilters as Record<typeof key, typeof value>)[key] = value;
    }
  }

  return nextFilters;
};

export const createCustomTabFilterSourceState = (
  savedQuery: GitHubSearchQuery,
  routeFilters: DashboardRouteFilters
): DashboardFilterSourceState => {
  const source: Extract<DashboardFilterSource, 'issues' | 'pulls'> =
    savedQuery.type === 'pulls' ? 'pulls' : 'issues';
  const sourceFilters = preserveCustomTabRouteState(
    source,
    createDashboardEffectiveFilters(source, routeFilters),
    routeFilters
  );
  const savedFilters = createDashboardFiltersFromCustomTabQuery(savedQuery);
  const displayFilters = mergeDashboardRouteFilterOverlay(savedFilters, sourceFilters);

  return {
    filters: displayFilters,
    chips: createDashboardFilterChips(displayFilters),
    hasActiveFilters: hasDashboardRouteFilters(displayFilters),
    notificationAdapter: buildNotificationFilterAdapter(displayFilters),
    issuePrQuery: undefined,
    overlayCustomTabQuery: (query) => buildCustomTabOverlayQuery(query, sourceFilters),
  };
};

export const createDashboardFilterSourceState = (
  source: DashboardFilterSource,
  filters: DashboardRouteFilters,
  userLogin?: string
): DashboardFilterSourceState => {
  const sourceFilters = createDashboardEffectiveFilters(source, filters);
  const issuePrQuery =
    source === 'issues' || source === 'pulls'
      ? buildBuiltinIssuePrFilterQuery(source, sourceFilters, userLogin)
      : undefined;

  return {
    filters: sourceFilters,
    chips: createDashboardFilterChips(sourceFilters),
    hasActiveFilters: hasDashboardRouteFilters(sourceFilters),
    notificationAdapter: buildNotificationFilterAdapter(sourceFilters),
    issuePrQuery,
    overlayCustomTabQuery: (savedQuery) => buildCustomTabOverlayQuery(savedQuery, sourceFilters),
  };
};

export function useDashboardFilters() {
  const route = useRoute();
  const router = useRouter();
  const localePath = useLocalePath();

  const filters = computed(() => parseDashboardRouteFilters(route.query));

  const updateFilters = async (patch: Partial<DashboardRouteFilters>) => {
    const labels = patch.labels ?? filters.value.labels;
    const nextFilters: DashboardRouteFilters = {
      ...filters.value,
      ...patch,
      labels,
    };

    await router.push({
      path: localePath('/dashboard'),
      query: {
        ...clearDashboardRouteFilters(route.query),
        ...serializeDashboardRouteFilters(nextFilters),
      },
    });
  };

  const removeFilter = async (chip: DashboardFilterChip) => {
    if (chip.key === 'labels') {
      await updateFilters({
        labels: filters.value.labels.filter((label) => label !== chip.value),
      });
      return;
    }

    await updateFilters({ [chip.key]: undefined, labels: filters.value.labels });
  };

  const clearFilters = async () => {
    await router.push({
      path: localePath('/dashboard'),
      query: clearDashboardRouteFilters(route.query),
    });
  };

  const clearSourceFilters = async (source: DashboardFilterSource) => {
    const nextFilters = clearDashboardSourceFilters(source, filters.value);
    await router.push({
      path: localePath('/dashboard'),
      query: {
        ...clearDashboardRouteFilters(route.query),
        ...serializeDashboardRouteFilters(nextFilters),
      },
    });
  };

  return {
    filters,
    updateFilters,
    removeFilter,
    clearFilters,
    clearSourceFilters,
  };
}
