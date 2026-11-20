<script setup lang="ts">
import { CircleExclamationPointIcon, LoaderCircleIcon, XIcon } from '@lucide/vue';
import { nextTick, onBeforeUnmount, useTemplateRef, watch } from 'vue';

import ScrollArea from '~/components/ui/ScrollArea.vue';

const { isVisible } = defineProps<{
  isVisible: boolean;
  title: string;
  closeLabel: string;
  loadingLabel?: string;
  error?: string;
  emptyLabel?: string;
}>();
const emit = defineEmits<{ close: [] }>();

const panel = useTemplateRef<HTMLElement>('panel');
const focusTrap = createFocusTrapController();

watch(
  () => isVisible,
  async (visible) => {
    if (!import.meta.client) return;
    if (visible) focusTrap.capturePreviousFocus();
    await nextTick();
    if (visible && panel.value) focusTrap.focusInitialElement(panel.value);
    if (!visible) focusTrap.restorePreviousFocus();
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  if (import.meta.client) focusTrap.restorePreviousFocus();
});

const handleKeydown = (event: KeyboardEvent) => {
  if (!panel.value) return;
  focusTrap.trapTabKey(event, panel.value);
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const list = target.closest('[data-picker-list]');
  if (!list) return;
  const rows = [...list.querySelectorAll<HTMLButtonElement>('[data-picker-row]')];
  if (!rows.length) return;
  const index = rows.findIndex((row) => row === target);
  const delta = event.key === 'ArrowDown' ? 1 : -1;
  event.preventDefault();
  rows[index < 0 ? 0 : (index + delta + rows.length) % rows.length]?.focus();
};
</script>

<template>
  <Teleport to="body">
    <Transition name="picker">
      <div
        v-if="isVisible"
        class="picker-overlay"
        @click.self="emit('close')"
        @keydown.escape.stop="emit('close')"
        @keydown="handleKeydown"
      >
        <div
          ref="panel"
          class="picker-panel"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
          tabindex="-1"
        >
          <div class="picker-header">
            <h3 class="picker-title">{{ title }}</h3>
            <button
              class="picker-close"
              type="button"
              :aria-label="closeLabel"
              @click="emit('close')"
            >
              <XIcon :size="16" aria-hidden="true" />
            </button>
          </div>

          <ScrollArea class="picker-content">
            <slot />
            <div v-if="loadingLabel" class="picker-status" role="status">
              <LoaderCircleIcon class="spin-animation" :size="18" aria-hidden="true" />
              <span>{{ loadingLabel }}</span>
            </div>

            <div v-else-if="error" class="picker-error" role="alert">
              <CircleExclamationPointIcon :size="14" aria-hidden="true" />
              <span>{{ error }}</span>
            </div>

            <div v-else-if="emptyLabel" class="picker-empty">
              <slot name="empty-icon" />
              <p>{{ emptyLabel }}</p>
            </div>
            <slot name="footer" />
          </ScrollArea>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
@use '~/assets/scss/pointer' as *;

.picker-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gitpulse-overlay-bg);
  backdrop-filter: blur(6px);
}

.picker-panel {
  width: 100%;
  max-width: 420px;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  background: var(--gitpulse-surface);
  border-radius: 8px;
  box-shadow: var(--gitpulse-shadow-raised);
  overflow: hidden;
}

.picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 8px;
}

.picker-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  margin: 0;
  letter-spacing: -0.01em;
}

.picker-close {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: transparent;
  border-radius: 6px;
  color: var(--gitpulse-text-subtle);
  cursor: pointer;
  transition: all 0.12s ease;

  @include hover-only {
    &:hover {
      background: var(--gitpulse-surface-hover);
      color: var(--gitpulse-text);
    }
  }
}

.picker-content {
  flex: 1;

  padding: 0 12px 12px;
  min-height: 0;
}

.picker-status,
.picker-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 36px 0;
  color: var(--gitpulse-text-muted);
  font-size: 13px;
  text-align: center;

  p {
    margin: 0;
  }
}

.picker-status {
  flex-direction: row;
}

.picker-error {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 12px 4px;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--gitpulse-danger-soft);
  color: var(--gitpulse-danger);
  font-size: 12px;
  font-weight: 500;
  text-align: center;
}

.picker-enter-active,
.picker-leave-active {
  transition: opacity 0.18s ease;

  .picker-panel {
    transition: transform 0.22s cubic-bezier(0.32, 0.72, 0, 1);
  }
}

.picker-enter-from,
.picker-leave-to {
  opacity: 0;

  .picker-panel {
    transform: scale(0.96) translateY(8px);
  }
}

.picker-enter-to,
.picker-leave-from {
  opacity: 1;

  .picker-panel {
    transform: scale(1) translateY(0);
  }
}
</style>
