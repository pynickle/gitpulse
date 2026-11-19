<template>
  <Teleport to="body">
    <Transition name="label-modal">
      <div v-if="isVisible" class="label-editor-overlay" @click.self="close">
        <div
          ref="panelRef"
          class="label-editor-panel"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          @keydown="handleKeydown"
        >
          <div class="label-editor-header">
            <button
              v-if="page !== 'reason'"
              type="button"
              class="label-editor-close close-modal__back"
              :aria-label="t('issueDetail.back')"
              @click="showPage('reason')"
            >
              <ArrowLeftIcon :size="16" />
            </button>
            <h3 :id="titleId" class="label-editor-title close-modal__title">{{ pageTitle }}</h3>
            <button
              type="button"
              class="label-editor-close"
              :aria-label="t('issueDetail.cancel')"
              :disabled="saving"
              @click="close"
            >
              <XIcon :size="16" />
            </button>
          </div>

          <ScrollArea v-if="page === 'reason'" class="label-editor-content">
            <div v-if="error" class="label-editor-error">
              <CircleExclamationPointIcon :size="14" />
              <span>{{ error }}</span>
              <button
                type="button"
                class="label-editor-error-dismiss"
                @click="$emit('dismiss-error')"
              >
                <XIcon :size="12" />
              </button>
            </div>

            <div class="label-editor-list">
              <div v-for="option in reasonOptions" :key="option.value">
                <label class="issue-option-row">
                  <input
                    v-model="reason"
                    class="issue-option-row__input"
                    type="radio"
                    :name="titleId"
                    :value="option.value"
                    :disabled="saving"
                  />
                  <span
                    class="issue-option-row__bar"
                    :style="{ '--issue-option-color': option.color }"
                    aria-hidden="true"
                  ></span>
                  <span class="issue-option-row__text">
                    <span class="issue-option-row__name">{{ option.label }}</span>
                    <span class="issue-option-row__desc">{{ option.description }}</span>
                  </span>
                  <CheckIcon class="issue-option-row__check" :size="14" aria-hidden="true" />
                </label>

                <div
                  v-if="option.value === 'duplicate' && reason === 'duplicate'"
                  class="close-target"
                  :class="{ 'is-empty': !target }"
                >
                  <button
                    ref="chooseTargetRef"
                    type="button"
                    class="close-target__choose"
                    :title="t('issueDetail.chooseDuplicateTarget')"
                    :disabled="saving"
                    @click="chooseTarget"
                  >
                    <span v-if="target" class="close-target__text"
                      ><span class="close-target__ref"
                        >{{ target.owner }}/{{ target.repo }}#{{ target.number }}</span
                      >
                      {{ target.title }}</span
                    >
                    <template v-else>
                      <SearchIcon :size="13" aria-hidden="true" />
                      <span class="close-target__text">{{
                        t('issueDetail.chooseDuplicateTarget')
                      }}</span>
                    </template>
                    <ChevronRightIcon class="close-target__chevron" :size="13" aria-hidden="true" />
                  </button>
                  <button
                    v-if="target"
                    type="button"
                    class="close-modal__icon-btn"
                    :aria-label="t('issueDetail.clearDuplicateTarget')"
                    :title="t('issueDetail.clearDuplicateTarget')"
                    :disabled="saving"
                    @click="target = null"
                  >
                    <XIcon :size="13" />
                  </button>
                </div>
              </div>
            </div>
          </ScrollArea>

          <ScrollArea v-else class="label-editor-content">
            <div class="close-picker__toolbar">
              <FilterSegmentedControl
                v-if="page === 'repos'"
                class="close-picker__scope"
                :model-value="repoScope"
                :options="repoScopeOptions"
                :aria-label="t('issueDetail.repositoryScope')"
                @update:model-value="setRepoScope"
              />

              <div class="close-picker__field">
                <button
                  v-if="page === 'issues'"
                  type="button"
                  class="close-picker__field-repo"
                  :aria-label="t('issueDetail.changeRepository', { repository: issueRepoName })"
                  :title="t('issueDetail.changeRepository', { repository: issueRepoName })"
                  @click="showPage('repos')"
                >
                  <BookMarkedIcon :size="13" aria-hidden="true" />
                  <span class="close-picker__field-repo-name">{{ issueRepoName }}</span>
                  <ChevronsUpDownIcon :size="13" aria-hidden="true" />
                </button>
                <SearchIcon :size="14" class="close-picker__field-icon" aria-hidden="true" />
                <input
                  ref="searchInputRef"
                  class="close-picker__field-input"
                  type="text"
                  :value="page === 'issues' ? issueQuery : repoQuery"
                  :placeholder="searchLabel"
                  :aria-label="searchLabel"
                  @input="handleSearchInput"
                />
              </div>
            </div>

            <div v-if="activeList.error.value" class="label-editor-error">
              <CircleExclamationPointIcon :size="14" />
              <span>{{ activeList.error.value }}</span>
            </div>

            <div v-else-if="activeList.loading.value" class="label-editor-loading">
              <LoaderCircleIcon class="spin-animation" :size="18" />
              <span>{{ t('issueDetail.loadingResults') }}</span>
            </div>

            <div v-else-if="page === 'issues'" class="label-editor-list">
              <button
                v-for="item in visibleIssues"
                :key="item.number"
                type="button"
                class="close-picker__row"
                data-picker-row
                @click="selectIssue(item)"
              >
                <component
                  :is="getIssueStateVisual(item.state, item.state_reason).icon"
                  :size="14"
                  :style="{
                    color:
                      getIssueStateVisual(item.state, item.state_reason).color ??
                      'var(--gitpulse-success)',
                  }"
                  aria-hidden="true"
                />
                <span class="close-picker__row-text"
                  ><span class="close-picker__row-number">#{{ item.number }}</span>
                  {{ item.title }}</span
                >
              </button>
              <div v-if="!visibleIssues.length" class="label-editor-empty">
                {{ t('issueDetail.noIssuesFound') }}
              </div>
            </div>

            <div v-else class="label-editor-list">
              <button
                v-for="item in repos.items.value"
                :key="item.full_name"
                type="button"
                class="close-picker__row"
                data-picker-row
                @click="selectRepository(item)"
              >
                <BookMarkedIcon :size="14" aria-hidden="true" />
                <span class="close-picker__row-text">{{ item.full_name }}</span>
              </button>
              <div v-if="!repos.items.value.length" class="label-editor-empty">
                {{
                  repoScope === 'github' && !repoQuery.trim()
                    ? t('issueDetail.searchAllGitHubHint')
                    : t('issueDetail.noRepositoriesFound')
                }}
              </div>
            </div>

            <div
              v-if="activeList.pagination.value.hasPrev || activeList.pagination.value.hasNext"
              class="close-picker__pager"
            >
              <button
                type="button"
                class="close-modal__icon-btn"
                :aria-label="t('dashboard.pagination.previous')"
                :disabled="!activeList.pagination.value.hasPrev || activeList.loading.value"
                @click="activeList.load(activeList.pagination.value.page - 1)"
              >
                <ChevronLeftIcon :size="14" />
              </button>
              <span class="close-picker__page">{{ activeList.pagination.value.page }}</span>
              <button
                type="button"
                class="close-modal__icon-btn"
                :aria-label="t('dashboard.pagination.next')"
                :disabled="!activeList.pagination.value.hasNext || activeList.loading.value"
                @click="activeList.load(activeList.pagination.value.page + 1)"
              >
                <ChevronRightIcon :size="14" />
              </button>
            </div>
          </ScrollArea>

          <div v-if="page === 'reason'" class="label-editor-footer">
            <button type="button" class="label-btn-cancel" :disabled="saving" @click="close">
              {{ t('issueDetail.cancel') }}
            </button>
            <button
              type="button"
              class="label-btn-save"
              :disabled="saving || (reason === 'duplicate' && !target)"
              @click="confirm"
            >
              <LoaderCircleIcon v-if="saving" class="spin-animation" :size="14" />
              <span>{{ saving ? t('issueDetail.closing') : t('issueDetail.closeIssue') }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import {
  ArrowLeftIcon,
  BookMarkedIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsUpDownIcon,
  CircleExclamationPointIcon,
  LoaderCircleIcon,
  SearchIcon,
  XIcon,
} from '@lucide/vue';
import { computed, nextTick, ref, shallowRef, useId, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { IssueCloseReason } from '#shared/types/issues';
import FilterSegmentedControl from '~/components/ui/FilterSegmentedControl.vue';
import ScrollArea from '~/components/ui/ScrollArea.vue';
import { getIssueStateVisual } from '~/utils/getDashboardSubjectStateVisual';
import { getFetchErrorMessage } from '~/utils/getFetchErrorMessage';

interface PickerPagination {
  page: number;
  hasPrev: boolean;
  hasNext: boolean;
}

interface IssueResult {
  number: number;
  title: string;
  state: string;
  state_reason?: string | null;
  pull_request?: unknown;
}

interface RepositoryResult {
  full_name: string;
  name: string;
  owner: { login: string };
}

interface DuplicateTargetSelection {
  owner: string;
  repo: string;
  number: number;
  title: string;
}

const PER_PAGE = 20;

const { isVisible, owner, repo, issueNumber, saving } = defineProps<{
  isVisible: boolean;
  owner: string;
  repo: string;
  issueNumber: number;
  saving: boolean;
  error?: string;
}>();

const emit = defineEmits<{
  close: [];
  confirm: [
    reason: IssueCloseReason,
    duplicateOf: { owner: string; repo: string; number: number } | null,
  ];
  'dismiss-error': [];
}>();

const { t } = useI18n();
const apiFetch = useGitPulseApiFetch();
const titleId = useId();
const panelRef = ref<HTMLElement | null>(null);
const searchInputRef = ref<HTMLInputElement | null>(null);
const chooseTargetRef = ref<HTMLButtonElement[]>([]);

const page = shallowRef<'reason' | 'issues' | 'repos'>('reason');
const reason = shallowRef<IssueCloseReason>('completed');
const target = shallowRef<DuplicateTargetSelection | null>(null);
const issueRepo = shallowRef({ owner, repo });
const issueQuery = shallowRef('');
const repoQuery = shallowRef('');
const repoScope = shallowRef<'accessible' | 'github'>('accessible');

const reasonOptions = computed(() => [
  {
    value: 'completed' as const,
    label: t('issueDetail.closeReasonCompleted'),
    description: t('issueDetail.closeReasonCompletedDesc'),
    color: 'var(--gitpulse-purple)',
  },
  {
    value: 'not_planned' as const,
    label: t('issueDetail.closeReasonNotPlanned'),
    description: t('issueDetail.closeReasonNotPlannedDesc'),
    color: 'var(--gitpulse-text-muted)',
  },
  {
    value: 'duplicate' as const,
    label: t('issueDetail.closeReasonDuplicate'),
    description: t('issueDetail.closeReasonDuplicateDesc'),
    color: 'var(--gitpulse-text-muted)',
  },
]);

const pageTitle = computed(() =>
  page.value === 'issues'
    ? t('issueDetail.duplicateOf')
    : page.value === 'repos'
      ? t('issueDetail.chooseRepository')
      : t('issueDetail.closeIssueReason')
);

const searchLabel = computed(() =>
  page.value === 'issues' ? t('issueDetail.searchIssues') : t('issueDetail.searchRepositories')
);

const repoScopeOptions = computed(() => [
  { value: 'accessible', label: t('issueDetail.yourRepositories') },
  { value: 'github', label: t('issueDetail.searchAllGitHub') },
]);

const issueRepoName = computed(() => `${issueRepo.value.owner}/${issueRepo.value.repo}`);

const buildSearchPath = (path: string, params: Record<string, string>, pageNumber: number) =>
  `${path}?${new URLSearchParams({ ...params, page: String(pageNumber), per_page: String(PER_PAGE) })}`;

/** One paginated result list; a page whose request is unchanged is not fetched again. */
function usePickerList<T>(buildPath: (pageNumber: number) => string | null) {
  const items = shallowRef<T[]>([]);
  const pagination = shallowRef<PickerPagination>({ page: 1, hasPrev: false, hasNext: false });
  const loading = shallowRef(false);
  const error = shallowRef('');
  let loadedPath: string | null | undefined;
  let requestId = 0;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  const load = async (pageNumber = 1, { reuse = false } = {}) => {
    clearTimeout(debounceTimer);
    const path = buildPath(pageNumber);
    if (reuse && path === loadedPath && !error.value) return;

    const currentRequest = ++requestId;
    loadedPath = path;
    error.value = '';
    if (!path) {
      items.value = [];
      pagination.value = { page: 1, hasPrev: false, hasNext: false };
      loading.value = false;
      return;
    }

    loading.value = true;
    try {
      const data = await apiFetch<{ items?: T[]; pagination?: Partial<PickerPagination> }>(path);
      if (currentRequest !== requestId) return;
      items.value = Array.isArray(data.items) ? data.items : [];
      pagination.value = {
        page: data.pagination?.page ?? pageNumber,
        hasPrev: Boolean(data.pagination?.hasPrev),
        hasNext: Boolean(data.pagination?.hasNext),
      };
    } catch (fetchError) {
      if (currentRequest !== requestId) return;
      items.value = [];
      error.value = getFetchErrorMessage(fetchError, t('issueDetail.failedToLoadResults'));
    } finally {
      if (currentRequest === requestId) loading.value = false;
    }
  };

  const loadSoon = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => void load(1), REPOSITORY_SEARCH_DEBOUNCE_MS);
  };

  const reset = () => {
    clearTimeout(debounceTimer);
    requestId += 1;
    loadedPath = undefined;
    items.value = [];
    pagination.value = { page: 1, hasPrev: false, hasNext: false };
    loading.value = false;
    error.value = '';
  };

  return { items, pagination, loading, error, load, loadSoon, reset };
}

