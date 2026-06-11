<script setup lang="ts">
import {
  SlidersHorizontalIcon,
  ChevronRightIcon,
  CircleDotIcon,
  CircleMinusIcon,
  GitMergeIcon,
  LayoutGridIcon,
  GitPullRequestIcon,
  MessageSquareIcon,
  TagIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  InboxIcon,
  CodeIcon,
  UserPlusIcon,
  PenLineIcon,
  ActivityIcon,
  MailIcon,
  BookmarkIcon,
  AtSignIcon,
  EyeIcon,
  ShieldCheckIcon,
  ShieldAlertIcon,
  GitCommitIcon,
  Users2Icon,
  BellIcon,
} from 'lucide-vue-next';
import { ref } from 'vue';

import FilterAutocomplete from '~/components/ui/FilterAutocomplete.vue';
import FilterDropdown from '~/components/ui/FilterDropdown.vue';
import type { FilterOption } from '~/components/ui/FilterDropdown.vue';
import FilterMultiSelect from '~/components/ui/FilterMultiSelect.vue';
import type {
  DashboardFilterSource,
  DashboardRouteFilters,
} from '~/composables/useDashboardFilters';

const props = defineProps<{
  currentTab: DashboardFilterSource;
  filters: DashboardRouteFilters;
  labelSuggestions?: string[];
  repoSuggestions?: string[];
  authorSuggestions?: string[];
}>();

const emit = defineEmits<{
  update: [patch: Partial<DashboardRouteFilters>];
}>();

const { t } = useI18n();

const isCollapsed = ref(true);

const labelSuggestionItems = computed(() =>
  (props.labelSuggestions ?? []).map((label) => ({ value: label }))
);

const repoSuggestionItems = computed(() =>
  (props.repoSuggestions ?? []).map((repo) => ({ value: repo }))
);

const authorSuggestionItems = computed(() =>
  (props.authorSuggestions ?? []).map((author) => ({ value: author }))
);

const activeFilterCount = computed(() => {
  let count = props.filters.labels.length;
  if (props.filters.repo) count++;
  if (props.filters.author) count++;
  if (props.currentTab === 'notifications') {
    if (props.filters.reason) count++;
    if (props.filters.subjectType) count++;
    if (props.filters.subjectState) count++;
  } else {
    if (props.currentTab === 'pulls' && props.filters.review) count++;
    if (props.filters.archived) count++;
    if (props.filters.sort) count++;
    if (props.filters.order) count++;
  }
  return count;
});

const reviewOptions: FilterOption[] = [
  { value: '', label: t('dashboard.filters.options.any') },
  { value: 'none', label: t('dashboard.filters.options.none') },
  { value: 'required', label: t('dashboard.filters.options.required') },
  { value: 'approved', label: t('dashboard.filters.options.approved') },
  { value: 'changes_requested', label: t('dashboard.filters.options.changes_requested') },
];

const archivedOptions: FilterOption[] = [
  { value: '', label: t('dashboard.filters.options.excludeArchived') },
  { value: 'include', label: t('dashboard.filters.options.includeArchived') },
  { value: 'only', label: t('dashboard.filters.options.onlyArchived') },
];

const sortOptions: FilterOption[] = [
  { value: '', label: t('dashboard.filters.options.updated') },
  { value: 'created', label: t('dashboard.filters.options.created') },
  { value: 'comments', label: t('dashboard.filters.options.comments') },
  { value: 'reactions', label: t('dashboard.filters.options.reactions') },
  { value: 'interactions', label: t('dashboard.filters.options.interactions') },
];

const orderOptions: FilterOption[] = [
  { value: '', label: t('dashboard.filters.options.desc') },
  { value: 'asc', label: t('dashboard.filters.options.asc') },
];

const subjectTypeOptions: FilterOption[] = [
  { value: '', label: t('dashboard.filters.options.all'), icon: InboxIcon },
  { value: 'Issue', label: t('dashboard.filters.subjectTypes.issue'), icon: CircleDotIcon },
  {
    value: 'PullRequest',
    label: t('dashboard.filters.subjectTypes.pullRequest'),
    icon: GitPullRequestIcon,
  },
  {
    value: 'Discussion',
    label: t('dashboard.filters.subjectTypes.discussion'),
    icon: MessageSquareIcon,
  },
  { value: 'Release', label: t('dashboard.filters.subjectTypes.release'), icon: TagIcon },
  { value: 'Commit', label: t('dashboard.filters.subjectTypes.commit'), icon: CodeIcon },
  {
    value: 'CheckSuite',
    label: t('dashboard.filters.subjectTypes.checkSuite'),
    icon: CheckCircleIcon,
  },
  {
    value: 'RepositoryVulnerabilityAlert',
    label: t('dashboard.filters.subjectTypes.securityAlert'),
    icon: AlertTriangleIcon,
  },
];

