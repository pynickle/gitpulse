<script setup lang="ts">
import { ArrowLeftIcon } from 'lucide-vue-next';
import { nextTick, ref, shallowRef, watch } from 'vue';

import type { AutocompleteSuggestion } from '~/components/ui/FilterAutocomplete.vue';
import FilterAutocomplete from '~/components/ui/FilterAutocomplete.vue';
import FilterDropdown from '~/components/ui/FilterDropdown.vue';
import FilterMultiSelect from '~/components/ui/FilterMultiSelect.vue';
import type { SegmentedOption } from '~/components/ui/FilterSegmentedControl.vue';
import FilterSegmentedControl from '~/components/ui/FilterSegmentedControl.vue';
import type {
  DashboardFilterSource,
  DashboardRouteFilters,
} from '~/composables/useDashboardFilters';
import createFocusTrapController from '~/utils/createFocusTrapController';

const props = defineProps<{
  open: boolean;
  currentTab: DashboardFilterSource;
  filters: DashboardRouteFilters;
  repoSuggestions?: string[] | AutocompleteSuggestion[];
  authorSuggestions?: string[] | AutocompleteSuggestion[];
  labelSuggestions?: string[];
}>();

const emit = defineEmits<{
  close: [];
  update: [patch: Partial<DashboardRouteFilters>];
  clear: [];
}>();

const { t } = useI18n();
const panelElement = ref<HTMLElement | null>(null);
const focusTrap = createFocusTrapController();

const localFilters = ref<DashboardRouteFilters>({ labels: [] });
const advancedOpen = shallowRef(false);

const repoItems = computed<AutocompleteSuggestion[]>(() =>
  (props.repoSuggestions ?? []).map((s) => (typeof s === 'string' ? { value: s } : s))
);

const authorItems = computed<AutocompleteSuggestion[]>(() =>
  (props.authorSuggestions ?? []).map((s) => (typeof s === 'string' ? { value: s } : s))
);

const labelItems = computed(() =>
  (props.labelSuggestions ?? []).map((label) => ({ value: label }))
);

const stateOptions = computed<SegmentedOption[]>(() => {
  if (props.currentTab === 'notifications') {
    return [
      { value: '', label: t('dashboard.filters.options.all') },
      { value: 'unread', label: t('dashboard.filters.options.unread') },
      { value: 'read', label: t('dashboard.filters.options.read') },
    ];
  }
  if (props.currentTab === 'pulls') {
    return [
      { value: '', label: t('dashboard.filters.options.open') },
      { value: 'closed', label: t('dashboard.filters.options.closed') },
      { value: 'merged', label: t('dashboard.filters.options.merged') },
      { value: 'all', label: t('dashboard.filters.options.all') },
    ];
  }
  if (props.currentTab === 'issues') {
    return [
      { value: '', label: t('dashboard.filters.options.open') },
      { value: 'closed', label: t('dashboard.filters.options.closed') },
      { value: 'all', label: t('dashboard.filters.options.all') },
    ];
  }
  return [];
});

const subjectStateOptions = computed<SegmentedOption[]>(() => [
  { value: '', label: t('dashboard.filters.options.any') },
  { value: 'open', label: t('dashboard.filters.options.open') },
  { value: 'closed', label: t('dashboard.filters.options.closed') },
]);

const selectedState = computed(() => localFilters.value.state ?? '');
const selectedSubjectState = computed(() => localFilters.value.subjectState ?? '');

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    emit('close');
    return;
  }
  if (panelElement.value) focusTrap.trapTabKey(event, panelElement.value);
};

const updateLocalFilter = (key: keyof DashboardRouteFilters, value: string) => {
  (localFilters.value as Record<string, unknown>)[key] = value || undefined;
};

const updateLocalLabels = (labels: string[]) => {
  localFilters.value.labels = labels;
};

const applyFilters = () => {
  emit('update', { ...localFilters.value });
  emit('close');
};

const clearLocalFilters = () => {
  localFilters.value = { labels: [] };
  emit('clear');
};

