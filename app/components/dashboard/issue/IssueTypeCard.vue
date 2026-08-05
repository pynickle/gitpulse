<template>
  <div class="sidebar-card mb-4">
    <div class="sidebar-card__header">
      <div class="sidebar-card__header-left">
        <TagIcon :size="14" class="sidebar-card__icon" />
        <span class="sidebar-card__title">{{ t('detailIssueType.title') }}</span>
      </div>
      <button
        class="sidebar-card__action"
        :class="{ 'sidebar-card__action--hidden': !canEditIssueType }"
        :title="t('detailIssueType.edit')"
        :disabled="!canEditIssueType"
        @click="toggleIssueTypeEditor"
      >
        <PencilIcon :size="14" />
      </button>
    </div>

    <div class="sidebar-card__content">
      <div v-if="issueType?.name" class="label-tags">
        <IssueTypeBadge variant="tag" :name="issueType.name" :color="issueType.color" />
      </div>
      <p v-else class="sidebar-card__empty">{{ t('detailIssueType.empty') }}</p>
    </div>

    <Teleport to="body">
      <Transition name="label-modal">
        <div
          v-if="isIssueTypeEditorVisible"
          class="label-editor-overlay"
          @click.self="toggleIssueTypeEditor"
        >
          <div class="label-editor-panel">
            <div class="label-editor-header">
              <h3 class="label-editor-title">{{ t('detailIssueType.edit') }}</h3>
              <button
                class="label-editor-close"
                :disabled="savingIssueType"
                @click="toggleIssueTypeEditor"
              >
                <XIcon :size="16" />
              </button>
            </div>

            <div class="label-editor-content">
              <div v-if="issueTypeError" class="label-editor-error">
                <AlertCircleIcon :size="14" />
                <span>{{ issueTypeError }}</span>
                <button class="label-editor-error-dismiss" @click="clearIssueTypeError">
                  <XIcon :size="12" />
                </button>
              </div>

              <div v-if="loadingIssueTypes" class="label-editor-loading">
                <Loader2Icon class="spin-animation" :size="18" />
                <span>{{ t('detailIssueType.loading') }}</span>
              </div>

              <div v-else class="label-editor-list">
                <label class="label-row" :class="{ 'is-selected': selectedTypeName === '' }">
                  <span class="label-row-check">
                    <input
                      type="radio"
                      name="issue-type"
                      value=""
                      :checked="selectedTypeName === ''"
                      :disabled="savingIssueType"
                      @change="selectIssueType('')"
                    />
                    <span class="label-row-check-box">
                      <CheckIcon :size="10" />
                    </span>
                  </span>
                  <span class="label-row-dot label-row-dot--empty"></span>
                  <span class="label-row-text">
                    <span class="label-row-name">{{ t('detailIssueType.none') }}</span>
                  </span>
                </label>

                <label
                  v-for="type in selectableIssueTypes"
                  :key="type.id"
                  class="label-row"
                  :class="{ 'is-selected': selectedTypeName === type.name }"
                >
                  <span class="label-row-check">
                    <input
                      type="radio"
                      name="issue-type"
                      :value="type.name"
                      :checked="selectedTypeName === type.name"
                      :disabled="savingIssueType"
                      @change="selectIssueType(type.name)"
                    />
                    <span class="label-row-check-box">
                      <CheckIcon :size="10" />
                    </span>
                  </span>
                  <span
                    class="label-row-dot"
                    :style="{ backgroundColor: resolveIssueTypeColor(type.color) }"
                  ></span>
                  <span class="label-row-text">
                    <span class="label-row-name">{{ type.name }}</span>
                    <span v-if="type.description" class="label-row-desc">
                      {{ type.description }}
                    </span>
                  </span>
                </label>

                <div v-if="selectableIssueTypes.length === 0" class="label-editor-empty">
                  {{ t('detailIssueType.noneAvailable') }}
                </div>
              </div>
            </div>

            <div class="label-editor-footer">
              <button
                class="label-btn-cancel"
                :disabled="savingIssueType"
                @click="toggleIssueTypeEditor"
              >
                {{ t('detailIssueType.cancel') }}
              </button>
              <button
                class="label-btn-save"
                :disabled="loadingIssueTypes || savingIssueType"
                @click="saveIssueType"
              >
                <Loader2Icon v-if="savingIssueType" class="spin-animation" :size="14" />
                <span>
                  {{ savingIssueType ? t('detailIssueType.saving') : t('detailIssueType.save') }}
                </span>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { AlertCircleIcon, CheckIcon, Loader2Icon, PencilIcon, TagIcon, XIcon } from '@lucide/vue';
import { computed, onUnmounted, ref, watch } from 'vue';

import type { GitHubIssueType } from '#shared/types/issues';
import IssueTypeBadge from '~/components/dashboard/issue/IssueTypeBadge.vue';
import getFetchErrorMessage from '~/utils/getFetchErrorMessage';
import resolveIssueTypeColor from '~/utils/issueTypeColor';

const props = defineProps<{
  issueType?: GitHubIssueType | null;
  canEditIssueType: boolean;
  repoInfo: { owner: string; repo: string } | null;
  issueNumber?: number | null;
}>();

