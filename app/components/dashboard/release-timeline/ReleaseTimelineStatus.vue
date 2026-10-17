<script setup lang="ts">
import { AlertCircleIcon, ArrowDownIcon, Loader2Icon } from '@lucide/vue';
import { computed } from 'vue';

const props = defineProps<{
  partial: boolean;
  hasMore: boolean;
  canRetry: boolean;
  loading: boolean;
  persistenceError: string | null;
  error: string | null;
}>();
const emit = defineEmits<{ older: []; retry: []; save: [] }>();
const { t } = useI18n();
const visible = computed(
  () =>
    props.hasMore ||
    props.partial ||
    props.canRetry ||
    Boolean(props.error || props.persistenceError)
);
</script>
<template>
  <div v-if="visible" class="timeline-status" aria-live="polite">
    <p v-if="partial" class="timeline-status__meta">{{ t('releaseTimeline.partialWindow') }}</p>
    <p v-if="error" class="timeline-status__alert timeline-status__alert--danger" role="alert">
      <AlertCircleIcon class="timeline-status__alert-icon" :size="14" aria-hidden="true" />
      <span>{{ t('releaseTimeline.error') }}</span>
    </p>
    <p v-if="persistenceError" class="timeline-status__alert" role="alert">
      <AlertCircleIcon class="timeline-status__alert-icon" :size="14" aria-hidden="true" />
      <span class="timeline-status__alert-text">{{ t('releaseTimeline.persistenceError') }}</span>
      <button class="timeline-status__retry" type="button" @click="emit('save')">
        {{ t('releaseTimeline.retry') }}
      </button>
    </p>
    <button
      v-if="canRetry"
      class="button is-small"
      type="button"
      :disabled="loading"
      @click="emit('retry')"
    >
      {{ t('releaseTimeline.retry') }}
    </button>
    <button
      v-if="hasMore"
      class="button is-small timeline-status__older"
      type="button"
      :disabled="loading"
      @click="emit('older')"
    >
      <Loader2Icon v-if="loading" :size="14" class="spin-animation" aria-hidden="true" />
      <ArrowDownIcon v-else :size="14" aria-hidden="true" />
      <span>{{ t('releaseTimeline.loadOlder') }}</span>
    </button>
  </div>
</template>
<style scoped>
.timeline-status {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
  padding: 0.5rem 0 0.25rem;
  font-size: 0.8rem;
  color: var(--gitpulse-text-muted);
}

.timeline-status__meta {
  margin: 0;
  line-height: 1.4;
}

.timeline-status__older {
  gap: 0.4rem;
  min-width: 12rem;
  border-style: dashed;
}

.timeline-status__alert {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  max-width: 100%;
  margin: 0;
  padding: 0.15rem 0.2rem 0.15rem 0.5rem;
  border-radius: 999px;
  background: var(--gitpulse-warning-soft);
  color: var(--gitpulse-text);
  line-height: 1.35;
}

.timeline-status__alert--danger {
  padding-right: 0.55rem;
  background: var(--gitpulse-danger-soft);
}

.timeline-status__alert-icon {
  flex: none;
  color: var(--gitpulse-warning);
}

.timeline-status__alert--danger .timeline-status__alert-icon {
  color: var(--gitpulse-danger);
}

.timeline-status__alert-text {
  min-width: 0;
}

.timeline-status__retry {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  height: 1.5rem;
  margin: 0;
  padding: 0 0.6rem;
  border: 0;
  border-radius: 999px;
  background: var(--gitpulse-warning-solid);
  color: #fff;
  font: inherit;
  font-size: 0.75rem;
  line-height: 1;
  cursor: pointer;
}

.timeline-status__retry:hover {
  background: var(--gitpulse-warning-solid-hover);
}

.spin-animation {
  flex: none;
  transform-origin: center;
  animation: timeline-status-spin 1s linear infinite;
  color: var(--gitpulse-accent);
}

@keyframes timeline-status-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
