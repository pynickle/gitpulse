<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import type { PullRequestStack } from '#shared/types/pulls';
import PickerModal from '~/components/dashboard/PickerModal.vue';

const { stack } = defineProps<{ stack: PullRequestStack }>();
const emit = defineEmits<{
  close: [];
  select: [pullNumber: number];
}>();
const { t } = useI18n();

const rows = computed(() =>
  stack.layers.map((layer, index) => {
    const current = index === stack.place - 1;
    const parts = [`#${layer.number}`];
    if (layer.title) parts.push(layer.title);
    parts.push(t(`prReview.stackDetail.state.${layer.state}`));
    if (current) parts.push(t('prReview.stackDetail.current'));
    return { number: layer.number, current, label: parts.join(' ') };
  })
);
</script>

<template>
  <PickerModal
    :is-visible="true"
    :title="t('prReview.stackDetail.title')"
    :close-label="t('prReview.stackDetail.close')"
    @close="emit('close')"
  >
    <p class="pr-stack-detail__trunk">{{ stack.trunk }}</p>
    <ul class="pr-stack-detail__layers" data-picker-list>
      <li v-for="row in rows" :key="row.number">
        <div
          v-if="row.current"
          class="pr-stack-detail__layer pr-stack-detail__layer--current"
          aria-current="true"
        >
          {{ row.label }}
        </div>
        <button
          v-else
          type="button"
          class="pr-stack-detail__layer pr-stack-detail__layer--action"
          data-picker-row
          @click="emit('select', row.number)"
        >
          {{ row.label }}
        </button>
      </li>
    </ul>
  </PickerModal>
</template>

<style scoped lang="scss">
@use '~/assets/scss/pointer' as *;

.pr-stack-detail__trunk {
  margin: 0 0.5rem 0.35rem;
  color: var(--gitpulse-text-strong);
  font-size: 0.8125rem;
  font-weight: 700;
}

.pr-stack-detail__layers {
  margin: 0;
  padding: 0;
  list-style: none;
}

.pr-stack-detail__layer {
  display: flex;
  width: 100%;
  padding: 0.45rem 0.5rem;
  border: 0;
  background: transparent;
  color: var(--gitpulse-text);
  font: inherit;
  font-size: 0.875rem;
  text-align: start;
}

.pr-stack-detail__layer--current {
  font-weight: 700;
}

.pr-stack-detail__layer--action {
  cursor: pointer;

  @include hover-only {
    &:hover {
      background: var(--gitpulse-surface-hover);
    }
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring, var(--gitpulse-accent));
    outline-offset: -2px;
  }
}
</style>
