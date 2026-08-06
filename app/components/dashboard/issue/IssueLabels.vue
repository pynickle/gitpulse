<template>
  <div class="sidebar-card mb-4">
    <div class="sidebar-card__header">
      <div class="sidebar-card__header-left">
        <TagIcon :size="14" class="sidebar-card__icon" />
        <span class="sidebar-card__title">{{ t('detailLabels.title') }}</span>
      </div>
      <button
        @click="toggleLabelEditor"
        class="sidebar-card__action"
        :class="{ 'sidebar-card__action--hidden': !canEditLabels }"
        :title="t('detailLabels.edit')"
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
        {{ t('detailLabels.empty') }}
      </p>
    </div>

    <Teleport to="body">
      <Transition name="label-modal">
        <div
          v-if="isLabelEditorVisible"
          class="label-editor-overlay"
          @click.self="toggleLabelEditor"
        >
          <div class="label-editor-panel">
            <div class="label-editor-header">
              <h3 class="label-editor-title">{{ t('detailLabels.edit') }}</h3>
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
                <span>{{ t('detailLabels.loading') }}</span>
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
                  {{ t('detailLabels.noneAvailable') }}
                </div>
              </div>
            </div>

            <div class="label-editor-footer">
              <button class="label-btn-cancel" @click="toggleLabelEditor" :disabled="savingLabels">
                {{ t('detailLabels.cancel') }}
              </button>
              <button
                class="label-btn-save"
                @click="saveLabels"
                :disabled="loadingLabels || savingLabels"
              >
                <Loader2Icon v-if="savingLabels" class="spin-animation" :size="14" />
                <span>{{ savingLabels ? t('detailLabels.saving') : t('detailLabels.save') }}</span>
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
import { onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { getTextColorFromBackground } from '#imports';
import getFetchErrorMessage from '~/utils/getFetchErrorMessage';

interface DashboardLabel {
  id?: number | string;
  name: string;
  color: string;
  description?: string | null;
}

const props = defineProps<{
  labels: DashboardLabel[];
  canEditLabels: boolean;
  repoInfo: { owner: string; repo: string } | null;
  issueNumber?: number | null;
}>();

const emit = defineEmits<{
  (e: 'update:labels', labels: DashboardLabel[]): void;
  (e: 'update:is-label-editor-visible', isVisible: boolean): void;
}>();

const { t } = useI18n();
const apiFetch = useGitPulseApiFetch();
const { openModal, closeModal } = useModalState();

const isLabelEditorVisible = ref(false);
const loadingLabels = ref(false);
const savingLabels = ref(false);
const repoLabels = ref<DashboardLabel[]>([]);
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

watch(
  () => props.labels,
  (newLabels) => {
    selectedLabels.value = newLabels.map((label) => label.name);
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

    const data = await $fetch<DashboardLabel[]>(`/api/repos/${owner}/${repo}/labels`, {
      method: 'GET',
    });

    repoLabels.value = data || [];

    selectedLabels.value = props.labels.map((label) => label.name);
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
    const data = await apiFetch<DashboardLabel[]>(
      `/api/repos/${owner}/${repo}/issues/${props.issueNumber}/labels`,
      {
        method: 'PUT',
        body: {
          labels: selectedLabels.value,
        },
      }
    );

    if (data) {
      emit('update:labels', data);
    }

    isLabelEditorVisible.value = false;
    emit('update:is-label-editor-visible', false);
    closeModal();
  } catch (err: unknown) {
    console.error('Error saving labels:', err);
    labelError.value = getFetchErrorMessage(err, t('detailLabels.updateFailed'));
    scheduleLabelErrorClear();
  } finally {
    savingLabels.value = false;
  }
};
</script>

<style scoped lang="scss">
@use '~/assets/scss/issue-metadata-editor';

.label-tag {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: 0;
}
</style>