const reasonOptions: FilterOption[] = [
  { value: '', label: t('dashboard.filters.options.all'), icon: LayoutGridIcon },
  { value: 'assign', label: t('dashboard.filters.reasons.assign'), icon: UserPlusIcon },
  { value: 'author', label: t('dashboard.filters.reasons.author'), icon: PenLineIcon },
  { value: 'comment', label: t('dashboard.filters.reasons.comment'), icon: MessageSquareIcon },
  { value: 'mention', label: t('dashboard.filters.reasons.mention'), icon: AtSignIcon },
  {
    value: 'review_requested',
    label: t('dashboard.filters.reasons.review_requested'),
    icon: EyeIcon,
  },
  {
    value: 'state_change',
    label: t('dashboard.filters.reasons.state_change'),
    icon: GitCommitIcon,
  },
  { value: 'subscribed', label: t('dashboard.filters.reasons.subscribed'), icon: BellIcon },
  { value: 'team_mention', label: t('dashboard.filters.reasons.team_mention'), icon: Users2Icon },
  { value: 'ci_activity', label: t('dashboard.filters.reasons.ci_activity'), icon: ActivityIcon },
  {
    value: 'security_alert',
    label: t('dashboard.filters.reasons.security_alert'),
    icon: ShieldAlertIcon,
  },
];

const showSubjectStateFilter = computed(() => {
  return props.filters.subjectType === 'Issue' || props.filters.subjectType === 'PullRequest';
});

const subjectStateOptionsForType = computed<FilterOption[]>(() => {
  const base: FilterOption[] = [
    { value: '', label: t('dashboard.filters.options.any'), icon: LayoutGridIcon },
    { value: 'open', label: t('dashboard.filters.options.open'), icon: CircleDotIcon },
    { value: 'closed', label: t('dashboard.filters.options.closed'), icon: CircleMinusIcon },
  ];

  if (props.filters.subjectType === 'PullRequest') {
    base.push({
      value: 'merged',
      label: t('dashboard.filters.options.merged'),
      icon: GitMergeIcon,
    });
  }

  return base;
});

const updateSelect = (
  key: 'review' | 'archived' | 'sort' | 'order' | 'subjectType' | 'reason' | 'subjectState',
  value: string
) => {
  const patch: Partial<DashboardRouteFilters> = { [key]: value || undefined };
  if (key === 'subjectType') {
    patch.subjectState = undefined;
  }
  emit('update', patch);
};

const updateLabels = (labels: string[]) => {
  emit('update', { labels });
};

const handleRepoChange = (value: string) => {
  emit('update', { repo: value || undefined });
};

const handleAuthorChange = (value: string) => {
  emit('update', { author: value || undefined });
};

const toggleCollapsed = () => {
  isCollapsed.value = !isCollapsed.value;
};
</script>

