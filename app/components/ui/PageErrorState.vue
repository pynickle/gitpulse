<script setup lang="ts">
import { ChevronDownIcon, RefreshCwIcon, TriangleExclamationPointIcon } from '@lucide/vue';
import { computed, shallowRef } from 'vue';
import { useI18n } from 'vue-i18n';

const {
  title,
  description = '',
  details = '',
  retryLabel,
  variant = 'page',
} = defineProps<{
  title: string;
  description?: string;
  details?: string;
  retryLabel: string;
  variant?: 'page' | 'inline';
}>();

const emit = defineEmits<{ (e: 'retry'): void }>();

const { t } = useI18n();
const isDetailsOpen = shallowRef(false);
const iconSize = computed(() => (variant === 'inline' ? 16 : 26));
</script>

<template>
  <div class="page-error-state" :class="`page-error-state--${variant}`">
    <div class="page-error-state__card">
      <span class="page-error-state__icon" aria-hidden="true">
        <TriangleExclamationPointIcon :size="iconSize" />
      </span>

      <div class="page-error-state__body">
        <!-- The alert covers the message only; the controls stay outside it so a
             screen reader announces the failure without trapping the buttons. -->
        <div class="page-error-state__message" role="alert">
          <p class="page-error-state__title">{{ title }}</p>
          <p v-if="description" class="page-error-state__description">{{ description }}</p>
        </div>

        <div class="page-error-state__actions">
          <button
            type="button"
            class="button is-small is-primary page-error-state__retry"
            @click="emit('retry')"
          >
            <RefreshCwIcon :size="14" aria-hidden="true" />
            <span>{{ retryLabel }}</span>
          </button>

          <button
            v-if="details"
            type="button"
            class="page-error-state__toggle"
            :aria-expanded="isDetailsOpen"
            @click="isDetailsOpen = !isDetailsOpen"
          >
            <span>{{
              isDetailsOpen ? t('pageError.hideDetails') : t('pageError.showDetails')
            }}</span>
            <ChevronDownIcon
              :size="14"
              class="page-error-state__chevron"
              :class="{ 'is-open': isDetailsOpen }"
              aria-hidden="true"
            />
          </button>
        </div>

        <pre v-if="details && isDetailsOpen" class="page-error-state__details">{{ details }}</pre>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '~/assets/scss/pointer' as *;

.page-error-state {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: clamp(1.25rem, 5vh, 3rem) clamp(1rem, 4vw, 2.5rem);
}

.page-error-state__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 26rem;
  padding: clamp(1.5rem, 4vw, 2rem);
  border: 1px solid color-mix(in srgb, var(--gitpulse-danger) 20%, var(--gitpulse-border));
  border-radius: var(--gitpulse-radius-xl);
  /* A wash of the failure tone at the top of the card, so the block reads as an
     interruption rather than as another panel of content. */
  background:
    radial-gradient(140% 110% at 50% -10%, var(--gitpulse-danger-soft), transparent 58%),
    var(--gitpulse-surface);
  box-shadow: var(--gitpulse-shadow-card);
  text-align: center;
}

.page-error-state__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 3.25rem;
  height: 3.25rem;
  margin-bottom: 1rem;
  border-radius: 50%;
  color: var(--gitpulse-danger);
  background: color-mix(in srgb, var(--gitpulse-danger) 12%, var(--gitpulse-surface));
  box-shadow: 0 0 0 6px color-mix(in srgb, var(--gitpulse-danger) 6%, transparent);
}

.page-error-state__body {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  min-width: 0;
}

.page-error-state__message {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  min-width: 0;
}

.page-error-state__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.4;
  color: var(--gitpulse-text-strong);
}

.page-error-state__description {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.55;
  color: var(--gitpulse-text-muted);
  overflow-wrap: anywhere;
}

.page-error-state__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.5rem 0.75rem;
  margin-top: 1.25rem;
}

/* The retry control keeps its own icon so the one action on the block is not
   mistaken for a link out of the page. */
.page-error-state__retry {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.page-error-state__toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem;
  border: 0;
  border-radius: var(--gitpulse-radius-sm);
  background: transparent;
  color: var(--gitpulse-text-muted);
  font: inherit;
  font-size: 0.8rem;
  cursor: pointer;

  @include hover-only {
    &:hover {
      color: var(--gitpulse-text-strong);
    }
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring);
    outline-offset: 2px;
  }
}

.page-error-state__chevron {
  transition: transform 0.16s ease;

  &.is-open {
    transform: rotate(180deg);
  }
}

.page-error-state__details {
  width: 100%;
  max-height: 10rem;
  margin: 0.875rem 0 0;
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: var(--gitpulse-radius-md);
  background: var(--gitpulse-surface-muted);
  color: var(--gitpulse-text-muted);
  font-family: var(--gitpulse-code-font-family);
  font-size: 0.75rem;
  line-height: 1.5;
  text-align: left;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  overflow: auto;
}

/* In-pane failure: a compact banner that belongs to the surrounding content
   instead of replacing it. */
.page-error-state--inline {
  justify-content: flex-start;
  padding: 0;
}

.page-error-state--inline .page-error-state__card {
  flex-direction: row;
  align-items: flex-start;
  gap: 0.75rem;
  max-width: none;
  padding: 0.875rem 1rem;
  border-radius: var(--gitpulse-radius-lg);
  background: var(--gitpulse-danger-soft);
  box-shadow: none;
  text-align: left;
}

.page-error-state--inline .page-error-state__icon {
  width: 1.75rem;
  height: 1.75rem;
  margin-bottom: 0;
  background: transparent;
  box-shadow: none;
}

.page-error-state--inline .page-error-state__body {
  align-items: flex-start;
  flex: 1;
}

.page-error-state--inline .page-error-state__title {
  font-size: 0.9rem;
}

.page-error-state--inline .page-error-state__description {
  font-size: 0.8rem;
}

.page-error-state--inline .page-error-state__actions {
  justify-content: flex-start;
  margin-top: 0.625rem;
}

.page-error-state--inline .page-error-state__details {
  margin-top: 0.75rem;
}

@media (max-width: 640px) {
  .page-error-state__card {
    padding: 1.25rem 1rem;
  }

  .page-error-state__actions {
    flex-direction: column;
    width: 100%;
  }

  .page-error-state__retry {
    justify-content: center;
    width: 100%;
  }

  .page-error-state--inline .page-error-state__actions {
    flex-direction: row;
    width: auto;
  }

  .page-error-state--inline .page-error-state__retry {
    width: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .page-error-state__chevron {
    transition: none;
  }
}
</style>
