<script setup lang="ts">
import { HandIcon, XIcon } from '@lucide/vue';

defineProps<{
  /** The first visit's guide; the reader closes it, nothing else does. */
  visible: boolean;
}>();

const emit = defineEmits<{
  dismiss: [];
}>();

const { t } = useI18n();
</script>

<template>
  <Transition name="notification-todo-guide" appear>
    <div v-if="visible" class="notification-todo-guide" role="note">
      <!-- The bar's box lives on a grid track so opening and closing move the list by a
           single animated row instead of a measured height. -->
      <div class="notification-todo-guide__collapse">
        <div class="notification-todo-guide__card">
          <HandIcon :size="17" class="notification-todo-guide__icon" aria-hidden="true" />
          <p class="notification-todo-guide__message">
            {{ t('dashboard.todos.swipeGuideCard') }}
          </p>
          <button
            type="button"
            class="notification-todo-guide__dismiss"
            :aria-label="t('dashboard.todos.swipeGuideDismiss')"
            @click="emit('dismiss')"
          >
            <XIcon :size="15" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
@use '~/assets/scss/pointer' as *;

.notification-todo-guide {
  display: grid;
  min-width: 0;
  grid-template-rows: 1fr;
  // The narrow list reserves the scrollbar track on its rows, and the guide only ever
  // renders in that list, so it reserves the same strip to keep both right edges equal.
  margin-right: var(--gitpulse-scrollbar-track-size);
}

.notification-todo-guide__collapse {
  min-height: 0;
  overflow: hidden;
}

// Sits exactly on the notification cards' left and right edges: the frame carries the
// list's right strip, and the card adds the same 0.25rem inset the cards below get from
// their own margin.
.notification-todo-guide__card {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0.25rem 0.75rem;
  padding: 0.5rem 0.4rem 0.5rem 0.6rem;
  border: 1px solid color-mix(in srgb, var(--gitpulse-accent) 26%, var(--gitpulse-border));
  border-radius: var(--gitpulse-radius-lg, 8px);
  background-color: var(--gitpulse-accent-soft);
  color: var(--gitpulse-text-strong);
}

.notification-todo-guide__icon {
  flex: 0 0 auto;
  color: var(--gitpulse-accent);
}

.notification-todo-guide__message {
  min-width: 0;
  margin: 0;
  flex: 1 1 auto;
  font-size: 0.8rem;
  font-weight: 550;
  line-height: 1.3;
}

.notification-todo-guide__dismiss {
  display: inline-flex;
  width: 2rem;
  height: 2rem;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  padding: 0;
  border: 0;
  border-radius: var(--gitpulse-radius-md, 6px);
  background: transparent;
  color: var(--gitpulse-text-muted);
  cursor: pointer;
}

@include hover-only {
  .notification-todo-guide__dismiss:hover {
    background-color: color-mix(in srgb, var(--gitpulse-accent) 10%, transparent);
    color: var(--gitpulse-text-strong);
  }
}

.notification-todo-guide__dismiss:focus-visible {
  outline: 2px solid var(--gitpulse-focus-ring);
  outline-offset: 1px;
}

// Opening and closing animate one grid track plus the card's own opacity and slide. The
// rows below ride that single size change — they keep their own layout and promote no
// compositor layer — so the work is a collapsing box and the scroll content's reflow, not
// a moving stack of cards or a measured height.
.notification-todo-guide-enter-active,
.notification-todo-guide-leave-active {
  transition: grid-template-rows 260ms cubic-bezier(0.4, 0, 0.2, 1);
}

.notification-todo-guide-enter-active .notification-todo-guide__card,
.notification-todo-guide-leave-active .notification-todo-guide__card {
  transition:
    opacity 200ms ease,
    transform 260ms cubic-bezier(0.4, 0, 0.2, 1);
}

.notification-todo-guide-enter-from,
.notification-todo-guide-leave-to {
  grid-template-rows: 0fr;
}

.notification-todo-guide-enter-from .notification-todo-guide__card,
.notification-todo-guide-leave-to .notification-todo-guide__card {
  opacity: 0;
  transform: translate3d(0, -0.375rem, 0);
}

@media (prefers-reduced-motion: reduce) {
  .notification-todo-guide-enter-active,
  .notification-todo-guide-leave-active,
  .notification-todo-guide-enter-active .notification-todo-guide__card,
  .notification-todo-guide-leave-active .notification-todo-guide__card {
    transition: none;
  }
}
</style>
