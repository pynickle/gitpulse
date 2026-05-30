<template>
  <div class="sidebar-card mb-4">
    <div class="sidebar-card__header">
      <div class="sidebar-card__header-left">
        <TagIcon :size="14" class="sidebar-card__icon" />
        <span class="sidebar-card__title">{{ t('issueDetail.labels') }}</span>
      </div>
      <button
        @click="toggleLabelEditor"
        class="sidebar-card__action"
        :class="{ 'sidebar-card__action--hidden': !canEditLabels }"
        :title="t('issueDetail.editLabels')"
        :disabled="!canEditLabels"
      >
        <PencilIcon :size="14" />
      </button>
    </div>
    <div class="sidebar-card__content">
      <div v-if="labels.length > 0" class="label-tags">
        <span
          v-for="label in labels"
          :key="label.id || label.name"
          class="label-tag"
          :style="{
            backgroundColor: `#${label.color}`,
            color: `#${getTextColorFromBackground(label.color)}`,
          }"
        >
          {{ label.name }}
        </span>
      </div>
      <p v-else class="sidebar-card__empty">
        {{ t('issueDetail.noLabels') }}
      </p>
    </div>

    <!-- Label editor panel -->
    <Teleport to="body">
      <Transition name="label-modal">
        <div
          v-if="isLabelEditorVisible"
          class="label-editor-overlay"
          @click.self="toggleLabelEditor"
        >
          <div class="label-editor-panel">
            <div class="label-editor-header">
              <h3 class="label-editor-title">{{ t('issueDetail.editLabels') }}</h3>
              <button
                class="label-editor-close"
                @click="toggleLabelEditor"
                :disabled="savingLabels"
              >
                <XIcon :size="16" />
              </button>
            </div>

            <div class="label-editor-content">
              <div v-if="labelError" class="label-editor-error">
                <AlertCircleIcon :size="14" />
                <span>{{ labelError }}</span>
                <button class="label-editor-error-dismiss" @click="clearLabelError">
                  <XIcon :size="12" />
                </button>
              </div>

              <div v-if="loadingLabels" class="label-editor-loading">
                <Loader2Icon class="spin-animation" :size="18" />
                <span>{{ t('issueDetail.loading') }}</span>
              </div>

              <div v-else class="label-editor-list">
                <label
                  v-for="label in repoLabels"
                  :key="label.id || label.name"
                  class="label-row"
                  :class="{ 'is-selected': selectedLabels.includes(label.name) }"
                >
                  <div class="label-row-check">
                    <input
                      type="checkbox"
                      :checked="selectedLabels.includes(label.name)"
                      @change="toggleLabel(label.name)"
                    />
                    <div class="label-row-check-box">
                      <CheckIcon :size="10" />
                    </div>
                  </div>
                  <span
                    class="label-row-dot"
                    :style="{ backgroundColor: `#${label.color}` }"
                  ></span>
                  <div class="label-row-text">
                    <span class="label-row-name">{{ label.name }}</span>
                    <span v-if="label.description" class="label-row-desc">{{
                      label.description
                    }}</span>
                  </div>
                </label>

                <div v-if="repoLabels.length === 0" class="label-editor-empty">
                  {{ t('issueDetail.noLabelsAvailable') }}
                </div>
              </div>
            </div>

            <div class="label-editor-footer">
              <button class="label-btn-cancel" @click="toggleLabelEditor" :disabled="savingLabels">
                {{ t('issueDetail.cancel') }}
              </button>
              <button
                class="label-btn-save"
                @click="saveLabels"
                :disabled="loadingLabels || savingLabels"
              >
                <Loader2Icon v-if="savingLabels" class="spin-animation" :size="14" />
                <span>{{ savingLabels ? t('issueDetail.saving') : t('issueDetail.save') }}</span>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import {
  AlertCircleIcon,
  CheckIcon,
  Loader2Icon,
  PencilIcon,
  TagIcon,
  XIcon,
} from 'lucide-vue-next';
import { onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
  labels: any[];
  canEditLabels: boolean;
  repoInfo: { owner: string; repo: string } | null;
  issueNumber?: number | null;
}>();

const emit = defineEmits<{
  (e: 'update:labels', labels: any[]): void;
  (e: 'update:is-label-editor-visible', isVisible: boolean): void;
}>();

const { t } = useI18n();
const { openModal, closeModal } = useModalState();

