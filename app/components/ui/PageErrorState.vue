<script setup lang="ts">
import { RefreshCwIcon, TriangleExclamationPointIcon } from '@lucide/vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const { title = '', description = '' } = defineProps<{
  title?: string;
  description?: string;
}>();

const emit = defineEmits<{ retry: [] }>();

const { t } = useI18n();

const visibleTitle = computed(() => title.trim());

// Callers often pass a composable's fallback string that repeats the localized
// headline verbatim; suppressing exact matches prevents echoing the same line twice.
const visibleDescription = computed(() => {
  const trimmed = description.trim();
  if (!trimmed || trimmed === visibleTitle.value) return '';
  return trimmed;
});
</script>

<template>
  <div class="page-error-state">
    <div class="page-error-state__content">
      <span class="page-error-state__icon" aria-hidden="true">
        <TriangleExclamationPointIcon :size="20" />
      </span>

      <!-- The alert covers the failure message only; keeping the retry button
           outside it prevents screen readers from announcing the action label
           as part of the error alert. -->
      <div class="page-error-state__message" role="alert">
        <p v-if="visibleTitle" class="page-error-state__title">{{ visibleTitle }}</p>
        <p
          v-if="visibleDescription"
          class="page-error-state__description"
          :class="{ 'page-error-state__description--solo': !visibleTitle }"
        >
          {{ visibleDescription }}
        </p>
      </div>

      <button type="button" class="page-error-state__retry" @click="emit('retry')">
        <RefreshCwIcon :size="14" aria-hidden="true" />
        <span>{{ t('pageError.retry') }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '~/assets/scss/pointer' as *;
@use '~/assets/scss/variables' as *;

.page-error-state {
  container: page-error / inline-size;
  box-sizing: border-box;
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  inline-size: 100%;
  min-block-size: clamp(11rem, 26vh, 16rem);
  padding: clamp(1.25rem, 4vh, 2.5rem) clamp(1rem, 4vw, 2rem);
}

.page-error-state__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  inline-size: min(100%, 24rem);
  min-inline-size: 0;
  text-align: center;
}

.page-error-state__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  inline-size: 2.5rem;
  block-size: 2.5rem;
  margin-block-end: 0.875rem;
  border: 1px solid color-mix(in srgb, var(--gitpulse-danger) 20%, transparent);
  border-radius: var(--gitpulse-radius-xl);
  background: var(--gitpulse-danger-soft);
  color: var(--gitpulse-danger);
}

.page-error-state__message {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  min-inline-size: 0;
  max-inline-size: 100%;
}

.page-error-state__title {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: -0.01em;
  color: var(--gitpulse-text-strong);
  overflow-wrap: break-word;
  text-wrap: balance;
}

.page-error-state__description {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--gitpulse-text-muted);
  overflow-wrap: break-word;
  text-wrap: pretty;
}

.page-error-state__description--solo {
  font-size: 0.9375rem;
  font-weight: 500;
  line-height: 1.45;
  color: var(--gitpulse-text-strong);
  text-wrap: balance;
}

.page-error-state__retry {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  min-block-size: 2.125rem;
  margin-block-start: 1.125rem;
  padding: 0.375rem 0.9rem;
  border: 1px solid color-mix(in srgb, var(--gitpulse-accent) 26%, transparent);
  border-radius: var(--gitpulse-radius-lg);
  background: var(--gitpulse-accent-soft);
  color: var(--gitpulse-accent);
  font-family: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  line-height: 1.2;
  cursor: pointer;
  transition: $theme-transition;

  @include hover-only {
    &:hover {
      border-color: color-mix(in srgb, var(--gitpulse-accent) 42%, transparent);
      background: color-mix(in srgb, var(--gitpulse-accent) 16%, transparent);
      color: var(--gitpulse-accent-hover);
    }
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring);
    outline-offset: 2px;
  }
}

@media (pointer: coarse) {
  .page-error-state__retry {
    min-block-size: 2.75rem;
    padding-inline: 1.125rem;
  }
}

@container page-error (inline-size <= 22rem) {
  .page-error-state__retry {
    inline-size: 100%;
    max-inline-size: 16rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .page-error-state__retry {
    transition: none;
  }
}

@media (forced-colors: active) {
  .page-error-state__icon {
    border: 1px solid CanvasText;
  }

  .page-error-state__retry {
    border: 1px solid ButtonText;

    &:focus-visible {
      outline: 2px solid Highlight;
    }
  }
}
</style>
