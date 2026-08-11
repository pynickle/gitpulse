<script setup lang="ts">
import { AlertTriangleIcon, RefreshCwIcon } from '@lucide/vue';

defineProps<{
  refreshing: boolean;
}>();

const emit = defineEmits<{
  retry: [];
}>();

const { t } = useI18n();
</script>

<template>
  <div class="notification-enrichment-notice" role="status" aria-live="polite" aria-atomic="true">
    <AlertTriangleIcon :size="16" aria-hidden="true" />
    <span class="notification-enrichment-notice__message">
      {{ t('dashboard.notificationSubjectEnrichment.failure') }}
    </span>
    <button
      class="notification-enrichment-notice__retry"
      type="button"
      :disabled="refreshing"
      :title="t('dashboard.notificationSubjectEnrichment.retry')"
      :aria-label="t('dashboard.notificationSubjectEnrichment.retry')"
      @click="emit('retry')"
    >
      <RefreshCwIcon :size="15" :class="{ 'is-spinning': refreshing }" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped lang="scss">
.notification-enrichment-notice {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.5rem;
  margin: 0 1rem 0.75rem 0;
  padding: 0.55rem 0.65rem;
  border: 1px solid color-mix(in srgb, var(--gitpulse-warning) 42%, var(--gitpulse-border));
  border-radius: 6px;
  background-color: color-mix(in srgb, var(--gitpulse-warning) 8%, var(--gitpulse-surface));
  color: var(--gitpulse-text-strong);
  font-size: 0.78rem;
}

.notification-enrichment-notice > svg {
  flex: 0 0 auto;
  color: var(--gitpulse-warning);
}

.notification-enrichment-notice__message {
  min-width: 0;
  flex: 1 1 auto;
}

.notification-enrichment-notice__retry {
  display: inline-flex;
  width: 1.75rem;
  height: 1.75rem;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  padding: 0;
  border: 1px solid var(--gitpulse-border);
  border-radius: 6px;
  background: var(--gitpulse-surface);
  color: var(--gitpulse-text-muted);
  cursor: pointer;
}

.notification-enrichment-notice__retry:hover,
.notification-enrichment-notice__retry:focus-visible {
  border-color: var(--gitpulse-warning);
  color: var(--gitpulse-text-strong);
}

.notification-enrichment-notice__retry:focus-visible {
  outline: 2px solid var(--gitpulse-focus-ring);
  outline-offset: 2px;
}

.notification-enrichment-notice__retry:disabled {
  cursor: progress;
  opacity: 0.65;
}

.is-spinning {
  animation: notification-enrichment-spin 0.9s linear infinite;
}

@keyframes notification-enrichment-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
