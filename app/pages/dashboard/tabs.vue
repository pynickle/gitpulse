<script setup lang="ts">
import {
  ArrowLeftIcon,
  BellIcon,
  BookMarkedIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CircleDotIcon,
  Code2Icon,
  DatabaseIcon,
  EyeIcon,
  FolderOpenIcon,
  GitBranchIcon,
  GitPullRequestIcon,
  HashIcon,
  LinkIcon,
  ListFilterIcon,
  MessageSquareIcon,
  PlusIcon,
  SearchIcon,
  TagsIcon,
  Trash2Icon,
  UserIcon,
  UsersIcon,
  XIcon,
} from 'lucide-vue-next';
import { computed, reactive, ref, shallowRef, watch } from 'vue';

import {
  appendCustomTabQueryParams,
  buildIssueSearchParts,
  getOneYearAgoSearchDate,
} from '#shared/utils/github-search-query';
import SearchResultPreview from '~/components/dashboard/SearchResultPreview.vue';
import TokenizedQuery from '~/components/dashboard/TokenizedQuery.vue';
import {
  useCustomTabs,
  type CustomTab,
  type CustomTabArchived,
  type CustomTabDraft,
  type CustomTabOrder,
  type CustomTabQuery,
  type CustomTabReview,
  type CustomTabSearchScope,
  type CustomTabSearchType,
  type CustomTabSort,
  type CustomTabSource,
  type CustomTabState,
  type CustomTabVisibility,
} from '~/composables/useCustomTabs';
import {
  BUILTIN_TAB_GROUP_ID,
  DEFAULT_CUSTOM_TAB_GROUP_ID,
  useTabGroups,
  type TabGroup,
} from '~/composables/useTabGroups';
import { useTabMigration } from '~/composables/useTabMigration';

interface SettingsTab {
  id: string;
  groupId: string;
  name: string;
  source?: CustomTabSource;
  query?: CustomTabQuery;
}

interface GroupRow extends TabGroup {
  depth: number;
}

interface SourceOption {
  id: CustomTabSource | 'github-graphql' | 'github-labels';
  labelKey: string;
  captionKey: string;
  disabled?: boolean;
}

interface ToggleOption<T extends string> {
  labelKey: string;
  value: T;
}

interface SearchPreviewRequest {
  q: string;
  sort?: string;
  order?: string;
  page: number;
  per_page: number;
}

interface SearchPreviewItem {
  id?: number;
  title: string;
  number: number;
  state: string;
  pull_request?: unknown;
  labels?: Array<{ id?: number; name: string; color?: string }>;
  repository_url: string;
  updated_at: string;
}

interface SearchPreviewResult {
  total_count?: number;
  incomplete_results?: boolean;
  request?: SearchPreviewRequest;
  items?: SearchPreviewItem[];
}

const maxGroupDepth = 1;
const previewDebounceMs = 900;
const previewPerPage = 5;
const DEFAULT_TAB_GROUP_NAME = 'General';
const { t } = useI18n();
const localePath = useLocalePath();

const sourceOptions: SourceOption[] = [
  {
    id: 'github-search',
    labelKey: 'dashboard.tabsSettings.source.githubSearch',
    captionKey: 'dashboard.tabsSettings.source.githubSearchCaption',
  },
  {
    id: 'github-graphql',
    labelKey: 'dashboard.tabsSettings.source.graphql',
    captionKey: 'dashboard.tabsSettings.source.graphqlCaption',
    disabled: true,
  },
  {
    id: 'github-labels',
    labelKey: 'dashboard.tabsSettings.source.labelsApi',
    captionKey: 'dashboard.tabsSettings.source.labelsApiCaption',
    disabled: true,
  },
];

const typeOptions: Array<ToggleOption<CustomTabSearchType>> = [
  { labelKey: 'dashboard.tabsSettings.options.issues', value: 'issues' },
  { labelKey: 'dashboard.tabsSettings.options.pullRequests', value: 'pulls' },
  { labelKey: 'dashboard.tabsSettings.options.both', value: 'all' },
];

const stateOptions: Array<ToggleOption<CustomTabState | 'any'>> = [
  { labelKey: 'dashboard.tabsSettings.options.any', value: 'any' },
  { labelKey: 'dashboard.tabsSettings.options.open', value: 'open' },
  { labelKey: 'dashboard.tabsSettings.options.closed', value: 'closed' },
  { labelKey: 'dashboard.tabsSettings.options.all', value: 'all' },
];

const scopeOptions: Array<ToggleOption<CustomTabSearchScope>> = [
  { labelKey: 'dashboard.tabsSettings.options.title', value: 'title' },
  { labelKey: 'dashboard.tabsSettings.options.body', value: 'body' },
  { labelKey: 'dashboard.tabsSettings.options.comments', value: 'comments' },
];

const sortOptions: Array<ToggleOption<CustomTabSort>> = [
  { labelKey: 'dashboard.tabsSettings.options.best', value: 'best-match' },
  { labelKey: 'dashboard.tabsSettings.options.updated', value: 'updated' },
  { labelKey: 'dashboard.tabsSettings.options.created', value: 'created' },
  { labelKey: 'dashboard.tabsSettings.options.comments', value: 'comments' },
  { labelKey: 'dashboard.tabsSettings.options.reactions', value: 'reactions' },
  { labelKey: 'dashboard.tabsSettings.options.interactions', value: 'interactions' },
];

const orderOptions: Array<ToggleOption<CustomTabOrder>> = [
  { labelKey: 'dashboard.tabsSettings.options.desc', value: 'desc' },
  { labelKey: 'dashboard.tabsSettings.options.asc', value: 'asc' },
];

const visibilityOptions: Array<ToggleOption<CustomTabVisibility>> = [
  { labelKey: 'dashboard.tabsSettings.options.any', value: 'any' },
  { labelKey: 'dashboard.tabsSettings.options.public', value: 'public' },
  { labelKey: 'dashboard.tabsSettings.options.private', value: 'private' },
];

const archivedOptions: Array<ToggleOption<CustomTabArchived>> = [
  { labelKey: 'dashboard.tabsSettings.options.excludeArchived', value: 'exclude' },
  { labelKey: 'dashboard.tabsSettings.options.include', value: 'include' },
  { labelKey: 'dashboard.tabsSettings.options.onlyArchived', value: 'only' },
];

const draftOptions: Array<ToggleOption<CustomTabDraft>> = [
  { labelKey: 'dashboard.tabsSettings.options.any', value: 'any' },
  { labelKey: 'dashboard.tabsSettings.options.draft', value: 'draft' },
  { labelKey: 'dashboard.tabsSettings.options.ready', value: 'ready' },
];

const reviewOptions: Array<ToggleOption<CustomTabReview>> = [
  { labelKey: 'dashboard.tabsSettings.options.any', value: 'any' },
  { labelKey: 'dashboard.tabsSettings.options.none', value: 'none' },
  { labelKey: 'dashboard.tabsSettings.options.required', value: 'required' },
  { labelKey: 'dashboard.tabsSettings.options.approved', value: 'approved' },
  { labelKey: 'dashboard.tabsSettings.options.changesRequested', value: 'changes_requested' },
];

const { groups, createGroup, updateGroup, deleteGroup, toggleGroupCollapsed } = useTabGroups();
const { tabs } = useTabMigration();
const { customTabs, createCustomTab, updateCustomTab, deleteCustomTab } = useCustomTabs();

const newGroup = reactive({
  name: '',
  source: 'github-search' as CustomTabSource,
});

const childGroupName = shallowRef('');
const activeChildCreatorGroupId = shallowRef<string | null>(null);

const newTab = reactive({
  name: '',
  groupId: DEFAULT_CUSTOM_TAB_GROUP_ID,
  source: 'github-search' as CustomTabSource,
  query: {
    text: '',
    type: 'issues' as CustomTabSearchType,
    repo: '',
    org: '',
    user: '',
    author: '',
    assignee: '',
    mentions: '',
    commenter: '',
    involves: '',
    milestone: '',
    state: 'open' as CustomTabState | 'any',
    scopes: ['title', 'body'] as CustomTabSearchScope[],
    labels: [] as string[],
    visibility: 'any' as CustomTabVisibility,
    archived: 'exclude' as CustomTabArchived,
    draft: 'any' as CustomTabDraft,
    review: 'any' as CustomTabReview,
    base: '',
    head: '',
    sort: 'updated' as CustomTabSort,
    order: 'desc' as CustomTabOrder,
    perPage: 20,
  },
});