const isLabelEditorVisible = ref(false);
const loadingLabels = ref(false);
const savingLabels = ref(false);
const repoLabels = ref<any[]>([]);
const selectedLabels = ref<string[]>([]);
const labelError = ref<string>('');
let labelErrorTimer: ReturnType<typeof setTimeout> | null = null;

const clearLabelErrorTimer = () => {
  if (labelErrorTimer) {
    clearTimeout(labelErrorTimer);
    labelErrorTimer = null;
  }
};

const clearLabelError = () => {
  clearLabelErrorTimer();
  labelError.value = '';
};

const scheduleLabelErrorClear = () => {
  clearLabelErrorTimer();
  labelErrorTimer = setTimeout(() => {
    labelError.value = '';
    labelErrorTimer = null;
  }, 5000);
};

// Watch for changes in props.labels to update selected labels
watch(
  () => props.labels,
  (newLabels) => {
    selectedLabels.value = newLabels.map((label: any) => label.name);
  },
  { immediate: true }
);

const toggleLabelEditor = async () => {
  if (props.canEditLabels) {
    const willBeVisible = !isLabelEditorVisible.value;
    isLabelEditorVisible.value = willBeVisible;
    emit('update:is-label-editor-visible', willBeVisible);
    if (willBeVisible) {
      openModal();
      await fetchRepoLabels();
    } else {
      closeModal();
    }
  }
};

onUnmounted(() => {
  clearLabelErrorTimer();
  if (isLabelEditorVisible.value) {
    closeModal();
  }
});

const fetchRepoLabels = async () => {
  if (!props.repoInfo || !props.issueNumber) return;

  loadingLabels.value = true;
  selectedLabels.value = [];

  try {
    const { owner, repo } = props.repoInfo;

    const data = await $fetch(`/api/repos/${owner}/${repo}/labels`, {
      method: 'GET',
    });

    repoLabels.value = data || [];

    // Set default selected labels based on current issue labels
    selectedLabels.value = props.labels.map((label: any) => label.name);
  } catch (err) {
    console.error('Error fetching repository labels:', err);
  } finally {
    loadingLabels.value = false;
  }
};

const toggleLabel = (labelName: string) => {
  const index = selectedLabels.value.indexOf(labelName);
  if (index > -1) {
    selectedLabels.value.splice(index, 1);
  } else {
    selectedLabels.value.push(labelName);
  }
};

const saveLabels = async () => {
  if (!props.repoInfo) return;

  savingLabels.value = true;
  clearLabelError();

  try {
    const { owner, repo } = props.repoInfo;
    const data = await $fetch(`/api/repos/${owner}/${repo}/issues/${props.issueNumber}/labels`, {
      method: 'PUT',
      body: {
        labels: selectedLabels.value,
      },
    });

    // Update current issue's labels
    if (data) {
      emit('update:labels', data);
    }

    isLabelEditorVisible.value = false;
    emit('update:is-label-editor-visible', false);
    closeModal();
  } catch (err: any) {
    console.error('Error saving labels:', err);
    labelError.value = err.message || t('issueDetail.failedToUpdateLabels');
    scheduleLabelErrorClear();
  } finally {
    savingLabels.value = false;
  }
};
</script>

<style scoped lang="scss">
@use 'sass:color';
@use '~/assets/scss/_variables' as *;

// Sidebar card wrapper
.sidebar-card {
  background: var(--gitpulse-surface-muted);
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
  overflow: hidden;
}

.sidebar-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--gitpulse-border);
  background: var(--gitpulse-surface);
}

.sidebar-card__header-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sidebar-card__icon {
  color: $brand-primary;
}

.sidebar-card__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  letter-spacing: -0.01em;
}

.sidebar-card__action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  background: transparent;
  border-radius: 6px;
  color: var(--gitpulse-text-subtle);
  cursor: pointer;
  transition: all 0.12s ease;

  &:hover:not(:disabled) {
    background: var(--gitpulse-accent-soft);
    color: var(--gitpulse-accent);
  }

  &--hidden {
    visibility: hidden;
  }
}

.sidebar-card__content {
  padding: 12px 16px;
}

.sidebar-card__empty {
  font-size: 12px;
  color: var(--gitpulse-text-subtle);
  margin: 0;
}

// Label tags
.label-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.label-tag {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 20px;
  letter-spacing: 0.01em;
  line-height: 1.4;
}

// Overlay
.label-editor-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gitpulse-overlay-bg);
  backdrop-filter: blur(6px);
}