<template>
  <div v-if="currentTab !== 'repos'" class="sidebar-card">
    <button
      class="sidebar-card__header sidebar-card__header--collapsible"
      :aria-expanded="!isCollapsed"
      @click="toggleCollapsed"
    >
      <div class="sidebar-card__header-left">
        <SlidersHorizontalIcon :size="14" class="sidebar-card__icon" />
        <span class="sidebar-card__title">{{ t('dashboard.filters.advanced') }}</span>
        <span v-if="activeFilterCount > 0" class="sidebar-card__count">
          {{ activeFilterCount }}
        </span>
      </div>
      <ChevronRightIcon
        :size="14"
        class="sidebar-card__chevron"
        :class="{ 'sidebar-card__chevron--expanded': !isCollapsed }"
      />
    </button>

    <div
      class="sidebar-card__collapse"
      :class="{ 'sidebar-card__collapse--open': !isCollapsed }"
      :inert="isCollapsed"
    >
      <div class="sidebar-card__content">
        <div class="dashboard-advanced-filters__body">
          <template v-if="currentTab === 'notifications'">
            <label class="dashboard-advanced-filters__control">
              <span>{{ t('dashboard.filters.repo') }}</span>
              <FilterAutocomplete
                :suggestions="repoSuggestionItems"
                :model-value="filters.repo ?? ''"
                :placeholder="t('dashboard.filters.repoPlaceholder')"
                @update:model-value="handleRepoChange"
              />
            </label>

            <label class="dashboard-advanced-filters__control">
              <span>{{ t('dashboard.filters.author') }}</span>
              <FilterAutocomplete
                :suggestions="authorSuggestionItems"
                :model-value="filters.author ?? ''"
                :placeholder="t('dashboard.filters.authorPlaceholder')"
                @update:model-value="handleAuthorChange"
              />
            </label>

            <label class="dashboard-advanced-filters__control">
              <span>{{ t('dashboard.filters.labels') }}</span>
              <FilterMultiSelect
                :suggestions="labelSuggestionItems"
                :model-value="filters.labels"
                :placeholder="t('dashboard.filters.labelsPlaceholder')"
                :empty-message="t('dashboard.filters.noResults')"
                :aria-label="t('dashboard.filters.labels')"
                @update:model-value="updateLabels"
              />
            </label>

            <label class="dashboard-advanced-filters__control">
              <span>{{ t('dashboard.filters.subjectType') }}</span>
              <FilterDropdown
                :options="subjectTypeOptions"
                :model-value="filters.subjectType ?? ''"
                :aria-label="t('dashboard.filters.subjectType')"
                @update:model-value="updateSelect('subjectType', $event)"
              />
            </label>

            <label class="dashboard-advanced-filters__control">
              <span>{{ t('dashboard.filters.reason') }}</span>
              <FilterDropdown
                :options="reasonOptions"
                :model-value="filters.reason ?? ''"
                :aria-label="t('dashboard.filters.reason')"
                @update:model-value="updateSelect('reason', $event)"
              />
            </label>

            <label v-if="showSubjectStateFilter" class="dashboard-advanced-filters__control">
              <span>{{ t('dashboard.filters.subjectState') }}</span>
              <FilterDropdown
                :options="subjectStateOptionsForType"
                :model-value="filters.subjectState ?? ''"
                :aria-label="t('dashboard.filters.subjectState')"
                @update:model-value="updateSelect('subjectState', $event)"
              />
            </label>
          </template>

          <template v-else>
            <label class="dashboard-advanced-filters__control">
              <span>{{ t('dashboard.filters.repo') }}</span>
              <FilterAutocomplete
                :suggestions="repoSuggestionItems"
                :model-value="filters.repo ?? ''"
                :placeholder="t('dashboard.filters.repoPlaceholder')"
                @update:model-value="handleRepoChange"
              />
            </label>

            <label class="dashboard-advanced-filters__control">
              <span>{{ t('dashboard.filters.author') }}</span>
              <FilterAutocomplete
                :suggestions="authorSuggestionItems"
                :model-value="filters.author ?? ''"
                :placeholder="t('dashboard.filters.authorPlaceholder')"
                @update:model-value="handleAuthorChange"
              />
            </label>

            <label class="dashboard-advanced-filters__control">
              <span>{{ t('dashboard.filters.labels') }}</span>
              <FilterMultiSelect
                :suggestions="labelSuggestionItems"
                :model-value="filters.labels"
                :placeholder="t('dashboard.filters.labelsPlaceholder')"
                :empty-message="t('dashboard.filters.noResults')"
                :aria-label="t('dashboard.filters.labels')"
                @update:model-value="updateLabels"
              />
            </label>

            <label v-if="currentTab === 'pulls'" class="dashboard-advanced-filters__control">
              <span>{{ t('dashboard.filters.review') }}</span>
              <FilterDropdown
                :options="reviewOptions"
                :model-value="filters.review ?? ''"
                :aria-label="t('dashboard.filters.review')"
                @update:model-value="updateSelect('review', $event)"
              />
            </label>

            <label class="dashboard-advanced-filters__control">
              <span>{{ t('dashboard.filters.archived') }}</span>
              <FilterDropdown
                :options="archivedOptions"
                :model-value="filters.archived ?? ''"
                :aria-label="t('dashboard.filters.archived')"
                @update:model-value="updateSelect('archived', $event)"
              />
            </label>

            <label class="dashboard-advanced-filters__control">
              <span>{{ t('dashboard.filters.sort') }}</span>
              <FilterDropdown
                :options="sortOptions"
                :model-value="filters.sort ?? ''"
                :aria-label="t('dashboard.filters.sort')"
                @update:model-value="updateSelect('sort', $event)"
              />
            </label>

            <label class="dashboard-advanced-filters__control">
              <span>{{ t('dashboard.filters.order') }}</span>
              <FilterDropdown
                :options="orderOptions"
                :model-value="filters.order ?? ''"
                :aria-label="t('dashboard.filters.order')"
                @update:model-value="updateSelect('order', $event)"
              />
            </label>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.sidebar-card {
  background: var(--gitpulse-surface-muted);
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
  overflow: hidden;
}

.sidebar-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--gitpulse-border);
  background: var(--gitpulse-surface);
}

.sidebar-card__header--collapsible {
  width: 100%;
  cursor: pointer;
  transition: background 0.12s ease;

  &:hover {
    background: var(--gitpulse-surface-hover);
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-accent);
    outline-offset: -2px;
  }
}

.sidebar-card__header-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sidebar-card__icon {
  color: var(--gitpulse-accent);
}

.sidebar-card__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  letter-spacing: -0.01em;
}

.sidebar-card__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.25rem;
  height: 1.25rem;
  padding: 0 0.25rem;
  border-radius: 9999px;
  background: var(--gitpulse-accent);
  color: white;
  font-size: 0.6875rem;
  font-weight: 600;
}

.sidebar-card__chevron {
  color: var(--gitpulse-text-muted);
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.sidebar-card__chevron--expanded {
  transform: rotate(90deg);
}

.sidebar-card__collapse {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.22s ease;
}

.sidebar-card__collapse--open {
  grid-template-rows: 1fr;
}

.sidebar-card__content {
  min-height: 0;
  overflow: hidden;
}

.dashboard-advanced-filters__body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 12px 16px;
}

.dashboard-advanced-filters__control {
  display: grid;
  gap: 0.25rem;
  color: var(--gitpulse-text-muted);
  font-size: 0.75rem;
  font-weight: 600;
}

.dashboard-advanced-filters__control .input {
  width: 100%;
}

@media (max-width: 860px) {
  .sidebar-card {
    display: none;
  }
}
</style>
