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
                    <span class="issue-type-radio" aria-hidden="true">
                      <span class="issue-type-radio__dot"></span>
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
                    <span class="issue-type-radio" aria-hidden="true">
                      <span class="issue-type-radio__dot"></span>
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
import { AlertCircleIcon, Loader2Icon, PencilIcon, Tags, XIcon } from '@lucide/vue';
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
@use '~/assets/scss/_variables' as *;
@use '~/assets/scss/issue-metadata-editor';

.label-row-dot--empty {
  background: var(--gitpulse-border-strong);
}

.issue-type-radio {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: 1.5px solid var(--gitpulse-input-border);
  border-radius: 50%;
  background: var(--gitpulse-input-bg);
  transition: all 0.12s ease;
  pointer-events: none;

  .label-row:hover & {
    border-color: var(--gitpulse-border-strong);
  }

  .label-row-check input:checked + & {
    border-color: $brand-primary;
  }
}

.issue-type-radio__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: $brand-primary;
  opacity: 0;
  transform: scale(0.5);
  transition:
    opacity 0.12s ease,
    transform 0.12s ease;
}

.label-row-check input:checked + .issue-type-radio .issue-type-radio__dot {
  opacity: 1;
  transform: scale(1);
}

.label-row-check input:focus-visible + .issue-type-radio {
  outline: 2px solid $brand-primary;
  outline-offset: 2px;
}
</style>
