import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckCircle2Icon,
  CircleDotIcon,
  CircleMinusIcon,
  FilePenLineIcon,
  GitMergeIcon,
  GitPullRequestIcon,
  ShieldAlertIcon,
  XCircleIcon,
} from 'lucide-vue-next';
import { computed, nextTick, onBeforeUnmount, reactive, ref, shallowRef, watch } from 'vue';

import {
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
  useCustomTabs,
} from '~/composables/useCustomTabs';
import {
  buildCustomTabHumanPreview,
  buildCustomTabSearchParts,
  buildCustomTabSearchQuery,
  buildCustomTabSummary,
  createCustomTabPreviewSearchParams,
  createGitHubCustomTabPreviewUrl,
  customTabArchivedOptions,
  customTabDraftOptions,
  customTabOrderOptions,
  customTabReviewOptions,
  customTabScopeOptions,
  customTabSortOptions,
  customTabSourceOptions,
  type CustomTabSourceOption,
  customTabStateOptions,
  customTabTypeOptions,
  customTabVisibilityOptions,
} from '~/composables/useCustomTabSettingsOptions';
import {
  BUILTIN_TAB_GROUP_ID,
  DEFAULT_CUSTOM_TAB_GROUP_ID,
  type TabGroup,
  useTabGroups,
} from '~/composables/useTabGroups';
import { useTabMigration } from '~/composables/useTabMigration';

export interface SettingsTab {
  id: string;
  groupId: string;
  name: string;
  subtitle?: string;
  source?: CustomTabSource;
  query?: CustomTabQuery;
}

export interface GroupRow extends TabGroup {
  depth: number;
}

export interface SearchPreviewRequest {
  q: string;
  sort?: string;
  order?: string;
  page: number;
  per_page: number;
}

export interface SearchPreviewItem {
  id?: number;
  title: string;
  number: number;
  state: string;
  pull_request?: unknown;
  labels?: Array<{ id?: number; name: string; color?: string }>;
  repository_url: string;
  updated_at: string;
}

export interface SearchPreviewResult {
  total_count?: number;
  incomplete_results?: boolean;
  request?: SearchPreviewRequest;
  items?: SearchPreviewItem[];
}

