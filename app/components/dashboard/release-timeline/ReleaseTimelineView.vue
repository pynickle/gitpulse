<script setup lang="ts">
import { RocketIcon, SlidersHorizontalIcon } from '@lucide/vue';
import { computed } from 'vue';

const emit = defineEmits<{
  manage: [];
}>();

const { t } = useI18n();
const { loaded, followedRepositories } = useReleaseFollows();

const showEmptyState = computed(() => loaded.value && followedRepositories.value.length === 0);
</script>

<template>
  <div class="release-timeline">
    <div class="release-timeline__header">
      <h2 class="release-timeline__title">{{ t('releaseTimeline.title') }}</h2>
      <div class="release-timeline__actions">
        <button
          class="button is-ghost is-small release-timeline__manage"
          type="button"
          :aria-label="t('releaseTimeline.manage')"
          :title="t('releaseTimeline.manage')"
          @click="emit('manage')"
        >
          <SlidersHorizontalIcon v-once :size="18" aria-hidden="true" />
        </button>
      </div>
    </div>

    <div class="release-timeline__body">
      <div v-if="showEmptyState" class="release-timeline__empty">
        <div class="release-timeline__empty-icon" aria-hidden="true">
          <RocketIcon :size="32" />
        </div>
        <p class="release-timeline__empty-title">{{ t('releaseTimeline.emptyTitle') }}</p>
        <p class="release-timeline__empty-description">
          {{ t('releaseTimeline.emptyDescription') }}
        </p>
        <button class="button is-primary is-small" type="button" @click="emit('manage')">
          {{ t('releaseTimeline.emptyAction') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.release-timeline {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  flex: 1;
  background: var(--gitpulse-surface, var(--gitpulse-page-bg));
  border: 1px solid var(--gitpulse-border);
  border-radius: var(--gitpulse-radius-md, 12px);
}

.release-timeline__header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1.25rem 1.5rem 0.5rem;
  border-bottom: 1px solid var(--gitpulse-border);
  min-width: 0;
}

.release-timeline__title {
  margin-bottom: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--bulma-text-strong);
  letter-spacing: -0.01em;
  flex-shrink: 0;
}

.release-timeline__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
}

.release-timeline__manage {
  flex-shrink: 0;
  color: var(--gitpulse-text-muted);
}

.release-timeline__manage:hover,
.release-timeline__manage:focus-visible {
  color: var(--gitpulse-link);
  background: var(--gitpulse-info-soft);
}

.release-timeline__body {
  display: flex;
  min-height: 0;
  flex: 1;
}

.release-timeline__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 12rem;
  padding: clamp(1.5rem, 6vh, 4rem) clamp(1rem, 5vw, 3rem);
  text-align: center;
}

.release-timeline__empty-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 4rem;
  height: 4rem;
  margin-bottom: 1rem;
  border-radius: 50%;
  background-color: var(--gitpulse-info-soft, var(--gitpulse-surface-muted));
  color: var(--gitpulse-accent, var(--gitpulse-link));
}

.release-timeline__empty-title {
  margin: 0 0 0.5rem;
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--gitpulse-text-strong);
}

.release-timeline__empty-description {
  margin: 0 0 1.25rem;
  max-width: 26rem;
  color: var(--gitpulse-text-muted);
  font-size: 0.875rem;
  line-height: 1.55;
}
</style>
