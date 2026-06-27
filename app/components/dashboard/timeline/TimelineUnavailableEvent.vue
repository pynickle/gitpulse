<template>
  <span class="timeline-unavailable">
    <span class="timeline-unavailable__label">{{ eventLabel }}</span>
    <span class="timeline-unavailable__icon" role="img" :aria-label="t('timeline.unavailable')">
      <InfoIcon :size="12" />
      <span class="timeline-unavailable__tooltip">{{ reasonText }}</span>
    </span>
  </span>
</template>

<script setup lang="ts">
import { InfoIcon } from '@lucide/vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
  eventType: string;
  reasonCode: string;
  scope: 'issue' | 'pull';
}>();

const { t } = useI18n();

const eventLabel = computed(() => {
  const scopeSuffix = props.scope === 'pull' ? 'PR' : 'issue';
  switch (props.eventType) {
    case 'mentioned':
      return `mentioned this ${scopeSuffix}`;
    case 'blocking_added':
      return 'added a blocking relationship';
    case 'blocking_removed':
      return 'removed a blocking relationship';
    case 'blocked_by_added':
      return 'was marked as blocked by another issue';
    case 'blocked_by_removed':
      return 'was unmarked as blocked by another issue';
    default:
      return props.eventType.replace(/_/g, ' ');
  }
});

const reasonText = computed(() => t(`timeline.unavailableReason_${props.reasonCode}`));
</script>

<style scoped lang="scss">
.timeline-unavailable {
  &__label {
    color: var(--bulma-grey);
  }

  &__icon {
    position: relative;
    display: inline-flex;
    align-items: center;
    margin-left: 0.25rem;
    cursor: help;
    color: var(--bulma-grey-light);
    vertical-align: middle;

    &:hover {
      color: var(--bulma-grey);
    }
  }

  &__tooltip {
    display: none;
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    background: hsl(0, 0%, 21%);
    color: hsl(0, 0%, 96%);
    padding: 0.5rem 0.75rem;
    border-radius: 4px;
    font-size: 0.75rem;
    line-height: 1.4;
    width: max-content;
    max-width: 280px;
    z-index: 100;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    pointer-events: none;
    white-space: normal;

    &::after {
      content: '';
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      border: 5px solid transparent;
      border-top-color: hsl(0, 0%, 21%);
    }
  }

  &__icon:hover &__tooltip {
    display: block;
  }
}
</style>
