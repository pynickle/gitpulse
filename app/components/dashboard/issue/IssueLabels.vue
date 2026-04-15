<template>
  <div class="mb-4">
    <div class="is-flex is-align-items-center mb-3">
      <h3 class="title is-6 mb-0 mr-2">{{ t('issueDetail.labels') }}</h3>
      <button
        v-if="canEditLabels"
        @click="toggleLabelEditor"
        class="button is-small is-text has-text-grey p-1"
        :title="t('issueDetail.editLabels')"
      >
        <BoltIcon :size="16" />
      </button>
    </div>
    <div class="is-flex is-flex-wrap-wrap mb-4">
      <span
        v-for="label in labels"
        :key="label.id || label.name"
        class="tag mr-2 mb-2 has-text-weight-medium"
        :style="{
          backgroundColor: `#${label.color}`,
          color: `#${getTextColorFromBackground(label.color)}`,
        }"
      >
        {{ label.name }}
      </span>
      <span v-if="labels.length === 0" class="has-text-grey is-size-7">
        {{ t('issueDetail.noLabels') }}
      </span>
    </div>

    <!-- Label editor modal -->
    <div class="modal" :class="{ 'is-active': isLabelEditorVisible }">
      <div class="modal-background" @click="toggleLabelEditor"></div>
      <div class="modal-card">
        <header class="modal-card-head">
          <p class="modal-card-title">{{ t('issueDetail.editLabels') }}</p>
          <button
            class="delete"
            @click="toggleLabelEditor"
            aria-label="close"
            :disabled="savingLabels"
          ></button>
        </header>
        <section class="modal-card-body">
          <div v-if="labelError" class="notification is-danger is-light mb-4 py-2 px-3">
            <button class="delete is-small" @click="labelError = ''"></button>
            <p class="is-size-7">{{ labelError }}</p>
          </div>
          <div
            v-if="loadingLabels"
            class="is-flex is-justify-content-center is-align-items-center py-8"
          >
            <LoadingIcon class="mr-2" />
            <span class="has-text-grey">{{ t('issueDetail.loading') }}</span>
          </div>
          <div v-else>
            <div class="mb-4">
              <p class="is-size-7 has-text-grey mb-3">
                {{ t('issueDetail.selectLabels') }}
              </p>
              <div class="space-y-4 max-h-96 overflow-y-auto">
                <div
                  v-for="label in repoLabels"
                  :key="label.id || label.name"
                  class="is-flex is-align-items-center p-2 hover:bg-gray-50 rounded"
                >
                  <input
                    type="checkbox"
                    :id="`label-${label.name}`"
                    :checked="selectedLabels.includes(label.name)"
                    @change="toggleLabel(label.name)"
                    class="mr-3"
                    style="width: 16px; height: 16px"
                  />
                  <label :for="`label-${label.name}`" class="is-flex is-align-items-center">
                    <span
                      class="tag mr-3"
                      :style="{
                        backgroundColor: `#${label.color}`,
                        color: `#${getTextColorFromBackground(label.color)}`,
                      }"
                    >
                      {{ label.name }}
                    </span>
                    <span
                      v-if="label.description"
                      class="is-size-7 has-text-grey has-text-weight-medium"
                      >{{ label.description }}</span
                    >
                  </label>
                </div>
                <div v-if="repoLabels.length === 0" class="has-text-grey is-size-7 py-4">
                  {{ t('issueDetail.noLabelsAvailable') }}
                </div>
              </div>
            </div>
          </div>
        </section>
        <footer class="modal-card-foot">
          <button class="button is-light" @click="toggleLabelEditor" :disabled="savingLabels">
            {{ t('issueDetail.cancel') }}
          </button>
          <button
            class="button is-primary ml-4"
            @click="saveLabels"
            :disabled="loadingLabels || savingLabels"
          >
            <span v-if="savingLabels" class="is-flex is-align-items-center">
              <LoadingIcon class="mr-2" :size="14" />
              {{ t('issueDetail.saving') }}
            </span>
            <span v-else>{{ t('issueDetail.save') }}</span>
          </button>
        </footer>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { BoltIcon } from 'lucide-vue-next';
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import LoadingIcon from '~/components/ui/LoadingIcon.vue';

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

// State variables
const isLabelEditorVisible = ref(false);
const loadingLabels = ref(false);
const savingLabels = ref(false);
const repoLabels = ref<any[]>([]);
const selectedLabels = ref<string[]>([]);
const labelError = ref<string>('');

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
    isLabelEditorVisible.value = !isLabelEditorVisible.value;
    emit('update:is-label-editor-visible', isLabelEditorVisible.value);
    if (isLabelEditorVisible.value) {
      await fetchRepoLabels();
    }
  }
};

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
  labelError.value = '';

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

    // Close the editor
    isLabelEditorVisible.value = false;
    emit('update:is-label-editor-visible', false);
  } catch (err: any) {
    console.error('Error saving labels:', err);
    labelError.value = err.message || t('issueDetail.failedToUpdateLabels');
    setTimeout(() => {
      labelError.value = '';
    }, 5000);
  } finally {
    savingLabels.value = false;
  }
};
</script>
