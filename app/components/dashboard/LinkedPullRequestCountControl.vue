<script setup lang="ts">
import { GitPullRequestIcon } from '@lucide/vue';
import { computed } from 'vue';

const props = defineProps<{
  count: number;
}>();

const emit = defineEmits<{
  click: [];
}>();

const { locale, t } = useI18n();

const countLabel = computed(() => formatCompactNumber(props.count, locale.value));
const accessibleName = computed(() =>
  t('dashboard.linkedPullRequests.count', { count: props.count })
);

const handleClick = (event: MouseEvent) => {
  event.stopPropagation();
  emit('click');
};

const handleKeydown = (event: KeyboardEvent) => {
  event.stopPropagation();
};
</script>

<template>
  <button
    class="notification-card__linked-prs"
    type="button"
    :title="accessibleName"
    :aria-label="accessibleName"
    @click="handleClick"
    @keydown="handleKeydown"
  >
    <GitPullRequestIcon :size="12" aria-hidden="true" />
    <span>{{ countLabel }}</span>
  </button>
</template>

<style scoped lang="scss">
.notification-card__linked-prs {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0;
  border: none;
  background: transparent;
  vertical-align: -0.05em;
  color: var(--gitpulse-text-muted, #6b7280);
  font: inherit;
  cursor: pointer;

  &:hover {
    color: var(--gitpulse-text);
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring, var(--gitpulse-accent));
    outline-offset: 2px;
    border-radius: 4px;
  }
}
</style>