const labelDraft = ref('');
const advancedFiltersOpen = ref(false);
const previewLoading = ref(false);
const previewError = ref<string | null>(null);
const previewResult = ref<SearchPreviewResult | null>(null);
let previewTimer: ReturnType<typeof setTimeout> | null = null;
let previewRequestId = 0;

const settingsTabs = computed<SettingsTab[]>(() => {
  return [...tabs.value, ...customTabs.value];
});

const builtinTabs = computed(() => {
  return tabs.value.filter((tab) => tab.groupId === BUILTIN_TAB_GROUP_ID);
});

const customGroupRows = computed<GroupRow[]>(() => {
  const rows: GroupRow[] = [];
  const visited = new Set<string>();
  const customGroups = groups.value.filter((group) => group.source !== 'system');

  const visit = (parentId: string | null, depth: number) => {
    for (const group of customGroups) {
      const currentParentId = group.parentId ?? null;
      if (currentParentId !== parentId || visited.has(group.id)) {
        continue;
      }

      visited.add(group.id);
      rows.push({ ...group, depth });
      visit(group.id, Math.min(depth + 1, maxGroupDepth));
    }
  };

  visit(null, 0);

  for (const group of customGroups) {
    if (!visited.has(group.id)) {
      rows.push({ ...group, depth: 0 });
    }
  }

  return rows;
});

const parentGroupOptions = computed(() => {
  return customGroupRows.value.filter((group) => group.depth < maxGroupDepth);
});

const editableGroupOptions = computed(() => {
  return customGroupRows.value.map((group) => ({
    id: group.id,
    name: group.name,
    depth: group.depth,
  }));
});

const selectedGroupExists = computed(() => {
  return customGroupRows.value.some((group) => group.id === newTab.groupId);
});

const selectedGroupName = computed(() => {
  return (
    customGroupRows.value.find((group) => group.id === newTab.groupId)?.name ??
    DEFAULT_TAB_GROUP_NAME
  );
});

const activeSource = computed(() => newTab.source);

const activeSourceLabel = computed(() => {
  const source = sourceOptions.find((option) => option.id === activeSource.value);
  return source ? t(source.labelKey) : activeSource.value;
});

const isPullRequestSearch = computed(() => {
  return newTab.query.type === 'pulls' || newTab.query.type === 'all';
});

const advancedFilterCount = computed(() => {
  let count = 0;
  if (newTab.query.repo.trim()) count++;
  if (newTab.query.org.trim() || newTab.query.user.trim()) count++;
  if (newTab.query.author.trim()) count++;
  if (newTab.query.assignee.trim()) count++;
  if (newTab.query.mentions.trim()) count++;
  if (newTab.query.involves.trim()) count++;
  if (newTab.query.commenter.trim()) count++;
  if (newTab.query.milestone.trim()) count++;
  if (newTab.query.visibility !== 'any') count++;
  if (newTab.query.archived !== 'exclude') count++;
  if (
    newTab.query.scopes.length > 0 &&
    (newTab.query.scopes.length !== 2 ||
      !newTab.query.scopes.includes('title') ||
      !newTab.query.scopes.includes('body'))
  )
    count++;
  if (newTab.query.draft !== 'any') count++;
  if (newTab.query.review !== 'any') count++;
  if (newTab.query.base.trim()) count++;
  if (newTab.query.head.trim()) count++;
  return count;
});

const labelSuggestions = computed(() => {
  const knownLabels = new Set<string>();

  for (const tab of customTabs.value) {
    for (const label of tab.query.labels ?? []) {
      knownLabels.add(label);
    }
  }

  const draft = labelDraft.value.trim().toLowerCase();
  return [...knownLabels]
    .filter((label) => !newTab.query.labels.includes(label))
    .filter((label) => (draft ? label.toLowerCase().includes(draft) : true))
    .slice(0, 6);
});

const getInputValue = (event: Event) => {
  if (event.target instanceof HTMLInputElement) {
    return event.target.value;
  }

  return '';
};

const isCustomTab = (tabId: string) => {
  return customTabs.value.some((tab) => tab.id === tabId);
};

const getTabsForGroup = (groupId: string) => {
  return settingsTabs.value.filter((tab) => tab.groupId === groupId && isCustomTab(tab.id));
};

const getGroupTabCount = (groupId: string) => {
  return getTabsForGroup(groupId).length;
};

const canEditGroup = (group: TabGroup) => {
  return group.source !== 'system';
};

const cleanLabels = () => {
  return newTab.query.labels.map((label) => label.trim()).filter((label) => label.length > 0);
};

const buildCurrentQuery = (): CustomTabQuery => {
  return {
    text: newTab.query.text.trim() || undefined,
    type: newTab.query.type,
    repo: newTab.query.repo.trim() || undefined,
    org: newTab.query.org.trim() || undefined,
    user: newTab.query.user.trim() || undefined,
    author: newTab.query.author.trim() || undefined,
    assignee: newTab.query.assignee.trim() || undefined,
    mentions: newTab.query.mentions.trim() || undefined,
    commenter: newTab.query.commenter.trim() || undefined,
    involves: newTab.query.involves.trim() || undefined,
    milestone: newTab.query.milestone.trim() || undefined,
    state: newTab.query.state === 'any' ? undefined : newTab.query.state,
    scopes: newTab.query.scopes.length > 0 ? [...newTab.query.scopes] : undefined,
    labels: cleanLabels().length > 0 ? cleanLabels() : undefined,
    visibility: newTab.query.visibility === 'any' ? undefined : newTab.query.visibility,
    archived: newTab.query.archived,
    draft: newTab.query.draft === 'any' ? undefined : newTab.query.draft,
    review: newTab.query.review === 'any' ? undefined : newTab.query.review,
    base: newTab.query.base.trim() || undefined,
    head: newTab.query.head.trim() || undefined,
    sort: newTab.query.sort,
    order: newTab.query.order,
    perPage: newTab.query.perPage,
  };
};

const searchQueryParts = computed(() => {
  return buildIssueSearchParts(buildCurrentQuery(), {
    createdAfter: getOneYearAgoSearchDate(),
    fallbackInvolves: '@me',
  });
});

const searchQueryString = computed(() => {
  return searchQueryParts.value.length > 0 ? searchQueryParts.value.join(' ') : 'involves:@me';
});

const previewSearchParams = computed(() => {
  const query = buildCurrentQuery();
  const searchParams = new URLSearchParams({
    page: '1',
    per_page: String(previewPerPage),
  });

  appendCustomTabQueryParams(searchParams, query);

  return searchParams;
});

const appPreviewUrl = computed(() => {
  return `/api/search/issues?${previewSearchParams.value.toString()}`;
});

const githubPreviewUrl = computed(() => {
  const searchParams = new URLSearchParams({ q: searchQueryString.value });
  if (newTab.query.type === 'issues') {
    searchParams.set('type', 'issues');
  } else if (newTab.query.type === 'pulls') {
    searchParams.set('type', 'pullrequests');
  }
  if (newTab.query.sort !== 'best-match') {
    searchParams.set('s', newTab.query.sort);
    searchParams.set('o', newTab.query.order);
  }
  return `https://github.com/search?${searchParams.toString()}`;
});

const humanPreview = computed(() => {
  const chunks = [];
  chunks.push(
    newTab.query.type === 'pulls'
      ? t('dashboard.tabsSettings.summary.pullRequests')
      : newTab.query.type === 'all'
        ? t('dashboard.tabsSettings.summary.issuesAndPullRequests')
        : t('dashboard.tabsSettings.summary.issues')
  );

  if (newTab.query.repo.trim())
    chunks.push(t('dashboard.tabsSettings.summary.inRepo', { value: newTab.query.repo.trim() }));
  if (newTab.query.author.trim())
    chunks.push(
      t('dashboard.tabsSettings.summary.authoredBy', { value: newTab.query.author.trim() })
    );
  if (newTab.query.assignee.trim())
    chunks.push(
      t('dashboard.tabsSettings.summary.assignedTo', { value: newTab.query.assignee.trim() })
    );
  if (newTab.query.involves.trim())
    chunks.push(
      t('dashboard.tabsSettings.summary.involving', { value: newTab.query.involves.trim() })
    );
  if (newTab.query.labels.length > 0)
    chunks.push(
      t('dashboard.tabsSettings.summary.labeled', { value: newTab.query.labels.join(', ') })
    );
  if (newTab.query.state !== 'any')
    chunks.push(t('dashboard.tabsSettings.summary.state', { value: newTab.query.state }));

  return t('dashboard.tabsSettings.summary.showing', { value: chunks.join(', ') });
});

