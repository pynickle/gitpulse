import { computed, nextTick, onBeforeUnmount, reactive, ref, shallowRef, watch } from 'vue';

import {
  getCustomTabSearchValidationIssue,
  type CustomTabSearchValidationIssue,
} from '#shared/utils/github-search-query';
import { parseGitHubSearchSyntax } from '#shared/utils/github-search-syntax';
import {
  type CustomTab,
  type CustomTabSource,
  type CustomTabSubtitleMode,
  type GitHubSearchEndpoint,
  type GitHubSearchItemType,
  type GitHubSearchQuery,
  useCustomTabs,
} from '~/composables/useCustomTabs';
import {
  buildCustomTabHumanPreview,
  buildCustomTabSearchParts,
  buildCustomTabSearchQuery,
  buildCustomTabSummary,
  createCustomTabPreviewSearchParams,
  createGitHubCustomTabPreviewUrl,
  customTabEndpointOptions,
  getCustomTabEndpointPath,
  customTabSubtitleModeOptions,
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
  subtitleMode?: CustomTabSubtitleMode;
  source?: CustomTabSource;
  query?: GitHubSearchQuery;
}

export interface GroupRow extends TabGroup {
  depth: number;
}

export interface SearchPreviewRequest {
  endpoint?: GitHubSearchEndpoint;
  q: string;
  sort?: string;
  order?: string;
  page: number;
  per_page: number;
}

export interface SearchPreviewItem {
  id?: number;
  title?: string;
  name?: string;
  full_name?: string;
  number?: number;
  state?: string;
  pull_request?: unknown;
  labels?: Array<{ id?: number; name: string; color?: string }>;
  repository_url?: string;
  updated_at?: string;
  html_url?: string;
  url?: string;
  [key: string]: unknown;
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

