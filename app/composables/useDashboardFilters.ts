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
export type DashboardIssuePrSort = Exclude<GitHubSearchSort, 'best-match'>;
export type DashboardTodoSort = 'added' | 'updated';
export type DashboardRouteSort = DashboardIssuePrSort | DashboardTodoSort;

export interface DashboardRouteFilters {
  state?: DashboardRouteState;
  repo?: string;
  author?: string;
  labels: string[];
  subjectType?: string;
  review?: Exclude<GitHubSearchReviewFilter, 'any'>;
  archived?: GitHubSearchArchivedFilter;
  sort?: DashboardRouteSort;
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
  'todos' | 'notifications' | 'issues' | 'pulls' | 'repos'
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
    subjectType?: string;
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
  // Legacy notification filters. Keep clearing them from routes, but do not
  // parse or serialize them into active dashboard filter state.
  'f_reason',
  'f_subject',
  'f_subject_state',
  'f_review',
  'f_archived',
  'f_sort',
  'f_order',
] as const;

type DashboardFilterQueryKey = (typeof dashboardFilterQueryKeys)[number];
type DashboardScalarFilterKey = Exclude<keyof DashboardRouteFilters, 'labels'>;

const dashboardScalarFilterKeys = [
  'state',
  'repo',
  'author',
  'subjectType',
  'review',
  'archived',
  'sort',
  'order',
] as const satisfies readonly DashboardScalarFilterKey[];

export type DashboardFilterKey = keyof DashboardRouteFilters;

export interface DashboardFilterSourceSchema {
  keys: readonly DashboardFilterKey[];
}

export const dashboardFilterSourceSchemas = {
  notifications: {
    keys: ['state'],
  },
  todos: {
    keys: ['repo', 'subjectType', 'sort', 'order'],
  },
  issues: {
    keys: ['state', 'repo', 'author', 'labels', 'archived', 'sort', 'order'],
  },
  pulls: {
    keys: ['state', 'repo', 'author', 'labels', 'review', 'archived', 'sort', 'order'],
  },
  repos: {
    keys: [],
  },
} as const satisfies Record<DashboardFilterSource, DashboardFilterSourceSchema>;

export const getDashboardFilterSourceSchema = (
  source: DashboardFilterSource
): DashboardFilterSourceSchema => dashboardFilterSourceSchemas[source];

export const sourceSupportsDashboardFilter = (
  source: DashboardFilterSource,
  key: DashboardFilterKey
) => getDashboardFilterSourceSchema(source).keys.includes(key);

export const sourceUsesDashboardTodoSortControls = (source: DashboardFilterSource) =>
  source === 'todos';

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
const GITHUB_SORT_VALUES = new Set<DashboardIssuePrSort>([
  'comments',
  'reactions',
  'interactions',
  'created',
  'updated',
]);
const TODO_SORT_VALUES = new Set<DashboardTodoSort>(['added', 'updated']);
const ROUTE_SORT_VALUES = new Set<DashboardRouteSort>([...GITHUB_SORT_VALUES, 'added']);
const ISSUE_STATE_VALUES = new Set<DashboardRouteState>(['all', 'open', 'closed', 'merged']);
const archivedChipOptionByValue: Record<GitHubSearchArchivedFilter, string> = {
  exclude: 'excludeArchived',
  include: 'includeArchived',
  only: 'onlyArchived',
};

const isGitHubSort = (sort: DashboardRouteFilters['sort']): sort is DashboardIssuePrSort => {
  return GITHUB_SORT_VALUES.has(sort as DashboardIssuePrSort);
};

const isTodoSort = (sort: DashboardRouteFilters['sort']): sort is DashboardTodoSort => {
  return TODO_SORT_VALUES.has(sort as DashboardTodoSort);
};

const createEmptyDashboardRouteFilters = (): DashboardRouteFilters => ({ labels: [] });

