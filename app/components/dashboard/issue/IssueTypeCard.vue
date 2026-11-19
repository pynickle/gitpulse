<template>
  <div class="sidebar-card mb-4">
    <div class="sidebar-card__header">
      <div class="sidebar-card__header-left">
        <TagsIcon :size="14" class="sidebar-card__icon" />
        <span class="sidebar-card__title">{{ t('detailIssueType.title') }}</span>
      </div>
      <button
        type="button"
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

    <IssueOptionModal
      v-model="selectedTypeName"
      :is-visible="isIssueTypeEditorVisible"
      :title="t('detailIssueType.edit')"
      :options="issueTypeOptions"
      :cancel-label="t('detailIssueType.cancel')"
      :confirm-label="savingIssueType ? t('detailIssueType.saving') : t('detailIssueType.save')"
      :saving="savingIssueType"
      :loading-label="loadingIssueTypes ? t('detailIssueType.loading') : undefined"
      :empty-message="
        selectableIssueTypes.length === 0 ? t('detailIssueType.noneAvailable') : undefined
      "
      :error="issueTypeError"
      @close="toggleIssueTypeEditor"
      @confirm="saveIssueType"
      @dismiss-error="clearIssueTypeError"
    />
  </div>
</template>

<script setup lang="ts">
import { PencilIcon, TagsIcon } from '@lucide/vue';
import { computed, onUnmounted, ref, watch } from 'vue';

import type { GitHubIssueType } from '#shared/types/issues';
import IssueTypeBadge from '~/components/dashboard/issue/IssueTypeBadge.vue';
import { getFetchErrorMessage } from '~/utils/getFetchErrorMessage';
import { resolveIssueTypeColor } from '~/utils/issueTypeColor';

import IssueOptionModal from './IssueOptionModal.vue';

const { issueType, canEditIssueType, repoInfo, issueNumber } = defineProps<{
  issueType?: GitHubIssueType | null;
  canEditIssueType: boolean;
  repoInfo: { owner: string; repo: string } | null;
  issueNumber?: number | null;
}>();

const emit = defineEmits<{
  'update:issueType': [issueType: GitHubIssueType | null];
}>();

const { t } = useI18n();
const apiFetch = useGitPulseApiFetch();
const isIssueTypeEditorVisible = ref(false);
const loadingIssueTypes = ref(false);
const savingIssueType = ref(false);
const issueTypeError = ref('');
const repoIssueTypes = ref<GitHubIssueType[]>([]);
const selectedTypeName = ref('');
let issueTypeErrorTimer: ReturnType<typeof setTimeout> | null = null;

const selectableIssueTypes = computed(() => {
  const enabledTypes = repoIssueTypes.value.filter((type) => type.is_enabled !== false);
  if (!issueType || enabledTypes.some((type) => type.name === issueType?.name)) {
    return enabledTypes;
  }

  return [issueType, ...enabledTypes];
});

const issueTypeOptions = computed(() => [
  { value: '', label: t('detailIssueType.none') },
  ...selectableIssueTypes.value.map((type) => ({
    value: type.name,
    label: type.name,
    description: type.description,
    color: resolveIssueTypeColor(type.color),
  })),
]);

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
  if (!repoInfo) return;

  loadingIssueTypes.value = true;
  clearIssueTypeError();
  try {
    const { owner, repo } = repoInfo;
    repoIssueTypes.value = await apiFetch<GitHubIssueType[]>(
      `/api/repos/${owner}/${repo}/issue-types`
    );
    selectedTypeName.value = issueType?.name ?? '';
  } catch (error: unknown) {
    issueTypeError.value = getFetchErrorMessage(error, t('detailIssueType.loadFailed'));
    scheduleIssueTypeErrorClear();
  } finally {
    loadingIssueTypes.value = false;
  }
};

const toggleIssueTypeEditor = async () => {
  if (!canEditIssueType || savingIssueType.value) return;

  const willBeVisible = !isIssueTypeEditorVisible.value;
  isIssueTypeEditorVisible.value = willBeVisible;
  if (willBeVisible) {
    selectedTypeName.value = issueType?.name ?? '';
    await fetchIssueTypes();
    return;
  }

  selectedTypeName.value = issueType?.name ?? '';
  clearIssueTypeError();
};

const saveIssueType = async () => {
  if (!repoInfo || !issueNumber) return;

  savingIssueType.value = true;
  clearIssueTypeError();
  try {
    const { owner, repo } = repoInfo;
    const updatedIssueType = await apiFetch<GitHubIssueType | null>(
      `/api/repos/${owner}/${repo}/issues/${issueNumber}/type`,
      {
        method: 'PATCH',
        body: { type: selectedTypeName.value || null },
      }
    );
    emit('update:issueType', updatedIssueType);
    isIssueTypeEditorVisible.value = false;
  } catch (error: unknown) {
    issueTypeError.value = getFetchErrorMessage(error, t('detailIssueType.updateFailed'));
    scheduleIssueTypeErrorClear();
  } finally {
    savingIssueType.value = false;
  }
};

watch(
  () => issueType,
  (issueType) => {
    if (!isIssueTypeEditorVisible.value) selectedTypeName.value = issueType?.name ?? '';
  },
  { immediate: true }
);

onUnmounted(() => {
  clearIssueTypeErrorTimer();
});
</script>

<style scoped lang="scss">
@use '~/assets/scss/detail-metadata-editor';
</style>