const issueNumberQuery = computed(() => /^#?(\d+)$/.exec(issueQuery.value.trim())?.[1] ?? null);

// GitHub matches a bare number against Issue numbers; text is limited to titles.
const issues = usePickerList<IssueResult>((pageNumber) => {
  const text = issueQuery.value.trim();
  const terms = issueNumberQuery.value ? [issueNumberQuery.value] : text ? [text, 'in:title'] : [];
  return buildSearchPath(
    '/api/search/issues',
    {
      q: [`repo:${issueRepoName.value}`, 'is:issue', ...terms, 'sort:updated-desc'].join(' '),
    },
    pageNumber
  );
});

const repos = usePickerList<RepositoryResult>((pageNumber) => {
  const query = repoQuery.value.trim();
  if (repoScope.value === 'github') {
    return query ? buildSearchPath('/api/search/repositories', { q: query }, pageNumber) : null;
  }
  return buildSearchPath(
    '/api/repos',
    query ? { scope: 'accessible', q: query } : { scope: 'accessible' },
    pageNumber
  );
});

const activeList = computed(() => (page.value === 'issues' ? issues : repos));

const isCurrentIssue = (item: IssueResult) =>
  item.number === issueNumber &&
  issueRepo.value.owner.toLowerCase() === owner.toLowerCase() &&
  issueRepo.value.repo.toLowerCase() === repo.toLowerCase();

// A number query also matches bodies that mention it; keep only number and title hits.
const visibleIssues = computed(() =>
  issues.items.value.filter(
    (item) =>
      !item.pull_request &&
      !isCurrentIssue(item) &&
      (!issueNumberQuery.value ||
        item.number === Number(issueNumberQuery.value) ||
        item.title.includes(issueNumberQuery.value))
  )
);

const showPage = async (nextPage: 'reason' | 'issues' | 'repos') => {
  page.value = nextPage;
  if (nextPage === 'issues') void issues.load(issues.pagination.value.page, { reuse: true });
  if (nextPage === 'repos') void repos.load(repos.pagination.value.page, { reuse: true });

  await nextTick();
  if (nextPage === 'reason') chooseTargetRef.value[0]?.focus();
  else searchInputRef.value?.focus();
};

const chooseTarget = () => {
  reason.value = 'duplicate';
  void showPage('issues');
};

const handleSearchInput = (event: Event) => {
  const value = (event.target as HTMLInputElement).value;
  if (page.value === 'issues') {
    issueQuery.value = value;
    issues.loadSoon();
  } else {
    repoQuery.value = value;
    repos.loadSoon();
  }
};

const setRepoScope = (scope: string) => {
  repoScope.value = scope === 'github' ? 'github' : 'accessible';
  void repos.load(1);
};

const selectRepository = (item: RepositoryResult) => {
  issueRepo.value = { owner: item.owner.login, repo: item.name };
  issueQuery.value = '';
  issues.reset();
  void showPage('issues');
};

const selectIssue = (item: IssueResult) => {
  target.value = {
    owner: issueRepo.value.owner,
    repo: issueRepo.value.repo,
    number: item.number,
    title: item.title,
  };
  void showPage('reason');
};

const confirm = () => {
  if (reason.value === 'duplicate' && !target.value) return;
  const duplicateOf =
    reason.value === 'duplicate' && target.value
      ? { owner: target.value.owner, repo: target.value.repo, number: target.value.number }
      : null;
  emit('confirm', reason.value, duplicateOf);
};

const close = () => {
  if (!saving) emit('close');
};

// The choice lives only as long as the dialog is open.
watch(
  () => isVisible,
  (visible) => {
    if (visible) return;
    page.value = 'reason';
    reason.value = 'completed';
    target.value = null;
    issueRepo.value = { owner, repo };
    issueQuery.value = '';
    repoQuery.value = '';
    repoScope.value = 'accessible';
    issues.reset();
    repos.reset();
  }
);

const { handleKeydown } = useModalLifecycle({
  open: () => isVisible,
  panel: panelRef,
  onRequestClose: close,
});
</script>

<style scoped lang="scss">
@use '~/assets/scss/detail-metadata-editor';
@use '~/assets/scss/pointer' as *;

.close-modal__title {
  flex: 1;
  min-width: 0;
}

// Pulls the back arrow's glyph onto the inset the toolbar and result rows use.
.close-modal__back {
  margin-left: -5px;
  margin-right: 6px;
}

.close-modal__icon-btn {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--gitpulse-text-subtle);
  cursor: pointer;
  transition:
    background 0.12s ease,
    color 0.12s ease;

  @include hover-only {
    &:hover:not(:disabled) {
      background: var(--gitpulse-surface-hover);
      color: var(--gitpulse-text);
    }
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring);
    outline-offset: -2px;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

// Sits under the Duplicate option, lined up with the option's text.
.close-target {
  display: flex;
  align-items: center;
  gap: 2px;
  margin: 2px 0 6px 15px;
  padding-right: 3px;
  border: 1px solid var(--gitpulse-border);
  border-radius: 6px;
  background: var(--gitpulse-surface-muted);

  &.is-empty {
    border-style: dashed;
    border-color: var(--gitpulse-border-strong);
  }
}

.close-target__choose {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 6px;
  min-width: 0;
  height: 32px;
  padding: 0 8px 0 10px;
  border: none;
  border-radius: 5px;
  background: transparent;
  font-size: 12px;
  color: var(--gitpulse-text-muted);
  text-align: left;
  cursor: pointer;

  @include hover-only {
    &:hover:not(:disabled) {
      color: var(--bulma-text-strong, var(--gitpulse-text-strong));
    }
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring);
    outline-offset: -2px;
  }

  &:disabled {
    cursor: not-allowed;
  }
}