  const endpointOptions = customTabEndpointOptions;
  const subtitleModeOptions = customTabSubtitleModeOptions;

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
    subtitleMode: 'none' as CustomTabSubtitleMode,
    groupId: DEFAULT_CUSTOM_TAB_GROUP_ID,
    source: 'github-search' as CustomTabSource,
    query: {
      endpoint: 'issues' as GitHubSearchEndpoint,
      syntax: '',
      text: '',
      type: 'issues' as GitHubSearchItemType,
      perPage: 20,
    },
  });

  const editingSubtitleTabId = shallowRef<string | null>(null);
  const editingSubtitleDraft = shallowRef('');
  const confirmingTabId = shallowRef<string | null>(null);
  const confirmingGroupId = shallowRef<string | null>(null);
  const selectedTabId = shallowRef<string | null>(null);
  const editorOpen = shallowRef(false);
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
    return t('dashboard.tabsSettings.source.githubSearch');
  });

  const selectedEndpointOption = computed(() => {
    return endpointOptions.find((option) => option.value === newTab.query.endpoint);
  });

  const selectedEndpointLabel = computed(() => {
    const option = selectedEndpointOption.value;
    return option ? t(option.labelKey) : '/search/issues';
  });

  const searchSyntaxAst = computed(() => {
    return parseGitHubSearchSyntax(newTab.query.syntax, {
      allowOperators: newTab.query.endpoint === 'code',
    });
  });

  const searchSyntaxHasErrors = computed(() => {
    return searchSyntaxAst.value.diagnostics.length > 0;
  });

  const hasUnsupportedOperators = computed(() => {
    return searchSyntaxAst.value.diagnostics.some(
      (diagnostic) => diagnostic.code === 'unsupported-operator'
    );
  });

  const operatorWarningMessage = computed(() => {
    if (!hasUnsupportedOperators.value) {
      return '';
    }

    return t('dashboard.tabsSettings.operatorUnsupportedHint', {
      endpoint: selectedEndpointLabel.value,
      codeEndpoint: t('dashboard.tabsSettings.endpoint.code'),
    });
  });

  const hasSearchSyntaxFeedback = computed(() => {
    if (!newTab.query.syntax.trim()) {
      return false;
    }

    return (
      operatorWarningMessage.value.length > 0 ||
      searchSyntaxAst.value.qualifiers.length > 0 ||
      searchSyntaxAst.value.diagnostics.some(
        (diagnostic) => diagnostic.code !== 'unsupported-operator'
      )
    );
  });

  const searchValidationIssue = computed<CustomTabSearchValidationIssue>(() => {
    return getCustomTabSearchValidationIssue(buildCurrentQuery(), { requireManualSyntax: true });
  });

  const saveValidationMessage = computed(() => {
    if (!newTab.name.trim()) {
      return t('dashboard.tabsSettings.saveMissingName');
    }

    if (!selectedGroupExists.value) {
      return t('dashboard.tabsSettings.saveMissingGroup');
    }

    if (searchValidationIssue.value === 'missing-query') {
      return t('dashboard.tabsSettings.saveMissingQuery');
    }

    if (searchValidationIssue.value === 'invalid-syntax') {
      return t('dashboard.tabsSettings.saveInvalidSyntax');
    }

    if (searchValidationIssue.value === 'unsupported-operator') {
      return operatorWarningMessage.value;
    }

    if (searchValidationIssue.value === 'missing-label-repository') {
      return t('dashboard.tabsSettings.saveMissingLabelRepository');
    }

    return '';
  });

  const canSaveTab = computed(() => saveValidationMessage.value.length === 0);

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

  const buildCurrentQuery = (): GitHubSearchQuery => {
    return {
      endpoint: newTab.query.endpoint,
      syntax: newTab.query.syntax.trim() || undefined,
      type: newTab.query.type,
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
    return `${getCustomTabEndpointPath(buildCurrentQuery())}?${previewSearchParams.value.toString()}`;
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

  const buildSummaryFromQuery = (query: GitHubSearchQuery) => {
    return buildCustomTabSummary(query, t);
  };

  const getTabSubtitle = (tab: SettingsTab) => {
    if (tab.subtitleMode === 'none') {
      return '';
    }

    if (tab.subtitle?.trim()) {
      return tab.subtitle.trim();
    }

    return '';
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
    newTab.subtitleMode = 'custom';
  };

  const setSubtitleMode = (mode: CustomTabSubtitleMode) => {
    newTab.subtitleMode = mode;
  };

  const startSubtitleEdit = (tab: SettingsTab) => {
    if (!isCustomTab(tab.id)) {
      return;
    }

    editingSubtitleTabId.value = tab.id;
    editingSubtitleDraft.value = tab.subtitleMode === 'none' ? '' : getTabSubtitle(tab);
  };

  const cancelSubtitleEdit = () => {
    editingSubtitleTabId.value = null;
    editingSubtitleDraft.value = '';
  };

  const saveSubtitleEdit = (tab: SettingsTab) => {
    const subtitle = editingSubtitleDraft.value.trim();
    if (subtitle) {
      updateCustomTab(tab.id, { subtitle, subtitleMode: 'custom' });
    } else {
      updateCustomTab(tab.id, { subtitle: undefined, subtitleMode: 'none' });
    }
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

  const setNewTabGroup = (groupId: string) => {
    newTab.groupId = groupId;
  };

  const setSearchEndpoint = (endpoint: GitHubSearchEndpoint) => {
    newTab.query.endpoint = endpoint;
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
    const affectedTabs = customTabs.value.filter((tab: CustomTab) =>
      affectedGroupIds.has(tab.groupId)
    );

    if (fallbackGroupId) {
      affectedTabs.forEach((tab: CustomTab) => {
        updateCustomTab(tab.id, { groupId: fallbackGroupId });
      });
    } else {
      affectedTabs.forEach((tab: CustomTab) => {
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
    newTab.subtitle = '';
    newTab.subtitleMode = 'none';
    newTab.groupId = getFallbackGroupId();
    newTab.source = 'github-search';
    newTab.query.endpoint = 'issues';
    newTab.query.syntax = '';
    newTab.query.text = '';
    newTab.query.type = 'issues';
    newTab.query.perPage = 20;
    previewResult.value = null;
  };

  const getFallbackGroupId = () => {
    const rows = customGroupRows.value;
    return rows[0]?.id ?? DEFAULT_CUSTOM_TAB_GROUP_ID;
  };

  const selectTabForEdit = (tab: SettingsTab) => {
    if (!isCustomTab(tab.id)) return;

    selectedTabId.value = tab.id;
    editorOpen.value = true;
    newTab.name = tab.name;
    newTab.subtitleMode = tab.subtitleMode ?? (tab.subtitle?.trim() ? 'custom' : 'none');
    newTab.subtitle = newTab.subtitleMode === 'custom' ? (tab.subtitle ?? '') : '';
    newTab.groupId = tab.groupId;
    newTab.source = tab.source ?? 'github-search';

    const q: GitHubSearchQuery = tab.query ?? { type: 'issues' };
    newTab.query.endpoint = q.endpoint ?? 'issues';
    newTab.query.syntax = q.syntax ?? buildCustomTabSearchQuery(q);
    newTab.query.text = q.text ?? '';
    newTab.query.type = q.type;
    newTab.query.perPage = q.perPage ?? 20;
    previewResult.value = null;
  };

  const deselectTab = () => {
    selectedTabId.value = null;
    resetNewTabForm();
  };

  const closeEditor = () => {
    deselectTab();
    editorOpen.value = false;
  };

  const startNewTabInGroup = (groupId: string) => {
    deselectTab();
    setNewTabGroup(groupId);
    editorOpen.value = true;
  };

  const startNewTab = () => {
    deselectTab();
    editorOpen.value = true;
  };

  const handleSaveTab = () => {
    const name = newTab.name.trim();
    if (!canSaveTab.value) return;

    const customSubtitle =
      newTab.subtitleMode === 'custom' ? newTab.subtitle.trim() || undefined : undefined;
    const subtitleMode: CustomTabSubtitleMode =
      newTab.subtitleMode === 'custom' && !customSubtitle ? 'none' : newTab.subtitleMode;

    if (isEditing.value && selectedTabId.value) {
      updateCustomTab(selectedTabId.value, {
        name,
        subtitle: customSubtitle,
        subtitleMode,
        groupId: newTab.groupId,
        source: newTab.source,
        query: buildCurrentQuery(),
      });
      closeEditor();
      return;
    }

    createCustomTab({
      name,
      subtitle: customSubtitle,
      subtitleMode,
      groupId: newTab.groupId,
      source: newTab.source,
      query: buildCurrentQuery(),
    });

    closeEditor();
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
      closeEditor();
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
      if (paginationInProgress || !editorOpen.value) {
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

  watch(editorOpen, (open) => {
    if (open) {
      void loadPreview();
      return;
    }

    if (previewTimer) {
      clearTimeout(previewTimer);
      previewTimer = null;
    }
  });

  onBeforeUnmount(() => {
    if (previewTimer) {
      clearTimeout(previewTimer);
      previewTimer = null;
    }
  });

  // Initial sync for drag-and-drop (deferred to avoid TDZ)
  void nextTick(() => {
    syncTabLists();
    syncGroupRows();
  });

  return {
    t,
    localePath,
    maxGroupDepth,
    endpointOptions,
    subtitleModeOptions,
    customTabs,
    newGroup,
    childGroupName,
    activeChildCreatorGroupId,
    newTab,
    editingSubtitleTabId,
    editingSubtitleDraft,
    confirmingTabId,
    confirmingGroupId,
    selectedTabId,
    editorOpen,
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
    selectedGroupExists,
    selectedGroupName,
    activeSource,
    activeSourceLabel,
    selectedEndpointLabel,
    searchSyntaxAst,
    searchSyntaxHasErrors,
    hasSearchSyntaxFeedback,
    operatorWarningMessage,
    searchValidationIssue,
    saveValidationMessage,
    canSaveTab,
    getInputValue,
    getGroupTabCount,
    getGroupDepthStyle,
    getNestedPanelStyle,
    canEditGroup,
    searchQueryParts,
    githubPreviewUrl,
    humanPreview,
    previewTotalPages,
    updateGroup,
    toggleGroupCollapsed,
    getTabSubtitle,
    getQueryPreview,
    handleSubtitleInput,
    setSubtitleMode,
    startSubtitleEdit,
    cancelSubtitleEdit,
    saveSubtitleEdit,
    requestDeleteTab,
    confirmDeleteTab,
    requestDeleteGroup,
    cancelDeleteConfirmation,
    confirmDeleteGroup,
    setSearchEndpoint,
    handleGroupReorder,
    handleTabsChanged,
    handleCreateGroup,
    handleStartChildGroup,
    handleCancelChildGroup,
    handleCreateChildGroup,
    deselectTab,
    closeEditor,
    startNewTab,
    startNewTabInGroup,
    selectTabForEdit,
    handleSaveTab,
    goToPreviewPage,
  };
};

export type TabsSettingsPageState = ReturnType<typeof useTabsSettingsPage>;
