<script setup lang="ts">
import { ListTreeIcon } from '@lucide/vue';
import { computed } from 'vue';

import type { SubIssueProgress } from '#shared/types/sub-issues';

const { progress } = defineProps<{ progress: SubIssueProgress }>();
const emit = defineEmits<{ open: [] }>();
const { t } = useI18n();
const label = computed(() => t('dashboard.subIssues.progress', { ...progress }));
</script>

<template>
  <button
    type="button"
    class="sub-issue-progress"
    :class="{ 'sub-issue-progress--complete': progress.completed === progress.total }"
    :aria-label="label"
    :title="label"
    aria-haspopup="dialog"
    @click.stop="emit('open')"
    @keydown.stop
  >
    <ListTreeIcon :size="12" aria-hidden="true" />
    {{ progress.completed }}/{{ progress.total }}
  </button>
</template>

<style scoped lang="scss">
@use '~/assets/scss/pointer' as *;

.sub-issue-progress {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0;
  border: 0;
  color: var(--gitpulse-text-muted);
  background: transparent;
  font: inherit;
  vertical-align: -0.05em;
  cursor: pointer;

  @include hover-only {
    &:hover {
      color: var(--gitpulse-text);
    }
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring, var(--gitpulse-accent));
    outline-offset: 2px;
    border-radius: 4px;
  }
}

.sub-issue-progress--complete {
  color: var(--gitpulse-success);
}
</style>
