<script setup lang="ts">
import { RefreshCwIcon, TriangleExclamationPointIcon } from '@lucide/vue';
import { useI18n } from 'vue-i18n';

// Only the props that need a default are bound; `title` is read from the
// template alone. Retry means the same thing on every failure, so the label is
// the component's own copy rather than a prop each page has to resolve.
const { description = '', details = '' } = defineProps<{
  title: string;
  description?: string;
  details?: string;
}>();

const emit = defineEmits<{ (e: 'retry'): void }>();

const { t } = useI18n();
</script>

<template>
  <div class="page-error-state">
    <div class="page-error-state__card">
      <span class="page-error-state__icon" aria-hidden="true">
        <TriangleExclamationPointIcon :size="26" />
      </span>

      <!-- The alert covers the message only; the retry control stays outside it
           so a screen reader announces the failure without the button. -->
      <div class="page-error-state__message" role="alert">
        <p class="page-error-state__title">{{ title }}</p>
        <p v-if="description" class="page-error-state__description">{{ description }}</p>
        <p v-if="details" class="page-error-state__details">{{ details }}</p>
      </div>

      <button type="button" class="button page-error-state__retry" @click="emit('retry')">
        <RefreshCwIcon :size="14" aria-hidden="true" />
        <span>{{ t('pageError.retry') }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '~/assets/scss/pointer' as *;

/* Fills whatever box it is dropped into so the card sits in the middle of the
   empty page rather than hanging under the top padding. */
.page-error-state {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 14rem;
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

.page-error-state__message {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
}

/* The headline carries the message; everything under it is deliberately quieter
   so the eye lands on what failed and only then on the technical cause. */
.page-error-state__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  line-height: 1.35;
  letter-spacing: -0.01em;
  color: var(--gitpulse-text-strong);
}

.page-error-state__description {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--gitpulse-text-muted);
  overflow-wrap: anywhere;
}

/* The technical message under a human sentence, when a page has both. */
.page-error-state__details {
  margin: 0;
  color: var(--gitpulse-text-subtle);
  font-family: var(--gitpulse-code-font-family);
  font-size: 0.6875rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

/* A small bordered control. It stays visibly a button without the weight of a
   filled call-to-action, which shouted over the message it sits under. */
.page-error-state__card .page-error-state__retry {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  min-height: 2.25rem;
  margin-top: 1rem;
  padding: 0 0.875rem;
  border: 1px solid var(--gitpulse-border-strong);
  border-radius: var(--gitpulse-radius-md);
  background: var(--gitpulse-surface);
  color: var(--gitpulse-text-strong);
  font-size: 0.8125rem;
  font-weight: 500;

  @include hover-only {
    &:hover {
      border-color: color-mix(in srgb, var(--gitpulse-accent) 42%, var(--gitpulse-border));
      background: var(--gitpulse-surface-hover);
      color: var(--gitpulse-accent);
    }
  }

  &:focus-visible {
    border-color: var(--gitpulse-accent);
    outline: 2px solid color-mix(in srgb, var(--gitpulse-accent) 72%, transparent);
    outline-offset: 1px;
  }
}
</style>
