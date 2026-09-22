<script setup lang="ts">
import { FilesIcon, MessageSquareIcon } from '@lucide/vue';

import type { ReviewBottomBarSheet } from '#shared/utils/pr-review-workspace-presentation';

defineProps<{
  fileCount: number;
  pendingCommentCount: number;
  openSheet: ReviewBottomBarSheet | null;
}>();

const emit = defineEmits<{
  (e: 'toggle-files'): void;
  (e: 'toggle-review'): void;
}>();

const { t } = useI18n();
</script>

<template>
  <nav class="pr-review-bottom-bar" :aria-label="t('prReview.bottomBar')">
    <button
      type="button"
      :class="[
        'pr-review-bottom-bar__entry',
        { 'pr-review-bottom-bar__entry--active': openSheet === 'files' },
      ]"
      :aria-pressed="openSheet === 'files'"
      @click="emit('toggle-files')"
    >
      <FilesIcon :size="16" aria-hidden="true" />
      <span class="pr-review-bottom-bar__label">{{ t('prReview.filesShort') }}</span>
      <strong class="pr-review-bottom-bar__count">{{ fileCount }}</strong>
    </button>
    <button
      type="button"
      :class="[
        'pr-review-bottom-bar__entry',
        { 'pr-review-bottom-bar__entry--active': openSheet === 'review' },
      ]"
      :aria-pressed="openSheet === 'review'"
      @click="emit('toggle-review')"
    >
      <MessageSquareIcon :size="16" aria-hidden="true" />
      <span class="pr-review-bottom-bar__label">{{ t('prReview.reviewPanel') }}</span>
      <strong class="pr-review-bottom-bar__count">{{ pendingCommentCount }}</strong>
    </button>
  </nav>
</template>

<style scoped lang="scss">
.pr-review-bottom-bar {
  position: relative;
  z-index: 40;
  box-sizing: border-box;
  flex: none;
  display: none;
  align-items: stretch;
  min-height: var(--pr-review-bottom-bar-block);
  padding-bottom: env(safe-area-inset-bottom, 0px);
  border-top: 1px solid var(--gitpulse-border);
  background: var(--gitpulse-surface);
}

.pr-review-bottom-bar__entry {
  flex: 1;
  min-width: 0;
  min-height: 0;
  border: 0;
  background: transparent;
  color: var(--gitpulse-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0 0.75rem;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--gitpulse-info);
    outline-offset: -2px;
  }
}

.pr-review-bottom-bar__entry--active {
  background: var(--gitpulse-info-soft);
  color: var(--gitpulse-info);
}

.pr-review-bottom-bar__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pr-review-bottom-bar__count {
  min-width: 1.25rem;
  height: 1.25rem;
  padding: 0 0.3rem;
  border-radius: 999px;
  background: var(--gitpulse-surface-muted);
  color: inherit;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.68rem;
}

.pr-review-bottom-bar__entry--active .pr-review-bottom-bar__count {
  background: var(--gitpulse-surface);
}
</style>