watch(
  () => props.open,
  async (open) => {
    if (!import.meta.client) return;

    if (!open) {
      await nextTick();
      focusTrap.restorePreviousFocus();
      return;
    }

    localFilters.value = {
      ...props.filters,
      labels: [...props.filters.labels],
    };

    focusTrap.capturePreviousFocus();

    await nextTick();
    if (panelElement.value) focusTrap.focusInitialElement(panelElement.value);
  }
);
</script>

<template>
  <Teleport to="body">
    <Transition name="filter-modal">
      <div
        v-if="open"
        ref="panelElement"
        class="filter-modal"
        role="dialog"
        aria-labelledby="filter-modal-title"
        aria-modal="true"
        tabindex="-1"
        @keydown="handleKeydown"
      >
        <header class="filter-modal__header">
          <button
            class="filter-modal__back"
            type="button"
            :aria-label="t('dashboard.filters.closeDrawer')"
            @click="emit('close')"
          >
            <ArrowLeftIcon :size="20" aria-hidden="true" />
          </button>
          <h2 id="filter-modal-title" class="filter-modal__title">
            {{ t('dashboard.filters.title') }}
          </h2>
          <button class="filter-modal__apply" type="button" @click="applyFilters">
            {{ t('dashboard.filters.apply') }}
          </button>
        </header>

        <div class="filter-modal__content">
          <section v-if="stateOptions.length > 0" class="filter-modal__section">
            <h3 class="filter-modal__section-title">
              {{ t('dashboard.filters.state') }}
            </h3>
            <FilterSegmentedControl
              :options="stateOptions"
              :model-value="selectedState"
              :aria-label="t('dashboard.filters.state')"
              @update:model-value="updateLocalFilter('state', $event)"
            />
          </section>

          <section v-if="currentTab === 'notifications'" class="filter-modal__section">
            <h3 class="filter-modal__section-title">
              {{ t('dashboard.filters.subjectState') }}
            </h3>
            <FilterSegmentedControl
              :options="subjectStateOptions"
              :model-value="selectedSubjectState"
              :aria-label="t('dashboard.filters.subjectState')"
              @update:model-value="updateLocalFilter('subjectState', $event)"
            />
          </section>

          <section v-if="currentTab !== 'repos'" class="filter-modal__section">
            <h3 class="filter-modal__section-title">
              {{ t('dashboard.filters.repo') }}
            </h3>
            <FilterAutocomplete
              :model-value="localFilters.repo ?? ''"
              :suggestions="repoItems"
              :placeholder="t('dashboard.filters.repoPlaceholder')"
              @update:model-value="updateLocalFilter('repo', $event)"
            />
          </section>

          <section v-if="currentTab !== 'repos'" class="filter-modal__section">
            <h3 class="filter-modal__section-title">
              {{ t('dashboard.filters.author') }}
            </h3>
            <FilterAutocomplete
              :model-value="localFilters.author ?? ''"
              :suggestions="authorItems"
              :placeholder="t('dashboard.filters.authorPlaceholder')"
              @update:model-value="updateLocalFilter('author', $event)"
            />
          </section>

          <details
            v-if="currentTab !== 'repos'"
            class="filter-modal__collapsible"
            :open="advancedOpen || undefined"
            @toggle="advancedOpen = ($event.target as HTMLDetailsElement).open"
          >
            <summary class="filter-modal__summary">
              {{ t('dashboard.filters.advanced') }}
              <svg
                class="filter-modal__chevron"
                :class="{ 'filter-modal__chevron--open': advancedOpen }"
                viewBox="0 0 16 16"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  d="M4.427 9.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 9H4.604a.25.25 0 00-.177.427zM4.427 6.573L7.823 3.177a.25.25 0 01.354 0L11.573 6.573A.25.25 0 0111.396 7H4.604a.25.25 0 01-.177-.427z"
                />
              </svg>
            </summary>

            <div class="filter-modal__advanced-body">
              <label class="filter-modal__field">
                <span class="filter-modal__field-label">{{ t('dashboard.filters.labels') }}</span>
                <FilterMultiSelect
                  :model-value="localFilters.labels"
                  :suggestions="labelItems"
                  :placeholder="t('dashboard.filters.labelsPlaceholder')"
                  :empty-message="t('dashboard.filters.noResults')"
                  :aria-label="t('dashboard.filters.labels')"
                  @update:model-value="updateLocalLabels"
                />
              </label>

              <template v-if="currentTab === 'notifications'">
                <label class="filter-modal__field">
                  <span class="filter-modal__field-label">{{ t('dashboard.filters.reason') }}</span>
                  <input
                    class="filter-modal__input"
                    type="text"
                    :value="localFilters.reason ?? ''"
                    placeholder="mention"
                    @change="updateLocalFilter('reason', ($event.target as HTMLInputElement).value)"
                  />
                </label>

                <label class="filter-modal__field">
                  <span class="filter-modal__field-label">{{
                    t('dashboard.filters.subjectType')
                  }}</span>
                  <input
                    class="filter-modal__input"
                    type="text"
                    :value="localFilters.subjectType ?? ''"
                    placeholder="Issue"
                    @change="
                      updateLocalFilter('subjectType', ($event.target as HTMLInputElement).value)
                    "
                  />
                </label>
              </template>

              <template v-else>
                <label v-if="currentTab === 'pulls'" class="filter-modal__field">
                  <span class="filter-modal__field-label">{{ t('dashboard.filters.review') }}</span>
                  <FilterDropdown
                    :model-value="localFilters.review ?? ''"
                    :options="[
                      { value: '', label: t('dashboard.filters.options.any') },
                      {
                        value: 'none',
                        label: t('dashboard.filters.options.none'),
                      },
                      {
                        value: 'required',
                        label: t('dashboard.filters.options.required'),
                      },
                      {
                        value: 'approved',
                        label: t('dashboard.filters.options.approved'),
                      },
                      {
                        value: 'changes_requested',
                        label: t('dashboard.filters.options.changes_requested'),
                      },
                    ]"
                    :placeholder="t('dashboard.filters.options.any')"
                    @update:model-value="updateLocalFilter('review', $event)"
                  />
                </label>

                <label class="filter-modal__field">
                  <span class="filter-modal__field-label">{{
                    t('dashboard.filters.archived')
                  }}</span>
                  <FilterDropdown
                    :model-value="localFilters.archived ?? ''"
                    :options="[
                      {
                        value: '',
                        label: t('dashboard.filters.options.excludeArchived'),
                      },
                      {
                        value: 'include',
                        label: t('dashboard.filters.options.includeArchived'),
                      },
                      {
                        value: 'only',
                        label: t('dashboard.filters.options.onlyArchived'),
                      },
                    ]"
                    :placeholder="t('dashboard.filters.options.excludeArchived')"
                    @update:model-value="updateLocalFilter('archived', $event)"
                  />
                </label>

                <label class="filter-modal__field">
                  <span class="filter-modal__field-label">{{ t('dashboard.filters.sort') }}</span>
                  <FilterDropdown
                    :model-value="localFilters.sort ?? ''"
                    :options="[
                      {
                        value: '',
                        label: t('dashboard.filters.options.updated'),
                      },
                      {
                        value: 'created',
                        label: t('dashboard.filters.options.created'),
                      },
                      {
                        value: 'comments',
                        label: t('dashboard.filters.options.comments'),
                      },
                      {
                        value: 'reactions',
                        label: t('dashboard.filters.options.reactions'),
                      },
                      {
                        value: 'interactions',
                        label: t('dashboard.filters.options.interactions'),
                      },
                    ]"
                    :placeholder="t('dashboard.filters.options.updated')"
                    @update:model-value="updateLocalFilter('sort', $event)"
                  />
                </label>

                <label class="filter-modal__field">
                  <span class="filter-modal__field-label">{{ t('dashboard.filters.order') }}</span>
                  <FilterDropdown
                    :model-value="localFilters.order ?? ''"
                    :options="[
                      {
                        value: '',
                        label: t('dashboard.filters.options.desc'),
                      },
                      {
                        value: 'asc',
                        label: t('dashboard.filters.options.asc'),
                      },
                    ]"
                    :placeholder="t('dashboard.filters.options.desc')"
                    @update:model-value="updateLocalFilter('order', $event)"
                  />
                </label>
              </template>
            </div>
          </details>
        </div>

        <footer class="filter-modal__footer">
          <button class="filter-modal__clear" type="button" @click="clearLocalFilters">
            {{ t('dashboard.filters.clearAll') }}
          </button>
        </footer>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.filter-modal {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  background: var(--gitpulse-surface);
}