const getQueryPreview = (tab: SettingsTab) => {
  if (!tab.query) {
    return t('dashboard.tabsSettings.builtinRowCaption');
  }

  const parts = buildIssueSearchParts(tab.query, {
    createdAfter: getOneYearAgoSearchDate(),
    fallbackInvolves: '@me',
  });

  return parts.length > 0 ? parts.join(' ') : t('dashboard.tabsSettings.defaultQueryPreview');
};

const setActiveSource = (source: SourceOption) => {
  if (source.disabled || source.id !== 'github-search') {
    return;
  }

  newTab.source = source.id;
};

const setNewTabGroup = (groupId: string) => {
  newTab.groupId = groupId;
};

const toggleScope = (scope: CustomTabSearchScope) => {
  if (newTab.query.scopes.includes(scope)) {
    newTab.query.scopes = newTab.query.scopes.filter((candidate) => candidate !== scope);
    return;
  }

  newTab.query.scopes = [...newTab.query.scopes, scope];
};

const addLabel = (label: string) => {
  const normalized = label.trim();
  if (!normalized || newTab.query.labels.includes(normalized)) {
    labelDraft.value = '';
    return;
  }

  newTab.query.labels = [...newTab.query.labels, normalized];
  labelDraft.value = '';
};

const handleLabelEnter = () => {
  addLabel(labelDraft.value);
};

const removeLabel = (label: string) => {
  newTab.query.labels = newTab.query.labels.filter((candidate) => candidate !== label);
};

const handleMoveTab = (tabId: string, groupId: string) => {
  if (!groupId || !isCustomTab(tabId)) {
    return;
  }

  updateCustomTab(tabId, { groupId });
};

const collectDescendantGroupIds = (groupId: string) => {
  const ids = new Set<string>();
  const visit = (parentId: string) => {
    for (const group of groups.value) {
      if (group.parentId !== parentId || ids.has(group.id)) {
        continue;
      }

      ids.add(group.id);
      visit(group.id);
    }
  };

  visit(groupId);
  return ids;
};

const handleCreateGroup = () => {
  const name = newGroup.name.trim();
  if (!name) {
    return;
  }

  createGroup({
    name,
    parentId: null,
    source: newGroup.source,
  });

  newGroup.name = '';
};

const handleStartChildGroup = (groupId: string) => {
  activeChildCreatorGroupId.value = groupId;
  childGroupName.value = '';
};

const handleCancelChildGroup = () => {
  activeChildCreatorGroupId.value = null;
  childGroupName.value = '';
};

const handleCreateChildGroup = () => {
  const parentId = activeChildCreatorGroupId.value;
  const name = childGroupName.value.trim();
  if (!parentId || !name) {
    return;
  }

  createGroup({
    name,
    parentId,
    source: newGroup.source,
  });

  handleCancelChildGroup();
};

const handleDeleteGroup = (groupId: string) => {
  const group = groups.value.find((candidate) => candidate.id === groupId);
  if (!group || !canEditGroup(group)) {
    return;
  }

  const affectedGroupIds = collectDescendantGroupIds(groupId);
  affectedGroupIds.add(groupId);
  const fallbackGroupId =
    group.parentId && !affectedGroupIds.has(group.parentId)
      ? group.parentId
      : (customGroupRows.value.find((candidate) => !affectedGroupIds.has(candidate.id))?.id ?? '');

  if (fallbackGroupId) {
    customTabs.value
      .filter((tab: CustomTab) => affectedGroupIds.has(tab.groupId))
      .forEach((tab: CustomTab) => {
        updateCustomTab(tab.id, { groupId: fallbackGroupId });
      });
  } else {
    customTabs.value
      .filter((tab: CustomTab) => affectedGroupIds.has(tab.groupId))
      .forEach((tab: CustomTab) => {
        deleteCustomTab(tab.id);
      });
  }

  for (const childGroupId of affectedGroupIds) {
    deleteGroup(childGroupId);
  }

  if (affectedGroupIds.has(newTab.groupId)) {
    newTab.groupId = fallbackGroupId;
  }
};

const handleCreateCustomTab = () => {
  const name = newTab.name.trim();
  if (!name || !selectedGroupExists.value) {
    return;
  }

  createCustomTab({
    name,
    groupId: newTab.groupId,
    source: newTab.source,
    query: buildCurrentQuery(),
  });

  newTab.name = '';
  newTab.query.text = '';
  newTab.query.repo = '';
  newTab.query.org = '';
  newTab.query.user = '';
  newTab.query.author = '';
  newTab.query.assignee = '';
  newTab.query.mentions = '';
  newTab.query.commenter = '';
  newTab.query.involves = '';
  newTab.query.milestone = '';
  newTab.query.base = '';
  newTab.query.head = '';
  newTab.query.labels = [];
  labelDraft.value = '';
};

const loadPreview = async () => {
  const requestId = previewRequestId + 1;
  previewRequestId = requestId;
  previewLoading.value = true;
  previewError.value = null;

  try {
    const result = await $fetch<SearchPreviewResult>(appPreviewUrl.value);
    if (requestId !== previewRequestId) {
      return;
    }
    previewResult.value = result;
  } catch (error) {
    if (requestId !== previewRequestId) {
      return;
    }
    previewResult.value = null;
    previewError.value =
      error instanceof Error ? error.message : t('dashboard.tabsSettings.previewFailed');
  } finally {
    if (requestId === previewRequestId) {
      previewLoading.value = false;
    }
  }
};

watch(
  customGroupRows,
  (rows) => {
    if (rows.some((group) => group.id === newTab.groupId)) {
      return;
    }

    newTab.groupId = rows[0]?.id ?? '';
  },
  { immediate: true }
);

watch(
  appPreviewUrl,
  () => {
    if (previewTimer) {
      clearTimeout(previewTimer);
    }

    previewTimer = setTimeout(() => {
      void loadPreview();
    }, previewDebounceMs);
  },
  { immediate: true }
);
</script>