const emit = defineEmits<{
  'update:issueType': [issueType: GitHubIssueType | null];
  'update:isIssueTypeEditorVisible': [isVisible: boolean];
}>();

const { t } = useI18n();
const apiFetch = useGitPulseApiFetch();
const { openModal, closeModal } = useModalState();
const isIssueTypeEditorVisible = ref(false);
const loadingIssueTypes = ref(false);
const savingIssueType = ref(false);
const issueTypeError = ref('');
const repoIssueTypes = ref<GitHubIssueType[]>([]);
const selectedTypeName = ref('');
let issueTypeErrorTimer: ReturnType<typeof setTimeout> | null = null;

const selectableIssueTypes = computed(() => {
  const enabledTypes = repoIssueTypes.value.filter((type) => type.is_enabled !== false);
  if (!props.issueType || enabledTypes.some((type) => type.name === props.issueType?.name)) {
    return enabledTypes;
  }

  return [props.issueType, ...enabledTypes];
});

const clearIssueTypeErrorTimer = () => {
  if (!issueTypeErrorTimer) return;
  clearTimeout(issueTypeErrorTimer);
  issueTypeErrorTimer = null;
};

const clearIssueTypeError = () => {
  clearIssueTypeErrorTimer();
  issueTypeError.value = '';
};

const scheduleIssueTypeErrorClear = () => {
  clearIssueTypeErrorTimer();
  issueTypeErrorTimer = setTimeout(() => {
    issueTypeError.value = '';
    issueTypeErrorTimer = null;
  }, 5000);
};

const fetchIssueTypes = async () => {
  if (!props.repoInfo) return;

  loadingIssueTypes.value = true;
  clearIssueTypeError();
  try {
    const { owner, repo } = props.repoInfo;
    repoIssueTypes.value = await apiFetch<GitHubIssueType[]>(
      `/api/repos/${owner}/${repo}/issue-types`
    );
    selectedTypeName.value = props.issueType?.name ?? '';
  } catch (error: unknown) {
    issueTypeError.value = getFetchErrorMessage(error, t('detailIssueType.loadFailed'));
    scheduleIssueTypeErrorClear();
  } finally {
    loadingIssueTypes.value = false;
  }
};

const toggleIssueTypeEditor = async () => {
  if (!props.canEditIssueType || savingIssueType.value) return;

  const willBeVisible = !isIssueTypeEditorVisible.value;
  isIssueTypeEditorVisible.value = willBeVisible;
  emit('update:isIssueTypeEditorVisible', willBeVisible);
  if (willBeVisible) {
    selectedTypeName.value = props.issueType?.name ?? '';
    openModal();
    await fetchIssueTypes();
    return;
  }

  selectedTypeName.value = props.issueType?.name ?? '';
  clearIssueTypeError();
  closeModal();
};

const selectIssueType = (typeName: string) => {
  if (savingIssueType.value) return;
  selectedTypeName.value = typeName;
};

const saveIssueType = async () => {
  if (!props.repoInfo || !props.issueNumber) return;

  savingIssueType.value = true;
  clearIssueTypeError();
  try {
    const { owner, repo } = props.repoInfo;
    const updatedIssueType = await apiFetch<GitHubIssueType | null>(
      `/api/repos/${owner}/${repo}/issues/${props.issueNumber}/type`,
      {
        method: 'PATCH',
        body: { type: selectedTypeName.value || null },
      }
    );
    emit('update:issueType', updatedIssueType);
    isIssueTypeEditorVisible.value = false;
    emit('update:isIssueTypeEditorVisible', false);
    closeModal();
  } catch (error: unknown) {
    issueTypeError.value = getFetchErrorMessage(error, t('detailIssueType.updateFailed'));
    scheduleIssueTypeErrorClear();
  } finally {
    savingIssueType.value = false;
  }
};

watch(
  () => props.issueType,
  (issueType) => {
    if (!isIssueTypeEditorVisible.value) selectedTypeName.value = issueType?.name ?? '';
  },
  { immediate: true }
);

onUnmounted(() => {
  clearIssueTypeErrorTimer();
  if (isIssueTypeEditorVisible.value) closeModal();
});
</script>

<style scoped lang="scss">
@use 'sass:color';
@use '~/assets/scss/_variables' as *;

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

.label-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

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

.label-editor-content {
  flex: 1;
  overflow-y: auto;
  padding: 4px 12px;
  min-height: 0;
}

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

.label-editor-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 36px 0;
  color: var(--gitpulse-text-subtle);
  font-size: 13px;
}

.label-editor-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 4px 0;
}

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

.label-row-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 5px;
}

.label-row-dot--empty {
  border: 1px solid var(--gitpulse-border-strong);
  background: var(--gitpulse-surface-muted);
}

.label-row-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1;
}

.label-row-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  line-height: 1.4;
}

.label-row-desc {
  font-size: 12px;
  color: var(--gitpulse-text-muted);
  line-height: 1.4;
  word-break: break-word;
}

.label-editor-empty {
  padding: 28px 0;
  text-align: center;
  color: var(--gitpulse-text-subtle);
  font-size: 13px;
}

.label-editor-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  padding: 8px 20px 14px;
}

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