.filter-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 1rem;
  border-bottom: 1px solid var(--gitpulse-border);
  background: var(--gitpulse-surface);
  position: sticky;
  top: 0;
  z-index: 1;
}

.filter-modal__back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 0;
  border-radius: var(--gitpulse-radius-md);
  background: transparent;
  color: var(--gitpulse-text-strong);
  cursor: pointer;
  transition: background 0.12s ease;
  flex-shrink: 0;

  &:hover {
    background: var(--gitpulse-surface-hover);
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring);
    outline-offset: -2px;
  }
}

.filter-modal__title {
  flex: 1;
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--gitpulse-text-strong);
  text-align: center;
}

.filter-modal__apply {
  padding: 0.5rem 1.25rem;
  border: 0;
  border-radius: var(--gitpulse-radius-md);
  background: var(--gitpulse-accent);
  color: var(--gitpulse-on-accent, #fff);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.12s ease;
  flex-shrink: 0;

  &:hover {
    opacity: 0.9;
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring);
    outline-offset: 2px;
  }
}

.filter-modal__content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  overscroll-behavior: contain;
}

.filter-modal__section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.filter-modal__section-title {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--gitpulse-text-muted);
}

.filter-modal__collapsible {
  border-top: 1px solid var(--gitpulse-border);
  padding-top: 1.25rem;
}

