<template>
  <div class="sidebar-card mb-4">
    <div class="sidebar-card__header">
      <div class="sidebar-card__header-left">
        <TagIcon :size="14" class="sidebar-card__icon" />
        <span class="sidebar-card__title">{{ t('detailLabels.title') }}</span>
      </div>
      <button
        type="button"
        class="sidebar-card__action"
        :class="{ 'sidebar-card__action--hidden': !canEditLabels }"
        :title="t('detailLabels.edit')"
        :disabled="!canEditLabels"
        @click="toggleLabelEditor"
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
      <p v-else class="sidebar-card__empty">{{ t('detailLabels.empty') }}</p>
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
                type="button"
                class="label-editor-close"
                :disabled="savingLabels"
                @click="toggleLabelEditor"
              >
                <XIcon :size="16" />
              </button>
            </div>

            <ScrollArea class="label-editor-content">
              <div v-if="labelError" class="label-editor-error">
                <CircleExclamationPointIcon :size="14" />
                <span>{{ labelError }}</span>
                <button type="button" class="label-editor-error-dismiss" @click="clearLabelError">
                  <XIcon :size="12" />
                </button>
              </div>

              <div v-if="loadingLabels" class="label-editor-loading">
                <LoaderCircleIcon class="spin-animation" :size="18" />
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
            </ScrollArea>

            <div class="label-editor-footer">
              <button
                type="button"
                class="label-btn-cancel"
                :disabled="savingLabels"
                @click="toggleLabelEditor"
              >
                {{ t('detailLabels.cancel') }}
              </button>
              <button
                type="button"
                class="label-btn-save"
                :disabled="loadingLabels || savingLabels"
                @click="saveLabels"
              >
                <LoaderCircleIcon v-if="savingLabels" class="spin-animation" :size="14" />
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
import {
  CircleExclamationPointIcon,
  CheckIcon,
  LoaderCircleIcon,
  PencilIcon,
  TagIcon,
  XIcon,
} from '@lucide/vue';
import { onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { RepositoryLabel } from '#shared/types/labels';
import ScrollArea from '~/components/ui/ScrollArea.vue';

const { labels, canEditLabels, repoInfo, number } = defineProps<{
  labels: RepositoryLabel[];
  canEditLabels: boolean;
  repoInfo: { owner: string; repo: string } | null;
  number: number | null;
}>();

const emit = defineEmits<{
  (e: 'update:labels', labels: RepositoryLabel[]): void;
}>();

const { t } = useI18n();
const apiFetch = useGitPulseApiFetch();
const { openModal, closeModal } = useModalState();

const isLabelEditorVisible = ref(false);
const loadingLabels = ref(false);
const savingLabels = ref(false);
const repoLabels = ref<RepositoryLabel[]>([]);
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
  () => labels,
  (newLabels) => {
    selectedLabels.value = newLabels.map((label) => label.name);
  },
  { immediate: true }
);

const toggleLabelEditor = async () => {
  if (!canEditLabels) return;

  const willBeVisible = !isLabelEditorVisible.value;
  isLabelEditorVisible.value = willBeVisible;

  if (willBeVisible) {
    openModal();
    await fetchRepoLabels();
    return;
  }

  closeModal();
};

onUnmounted(() => {
  clearLabelErrorTimer();
  if (isLabelEditorVisible.value) {
    closeModal();
  }
});

const fetchRepoLabels = async () => {
  if (!repoInfo || !number) return;

  loadingLabels.value = true;
  selectedLabels.value = [];

  try {
    const { owner, repo } = repoInfo;

    const data = await $fetch<RepositoryLabel[]>(`/api/repos/${owner}/${repo}/labels`, {
      method: 'GET',
    });

    repoLabels.value = data || [];
    selectedLabels.value = labels.map((label) => label.name);
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
  if (!repoInfo) return;

  savingLabels.value = true;
  clearLabelError();

  try {
    const { owner, repo } = repoInfo;
    const data = await apiFetch<RepositoryLabel[]>(
      `/api/repos/${owner}/${repo}/issues/${number}/labels`,
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
@use '~/assets/scss/detail-metadata-editor';

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
