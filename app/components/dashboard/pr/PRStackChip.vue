<script setup lang="ts">
import { LayersIcon } from '@lucide/vue';
import { shallowRef } from 'vue';
import { useI18n } from 'vue-i18n';

import type { PullRequestStack } from '#shared/types/pulls';
import PRStackDetail from '~/components/dashboard/pr/PRStackDetail.vue';

defineProps<{
  stack?: PullRequestStack | null;
}>();

const emit = defineEmits<{
  select: [pullNumber: number];
}>();

const { t } = useI18n();
const open = shallowRef(false);

const choose = (pullNumber: number) => {
  open.value = false;
  emit('select', pullNumber);
};
</script>

<template>
  <span v-if="stack" class="pr-stack-chip-host">
    <button
      type="button"
      class="pr-stack-chip"
      :aria-expanded="open"
      aria-haspopup="dialog"
      @click="open = true"
    >
      <LayersIcon :size="13" aria-hidden="true" />
      {{ t('prReview.stackChip.place', { place: stack.place, count: stack.count }) }}
    </button>
    <PRStackDetail v-if="open" :stack="stack" @close="open = false" @select="choose" />
  </span>
</template>

<style scoped lang="scss">
@use '~/assets/scss/pointer' as *;

.pr-stack-chip-host {
  display: inline-flex;
  flex: none;
}

.pr-stack-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  flex: none;
  padding: 0.15rem 0.55rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 999px;
  background: var(--gitpulse-surface-muted);
  color: var(--gitpulse-text-muted);
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.4;
  white-space: nowrap;
  cursor: pointer;

  @include hover-only {
    &:hover {
      border-color: var(--gitpulse-border-strong);
      color: var(--gitpulse-text);
    }
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring, var(--gitpulse-accent));
    outline-offset: 2px;
  }
}
</style>
