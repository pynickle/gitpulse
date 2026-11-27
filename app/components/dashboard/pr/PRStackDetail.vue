<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import type { PullRequestStack } from '#shared/types/pulls';
import PickerModal from '~/components/dashboard/PickerModal.vue';
import PRStackLayerList from '~/components/dashboard/pr/PRStackLayerList.vue';

defineProps<{
  stack: PullRequestStack;
  currentPullNumber?: number;
}>();

const emit = defineEmits<{
  close: [];
  select: [pullNumber: number];
}>();

const { t } = useI18n();
</script>

<template>
  <PickerModal
    :is-visible="true"
    :title="t('prReview.stackDetail.title')"
    :close-label="t('prReview.stackDetail.close')"
    :empty-label="!stack.layers.length ? t('prReview.stackDetail.unavailable') : undefined"
    @close="emit('close')"
  >
    <PRStackLayerList
      :stack="stack"
      :current-pull-number="currentPullNumber"
      picker-mode
      @select="emit('select', $event)"
    />
  </PickerModal>
</template>