.filter-modal__summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 44px;
  padding: 0.5rem 0;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--gitpulse-text-strong);
  cursor: pointer;
  user-select: none;
  list-style: none;

  &::-webkit-details-marker {
    display: none;
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring);
    outline-offset: 2px;
    border-radius: var(--gitpulse-radius-sm);
  }
}

.filter-modal__chevron {
  width: 16px;
  height: 16px;
  color: var(--gitpulse-text-muted);
  transition: transform 0.2s ease;
  flex-shrink: 0;

  &--open {
    transform: rotate(180deg);
  }
}

.filter-modal__advanced-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-top: 0.75rem;
}

.filter-modal__field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.filter-modal__field-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--gitpulse-text-muted);
}

.filter-modal__input {
  width: 100%;
  height: 40px;
  padding: 0 0.75rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: var(--gitpulse-radius-md);
  background: var(--gitpulse-input-bg);
  color: var(--gitpulse-text-strong);
  font-size: 0.875rem;
  transition:
    border-color 0.12s ease,
    box-shadow 0.12s ease;

  &:focus {
    outline: none;
    border-color: var(--gitpulse-accent);
    box-shadow: 0 0 0 2px var(--gitpulse-accent-soft);
  }

  &::placeholder {
    color: var(--gitpulse-text-subtle);
  }
}

.filter-modal__footer {
  padding: 1rem;
  border-top: 1px solid var(--gitpulse-border);
  background: var(--gitpulse-surface);
  position: sticky;
  bottom: 0;
}

.filter-modal__clear {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: var(--gitpulse-radius-md);
  background: var(--gitpulse-surface);
  color: var(--gitpulse-text-muted);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.12s ease,
    color 0.12s ease;
  min-height: 44px;

  &:hover {
    background: var(--gitpulse-surface-hover);
    color: var(--gitpulse-text-strong);
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring);
    outline-offset: 2px;
  }
}

// Slide-up transition
.filter-modal-enter-active,
.filter-modal-leave-active {
  transition: transform 0.22s cubic-bezier(0.32, 0.72, 0, 1);
}

.filter-modal-enter-from,
.filter-modal-leave-to {
  transform: translateY(100%);
}

// Mobile only
@media (min-width: 861px) {
  .filter-modal {
    display: none;
  }
}
</style>