// Panel
.label-editor-panel {
  width: 100%;
  max-width: 400px;
  max-height: 78vh;
  display: flex;
  flex-direction: column;
  background: var(--gitpulse-surface);
  border-radius: 8px;
  box-shadow: var(--gitpulse-shadow-raised);
  overflow: hidden;
}

// Header — no border
.label-editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 8px;
}

.label-editor-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  margin: 0;
  letter-spacing: -0.01em;
}

.label-editor-close {
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

  &:hover {
    background: var(--gitpulse-surface-hover);
    color: var(--gitpulse-text);
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
}

// Content
.label-editor-content {
  flex: 1;
  overflow-y: auto;
  padding: 4px 12px;
  min-height: 0;
}

// Error
.label-editor-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  margin: 4px 8px 8px;
  background: var(--gitpulse-danger-soft);
  border-radius: 8px;
  color: var(--gitpulse-danger);
  font-size: 12px;
}

.label-editor-error-dismiss {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  margin-left: auto;
  border: none;
  background: transparent;
  border-radius: 4px;
  color: var(--gitpulse-danger);
  cursor: pointer;

  &:hover {
    background: var(--gitpulse-danger-soft);
  }
}

// Loading
.label-editor-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 36px 0;
  color: var(--gitpulse-text-subtle);
  font-size: 13px;
}

// Label list
.label-editor-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 4px 0;
}

// Row
.label-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 8px;
  margin: 0 -8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.1s ease;
  user-select: none;

  &:hover {
    background: var(--gitpulse-surface-hover);
  }

  &.is-selected {
    background: var(--gitpulse-accent-soft);
  }
}

// Checkbox
.label-row-check {
  position: relative;
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  margin-top: 1px;

  input {
    position: absolute;
    opacity: 0;
    width: 100%;
    height: 100%;
    cursor: pointer;
    z-index: 1;
  }
}

.label-row-check-box {
  width: 16px;
  height: 16px;
  border: 1.5px solid var(--gitpulse-input-border);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gitpulse-input-bg);
  transition: all 0.12s ease;
  color: transparent;
  pointer-events: none;

  .label-row-check input:checked + & {
    background: $brand-primary;
    border-color: $brand-primary;
    color: var(--gitpulse-surface);
  }

  .label-row:hover & {
    border-color: var(--gitpulse-border-strong);
  }

  .label-row.is-selected & {
    background: $brand-primary;
    border-color: $brand-primary;
    color: var(--gitpulse-surface);
  }
}

// Dot
.label-row-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 5px;
}

// Text container
.label-row-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1;
}

// Name
.label-row-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  line-height: 1.4;
}

// Description — wraps naturally, muted color
.label-row-desc {
  font-size: 12px;
  color: var(--gitpulse-text-muted);
  line-height: 1.4;
  word-break: break-word;
}

// Empty
.label-editor-empty {
  padding: 28px 0;
  text-align: center;
  color: var(--gitpulse-text-subtle);
  font-size: 13px;
}

// Footer — no border
.label-editor-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  padding: 8px 20px 14px;
}

// Buttons — compact, no heavy chrome
.label-btn-cancel {
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 500;
  color: var(--gitpulse-text-muted);
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.12s ease;

  &:hover:not(:disabled) {
    background: var(--gitpulse-surface-hover);
    color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
}

.label-btn-save {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 14px;
  font-size: 12px;
  font-weight: 500;
  color: var(--gitpulse-surface);
  background: $brand-primary;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.12s ease;

  &:hover:not(:disabled) {
    background: color.adjust($brand-primary, $lightness: -5%);
    box-shadow: 0 2px 8px rgba($brand-primary, 0.25);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}

// Spin
.spin-animation {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

// Transition
.label-modal-enter-active {
  transition: opacity 0.18s ease;

  .label-editor-panel {
    transition:
      transform 0.22s cubic-bezier(0.16, 1, 0.3, 1),
      opacity 0.18s ease;
  }
}

.label-modal-leave-active {
  transition: opacity 0.12s ease;

  .label-editor-panel {
    transition:
      transform 0.12s ease,
      opacity 0.12s ease;
  }
}

.label-modal-enter-from {
  opacity: 0;

  .label-editor-panel {
    transform: scale(0.97) translateY(6px);
    opacity: 0;
  }
}

.label-modal-leave-to {
  opacity: 0;

  .label-editor-panel {
    transform: scale(0.97) translateY(6px);
    opacity: 0;
  }
}
</style>
