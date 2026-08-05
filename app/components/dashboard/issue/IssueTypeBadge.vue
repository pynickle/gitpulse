<template>
  <span
    class="issue-type-badge"
    :class="{ 'issue-type-badge--tag': variant === 'tag' }"
    :style="badgeStyle"
  >
    {{ name }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import resolveIssueTypeColor from '~/utils/issueTypeColor';

const props = withDefaults(
  defineProps<{
    name: string;
    color?: string | null;
    variant?: 'underline' | 'tag';
  }>(),
  {
    color: null,
    variant: 'underline',
  }
);

const badgeStyle = computed(() => ({
  '--issue-type-color': resolveIssueTypeColor(props.color),
}));
</script>

<style scoped lang="scss">
.issue-type-badge {
  display: inline-block;
  flex: 0 0 auto;
  max-width: 100%;
  padding-bottom: 1px;
  border-bottom: 2px solid var(--issue-type-color);
  color: var(--gitpulse-text-strong);
  font-size: 0.62rem;
  font-weight: 650;
  line-height: 1.4;
  letter-spacing: 0;
  overflow-wrap: anywhere;
  white-space: normal;
}

.issue-type-badge--tag {
  display: inline-flex;
  align-items: center;
  padding: 3px 9px;
  border: 1px solid var(--issue-type-color);
  border-radius: 20px;
  background: color-mix(in srgb, var(--issue-type-color) 10%, var(--gitpulse-surface));
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
}
</style>
