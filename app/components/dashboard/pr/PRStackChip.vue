<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import type { PullRequestStack } from '#shared/types/pulls';

defineProps<{
  stack?: PullRequestStack | null;
}>();

const { t } = useI18n();
</script>

<template>
  <span v-if="stack" class="pr-stack-chip">{{
    t('prReview.stackChip.place', { place: stack.place, count: stack.count })
  }}</span>
</template>

<style scoped lang="scss">
.pr-stack-chip {
  flex: none;
  padding: 0.15rem 0.55rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 999px;
  background: var(--gitpulse-surface-muted);
  color: var(--gitpulse-text-muted);
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.4;
  white-space: nowrap;
}
</style>
