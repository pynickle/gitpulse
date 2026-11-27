<template>
  <Teleport to="body">
    <Transition name="label-modal">
      <div v-if="isVisible" class="label-editor-overlay" @click.self="close">
        <div
          ref="panelRef"
          class="label-editor-panel"
          role="dialog"
          aria-modal="true"
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

          <ScrollArea
            v-if="error || loadingLabel || options.length > 0 || emptyMessage"
            class="label-editor-content"
          >
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

            <div v-else-if="options.length > 0 || emptyMessage" class="label-editor-list">
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
                  <span class="issue-option-row__name">{{ option.label }}</span>
                  <span v-if="option.description" class="issue-option-row__desc">
                    {{ option.description }}
                  </span>
                </span>
                <CheckIcon class="issue-option-row__check" :size="14" aria-hidden="true" />
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

const {
  isVisible,
  saving,
  options = [],
} = defineProps<{
  isVisible: boolean;
  title: string;
  options?: { value: string; label: string; description?: string | null; color?: string }[];
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

const selectedValue = defineModel<string>({ default: '' });
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
@use '~/assets/scss/modal-shell';
</style>
