<template>
  <div class="sidebar-card mb-4">
    <div class="sidebar-card__header">
      <div class="sidebar-card__header-left">
        <Tags :size="14" class="sidebar-card__icon" />
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
                <label class="issue-type-row" :class="{ 'is-selected': selectedTypeName === '' }">
                  <input
                    class="issue-type-row__input"
                    type="radio"
                    name="issue-type"
                    value=""
                    :checked="selectedTypeName === ''"
                    :disabled="savingIssueType"
                    @change="selectIssueType('')"
                  />
                  <span class="issue-type-row__bar" aria-hidden="true"></span>
                  <span class="issue-type-row__text">
                    <span class="issue-type-row__head">
                      <span class="issue-type-row__name">{{ t('detailIssueType.none') }}</span>
                      <CheckIcon class="issue-type-row__check" :size="14" aria-hidden="true" />
                    </span>
                  </span>
                </label>

                <label
                  v-for="type in selectableIssueTypes"
                  :key="type.id"
                  class="issue-type-row"
                  :class="{ 'is-selected': selectedTypeName === type.name }"
                >
                  <input
                    class="issue-type-row__input"
                    type="radio"
                    name="issue-type"
                    :value="type.name"
                    :checked="selectedTypeName === type.name"
                    :disabled="savingIssueType"
                    @change="selectIssueType(type.name)"
                  />
                  <span
                    class="issue-type-row__bar"
                    :style="issueTypeBarStyle(type)"
                    aria-hidden="true"
                  ></span>
                  <span class="issue-type-row__text">
                    <span class="issue-type-row__head">
                      <span class="issue-type-row__name">{{ type.name }}</span>
                      <CheckIcon class="issue-type-row__check" :size="14" aria-hidden="true" />
                    </span>
                    <span v-if="type.description" class="issue-type-row__desc">
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
import { AlertCircleIcon, CheckIcon, Loader2Icon, PencilIcon, Tags, XIcon } from '@lucide/vue';
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

const issueTypeBarStyle = (type: GitHubIssueType) => ({
  '--issue-type-color': resolveIssueTypeColor(type.color),
});

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
@use '~/assets/scss/_variables' as *;
@use '~/assets/scss/issue-metadata-editor';

.issue-type-row {
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

  &:hover {
    background: var(--gitpulse-surface-hover);
  }

  &:has(.issue-type-row__input:focus-visible) {
    outline: 2px solid $brand-primary;
    outline-offset: -2px;
  }

  &:has(.issue-type-row__input:disabled) {
    cursor: progress;
    opacity: 0.6;
  }
}

.issue-type-row__input {
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

.issue-type-row__bar {
  flex-shrink: 0;
  align-self: stretch;
  width: 3px;
  border-radius: 2px;
  background: var(--issue-type-color, var(--gitpulse-border-strong));
  opacity: 0.5;
  transition: opacity 0.12s ease;
}

.issue-type-row__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.issue-type-row__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.issue-type-row__name {
  font-size: 13px;
  font-weight: 500;
  line-height: 1.4;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  transition: color 0.12s ease;
}

.issue-type-row__desc {
  font-size: 12px;
  line-height: 1.45;
  color: var(--gitpulse-text-muted);
  word-break: break-word;
}

.issue-type-row__check {
  flex-shrink: 0;
  color: var(--gitpulse-accent);
  opacity: 0;
  transform: scale(0.7);
  transition:
    opacity 0.14s ease,
    transform 0.14s ease;
}

.issue-type-row.is-selected {
  .issue-type-row__bar {
    opacity: 1;
  }

  .issue-type-row__name {
    font-weight: 600;
    color: var(--gitpulse-accent);
  }

  .issue-type-row__check {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
