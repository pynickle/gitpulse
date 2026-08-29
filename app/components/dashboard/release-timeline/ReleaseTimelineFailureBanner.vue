<script setup lang="ts">
import type { FollowedRepository } from '#shared/types/release-follows';

defineProps<{
  unavailableRepos: FollowedRepository[];
  transientRepos: FollowedRepository[];
}>();

const emit = defineEmits<{
  retry: [];
  manage: [];
}>();

const { t } = useI18n();

const repoList = (items: FollowedRepository[]) =>
  items.map((item) => `${item.owner}/${item.name}`).join(', ');
</script>

<template>
  <div class="timeline-failure-banner" role="status">
    <div v-if="unavailableRepos.length > 0" class="timeline-failure-banner__section">
      <p class="timeline-failure-banner__title">
        {{ t('releaseTimeline.bannerUnavailableTitle') }}
      </p>
      <p class="timeline-failure-banner__body">
        {{
          t('releaseTimeline.bannerUnavailableDescription', {
            repos: repoList(unavailableRepos),
          })
        }}
      </p>
    </div>

    <div v-if="transientRepos.length > 0" class="timeline-failure-banner__section">
      <p class="timeline-failure-banner__title">
        {{ t('releaseTimeline.bannerTransientTitle') }}
      </p>
      <p class="timeline-failure-banner__body">
        {{
          t('releaseTimeline.bannerTransientDescription', {
            repos: repoList(transientRepos),
          })
        }}
      </p>
    </div>

    <div class="timeline-failure-banner__actions">
      <button class="button is-small is-danger is-outlined" type="button" @click="emit('retry')">
        {{ t('releaseTimeline.retry') }}
      </button>
      <button class="button is-small is-ghost" type="button" @click="emit('manage')">
        {{ t('releaseTimeline.bannerManage') }}
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.timeline-failure-banner {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  gap: 0.75rem;
  margin: 0.75rem 1rem 0;
  padding: 0.85rem 1rem;
  border: 1px solid color-mix(in srgb, var(--gitpulse-danger) 24%, var(--gitpulse-border));
  border-radius: var(--gitpulse-radius-md, 8px);
  background: var(--gitpulse-danger-soft);
}

.timeline-failure-banner__section {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.timeline-failure-banner__title {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--gitpulse-text-strong);
}

.timeline-failure-banner__body {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.45;
  color: var(--gitpulse-text);
}

.timeline-failure-banner__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
</style>