<template>
  <div class="tabs-settings-page">
    <nav class="tabs-nav-back" aria-label="Page navigation">
      <NuxtLink :to="localePath('/dashboard')" class="button is-ghost is-small nav-back-link">
        <ArrowLeftIcon :size="16" />
        <span>{{ t('dashboard.tabsSettings.backToDashboard') }}</span>
      </NuxtLink>
    </nav>

    <header class="settings-header">
      <div>
        <h1 class="title is-4 mb-1">{{ t('dashboard.tabsSettings.pageTitle') }}</h1>
        <p class="settings-subtitle">{{ t('dashboard.tabsSettings.pageSubtitle') }}</p>
      </div>
      <a
        class="button is-small is-light preview-link"
        :href="githubPreviewUrl"
        target="_blank"
        rel="noreferrer"
      >
        <span class="icon is-small"><LinkIcon :size="14" /></span>
        <span>{{ t('dashboard.tabsSettings.openQuery') }}</span>
      </a>
    </header>

    <div class="settings-grid">
      <section class="box views-tree-panel">
        <div class="panel-heading-row">
          <div>
            <h2 class="title is-6 mb-1">{{ t('dashboard.tabsSettings.viewsPanelTitle') }}</h2>
            <p class="panel-caption">{{ t('dashboard.tabsSettings.viewsPanelCaption') }}</p>
          </div>
          <span class="tag is-light">{{
            t('dashboard.tabsSettings.customCount', { count: customTabs.length })
          }}</span>
        </div>

        <section class="builtin-section">
          <div class="section-label-row">
            <div class="section-label">
              <DatabaseIcon :size="15" />
              <span>{{ t('dashboard.tabsSettings.builtinSectionTitle') }}</span>
            </div>
            <span class="tag is-light is-small">{{ builtinTabs.length }}</span>
          </div>
          <div class="builtin-list">
            <article v-for="tab in builtinTabs" :key="tab.id" class="builtin-row">
              <BellIcon v-if="tab.id === 'notifications'" :size="16" />
              <CircleDotIcon v-else-if="tab.id === 'issues'" :size="16" />
              <GitPullRequestIcon v-else-if="tab.id === 'pulls'" :size="16" />
              <BookMarkedIcon v-else :size="16" />
              <div class="tree-tab-main">
                <span>{{ tab.name }}</span>
                <small>{{ t('dashboard.tabsSettings.builtinRowCaption') }}</small>
              </div>
              <span class="tag is-light is-small">{{
                t('dashboard.tabsSettings.builtinLocked')
              }}</span>
            </article>
          </div>
        </section>

        <section class="custom-section">
          <div class="section-label-row">
            <div class="section-label">
              <FolderOpenIcon :size="15" />
              <span>{{ t('dashboard.tabsSettings.customSectionTitle') }}</span>
            </div>
            <span class="tag is-primary is-light is-small">{{ customGroupRows.length }}</span>
          </div>

          <div class="group-insights" :aria-label="t('dashboard.tabsSettings.groupOverviewLabel')">
            <div class="group-insight-card">
              <strong>{{ customGroupRows.length }}</strong>
              <span>{{ t('dashboard.tabsSettings.groupInsightGroups') }}</span>
            </div>
            <div class="group-insight-card">
              <strong>{{ customTabs.length }}</strong>
              <span>{{ t('dashboard.tabsSettings.groupInsightViews') }}</span>
            </div>
            <div class="group-insight-card">
              <strong>{{ parentGroupOptions.length }}</strong>
              <span>{{ t('dashboard.tabsSettings.groupInsightParents') }}</span>
            </div>
          </div>

          <section class="group-creator-strip">
            <div class="group-creator-header">
              <div class="group-creator-icon" aria-hidden="true">
                <FolderOpenIcon :size="18" />
              </div>
              <div>
                <h3 class="group-creator-title">
                  {{ t('dashboard.tabsSettings.groupCreatorTitle') }}
                </h3>
                <p class="group-creator-copy">
                  {{ t('dashboard.tabsSettings.groupCreatorCaption') }}
                </p>
              </div>
            </div>
            <div class="group-creator-form">
              <div class="field mb-0">
                <label class="label is-small" for="new-group-name">
                  {{ t('dashboard.tabsSettings.groupNameLabel') }}
                </label>
                <div class="control has-icons-left">
                  <input
                    id="new-group-name"
                    v-model="newGroup.name"
                    class="input is-small"
                    type="text"
                    :placeholder="t('dashboard.tabsSettings.groupNamePlaceholder')"
                    @keyup.enter="handleCreateGroup"
                  />
                  <span class="icon is-small is-left"><FolderOpenIcon :size="14" /></span>
                </div>
              </div>
              <button
                class="button is-primary is-small group-create-button"
                type="button"
                :disabled="!newGroup.name.trim()"
                @click="handleCreateGroup"
              >
                <PlusIcon :size="14" />
                <span>{{ t('dashboard.tabsSettings.createGroupButton') }}</span>
              </button>
            </div>
          </section>

          <div v-if="customGroupRows.length === 0" class="empty-state">
            <FolderOpenIcon :size="36" />
            <p class="empty-state-title">{{ t('dashboard.tabsSettings.customSectionEmpty') }}</p>
            <p class="empty-state-hint">{{ t('dashboard.tabsSettings.customSectionEmptyHint') }}</p>
          </div>

          <div v-else class="tree-list">
            <article v-for="group in customGroupRows" :key="group.id" class="tree-group">
              <div
                class="tree-group-row"
                :style="{ paddingLeft: `${0.75 + group.depth * 1.1}rem` }"
              >
                <button
                  class="button is-ghost is-small tree-icon"
                  type="button"
                  @click="toggleGroupCollapsed(group.id)"
                >
                  <ChevronDownIcon :class="{ 'is-collapsed': group.collapsed }" :size="14" />
                </button>
                <div class="tree-group-main">
                  <input
                    class="input is-small tree-name-input"
                    :value="group.name"
                    :disabled="!canEditGroup(group)"
                    @change="
                      updateGroup(group.id, { name: getInputValue($event).trim() || group.name })
                    "
                  />
                  <small>
                    {{
                      group.depth === 0
                        ? t('dashboard.tabsSettings.groupTopLevel')
                        : t('dashboard.tabsSettings.groupNestedLabel')
                    }}
                    ·
                    {{
                      t('dashboard.tabsSettings.groupViewCount', {
                        count: getGroupTabCount(group.id),
                      })
                    }}
                  </small>
                </div>
                <button
                  v-if="group.depth < maxGroupDepth"
                  class="button is-ghost is-small tree-add"
                  type="button"
                  :title="t('dashboard.tabsSettings.addChildGroupTitle', { group: group.name })"
                  @click="handleStartChildGroup(group.id)"
                >
                  <PlusIcon :size="14" />
                </button>
                <button
                  class="button is-ghost is-small tree-delete"
                  type="button"
                  :disabled="!canEditGroup(group)"
                  @click="handleDeleteGroup(group.id)"
                >
                  <Trash2Icon :size="14" />
                </button>
              </div>

              <div
                v-if="activeChildCreatorGroupId === group.id"
                class="inline-child-creator"
                :style="{ marginLeft: `${2.1 + group.depth * 1.1}rem` }"
              >
                <div class="inline-child-creator__label">
                  {{ t('dashboard.tabsSettings.addChildGroupLabel', { group: group.name }) }}
                </div>
                <div class="inline-child-creator__controls">
                  <div class="control has-icons-left inline-child-creator__input">
                    <input
                      v-model="childGroupName"
                      class="input is-small"
                      type="text"
                      :placeholder="t('dashboard.tabsSettings.childGroupNamePlaceholder')"
                      @keyup.enter="handleCreateChildGroup"
                      @keyup.esc="handleCancelChildGroup"
                    />
                    <span class="icon is-small is-left"><FolderOpenIcon :size="14" /></span>
                  </div>
                  <button
                    class="button is-primary is-small"
                    type="button"
                    :disabled="!childGroupName.trim()"
                    @click="handleCreateChildGroup"
                  >
                    <PlusIcon :size="14" />
                    <span>{{ t('dashboard.tabsSettings.createGroupButton') }}</span>
                  </button>
                  <button
                    class="button is-ghost is-small"
                    type="button"
                    @click="handleCancelChildGroup"
                  >
                    {{ t('dashboard.tabsSettings.cancelChildGroupButton') }}
                  </button>
                </div>
              </div>

              <div v-if="!group.collapsed" class="tree-tabs">
                <div v-for="tab in getTabsForGroup(group.id)" :key="tab.id" class="tree-tab-row">
                  <SearchIcon :size="15" />
                  <div class="tree-tab-main">
                    <span>{{ tab.name }}</span>
                    <small>{{ getQueryPreview(tab) }}</small>
                  </div>
                  <button
                    class="button is-ghost is-small"
                    type="button"
                    @click="deleteCustomTab(tab.id)"
                  >
                    <XIcon :size="14" />
                  </button>
                  <div v-if="editableGroupOptions.length > 1" class="tab-move-tray">
                    <span class="chip-label">{{ t('dashboard.tabsSettings.moveToLabel') }}</span>
                    <button
                      v-for="option in editableGroupOptions"
                      :key="option.id"
                      class="chip-button is-compact"
                      :class="{ 'is-active': tab.groupId === option.id }"
                      type="button"
                      @click="handleMoveTab(tab.id, option.id)"
                    >
                      {{ option.name }}
                    </button>
                  </div>
                </div>
                <p v-if="getTabsForGroup(group.id).length === 0" class="empty-drop-zone">
                  {{ t('dashboard.tabsSettings.groupEmptyTabs') }}
                </p>
              </div>
            </article>
          </div>
        </section>
      </section>

      <section class="box editor-panel">
        <div class="panel-heading-row mb-4">
          <div>
            <h2 class="title is-6 mb-1">{{ t('dashboard.tabsSettings.editorTitle') }}</h2>
            <p class="panel-caption">
              {{
                t('dashboard.tabsSettings.editorCaption', {
                  source: activeSourceLabel,
                  group: selectedGroupName,
                })
              }}
            </p>
          </div>
          <span class="tag is-primary is-light">{{
            t('dashboard.tabsSettings.editorDebouncedPreview')
          }}</span>
        </div>

        <div class="source-selector" role="radiogroup" aria-label="API source">
          <button
            v-for="source in sourceOptions"
            :key="source.id"
            class="source-option"
            :class="{ 'is-active': source.id === activeSource }"
            type="button"
            role="radio"
            :aria-checked="source.id === activeSource"
            :disabled="source.disabled"
            @click="setActiveSource(source)"
          >
            <SearchIcon v-if="source.id === 'github-search'" :size="16" />
            <Code2Icon v-else-if="source.id === 'github-graphql'" :size="16" />
            <TagsIcon v-else :size="16" />
            <span>{{ t(source.labelKey) }}</span>
            <small>{{ t(source.captionKey) }}</small>
          </button>
        </div>

        <div class="field">
          <label class="label">{{ t('dashboard.tabsSettings.viewNameLabel') }}</label>
          <div class="control has-icons-left">
            <input
              v-model="newTab.name"
              class="input"
              type="text"
              :placeholder="t('dashboard.tabsSettings.viewNamePlaceholder')"
            />
            <span class="icon is-small is-left"><SearchIcon :size="16" /></span>
          </div>
        </div>

        <div class="field">
          <label class="label">{{ t('dashboard.tabsSettings.destinationGroupLabel') }}</label>
          <div class="group-picker">
            <button
              v-for="group in editableGroupOptions"
              :key="group.id"
              class="group-choice"
              :class="{ 'is-active': newTab.groupId === group.id }"
              type="button"
              @click="setNewTabGroup(group.id)"
            >
              <FolderOpenIcon :size="14" />
              <span>{{ group.depth > 0 ? `${group.name}` : group.name }}</span>
            </button>
          </div>
        </div>

        <section class="search-fields-panel">
          <div class="section-label-row mb-3">
            <div class="section-label">
              <ListFilterIcon :size="15" />
              <span>{{ t('dashboard.tabsSettings.searchParamsLabel') }}</span>
            </div>
            <span class="tag is-light is-small">{{
              t('dashboard.tabsSettings.searchParamsTag')
            }}</span>
          </div>

          <div class="field">
            <label class="label">{{ t('dashboard.tabsSettings.searchTextLabel') }}</label>
            <div class="control has-icons-left">
              <input
                v-model="newTab.query.text"
                class="input"
                type="text"
                :placeholder="t('dashboard.tabsSettings.searchTextPlaceholder')"
              />
              <span class="icon is-small is-left"><HashIcon :size="16" /></span>
            </div>
          </div>

          <div class="cmpact-row">
            <div class="toggle-section cmpact-toggle">
              <label class="label is-sr-only">{{
                t('dashboard.tabsSettings.resultTypeLabel')
              }}</label>
              <div class="segmented-row">
                <button
                  v-for="option in typeOptions"
                  :key="option.value"
                  class="segmented-button"
                  :class="{ 'is-active': newTab.query.type === option.value }"
                  type="button"
                  @click="newTab.query.type = option.value"
                >
                  {{ t(option.labelKey) }}
                </button>
              </div>
            </div>
            <div class="toggle-section cmpact-toggle">
              <label class="label is-sr-only">{{ t('dashboard.tabsSettings.stateLabel') }}</label>
              <div class="segmented-row">
                <button
                  v-for="option in stateOptions"
                  :key="option.value"
                  class="segmented-button"
                  :class="{ 'is-active': newTab.query.state === option.value }"
                  type="button"
                  @click="newTab.query.state = option.value"
                >
                  {{ t(option.labelKey) }}
                </button>
              </div>
            </div>
          </div>

          <!-- Advanced filters (collapsible) -->
          <div class="advanced-section" :class="{ 'is-open': advancedFiltersOpen }">
            <button
              class="advanced-toggle"
              type="button"
              @click="advancedFiltersOpen = !advancedFiltersOpen"
            >
              <ChevronRightIcon
                :size="14"
                class="advanced-toggle__icon"
                :class="{ rotated: advancedFiltersOpen }"
              />
              <span>{{ t('dashboard.tabsSettings.advancedToggle') }}</span>
              <span class="tag is-light is-small advanced-count">{{ advancedFilterCount }}</span>
            </button>

            <div v-if="advancedFiltersOpen" class="advanced-body">
              <div class="field-grid is-two">
                <div class="field">
                  <label class="label">{{ t('dashboard.tabsSettings.repoLabel') }}</label>
                  <div class="control has-icons-left">
                    <input
                      v-model="newTab.query.repo"
                      class="input"
                      type="text"
                      :placeholder="t('dashboard.tabsSettings.repoPlaceholder')"
                    />
                    <span class="icon is-small is-left"><GitBranchIcon :size="16" /></span>
                  </div>
                </div>
                <div class="field">
                  <label class="label">{{ t('dashboard.tabsSettings.orgUserLabel') }}</label>
                  <div class="scope-grid">
                    <div class="control has-icons-left">
                      <input
                        v-model="newTab.query.org"
                        class="input"
                        type="text"
                        :placeholder="t('dashboard.tabsSettings.orgPlaceholder')"
                      />
                      <span class="icon is-small is-left"><UsersIcon :size="16" /></span>
                    </div>
                    <div class="control has-icons-left">
                      <input
                        v-model="newTab.query.user"
                        class="input"
                        type="text"
                        :placeholder="t('dashboard.tabsSettings.userPlaceholder')"
                      />
                      <span class="icon is-small is-left"><UserIcon :size="16" /></span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="field-grid is-four">
                <div class="field">
                  <label class="label">{{ t('dashboard.tabsSettings.authorLabel') }}</label>
                  <div class="control has-icons-left">
                    <input
                      v-model="newTab.query.author"
                      class="input"
                      type="text"
                      :placeholder="t('dashboard.tabsSettings.authorPlaceholder')"
                    />
                    <span class="icon is-small is-left"><UserIcon :size="16" /></span>
                  </div>
                </div>
                <div class="field">
                  <label class="label">{{ t('dashboard.tabsSettings.assigneeLabel') }}</label>
                  <div class="control has-icons-left">
                    <input
                      v-model="newTab.query.assignee"
                      class="input"
                      type="text"
                      :placeholder="t('dashboard.tabsSettings.assigneePlaceholder')"
                    />
                    <span class="icon is-small is-left"><CheckIcon :size="16" /></span>
                  </div>
                </div>
                <div class="field">
                  <label class="label">{{ t('dashboard.tabsSettings.mentionsLabel') }}</label>
                  <div class="control has-icons-left">
                    <input
                      v-model="newTab.query.mentions"
                      class="input"
                      type="text"
                      :placeholder="t('dashboard.tabsSettings.mentionsPlaceholder')"
                    />
                    <span class="icon is-small is-left"><MessageSquareIcon :size="16" /></span>
                  </div>
                </div>
                <div class="field">
                  <label class="label">{{ t('dashboard.tabsSettings.involvesLabel') }}</label>
                  <div class="control has-icons-left">
                    <input
                      v-model="newTab.query.involves"
                      class="input"
                      type="text"
                      :placeholder="t('dashboard.tabsSettings.involvesPlaceholder')"
                    />
                    <span class="icon is-small is-left"><EyeIcon :size="16" /></span>
                  </div>
                </div>
              </div>

              <div class="field-grid is-three">
                <div class="field">
                  <label class="label">{{ t('dashboard.tabsSettings.commenterLabel') }}</label>
                  <input
                    v-model="newTab.query.commenter"
                    class="input"
                    type="text"
                    :placeholder="t('dashboard.tabsSettings.commenterPlaceholder')"
                  />
                </div>
                <div class="field">
                  <label class="label">{{ t('dashboard.tabsSettings.milestoneLabel') }}</label>
                  <input
                    v-model="newTab.query.milestone"
                    class="input"
                    type="text"
                    :placeholder="t('dashboard.tabsSettings.milestonePlaceholder')"
                  />
                </div>
                <div class="field">
                  <label class="label">{{ t('dashboard.tabsSettings.perPageLabel') }}</label>
                  <input
                    v-model.number="newTab.query.perPage"
                    class="input"
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                  />
                </div>
              </div>

              <div class="toggle-section">
                <label class="label">{{ t('dashboard.tabsSettings.searchInLabel') }}</label>
                <div class="segmented-row is-wrap">
                  <button
                    v-for="option in scopeOptions"
                    :key="option.value"
                    class="segmented-button"
                    :class="{ 'is-active': newTab.query.scopes.includes(option.value) }"
                    type="button"
                    @click="toggleScope(option.value)"
                  >
                    {{ t(option.labelKey) }}
                  </button>
                </div>
              </div>

              <div class="toggle-grid">
                <div class="toggle-section">
                  <label class="label">{{ t('dashboard.tabsSettings.visibilityLabel') }}</label>
                  <div class="segmented-row is-wrap">
                    <button
                      v-for="option in visibilityOptions"
                      :key="option.value"
                      class="segmented-button"
                      :class="{ 'is-active': newTab.query.visibility === option.value }"
                      type="button"
                      @click="newTab.query.visibility = option.value"
                    >
                      {{ t(option.labelKey) }}
                    </button>
                  </div>
                </div>
                <div class="toggle-section">
                  <label class="label">{{ t('dashboard.tabsSettings.archivedLabel') }}</label>
                  <div class="segmented-row is-wrap">
                    <button
                      v-for="option in archivedOptions"
                      :key="option.value"
                      class="segmented-button"
                      :class="{ 'is-active': newTab.query.archived === option.value }"
                      type="button"
                      @click="newTab.query.archived = option.value"
                    >
                      {{ t(option.labelKey) }}
                    </button>
                  </div>
                </div>
              </div>

              <div v-if="isPullRequestSearch" class="advanced-pr-band">
                <div class="section-label-row mb-3">
                  <div class="section-label">
                    <GitPullRequestIcon :size="15" />
                    <span>{{ t('dashboard.tabsSettings.prQualifiersTitle') }}</span>
                  </div>
                </div>
                <div class="field-grid is-two">
                  <div class="field">
                    <label class="label">{{ t('dashboard.tabsSettings.baseBranchLabel') }}</label>
                    <input
                      v-model="newTab.query.base"
                      class="input"
                      type="text"
                      :placeholder="t('dashboard.tabsSettings.baseBranchPlaceholder')"
                    />
                  </div>
                  <div class="field">
                    <label class="label">{{ t('dashboard.tabsSettings.headBranchLabel') }}</label>
                    <input
                      v-model="newTab.query.head"
                      class="input"
                      type="text"
                      :placeholder="t('dashboard.tabsSettings.headBranchPlaceholder')"
                    />
                  </div>
                </div>
                <div class="toggle-grid">
                  <div class="toggle-section">
                    <label class="label">{{ t('dashboard.tabsSettings.draftLabel') }}</label>
                    <div class="segmented-row is-wrap">
                      <button
                        v-for="option in draftOptions"
                        :key="option.value"
                        class="segmented-button"
                        :class="{ 'is-active': newTab.query.draft === option.value }"
                        type="button"
                        @click="newTab.query.draft = option.value"
                      >
                        {{ t(option.labelKey) }}
                      </button>
                    </div>
                  </div>
                  <div class="toggle-section">
                    <label class="label">{{ t('dashboard.tabsSettings.reviewLabel') }}</label>
                    <div class="segmented-row is-wrap">
                      <button
                        v-for="option in reviewOptions"
                        :key="option.value"
                        class="segmented-button"
                        :class="{ 'is-active': newTab.query.review === option.value }"
                        type="button"
                        @click="newTab.query.review = option.value"
                      >
                        {{ t(option.labelKey) }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="field">
            <label class="label is-flex is-align-items-center label-heading">
              <TagsIcon :size="16" />
              <span>{{ t('dashboard.tabsSettings.labelsLabel') }}</span>
            </label>
            <div class="label-combobox">
              <span
                v-for="label in newTab.query.labels"
                :key="label"
                class="tag is-link is-light label-chip"
              >
                {{ label }}
                <button class="delete is-small" type="button" @click="removeLabel(label)"></button>
              </span>
              <input
                v-model="labelDraft"
                class="label-input"
                type="text"
                :placeholder="t('dashboard.tabsSettings.labelsPlaceholder')"
                @keyup.enter="handleLabelEnter"
              />
            </div>
            <div v-if="labelDraft.trim() || labelSuggestions.length > 0" class="label-suggestions">
              <button
                v-for="label in labelSuggestions"
                :key="label"
                class="button is-ghost is-small suggestion-row"
                type="button"
                @click="addLabel(label)"
              >
                {{ label }}
              </button>
              <button
                v-if="labelDraft.trim()"
                class="button is-ghost is-small suggestion-row"
                type="button"
                @click="addLabel(labelDraft)"
              >
                {{ t('dashboard.tabsSettings.addLabelSuggestion', { label: labelDraft.trim() }) }}
              </button>
            </div>
          </div>

          <div class="sort-row">
            <div class="toggle-section">
              <label class="label">{{ t('dashboard.tabsSettings.sortLabel') }}</label>
              <div class="segmented-row is-wrap">
                <button
                  v-for="option in sortOptions"
                  :key="option.value"
                  class="segmented-button"
                  :class="{ 'is-active': newTab.query.sort === option.value }"
                  type="button"
                  @click="newTab.query.sort = option.value"
                >
                  {{ t(option.labelKey) }}
                </button>
              </div>
            </div>
            <div class="toggle-section">
              <label class="label">{{ t('dashboard.tabsSettings.orderLabel') }}</label>
              <div class="segmented-row is-wrap">
                <button
                  v-for="option in orderOptions"
                  :key="option.value"
                  class="segmented-button"
                  :class="{ 'is-active': newTab.query.order === option.value }"
                  type="button"
                  @click="newTab.query.order = option.value"
                >
                  {{ t(option.labelKey) }}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section class="preview-panel">
          <div class="preview-header">
            <div>
              <p class="panel-caption mb-1">{{ t('dashboard.tabsSettings.previewLabel') }}</p>
              <strong>{{ humanPreview }}</strong>
            </div>
          </div>

          <div class="tokenized-query-box">
            <div class="tqb-header">
              <span class="tqb-label">{{ t('dashboard.tabsSettings.previewGithubQuery') }}</span>
              <a class="tqb-gh-link" :href="githubPreviewUrl" target="_blank" rel="noreferrer">
                {{ t('dashboard.tabsSettings.testInGithub') }}
              </a>
            </div>
            <div class="tqb-body">
              <TokenizedQuery :parts="searchQueryParts" />
            </div>
          </div>

          <div class="preview-results">
            <div class="pr-header">
              <span class="pr-label">{{ t('dashboard.tabsSettings.previewResultsLabel') }}</span>
            </div>
            <SearchResultPreview
              :items="previewResult?.items ?? null"
              :total-count="previewResult?.total_count ?? null"
              :loading="previewLoading"
              :error="previewError"
              :github-url="githubPreviewUrl"
              :loading-label="t('dashboard.tabsSettings.previewLoading')"
              :count-label="
                t('dashboard.tabsSettings.previewMatches', {
                  count: previewResult?.total_count ?? 0,
                })
              "
              :open-in-github-label="t('dashboard.tabsSettings.testInGithub')"
              :waiting-label="t('dashboard.tabsSettings.previewWaiting')"
              :empty-label="t('dashboard.tabsSettings.previewEmptyResults')"
            />
          </div>
        </section>

        <footer class="editor-footer">
          <p class="query-preview">{{ appPreviewUrl }}</p>
          <div class="editor-footer-actions">
            <button
              class="button is-primary"
              type="button"
              :disabled="!newTab.name.trim() || !selectedGroupExists"
              @click="handleCreateCustomTab"
            >
              <PlusIcon :size="16" />
              <span>{{ t('dashboard.tabsSettings.createViewButton') }}</span>
            </button>
          </div>
        </footer>
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
.tabs-settings-page {
  width: 100%;
  min-height: 100%;
  padding: 1.25rem;
}

.settings-header,
.panel-heading-row,
.section-label-row,
.section-label,
.builtin-row,
.tree-group-row,
.tree-tab-row,
.editor-footer,
.editor-footer-actions,
.preview-header,
.preview-status-row,
.label-heading {
  display: flex;
  align-items: center;
}

.settings-header {
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.tabs-nav-back {
  margin-bottom: 1.25rem;
}

.nav-back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  height: auto;
  padding: 0;
  border: none;
  color: #4f46e5;
  font-size: 0.85rem;
  font-weight: 700;
  text-decoration: none;
  transition: opacity 0.15s ease;
}

.nav-back-link:hover {
  background: transparent;
  opacity: 0.72;
}

.nav-back-link:focus-visible {
  border-radius: 4px;
  background: transparent;
  outline: 2px solid #4f46e5;
  outline-offset: 2px;
}

.settings-subtitle,
.panel-caption,
.tree-group-main small,
.tree-tab-main small,
.query-preview,
.chip-label {
  color: var(--bulma-text-light, #6b7280);
  font-size: 0.78rem;
}

.section-label {
  font-weight: 750;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.settings-subtitle {
  margin: 0;
}

.preview-link {
  flex: 0 0 auto;
}

.settings-grid {
  display: grid;
  grid-template-columns: minmax(18rem, 0.82fr) minmax(28rem, 1.45fr);
  gap: 1rem;
  align-items: start;
}

.views-tree-panel,
.editor-panel {
  margin-bottom: 0;
  border: 1px solid var(--bulma-border-light, rgba(10, 10, 10, 0.08));
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
}

.panel-heading-row,
.section-label-row,
.editor-footer,
.preview-header,
.preview-status-row {
  justify-content: space-between;
  gap: 1rem;
}

.section-label {
  gap: 0.4rem;
  color: var(--bulma-text-strong, #111827);
  font-size: 0.72rem;
}

.builtin-section,
.custom-section,
.search-fields-panel,
.preview-panel,
.group-creator-strip,
.pr-field-band {
  padding: 0.85rem;
  border: 1px solid var(--bulma-border-light, rgba(10, 10, 10, 0.08));
  border-radius: 8px;
  background: rgba(248, 250, 252, 0.72);
}

.builtin-section,
.custom-section,
.group-creator-strip {
  margin-top: 0.8rem;
}

.group-insights {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.45rem;
  margin-top: 0.75rem;
}

.group-insight-card {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
  padding: 0.55rem 0.6rem;
  border: 1px solid rgba(79, 70, 229, 0.12);
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(79, 70, 229, 0.08), rgba(14, 165, 233, 0.04));
}

.group-insight-card strong {
  color: #4f46e5;
  font-size: 1rem;
  line-height: 1;
}

.group-insight-card span {
  overflow: hidden;
  color: var(--bulma-text-light, #64748b);
  font-size: 0.68rem;
  font-weight: 700;
  text-overflow: ellipsis;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  white-space: nowrap;
}

.group-creator-strip {
  display: grid;
  gap: 0.55rem;
  margin-top: 0.75rem;
  border-color: rgba(79, 70, 229, 0.18);
  background: rgba(248, 250, 252, 0.92);
}

.group-creator-form,
.inline-child-creator__controls,
.tab-move-tray {
  display: flex;
  align-items: center;
}

.group-creator-header {
  gap: 0.65rem;
}

.group-creator-icon {
  display: grid;
  width: 2rem;
  height: 2rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 10px;
  color: #4f46e5;
  background: rgba(79, 70, 229, 0.12);
}

.group-creator-title {
  margin: 0;
  color: var(--bulma-text-strong, #111827);
  font-size: 0.9rem;
  font-weight: 750;
}

.group-creator-copy {
  margin: 0.1rem 0 0;
  color: var(--bulma-text-light, #64748b);
  font-size: 0.75rem;
}

.group-creator-form {
  gap: 0.55rem;
  align-items: flex-end;
}

.group-creator-form .field:first-child {
  flex: 1 1 11rem;
}

.group-create-button {
  flex: 0 0 auto;
  gap: 0.3rem;
  font-weight: 700;
}

.builtin-list,
.tree-list,
.tree-tabs {
  display: grid;
  gap: 0.6rem;
}

.builtin-list {
  margin-top: 0.65rem;
}

.tree-list {
  margin-top: 0.5rem;
}

.builtin-row,
.tree-tab-row {
  gap: 0.55rem;
  min-height: 2.5rem;
  padding: 0.55rem 0.75rem;
  border: 1px solid transparent;
  border-radius: 6px;
  background: var(--bulma-scheme-main, #ffffff);
}

.builtin-row {
  color: var(--bulma-text, #334155);
}

.tree-group {
  overflow: hidden;
  border: 1px solid var(--bulma-border-light, rgba(10, 10, 10, 0.08));
  border-radius: 8px;
  background: var(--bulma-scheme-main, #ffffff);
}

.tree-group-row {
  position: relative;
  gap: 0.45rem;
  min-height: 2.75rem;
  padding: 0.6rem 0.85rem;
  border: 1px solid transparent;
  box-shadow: inset 3px 0 0 transparent;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    box-shadow 0.15s ease;
}

.tree-group-row:hover,
.tree-group-row:focus-within,
.tree-tab-row:hover,
.builtin-row:hover {
  border-color: rgba(79, 70, 229, 0.18);
  background: rgba(79, 70, 229, 0.045);
}

.tree-group-row:hover,
.tree-group-row:focus-within {
  box-shadow: inset 3px 0 0 #4f46e5;
}

.tree-icon {
  width: 1.65rem;
  height: 1.65rem;
  padding: 0;
}

.tree-icon svg {
  transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1);
}

.tree-icon svg.is-collapsed {
  transform: rotate(-90deg);
}

.tree-group-main,
.tree-tab-main {
  min-width: 0;
  flex: 1;
}

.tree-name-input {
  height: 1.85rem;
  border-color: transparent;
  border-bottom: 1px dashed rgba(100, 116, 139, 0.28);
  background: transparent;
  font-weight: 650;
}

.tree-name-input:hover:not(:disabled) {
  border-bottom-color: rgba(79, 70, 229, 0.4);
}

.tree-name-input:focus {
  border-color: #4f46e5;
  background: var(--bulma-scheme-main, #ffffff);
}

.tree-delete {
  color: #b42318;
}

.tree-add {
  width: 1.65rem;
  height: 1.65rem;
  padding: 0;
  color: #4f46e5;
  opacity: 0;
  pointer-events: none;
  transition:
    opacity 0.14s ease,
    background 0.15s ease,
    transform 0.15s ease;
}

.tree-group-row:hover .tree-add,
.tree-group-row:focus-within .tree-add {
  opacity: 1;
  pointer-events: auto;
}

.tree-add:hover,
.tree-add:focus-visible {
  background: rgba(79, 70, 229, 0.1);
  transform: translateY(-1px);
}

.inline-child-creator {
  display: grid;
  gap: 0.45rem;
  padding: 0.55rem 0.65rem 0.65rem;
  margin-right: 0.7rem;
  margin-bottom: 0.55rem;
  margin-top: 0.6rem;
  border: 1px dashed rgba(79, 70, 229, 0.22);
  border-radius: 8px;
  background: rgba(79, 70, 229, 0.045);
}

.inline-child-creator__label {
  color: #4f46e5;
  font-size: 0.72rem;
  font-weight: 750;
}

.inline-child-creator__controls {
  gap: 0.45rem;
}

.inline-child-creator__input {
  flex: 1 1 12rem;
}

.tree-tabs {
  padding: 0.35rem 0.7rem 0.7rem 2.4rem;
}

.tree-tab-row {
  flex-wrap: wrap;
}

.tree-tab-main span,
.tree-tab-main small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab-move-tray,
.group-picker,
.segmented-row,
.source-selector {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.segmented-row.is-wrap,
.group-picker,
.source-selector {
  flex-wrap: wrap;
}

.tab-move-tray {
  width: 100%;
  justify-content: flex-start;
  gap: 0.42rem;
  padding: 0.35rem 0 0 1.4rem;
  opacity: 0.92;
}

.chip-button,
.group-choice,
.segmented-button,
.source-option {
  border: 1px solid var(--bulma-border-light, rgba(10, 10, 10, 0.08));
  color: var(--bulma-text, #334155);
  background: var(--bulma-scheme-main, #ffffff);
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease,
    color 0.15s ease;
}

.chip-button,
.segmented-button {
  min-height: 1.85rem;
  padding: 0.25rem 0.55rem;
  border-radius: 999px;
  font-size: 0.76rem;
  font-weight: 650;
}

.chip-button.is-compact {
  min-height: 1.6rem;
  padding: 0.18rem 0.45rem;
}

.group-choice {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 2.1rem;
  padding: 0.35rem 0.7rem;
  border-radius: 6px;
  font-size: 0.84rem;
  font-weight: 650;
}

.chip-button:hover:not(:disabled),
.group-choice:hover,
.segmented-button:hover,
.source-option:hover:not(:disabled) {
  border-color: rgba(79, 70, 229, 0.32);
  color: #4f46e5;
  background: rgba(79, 70, 229, 0.07);
}

.chip-button.is-active {
  border-color: #4f46e5;
  color: #ffffff;
  background: #4f46e5;
}

.group-choice.is-active {
  border-color: #4f46e5;
  color: #ffffff;
  background: #4f46e5;
}

.segmented-button.is-active {
  border-color: #4f46e5;
  color: #ffffff;
  background: #4f46e5;
  box-shadow: 0 1px 3px rgba(79, 70, 229, 0.3);
}

.chip-button:disabled,
.source-option:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.source-selector {
  padding: 0.25rem;
  margin-bottom: 1rem;
  border: 1px solid var(--bulma-border-light, rgba(10, 10, 10, 0.08));
  border-radius: 8px;
  background: rgba(248, 250, 252, 0.95);
}

.source-option {
  display: inline-grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: auto auto;
  column-gap: 0.45rem;
  min-width: 11rem;
  padding: 0.48rem 0.65rem;
  border-radius: 6px;
  text-align: left;
}

.source-option svg {
  grid-row: 1 / span 2;
  align-self: center;
}

.source-option span {
  font-size: 0.84rem;
  font-weight: 750;
}

.source-option small {
  color: var(--bulma-text-light, #6b7280);
  font-size: 0.7rem;
}

.source-option.is-active {
  border-color: #4f46e5;
  color: #ffffff;
  background: #4f46e5;
}

.source-option.is-active small {
  color: rgba(255, 255, 255, 0.76);
}

.field-grid,
.toggle-grid,
.sort-row,
.scope-grid {
  display: grid;
  gap: 0.75rem;
}

.field-grid.is-two,
.toggle-grid,
.sort-row,
.scope-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.field-grid.is-three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.field-grid.is-four {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.toggle-section {
  margin-bottom: 0.85rem;
}

.segmented-row {
  flex-wrap: wrap;
}

.segmented-row.is-compact-row {
  flex-wrap: nowrap;
}

.label-heading,
.section-label {
  gap: 0.35rem;
}

.label-combobox {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  min-height: 2.6rem;
  padding: 0.45rem;
  border: 1px solid var(--bulma-border, #dbdbdb);
  border-radius: 6px;
  background: var(--bulma-scheme-main, #ffffff);
}

.label-chip {
  gap: 0.25rem;
}

.label-input {
  min-width: 12rem;
  flex: 1;
  border: 0;
  outline: 0;
  background: transparent;
  font: inherit;
}

.label-suggestions {
  display: grid;
  gap: 0.15rem;
  max-height: 11rem;
  padding: 0.35rem;
  margin-top: 0.35rem;
  overflow: auto;
  border: 1px solid var(--bulma-border-light, rgba(10, 10, 10, 0.08));
  border-radius: 8px;
  background: var(--bulma-scheme-main, #ffffff);
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.1);
}

.suggestion-row {
  justify-content: flex-start;
}

.preview-panel {
  margin-top: 1rem;
  border-color: var(--bulma-border-light, rgba(10, 10, 10, 0.12));
  background: var(--bulma-scheme-main, #ffffff);
}

/* ── Tokenized query box ── */
.tokenized-query-box {
  margin-top: 0.75rem;
  border: 1px solid rgba(79, 70, 229, 0.15);
  border-radius: 8px;
  background: rgba(248, 250, 252, 0.82);
  overflow: hidden;
}

.tqb-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.45rem 0.7rem;
  background: rgba(79, 70, 229, 0.06);
  border-bottom: 1px solid rgba(79, 70, 229, 0.1);
}

.tqb-label {
  font-size: 0.68rem;
  font-weight: 750;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #4f46e5;
}

.tqb-gh-link {
  font-size: 0.72rem;
  font-weight: 600;
  color: #4f46e5;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.tqb-body {
  padding: 0.65rem 0.7rem;
  font-family: 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', monospace;
  font-size: 0.78rem;
}

/* ── Preview results ── */
.preview-results {
  margin-top: 0.75rem;
}

.pr-header {
  margin-bottom: 0.45rem;
}

.pr-label {
  font-size: 0.68rem;
  font-weight: 750;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--bulma-text-light, #6b7280);
}

/* ── Compact type/state row ── */
.cmpact-row {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 0.85rem;
}

.cmpact-toggle {
  margin-bottom: 0;
  flex: 1;
}

/* ── Advanced filters collapsible ── */
.advanced-section {
  margin: 0.85rem 0;
  border: 1px solid var(--bulma-border-light, rgba(10, 10, 10, 0.08));
  border-radius: 8px;
  background: rgba(248, 250, 252, 0.5);
  transition: border-color 0.15s ease;

  &.is-open {
    border-color: rgba(79, 70, 229, 0.18);
    background: rgba(248, 250, 252, 0.72);
  }
}

.advanced-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  width: 100%;
  padding: 0.5rem 0.65rem;
  border: 0;
  background: transparent;
  cursor: pointer;
  color: var(--bulma-text-light, #6b7280);
  font-size: 0.78rem;
  font-weight: 650;
  transition: color 0.15s ease;

  &:hover {
    color: #4f46e5;
  }
}

.advanced-toggle__icon {
  transition: transform 0.2s ease;
  color: var(--bulma-text-light, #888);
  flex: 0 0 auto;

  &.rotated {
    transform: rotate(90deg);
    color: #4f46e5;
  }
}

.advanced-count {
  margin-left: auto;
}

.advanced-body {
  padding: 0 0.65rem 0.65rem;
}

.advanced-pr-band {
  padding: 0.75rem;
  margin-top: 0.5rem;
  border: 1px solid var(--bulma-border-light, rgba(10, 10, 10, 0.08));
  border-radius: 8px;
  background: rgba(236, 253, 245, 0.5);
}

.editor-footer {
  padding-top: 1rem;
  margin-top: 1rem;
  border-top: 1px solid var(--bulma-border-light, rgba(10, 10, 10, 0.08));
}

.editor-footer-actions {
  flex: 0 0 auto;
  gap: 0.5rem;
}

.query-preview {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-drop-zone,
.empty-state {
  color: var(--bulma-text-light, #94a3b8);
  font-size: 0.85rem;
}

.empty-drop-zone {
  padding: 0.65rem;
  border: 1px dashed var(--bulma-border-light, rgba(10, 10, 10, 0.08));
  border-radius: 6px;
  text-align: center;
}

.empty-state {
  display: grid;
  place-items: center;
  gap: 0.5rem;
  min-height: 8rem;
}

@media (max-width: 1160px) {
  .settings-grid,
  .field-grid.is-four {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 820px) {
  .settings-header,
  .editor-footer,
  .editor-footer-actions,
  .preview-header,
  .preview-status-row {
    align-items: stretch;
    flex-direction: column;
  }

  .field-grid.is-two,
  .field-grid.is-three,
  .toggle-grid,
  .sort-row,
  .scope-grid {
    grid-template-columns: 1fr;
  }

  .source-selector {
    flex-wrap: nowrap;
    overflow-x: auto;
  }

  .source-option {
    min-width: 10.5rem;
  }

  .tree-tabs {
    padding-left: 0.7rem;
  }
}

@media (prefers-color-scheme: dark) {
  .builtin-section,
  .custom-section,
  .search-fields-panel,
  .group-creator-strip,
  .pr-field-band,
  .source-selector {
    background: rgba(30, 41, 59, 0.55);
  }

  .preview-panel {
    background: var(--bulma-scheme-main, #111827);
  }

  .tokenized-query-box {
    background: rgba(30, 41, 59, 0.6);
  }

  .tqb-header {
    background: rgba(79, 70, 229, 0.1);
  }

  .advanced-section {
    background: rgba(30, 41, 59, 0.35);

    &.is-open {
      background: rgba(30, 41, 59, 0.5);
    }
  }

  .advanced-pr-band {
    background: rgba(6, 78, 59, 0.2);
  }

  .builtin-row,
  .tree-group,
  .inline-child-creator,
  .tree-tab-row,
  .label-combobox,
  .label-suggestions,
  .chip-button,
  .group-choice,
  .segmented-button,
  .source-option {
    background: var(--bulma-scheme-main, #111827);
  }
}
</style>
