<script setup lang="ts">
import { XIcon } from '@lucide/vue';
import { computed, nextTick, onUnmounted, shallowRef, useId, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import FilterDateRange from '~/components/ui/FilterDateRange.vue';
import FilterMultiSelect from '~/components/ui/FilterMultiSelect.vue';
import type { FilterMultiSelectOption } from '~/components/ui/FilterMultiSelect.vue';
import { EMPTY_DATE_RANGE, type DateRange } from '~/utils/filterDateRange';
import {
  hasActiveTimelineFilter,
  toFollowedRepositoryKey,
} from '~/utils/filterReleaseTimelineGroups';

const props = defineProps<{
  open: boolean;
  repositories: string[];
  dateRange: DateRange;
}>();

const emit = defineEmits<{
  'update:repositories': [value: string[]];
  'update:date-range': [value: DateRange];
  close: [];
}>();

const { t } = useI18n();
const { openModal, closeModal } = useModalState();
const { followedRepositories } = useReleaseFollows();
const titleId = useId();
const panel = shallowRef<HTMLElement | null>(null);
const focusTrap = createFocusTrapController();
const repositoryOptions = computed<FilterMultiSelectOption[]>(() =>
  followedRepositories.value
    .map((repo) => {
      const fullName = toFollowedRepositoryKey(repo);
      return { value: fullName, label: fullName };
    })
    .sort((a, b) => a.value.localeCompare(b.value))
);

const hasActiveFilter = computed(() =>
  hasActiveTimelineFilter({ repositories: props.repositories, dateRange: props.dateRange })
);
const repositoryEmptyMessage = computed(() =>
  repositoryOptions.value.length === 0
    ? t('releaseTimeline.filterPanelRepositoriesEmpty')
    : t('releaseTimeline.filterPanelRepositoriesNoMatch')
);

watch(
  () => props.open,
  async (open) => {
    if (!import.meta.client) return;

    if (!open) {
      closeModal();
      await nextTick();
      focusTrap.restorePreviousFocus();
      return;
    }

    openModal();
    focusTrap.capturePreviousFocus();
    await nextTick();
    if (panel.value) focusTrap.focusInitialElement(panel.value);
  }
);

onUnmounted(() => {
  if (props.open) closeModal();
});

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    emit('close');
    return;
  }
  if (panel.value) focusTrap.trapTabKey(event, panel.value);
};

const clearAll = () => {
  emit('update:repositories', []);
  emit('update:date-range', EMPTY_DATE_RANGE);
};
</script>

<template>
  <Teleport to="body">
    <Transition name="release-timeline-filter-panel">
      <div
        v-if="open"
        class="release-timeline-filter-panel"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        @keydown="handleKeydown"
      >
        <button
          class="release-timeline-filter-panel__scrim"
          type="button"
          tabindex="-1"
          :aria-label="t('releaseTimeline.closeFilterPanel')"
          @click="emit('close')"
        />

        <aside ref="panel" class="release-timeline-filter-panel__panel" tabindex="-1">
          <header class="release-timeline-filter-panel__header">
            <h2 :id="titleId">{{ t('releaseTimeline.filterPanelTitle') }}</h2>
            <button
              class="release-timeline-filter-panel__close"
              type="button"
              :aria-label="t('releaseTimeline.closeFilterPanel')"
              :title="t('releaseTimeline.closeFilterPanel')"
              @click="emit('close')"
            >
              <XIcon :size="18" aria-hidden="true" />
            </button>
          </header>

          <div class="release-timeline-filter-panel__body">
            <section class="release-timeline-filter-panel__section">
              <h3 class="release-timeline-filter-panel__section-title">
                {{ t('releaseTimeline.filterPanelRepositories') }}
              </h3>
              <FilterMultiSelect
                :model-value="repositories"
                :suggestions="repositoryOptions"
                :placeholder="t('releaseTimeline.filterPanelRepositoriesPlaceholder')"
                :empty-message="repositoryEmptyMessage"
                :aria-label="t('releaseTimeline.filterPanelRepositories')"
                :remove-label="t('releaseTimeline.filterPanelRemoveRepo')"
                @update:modelValue="emit('update:repositories', $event)"
              />
            </section>

            <section class="release-timeline-filter-panel__section">
              <h3 class="release-timeline-filter-panel__section-title">
                {{ t('releaseTimeline.filterPanelDateRange') }}
              </h3>
              <FilterDateRange
                :model-value="dateRange"
                @update:modelValue="emit('update:date-range', $event)"
              />
            </section>
          </div>

          <footer class="release-timeline-filter-panel__footer">
            <button
              class="button is-small"
              type="button"
              :disabled="!hasActiveFilter"
              @click="clearAll"
            >
              {{ t('releaseTimeline.filterPanelClearAll') }}
            </button>
          </footer>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.release-timeline-filter-panel {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  justify-content: flex-end;
  overscroll-behavior: none;
}

.release-timeline-filter-panel__scrim {
  position: absolute;
  inset: 0;
  border: 0;
  background: var(--gitpulse-overlay-bg);
  cursor: pointer;
}

.release-timeline-filter-panel__panel {
  position: relative;
  z-index: 1;
  display: flex;
  width: min(26rem, 90vw);
  height: 100%;
  flex-direction: column;
  background: var(--gitpulse-surface);
  box-shadow: -1rem 0 2rem rgb(0 0 0 / 0.18);
}

.release-timeline-filter-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-shrink: 0;
  padding: 1rem 1.15rem;
  border-bottom: 1px solid var(--gitpulse-border);
}

.release-timeline-filter-panel__header h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--bulma-text-strong);
}

.release-timeline-filter-panel__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--gitpulse-text-muted);
  cursor: pointer;
}

.release-timeline-filter-panel__close:hover,
.release-timeline-filter-panel__close:focus-visible {
  background: var(--gitpulse-surface-hover, var(--gitpulse-info-soft));
  color: var(--gitpulse-text-strong);
}

.release-timeline-filter-panel__close:focus-visible {
  outline: 2px solid var(--gitpulse-info);
  outline-offset: 2px;
}

.release-timeline-filter-panel__body {
  display: grid;
  min-height: 0;
  flex: 1;
  align-content: start;
  gap: 1.35rem;
  overflow-y: auto;
  padding: 1.15rem;
  overscroll-behavior: contain;
}

.release-timeline-filter-panel__section {
  display: grid;
  gap: 0.55rem;
  min-width: 0;
}

.release-timeline-filter-panel__section-title {
  margin: 0;
  color: var(--gitpulse-text-muted);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.release-timeline-filter-panel__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  flex-shrink: 0;
  padding: 0.85rem 1.15rem;
  border-top: 1px solid var(--gitpulse-border);
}

.release-timeline-filter-panel-enter-active {
  transition: opacity 0.2s ease;

  .release-timeline-filter-panel__panel {
    transition: transform 0.2s ease;
  }
}

.release-timeline-filter-panel-leave-active {
  transition: opacity 0.15s ease;

  .release-timeline-filter-panel__panel {
    transition: transform 0.15s ease;
  }
}

.release-timeline-filter-panel-enter-from,
.release-timeline-filter-panel-leave-to {
  opacity: 0;

  .release-timeline-filter-panel__panel {
    transform: translateX(100%);
  }
}

.release-timeline-filter-panel-enter-active .release-timeline-filter-panel__scrim,
.release-timeline-filter-panel-leave-active .release-timeline-filter-panel__scrim {
  cursor: default;
}
</style>
