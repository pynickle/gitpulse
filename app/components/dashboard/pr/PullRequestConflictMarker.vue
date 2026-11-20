<script setup lang="ts">
import { TriangleExclamationPointIcon } from '@lucide/vue';
import { computed } from 'vue';

const { t } = useI18n();
const label = computed(() => t('dashboard.pullRequestConflicts'));
</script>

<template>
  <span class="pr-conflict-marker" role="img" :title="label" :aria-label="label">
    <TriangleExclamationPointIcon class="pr-conflict-marker__icon" :size="14" aria-hidden="true" />
  </span>
</template>

<style scoped lang="scss">
.pr-conflict-marker {
  /* A flex item shrinks by default. The marker must not: the title beside it gives up width first. */
  flex: none;
  display: inline-flex;
  align-items: center;
  align-self: center;
  color: var(--gitpulse-text-muted);
  line-height: 1;
}

.pr-conflict-marker__icon {
  /* An inline svg sits on the text baseline and leaves a gap under the glyph. */
  display: block;
}
</style>