.close-target__text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.close-target__ref {
  font-weight: 600;
  color: var(--gitpulse-accent);
}

.close-target__chevron {
  flex-shrink: 0;
}

// Toolbar and result rows share one inset with the header: the content pads
// 12px and each of these adds 8px.
.close-picker__toolbar {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px 8px 8px;
  background: var(--gitpulse-surface);
}

.close-picker__scope {
  display: flex;
  width: 100%;
}

.close-picker__field {
  display: flex;
  align-items: center;
  height: 34px;
  border: 1px solid var(--gitpulse-border);
  border-radius: 6px;
  background: var(--gitpulse-surface-muted);
  overflow: hidden;
  transition: border-color 0.12s ease;

  &:has(.close-picker__field-input:focus) {
    border-color: var(--gitpulse-accent);
  }
}

.close-picker__field-repo {
  display: inline-flex;
  flex-shrink: 1;
  align-items: center;
  gap: 5px;
  min-width: 0;
  max-width: 55%;
  height: 100%;
  padding: 0 8px 0 10px;
  border: none;
  border-right: 1px solid var(--gitpulse-border);
  background: var(--gitpulse-surface);
  font-size: 12px;
  font-weight: 600;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  cursor: pointer;

  svg {
    flex-shrink: 0;
    color: var(--gitpulse-text-muted);
  }

  @include hover-only {
    &:hover {
      background: var(--gitpulse-surface-hover);
    }
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring);
    outline-offset: -2px;
  }
}

.close-picker__field-repo-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.close-picker__field-icon {
  flex-shrink: 0;
  margin: 0 6px 0 10px;
  color: var(--gitpulse-text-muted);
}

.close-picker__field-input {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0 10px 0 0;
  border: none;
  background: transparent;
  font-size: 13px;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));

  &::placeholder {
    color: var(--gitpulse-text-muted);
  }

  &:focus {
    outline: none;
  }
}

.close-picker__row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  text-align: left;
  cursor: pointer;

  @include hover-only {
    &:hover {
      background: var(--gitpulse-surface-hover);
    }
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring);
    outline-offset: -2px;
  }

  svg {
    flex-shrink: 0;
    color: var(--gitpulse-text-muted);
  }
}

.close-picker__row-text {
  min-width: 0;
  overflow: hidden;
  font-size: 13px;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  text-overflow: ellipsis;
  white-space: nowrap;
}

.close-picker__row-number {
  color: var(--gitpulse-text-muted);
}

.close-picker__pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 0 4px;
}

.close-picker__page {
  font-size: 12px;
  color: var(--gitpulse-text-muted);
}
</style>
