<script setup lang="ts">
import { ChevronRightIcon, GitBranchIcon, LayersIcon } from '@lucide/vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import type { PullRequestStack } from '#shared/types/pulls';
import PickerModal from '~/components/dashboard/PickerModal.vue';

const { stack, currentPullNumber } = defineProps<{
  stack: PullRequestStack;
  currentPullNumber?: number;
}>();
const emit = defineEmits<{
  close: [];
  select: [pullNumber: number];
}>();
const { t } = useI18n();
const layers = computed(() => {
  const hasPullNumberMatch =
    currentPullNumber !== undefined &&
    stack.layers.some((layer) => layer.number === currentPullNumber);
  return stack.layers.map((layer, index) => ({
    ...layer,
    current: hasPullNumberMatch ? layer.number === currentPullNumber : index + 1 === stack.place,
  }));
});
</script>

<template>
  <PickerModal
    :is-visible="true"
    :title="t('prReview.stackDetail.title')"
    :close-label="t('prReview.stackDetail.close')"
    :empty-label="!layers.length ? t('prReview.stackDetail.unavailable') : undefined"
    @close="emit('close')"
  >
    <div class="pr-stack-detail__trunk">
      <GitBranchIcon :size="17" aria-hidden="true" />
      <span>{{ t('prReview.stackDetail.trunk') }}</span>
      <code>{{ stack.trunk }}</code>
    </div>
    <ol v-if="layers.length" class="pr-stack-detail__layers" data-picker-list>
      <li v-for="layer in layers" :key="layer.number" class="pr-stack-detail__row">
        <span class="pr-stack-detail__node" aria-hidden="true">
          <LayersIcon :size="13" />
        </span>
        <component
          :is="layer.current ? 'div' : 'button'"
          :type="layer.current ? undefined : 'button'"
          class="pr-stack-detail__layer"
          :aria-current="layer.current ? 'true' : undefined"
          :data-picker-row="layer.current ? undefined : ''"
          @click="!layer.current && emit('select', layer.number)"
        >
          <span class="pr-stack-detail__content">
            <span class="pr-stack-detail__number">#{{ layer.number }}</span>{{ ' ' }}
            <span class="pr-stack-detail__title">{{ layer.title }}</span>{{ ' ' }}
            <span class="pr-stack-detail__state" :data-state="layer.state">
              {{ t(`prReview.stackDetail.state.${layer.state}`) }}
            </span>
            <template v-if="layer.current">
              {{ ' '
              }}<span class="pr-stack-detail__current">{{
                t('prReview.stackDetail.current')
              }}</span>
            </template>
          </span>
          <ChevronRightIcon v-if="!layer.current" :size="15" aria-hidden="true" />
        </component>
      </li>
    </ol>
  </PickerModal>
</template>

<style scoped lang="scss">
@use '~/assets/scss/pointer' as *;

.pr-stack-detail__trunk {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.2rem 0.32rem;
  color: var(--gitpulse-text-muted);
  font-size: 0.75rem;
}

.pr-stack-detail__trunk code {
  color: var(--gitpulse-text-strong);
  overflow-wrap: anywhere;
}

.pr-stack-detail__layers {
  margin: 0;
  padding: 0;
  list-style: none;
}

.pr-stack-detail__row {
  position: relative;
  display: grid;
  grid-template-columns: 1.75rem minmax(0, 1fr);
  align-items: center;
  gap: 0.5rem;
  padding-top: 0.45rem;

  &::before {
    position: absolute;
    inset: 0 auto 0 0.875rem;
    width: 1px;
    background: var(--gitpulse-border-strong);
    content: '';
  }

  &:last-child::before {
    bottom: 50%;
  }
}

.pr-stack-detail__node {
  z-index: 0;
  display: grid;
  place-items: center;
  justify-self: center;
  width: 1.45rem;
  height: 1.45rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 50%;
  background: var(--gitpulse-surface);
  color: var(--gitpulse-text-muted);
}

.pr-stack-detail__layer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  width: 100%;
  padding: 0.55rem 0.65rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: var(--gitpulse-radius-sm);
  background: var(--gitpulse-surface);
  color: var(--gitpulse-text);
  font: inherit;
  font-size: 0.875rem;
  text-align: start;
}

.pr-stack-detail__content {
  min-width: 0;
  overflow-wrap: anywhere;
}

.pr-stack-detail__title {
  font-weight: 600;
}

.pr-stack-detail__number,
.pr-stack-detail__state,
.pr-stack-detail__current {
  font-size: 0.75rem;
  color: var(--gitpulse-text-muted);
}

.pr-stack-detail__state[data-state='open'] {
  color: var(--gitpulse-success-solid);
}

.pr-stack-detail__state[data-state='merged'] {
  color: var(--gitpulse-info);
}

.pr-stack-detail__current {
  color: var(--gitpulse-accent);
}

.pr-stack-detail__state[data-state='closed'] {
  color: var(--gitpulse-danger-solid);
}

.pr-stack-detail__layer[aria-current='true'] {
  border-color: var(--gitpulse-accent);
  background: var(--gitpulse-accent-soft);
}

button.pr-stack-detail__layer {
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