export const hasNotificationPageLocalPredicates = (
  localFilters: NotificationFilterAdapter['local']
) => {
  return Boolean(
    localFilters.readState === 'read' || localFilters.repo || localFilters.subjectType
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

export const parseDashboardRouteFilters = (
  query: Record<string, unknown>
): DashboardRouteFilters => {
  const state = getStringValue(query, 'f_state');
  const review = getStringValue(query, 'f_review');
  const archived = getStringValue(query, 'f_archived');
  const sort = getStringValue(query, 'f_sort');
  const order = getStringValue(query, 'f_order');

  return {
    state: STATE_VALUES.has(state as DashboardRouteState)
      ? (state as DashboardRouteState)
      : undefined,
    repo: getStringValue(query, 'f_repo'),
    author: getStringValue(query, 'f_author'),
    labels: parseList(getStringValue(query, 'f_labels')),
    subjectType: getStringValue(query, 'f_subject'),
    review: REVIEW_VALUES.has(review as Exclude<GitHubSearchReviewFilter, 'any'>)
      ? (review as Exclude<GitHubSearchReviewFilter, 'any'>)
      : undefined,
    archived: ARCHIVED_VALUES.has(archived as GitHubSearchArchivedFilter)
      ? (archived as GitHubSearchArchivedFilter)
      : undefined,
    sort: ROUTE_SORT_VALUES.has(sort as DashboardRouteSort)
      ? (sort as DashboardRouteSort)
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
  setQueryValue(query, 'f_subject', filters.subjectType);
  setQueryValue(query, 'f_review', filters.review);
  setQueryValue(query, 'f_archived', filters.archived);
  setQueryValue(query, 'f_sort', filters.sort);
  setQueryValue(query, 'f_order', filters.order);

  return query;
};

export const hasDashboardRouteFilters = (filters: DashboardRouteFilters) => {
  return (
    filters.labels.length > 0 || dashboardScalarFilterKeys.some((key) => Boolean(filters[key]))
  );
};

export const createDashboardFilterPatchForSource = (
  source: DashboardFilterSource,
  patch: Partial<DashboardRouteFilters>
): Partial<DashboardRouteFilters> => {
  const schema = getDashboardFilterSourceSchema(source);
  const nextPatch: Partial<DashboardRouteFilters> = {};

  for (const key of schema.keys) {
    if (Object.hasOwn(patch, key)) {
      (nextPatch as Partial<Record<DashboardFilterKey, DashboardRouteFilters[DashboardFilterKey]>>)[
        key
      ] = patch[key];
    }
  }

  return nextPatch;
};

export const createDashboardEffectiveFilters = (
  source: DashboardFilterSource,
  filters: DashboardRouteFilters
): DashboardRouteFilters => {
  const effective = createEmptyDashboardRouteFilters();

  if (source === 'repos') {
    return effective;
  }

  if (source === 'todos') {
    effective.repo = filters.repo;
    effective.subjectType = filters.subjectType;
    effective.sort = isTodoSort(filters.sort) ? filters.sort : undefined;
    effective.order = filters.order;

    if (effective.sort === 'added') {
      delete effective.sort;
    }
    if (effective.order === 'desc') {
      delete effective.order;
    }

    return effective;
  }

  if (source === 'notifications') {
    if (filters.state === 'all' || filters.state === 'unread' || filters.state === 'read') {
      effective.state = filters.state;
    }
    return effective;
  }

  effective.repo = filters.repo;
  effective.author = filters.author;
  effective.labels = filters.labels;

  if (filters.state === 'all' || filters.state === 'open' || filters.state === 'closed') {
    effective.state = filters.state;
  } else if (source === 'pulls' && filters.state === 'merged') {
    effective.state = 'merged';
  }

  effective.archived = filters.archived;
  effective.sort = isGitHubSort(filters.sort) ? filters.sort : undefined;
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

  for (const key of dashboardScalarFilterKeys) {
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

  for (const key of dashboardScalarFilterKeys) {
    const value = filters[key];
    if (value) {
      const labelValue =
        key === 'state' || key === 'review' || key === 'sort' || key === 'order'
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
  source: DashboardFilterSource,
  filters: DashboardRouteFilters
): NotificationFilterAdapter => {
  const readState =
    source === 'notifications' && (filters.state === 'read' || filters.state === 'unread')
      ? filters.state
      : undefined;
  const localFilters: NotificationFilterAdapter['local'] =
    source === 'todos'
      ? {
          repo: filters.repo,
          subjectType: filters.subjectType,
        }
      : {
          readState,
        };

  return {
    apiParams: {
      all: source === 'notifications' && filters.state === 'unread' ? undefined : true,
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
  const sort = isGitHubSort(filters.sort) ? filters.sort : undefined;
  const sharedQuery = {
    archived: filters.archived ?? ('exclude' as const),
    sort: sort ?? ('updated' as const),
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
  if (isGitHubSort(filters.sort)) nextQuery.sort = filters.sort;
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

    if (localFilters.subjectType && notification.subject?.type !== localFilters.subjectType) {
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

export const createCustomTabFilterSourceState = (
  savedQuery: GitHubSearchQuery
): DashboardFilterSourceState => {
  const source: Extract<DashboardFilterSource, 'issues' | 'pulls'> =
    savedQuery.type === 'pulls' ? 'pulls' : 'issues';
  const filters = createEmptyDashboardRouteFilters();

  return {
    filters,
    chips: [],
    hasActiveFilters: false,
    notificationAdapter: buildNotificationFilterAdapter(source, filters),
    issuePrQuery: undefined,
    overlayCustomTabQuery: (query) => query,
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
    notificationAdapter: buildNotificationFilterAdapter(source, sourceFilters),
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
