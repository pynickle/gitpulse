<script setup lang="ts">
import { CheckIcon, CircleIcon } from '@lucide/vue';

import LoadingIcon from '~/components/ui/LoadingIcon.vue';

const { resolved = false, loading = false } = defineProps<{
  resolved?: boolean;
  loading?: boolean;
}>();

const emit = defineEmits<{ (e: 'toggle'): void }>();

const { t } = useI18n();

const handleClick = () => {
  if (loading) {
    return;
  }

  emit('toggle');
};
</script>

<template>
  <button
    type="button"
    class="pr-review-thread-toggle"
    :class="{ 'is-resolved': resolved }"
    :aria-pressed="resolved"
    :aria-disabled="loading || undefined"
    :aria-busy="loading || undefined"
    :title="resolved ? t('prReview.unresolveThread') : t('prReview.resolveThread')"
    @click="handleClick"
  >
    <span class="pr-review-thread-toggle__marks" aria-hidden="true">
      <LoadingIcon
        class="pr-review-thread-toggle__spinner"
        :class="{ 'is-active': loading }"
        :size="13"
        :stroke-width="2.5"
      />
      <CheckIcon
        class="pr-review-thread-toggle__mark"
        :class="{ 'is-active': !loading && resolved }"
        :size="13"
        :stroke-width="2.5"
      />
      <CircleIcon
        class="pr-review-thread-toggle__mark"
        :class="{ 'is-active': !loading && !resolved }"
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
    background-color 0.22s ease,
    border-color 0.22s ease,
    color 0.22s ease;

  &.is-resolved {
    border-color: color-mix(in srgb, var(--gitpulse-success) 28%, transparent);
    background: var(--gitpulse-success-soft);
    color: var(--gitpulse-success);
  }

  @include hover-only {
    &:hover:not([aria-disabled='true']) {
      border-color: var(--gitpulse-border-strong);
      background: var(--gitpulse-surface-hover);
      color: var(--gitpulse-text-strong);
    }

    &.is-resolved:hover:not([aria-disabled='true']) {
      border-color: color-mix(in srgb, var(--gitpulse-success) 40%, transparent);
      background: color-mix(in srgb, var(--gitpulse-success) 18%, transparent);
    }
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring);
    outline-offset: 2px;
  }

  &[aria-disabled='true'] {
    cursor: progress;
  }
}

.pr-review-thread-toggle__marks,
.pr-review-thread-toggle__label {
  display: grid;
}

.pr-review-thread-toggle__mark,
.pr-review-thread-toggle__spinner,
.pr-review-thread-toggle__text {
  grid-area: 1 / 1;
  opacity: 0;
  visibility: hidden;
  transition:
    opacity 0.2s ease,
    visibility 0s linear 0.2s;

  &.is-active {
    opacity: 1;
    visibility: visible;
    transform: none;
    transition-delay: 0s;
  }
}

.pr-review-thread-toggle__mark,
.pr-review-thread-toggle__text {
  transition:
    opacity 0.2s ease,
    transform 0.3s cubic-bezier(0.34, 1.46, 0.64, 1),
    visibility 0s linear 0.2s;
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
