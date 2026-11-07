<script setup lang="ts">
import { CheckIcon, CircleIcon } from '@lucide/vue';

const { resolved = false, loading = false } = defineProps<{
  resolved?: boolean;
  loading?: boolean;
}>();

const emit = defineEmits<{ (e: 'toggle'): void }>();

const { t } = useI18n();
</script>

<template>
  <button
    type="button"
    class="pr-review-thread-toggle"
    :class="{ 'is-resolved': resolved }"
    :disabled="loading"
    :aria-pressed="resolved"
    :title="resolved ? t('prReview.unresolveThread') : t('prReview.resolveThread')"
    @click="emit('toggle')"
  >
    <span class="pr-review-thread-toggle__marks" aria-hidden="true">
      <CheckIcon
        class="pr-review-thread-toggle__mark"
        :class="{ 'is-active': resolved }"
        :size="13"
        :stroke-width="2.5"
      />
      <CircleIcon
        class="pr-review-thread-toggle__mark"
        :class="{ 'is-active': !resolved }"
        :size="13"
        :stroke-width="2.5"
      />
    </span>
    <span class="pr-review-thread-toggle__label">
      <span
        class="pr-review-thread-toggle__text"
        :class="{ 'is-active': resolved }"
        :aria-hidden="!resolved || undefined"
      >
        {{ t('prReview.threadResolved') }}
      </span>
      <span
        class="pr-review-thread-toggle__text"
        :class="{ 'is-active': !resolved }"
        :aria-hidden="resolved || undefined"
      >
        {{ t('prReview.threadUnresolved') }}
      </span>
    </span>
  </button>
</template>

<style scoped lang="scss">
@use '~/assets/scss/pointer' as *;

.pr-review-thread-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  min-height: 1.6rem;
  padding: 0 0.55rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 999px;
  background: var(--gitpulse-surface-muted);
  color: var(--gitpulse-text-muted);
  font-size: 0.7rem;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease,
    color 0.18s ease;

  &.is-resolved {
    border-color: color-mix(in srgb, var(--gitpulse-success) 28%, transparent);
    background: var(--gitpulse-success-soft);
    color: var(--gitpulse-success);
  }

  @include hover-only {
    &:hover:not(:disabled) {
      border-color: var(--gitpulse-border-strong);
      background: var(--gitpulse-surface-hover);
      color: var(--gitpulse-text-strong);
    }

    &.is-resolved:hover:not(:disabled) {
      border-color: color-mix(in srgb, var(--gitpulse-success) 40%, transparent);
      background: color-mix(in srgb, var(--gitpulse-success) 18%, transparent);
    }
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring);
    outline-offset: 2px;
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
}

.pr-review-thread-toggle__marks,
.pr-review-thread-toggle__label {
  display: grid;
}

.pr-review-thread-toggle__mark,
.pr-review-thread-toggle__text {
  grid-area: 1 / 1;
  opacity: 0;
  visibility: hidden;
  transition:
    opacity 0.16s ease,
    transform 0.24s cubic-bezier(0.34, 1.46, 0.64, 1),
    visibility 0s linear 0.16s;

  &.is-active {
    opacity: 1;
    visibility: visible;
    transform: none;
    transition-delay: 0s;
  }
}

.pr-review-thread-toggle__mark {
  transform: scale(0.4) rotate(-90deg);
}

.pr-review-thread-toggle__text {
  transform: translateY(0.35em);
}

@media (prefers-reduced-motion: reduce) {
  .pr-review-thread-toggle,
  .pr-review-thread-toggle__mark,
  .pr-review-thread-toggle__text {
    transition: none;
  }
}
</style>
