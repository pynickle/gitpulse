<template>
  <Teleport to="body">
    <Transition name="label-modal">
      <div v-if="isVisible" class="label-editor-overlay" @click.self="close">
        <div
          ref="panelRef"
          class="label-editor-panel"
          role="dialog"
          :aria-labelledby="titleId"
          @keydown="handleKeydown"
        >
          <div class="label-editor-header">
            <h3 :id="titleId" class="label-editor-title">{{ title }}</h3>
            <button
              type="button"
              class="label-editor-close"
              :aria-label="cancelLabel"
              :disabled="saving"
              @click="close"
            >
              <XIcon :size="16" />
            </button>
          </div>

          <ScrollArea class="label-editor-content">
            <div v-if="error" class="label-editor-error">
              <CircleExclamationPointIcon :size="14" />
              <span>{{ error }}</span>
              <button
                type="button"
                class="label-editor-error-dismiss"
                @click="$emit('dismiss-error')"
              >
                <XIcon :size="12" />
              </button>
            </div>

            <div v-if="loadingLabel" class="label-editor-loading">
              <LoaderCircleIcon class="spin-animation" :size="18" />
              <span>{{ loadingLabel }}</span>
            </div>

            <div v-else class="label-editor-list">
              <label v-for="option in options" :key="option.value" class="issue-option-row">
                <input
                  v-model="selectedValue"
                  class="issue-option-row__input"
                  type="radio"
                  :name="titleId"
                  :value="option.value"
                  :disabled="saving"
                />
                <span
                  class="issue-option-row__bar"
                  :style="{ '--issue-option-color': option.color }"
                  aria-hidden="true"
                ></span>
                <span class="issue-option-row__text">
                  <span class="issue-option-row__head">
                    <span class="issue-option-row__name">{{ option.label }}</span>
                    <CheckIcon class="issue-option-row__check" :size="14" aria-hidden="true" />
                  </span>
                  <span v-if="option.description" class="issue-option-row__desc">
                    {{ option.description }}
                  </span>
                </span>
              </label>

              <div v-if="emptyMessage" class="label-editor-empty">{{ emptyMessage }}</div>
            </div>
          </ScrollArea>

          <div class="label-editor-footer">
            <button type="button" class="label-btn-cancel" :disabled="saving" @click="close">
              {{ cancelLabel }}
            </button>
            <button
              type="button"
              class="label-btn-save"
              :disabled="!!loadingLabel || saving || confirmDisabled"
              @click="$emit('confirm')"
            >
              <LoaderCircleIcon v-if="saving" class="spin-animation" :size="14" />
              <span>{{ confirmLabel }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { CheckIcon, CircleExclamationPointIcon, LoaderCircleIcon, XIcon } from '@lucide/vue';
import { ref, useId } from 'vue';

import ScrollArea from '~/components/ui/ScrollArea.vue';

const { isVisible, saving } = defineProps<{
  isVisible: boolean;
  title: string;
  options: { value: string; label: string; description?: string | null; color?: string }[];
  cancelLabel: string;
  confirmLabel: string;
  confirmDisabled?: boolean;
  saving: boolean;
  loadingLabel?: string;
  emptyMessage?: string;
  error?: string;
}>();

const emit = defineEmits<{
  close: [];
  confirm: [];
  'dismiss-error': [];
}>();

const selectedValue = defineModel<string>({ required: true });
const panelRef = ref<HTMLElement | null>(null);
const titleId = useId();

const close = () => {
  if (!saving) emit('close');
};

const { handleKeydown } = useModalLifecycle({
  open: () => isVisible,
  panel: panelRef,
  onRequestClose: close,
});
</script>

<style scoped lang="scss">
@use '~/assets/scss/_variables' as *;
@use '~/assets/scss/detail-metadata-editor';
@use '~/assets/scss/pointer' as *;

.issue-option-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 10px 9px 8px;
  margin: 0 -8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.1s ease;
  user-select: none;

  @include hover-only {
    &:hover {
      background: var(--gitpulse-surface-hover);
    }
  }

  &:has(.issue-option-row__input:focus-visible) {
    outline: 2px solid $brand-primary;
    outline-offset: -2px;
  }

  &:has(.issue-option-row__input:disabled) {
    cursor: progress;
    opacity: 0.6;
  }
}

.issue-option-row__input {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: 0;
  padding: 0;
  border: 0;
  opacity: 0;
  clip-path: inset(50%);
  pointer-events: none;
}

.issue-option-row__bar {
  flex-shrink: 0;
  align-self: stretch;
  width: 3px;
  border-radius: 2px;
  background: var(--issue-option-color, var(--gitpulse-border-strong));
  opacity: 0.5;
  transition: opacity 0.12s ease;
}

.issue-option-row__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.issue-option-row__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.issue-option-row__name {
  font-size: 13px;
  font-weight: 500;
  line-height: 1.4;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  transition: color 0.12s ease;
}

.issue-option-row__desc {
  font-size: 12px;
  line-height: 1.45;
  color: var(--gitpulse-text-muted);
  word-break: break-word;
}

.issue-option-row__check {
  flex-shrink: 0;
  color: var(--gitpulse-accent);
  opacity: 0;
  transform: scale(0.7);
  transition:
    opacity 0.14s ease,
    transform 0.14s ease;
}

.issue-option-row:has(.issue-option-row__input:checked) {
  .issue-option-row__bar {
    opacity: 1;
  }

  .issue-option-row__name {
    font-weight: 600;
    color: var(--gitpulse-accent);
  }

  .issue-option-row__check {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
