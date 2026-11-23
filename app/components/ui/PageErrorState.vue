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

      <button
        type="button"
        class="button is-primary page-error-state__retry"
        @click="emit('retry')"
      >
        <RefreshCwIcon :size="14" aria-hidden="true" />
        <span>{{ t('pageError.retry') }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
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

/* The technical message under a human sentence, when a page has both. */
.page-error-state__details {
  margin: 0;
  color: var(--gitpulse-text-subtle);
  font-family: var(--gitpulse-code-font-family);
  font-size: 0.75rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

/* The app's 2.75rem touch target, so the one control here is comfortably hit. */
.page-error-state__retry {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  min-height: 2.75rem;
  margin-top: 1.25rem;
  padding-inline: 1rem;
}

@media (max-width: 860px) {
  .page-error-state__retry {
    width: 100%;
  }
}
</style>