export const useTabsSettingsPage = () => {
  const maxGroupDepth = 1;
  const previewDebounceMs = 900;
  const previewPerPage = 15;
  const previewPage = ref(1);
  const DEFAULT_TAB_GROUP_NAME = 'General';
  const { t } = useI18n();
  const localePath = useLocalePath();

  const sourceOptions = customTabSourceOptions;
  const typeOptions = customTabTypeOptions;
  const stateOptions = customTabStateOptions;
  const scopeOptions = customTabScopeOptions;
  const sortOptions = customTabSortOptions;
  const orderOptions = customTabOrderOptions;
  const visibilityOptions = customTabVisibilityOptions;
  const archivedOptions = customTabArchivedOptions;
  const draftOptions = customTabDraftOptions;
  const reviewOptions = customTabReviewOptions;

  const filterIconMap: Record<
    string,
    { icon: typeof CircleDotIcon; activeColor: string } | undefined
  > = {
    // type
    issues: { icon: CircleDotIcon, activeColor: 'var(--gitpulse-success-solid)' },
    pulls: { icon: GitPullRequestIcon, activeColor: 'var(--gitpulse-purple)' },
    all: { icon: GitMergeIcon, activeColor: 'var(--gitpulse-accent)' },
    // state
    open: { icon: CircleDotIcon, activeColor: 'var(--gitpulse-success-solid)' },
    closed: { icon: CircleMinusIcon, activeColor: 'var(--gitpulse-danger-solid)' },
    // draft
    draft: { icon: FilePenLineIcon, activeColor: 'var(--gitpulse-warning-solid)' },
    ready: { icon: CheckCircle2Icon, activeColor: 'var(--gitpulse-success-solid)' },
    // review
    approved: { icon: CheckCircle2Icon, activeColor: 'var(--gitpulse-success-solid)' },
    changes_requested: { icon: XCircleIcon, activeColor: 'var(--gitpulse-danger-solid)' },
    required: { icon: ShieldAlertIcon, activeColor: 'var(--gitpulse-warning-solid)' },
    // order
    desc: { icon: ArrowDownIcon, activeColor: 'var(--gitpulse-accent)' },
    asc: { icon: ArrowUpIcon, activeColor: 'var(--gitpulse-accent)' },
  };

  const { groups, createGroup, updateGroup, deleteGroup, toggleGroupCollapsed, reorderGroups } =
    useTabGroups();
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
    subtitle: '',
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
  const subtitleManuallyEdited = shallowRef(false);
  const editingSubtitleTabId = shallowRef<string | null>(null);
  const editingSubtitleDraft = shallowRef('');
  const confirmingTabId = shallowRef<string | null>(null);
  const confirmingGroupId = shallowRef<string | null>(null);
  const selectedTabId = shallowRef<string | null>(null);
  const advancedFiltersOpen = ref(false);
  const previewLoading = ref(false);
  const previewError = ref<string | null>(null);
  const previewResult = ref<SearchPreviewResult | null>(null);
  let previewTimer: ReturnType<typeof setTimeout> | null = null;
  let previewRequestId = 0;
  let paginationInProgress = false;

  const isEditing = computed(() => selectedTabId.value !== null);
  const editorTitle = computed(() =>
    isEditing.value
      ? t('dashboard.tabsSettings.editorTitleEdit')
      : t('dashboard.tabsSettings.editorTitle')
  );
  const editorCaption = computed(() => {
    const source = activeSourceLabel.value;
    const group = selectedGroupName.value;
    return isEditing.value
      ? t('dashboard.tabsSettings.editorCaptionEdit', { source, group })
      : t('dashboard.tabsSettings.editorCaption', { source, group });
  });

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

  // Drag-and-drop: per-group reactive tab lists
  let isDragUpdating = false;

  const groupTabLists = ref<Record<string, SettingsTab[]>>({});

  const syncTabLists = () => {
    const next: Record<string, SettingsTab[]> = {};
    for (const group of customGroupRows.value) {
      next[group.id] = getTabsForGroup(group.id);
    }
    groupTabLists.value = next;
  };

  watch(
    [settingsTabs, () => customGroupRows.value.map((g) => g.id)],
    () => {
      if (isDragUpdating) return;
      syncTabLists();
    },
    { deep: true }
  );

  // Drag-and-drop: group reordering
  let isGroupDragUpdating = false;

  const draggableGroupRows = shallowRef<GroupRow[]>([]);

  const syncGroupRows = () => {
    draggableGroupRows.value = customGroupRows.value.map((g) => ({ ...g }));
  };

  watch(customGroupRows, () => {
    if (isGroupDragUpdating) return;
    syncGroupRows();
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

  const getGroupDepthStyle = (depth: number) => {
    return { inlineSize: `clamp(0rem, ${Math.max(depth, 0) * 1.1}rem, 30%)` };
  };

  const getNestedPanelStyle = (depth: number) => {
    return { marginLeft: `clamp(0.85rem, ${0.85 + Math.max(depth, 0) * 1.1}rem, 30%)` };
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
    return buildCustomTabSearchParts(buildCurrentQuery());
  });

  const searchQueryString = computed(() => {
    return buildCustomTabSearchQuery(buildCurrentQuery());
  });

  const previewSearchParams = computed(() => {
    return createCustomTabPreviewSearchParams(
      buildCurrentQuery(),
      previewPage.value,
      previewPerPage
    );
  });

  const appPreviewUrl = computed(() => {
    return `/api/search/issues?${previewSearchParams.value.toString()}`;
  });

  const previewTotalPages = computed(() => {
    const total = previewResult.value?.total_count ?? 0;
    const pages = Math.ceil(total / previewPerPage);
    return Math.max(1, pages);
  });

  const githubPreviewUrl = computed(() => {
    return createGitHubCustomTabPreviewUrl(buildCurrentQuery());
  });

  const humanPreview = computed(() => {
    return buildCustomTabHumanPreview(buildCurrentQuery(), t);
  });

  const buildSummaryFromQuery = (query: CustomTabQuery) => {
    return buildCustomTabSummary(query, t);
  };

  const autoSubtitle = computed(() => buildSummaryFromQuery(buildCurrentQuery()));

  const getTabSubtitle = (tab: SettingsTab) => {
    if (tab.subtitle?.trim()) {
      return tab.subtitle.trim();
    }

    if (!tab.query) {
      return t('dashboard.tabsSettings.defaultQueryPreview');
    }

    return buildSummaryFromQuery(tab.query);
  };

  const getQueryPreview = (tab: SettingsTab) => {
    if (!tab.query) {
      return t('dashboard.tabsSettings.defaultQueryPreview');
    }

    const parts = buildCustomTabSearchParts(tab.query);

    return parts.length > 0 ? parts.join(' ') : t('dashboard.tabsSettings.defaultQueryPreview');
  };

  const handleSubtitleInput = (event: Event) => {
    newTab.subtitle = getInputValue(event);
    subtitleManuallyEdited.value = true;
  };

  const useAutoSubtitle = () => {
    newTab.subtitle = autoSubtitle.value;
    subtitleManuallyEdited.value = false;
  };

  const startSubtitleEdit = (tab: SettingsTab) => {
    if (!isCustomTab(tab.id)) {
      return;
    }

    editingSubtitleTabId.value = tab.id;
    editingSubtitleDraft.value = getTabSubtitle(tab);
  };

  const cancelSubtitleEdit = () => {
    editingSubtitleTabId.value = null;
    editingSubtitleDraft.value = '';
  };

  const saveSubtitleEdit = (tab: SettingsTab) => {
    const subtitle = editingSubtitleDraft.value.trim();
    updateCustomTab(tab.id, { subtitle: subtitle || getTabSubtitle(tab) });
    cancelSubtitleEdit();
  };

  const requestDeleteTab = (tabId: string) => {
    confirmingGroupId.value = null;
    confirmingTabId.value = tabId;
  };

  const confirmDeleteTab = (tabId: string) => {
    deleteCustomTab(tabId);
    if (confirmingTabId.value === tabId) {
      confirmingTabId.value = null;
    }
  };

  const requestDeleteGroup = (groupId: string) => {
    confirmingTabId.value = null;
    confirmingGroupId.value = groupId;
  };

  const cancelDeleteConfirmation = () => {
    confirmingTabId.value = null;
    confirmingGroupId.value = null;
  };

  const confirmDeleteGroup = (groupId: string) => {
    handleDeleteGroup(groupId);
    if (confirmingGroupId.value === groupId) {
      confirmingGroupId.value = null;
    }
  };

  const setActiveSource = (source: CustomTabSourceOption) => {
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

  // Drag-and-drop event handlers

  const handleGroupReorder = () => {
    isGroupDragUpdating = true;
    const orderedIds = draggableGroupRows.value.map((g) => g.id);
    reorderGroups(orderedIds);
    void nextTick(() => {
      isGroupDragUpdating = false;
      syncGroupRows();
    });
  };

  const handleTabsChanged = (groupId: string) => {
    if (isDragUpdating) return;

    const currentTabs = groupTabLists.value[groupId];
    if (!currentTabs) return;

    // Detect tabs that were moved into this group from another group
    for (const tab of currentTabs) {
      if (tab.groupId !== groupId && isCustomTab(tab.id)) {
        isDragUpdating = true;
        updateCustomTab(tab.id, { groupId });
      }
    }

    if (isDragUpdating) {
      void nextTick(() => {
        isDragUpdating = false;
        syncTabLists();
      });
    }
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
        : (customGroupRows.value.find((candidate) => !affectedGroupIds.has(candidate.id))?.id ??
          '');

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

  const resetNewTabForm = () => {
    newTab.name = '';
    newTab.subtitle = autoSubtitle.value;
    subtitleManuallyEdited.value = false;
    newTab.groupId = getFallbackGroupId();
    newTab.source = 'github-search';
    newTab.query.text = '';
    newTab.query.type = 'issues';
    newTab.query.repo = '';
    newTab.query.org = '';
    newTab.query.user = '';
    newTab.query.author = '';
    newTab.query.assignee = '';
    newTab.query.mentions = '';
    newTab.query.commenter = '';
    newTab.query.involves = '';
    newTab.query.milestone = '';
    newTab.query.state = 'open';
    newTab.query.scopes = ['title', 'body'];
    newTab.query.labels = [];
    newTab.query.visibility = 'any';
    newTab.query.archived = 'exclude';
    newTab.query.draft = 'any';
    newTab.query.review = 'any';
    newTab.query.base = '';
    newTab.query.head = '';
    newTab.query.sort = 'updated';
    newTab.query.order = 'desc';
    newTab.query.perPage = 20;
    labelDraft.value = '';
    advancedFiltersOpen.value = false;
    previewResult.value = null;
  };

  const getFallbackGroupId = () => {
    const rows = customGroupRows.value;
    return rows[0]?.id ?? DEFAULT_CUSTOM_TAB_GROUP_ID;
  };

  const selectTabForEdit = (tab: SettingsTab) => {
    if (!isCustomTab(tab.id)) return;

    selectedTabId.value = tab.id;
    newTab.name = tab.name;
    newTab.subtitle = tab.subtitle?.trim() || getTabSubtitle(tab);
    subtitleManuallyEdited.value = Boolean(tab.subtitle?.trim());
    newTab.groupId = tab.groupId;
    newTab.source = tab.source ?? 'github-search';

    const q = tab.query ?? {};
    newTab.query.text = q.text ?? '';
    newTab.query.type = q.type ?? 'issues';
    newTab.query.repo = q.repo ?? '';
    newTab.query.org = q.org ?? '';
    newTab.query.user = q.user ?? '';
    newTab.query.author = q.author ?? '';
    newTab.query.assignee = q.assignee ?? '';
    newTab.query.mentions = q.mentions ?? '';
    newTab.query.commenter = q.commenter ?? '';
    newTab.query.involves = q.involves ?? '';
    newTab.query.milestone = q.milestone ?? '';
    newTab.query.state = q.state ?? 'open';
    newTab.query.scopes = q.scopes ?? ['title', 'body'];
    newTab.query.labels = q.labels ?? [];
    newTab.query.visibility = q.visibility ?? 'any';
    newTab.query.archived = q.archived ?? 'exclude';
    newTab.query.draft = q.draft ?? 'any';
    newTab.query.review = q.review ?? 'any';
    newTab.query.base = q.base ?? '';
    newTab.query.head = q.head ?? '';
    newTab.query.sort = q.sort ?? 'updated';
    newTab.query.order = q.order ?? 'desc';
    newTab.query.perPage = q.perPage ?? 20;
    labelDraft.value = '';
    advancedFiltersOpen.value = false;
    previewResult.value = null;
  };

  const deselectTab = () => {
    selectedTabId.value = null;
    resetNewTabForm();
  };

  const handleSaveTab = () => {
    const name = newTab.name.trim();
    if (!name || !selectedGroupExists.value) return;

    if (isEditing.value && selectedTabId.value) {
      updateCustomTab(selectedTabId.value, {
        name,
        subtitle: newTab.subtitle.trim() || autoSubtitle.value,
        groupId: newTab.groupId,
        source: newTab.source,
        query: buildCurrentQuery(),
      });
      deselectTab();
      return;
    }

    createCustomTab({
      name,
      subtitle: newTab.subtitle.trim() || autoSubtitle.value,
      groupId: newTab.groupId,
      source: newTab.source,
      query: buildCurrentQuery(),
    });

    resetNewTabForm();
  };

  const loadPreview = async (silent = false) => {
    const requestId = previewRequestId + 1;
    previewRequestId = requestId;
    if (!silent) {
      previewLoading.value = true;
    }
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

  watch(customTabs, (tabs) => {
    if (selectedTabId.value && !tabs.some((tab) => tab.id === selectedTabId.value)) {
      deselectTab();
    }
  });

  function goToPreviewPage(page: number) {
    paginationInProgress = true;
    previewPage.value = page;
    if (previewTimer) {
      clearTimeout(previewTimer);
    }
    void loadPreview();
    nextTick(() => {
      paginationInProgress = false;
    });
  }

  watch(searchQueryString, () => {
    previewPage.value = 1;
  });

  watch(
    appPreviewUrl,
    () => {
      if (paginationInProgress) {
        return;
      }
      if (previewTimer) {
        clearTimeout(previewTimer);
      }

      previewTimer = setTimeout(() => {
        void loadPreview();
      }, previewDebounceMs);
    },
    { immediate: true }
  );

  onBeforeUnmount(() => {
    if (previewTimer) {
      clearTimeout(previewTimer);
      previewTimer = null;
    }
  });

  watch(
    autoSubtitle,
    (subtitle) => {
      if (!subtitleManuallyEdited.value) {
        newTab.subtitle = subtitle;
      }
    },
    { immediate: true }
  );

  // Initial sync for drag-and-drop (deferred to avoid TDZ)
  void nextTick(() => {
    syncTabLists();
    syncGroupRows();
  });

  return {
    t,
    localePath,
    maxGroupDepth,
    sourceOptions,
    typeOptions,
    stateOptions,
    scopeOptions,
    sortOptions,
    orderOptions,
    visibilityOptions,
    archivedOptions,
    draftOptions,
    reviewOptions,
    filterIconMap,
    customTabs,
    newGroup,
    childGroupName,
    activeChildCreatorGroupId,
    newTab,
    labelDraft,
    editingSubtitleTabId,
    editingSubtitleDraft,
    confirmingTabId,
    confirmingGroupId,
    selectedTabId,
    advancedFiltersOpen,
    previewLoading,
    previewError,
    previewResult,
    previewPage,
    isEditing,
    editorTitle,
    editorCaption,
    builtinTabs,
    customGroupRows,
    groupTabLists,
    draggableGroupRows,
    parentGroupOptions,
    editableGroupOptions,
    selectedGroupExists,
    activeSource,
    activeSourceLabel,
    isPullRequestSearch,
    advancedFilterCount,
    labelSuggestions,
    getInputValue,
    getGroupTabCount,
    getGroupDepthStyle,
    getNestedPanelStyle,
    canEditGroup,
    searchQueryParts,
    githubPreviewUrl,
    humanPreview,
    autoSubtitle,
    previewTotalPages,
    updateGroup,
    toggleGroupCollapsed,
    getTabSubtitle,
    getQueryPreview,
    handleSubtitleInput,
    useAutoSubtitle,
    startSubtitleEdit,
    cancelSubtitleEdit,
    saveSubtitleEdit,
    requestDeleteTab,
    confirmDeleteTab,
    requestDeleteGroup,
    cancelDeleteConfirmation,
    confirmDeleteGroup,
    setActiveSource,
    setNewTabGroup,
    toggleScope,
    addLabel,
    handleLabelEnter,
    removeLabel,
    handleGroupReorder,
    handleTabsChanged,
    handleCreateGroup,
    handleStartChildGroup,
    handleCancelChildGroup,
    handleCreateChildGroup,
    deselectTab,
    selectTabForEdit,
    handleSaveTab,
    goToPreviewPage,
  };
};

export type TabsSettingsPageState = ReturnType<typeof useTabsSettingsPage>;
