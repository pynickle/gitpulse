<script setup lang="ts">
const { centered = false } = defineProps<{
  centered?: boolean;
}>();

const emit = defineEmits<{
  manage: [];
}>();

const { t } = useI18n();
</script>

<template>
  <div
    class="timeline-failure-banner"
    :class="{ 'timeline-failure-banner--centered': centered }"
    role="status"
  >
    <p class="timeline-failure-banner__text">{{ t('releaseTimeline.unavailableNotice') }}</p>
    <button class="timeline-failure-banner__config" type="button" @click="emit('manage')">
      {{ t('releaseTimeline.bannerManage') }}
    </button>
  </div>
</template>

<style scoped lang="scss">
@use '~/assets/scss/pointer' as *;

.timeline-failure-banner {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem 0.75rem;
  margin: 0.75rem 1rem 0;
  color: var(--gitpulse-text-muted);
  font-size: 0.85rem;
  line-height: 1.45;
}

.timeline-failure-banner--centered {
  flex: 1;
  flex-direction: column;
  justify-content: center;
  gap: 0.75rem;
  width: 100%;
  min-height: 12rem;
  margin: 0;
  padding: clamp(1.5rem, 6vh, 4rem) clamp(1rem, 5vw, 3rem);
  text-align: center;

  .timeline-failure-banner__text {
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--gitpulse-text-strong);
  }
}

.timeline-failure-banner__text {
  margin: 0;
}

.timeline-failure-banner__config {
  display: inline-flex;
  align-items: center;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--gitpulse-text);
  font: inherit;
  font-size: inherit;
  line-height: inherit;
  text-decoration: none;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--gitpulse-accent);
    outline-offset: 3px;
    border-radius: 2px;
  }
}

@include hover-only {
  .timeline-failure-banner__config:hover {
    color: var(--gitpulse-text-strong);
    text-decoration: underline;
    text-underline-offset: 0.18em;
  }
}
</style>
