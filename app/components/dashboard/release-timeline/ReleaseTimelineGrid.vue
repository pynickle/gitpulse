<script setup lang="ts">
import type { ReleaseTimelineGroup } from '#shared/types/release-follows';
import ReleaseTimelineCard from '~/components/dashboard/release-timeline/ReleaseTimelineCard.vue';

defineProps<{
  groups: ReleaseTimelineGroup[];
}>();
</script>

<template>
  <div class="release-timeline-grid">
    <template v-for="group in groups" :key="group.date">
      <div class="release-timeline-date">
        <span class="release-timeline-date__rule" aria-hidden="true" />
        <time class="release-timeline-date__label" :datetime="group.date">{{ group.date }}</time>
        <span class="release-timeline-date__rule" aria-hidden="true" />
      </div>
      <ReleaseTimelineCard
        v-for="item in group.items"
        :key="`${item.repository.id}:${item.id}`"
        :item="item"
      />
    </template>
  </div>
</template>

<style scoped lang="scss">
.release-timeline-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.9rem 1rem;
  width: 100%;
  padding: 1rem 1.25rem 1.5rem;
}

.release-timeline-date {
  display: flex;
  grid-column: 1 / -1;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.release-timeline-date__rule {
  flex: 1;
  height: 1px;
  background: var(--gitpulse-border);
}

.release-timeline-date__label {
  flex-shrink: 0;
  color: var(--gitpulse-text-muted);
  font-size: 0.8rem;
  font-weight: 650;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

@media (max-width: 1100px) {
  .release-timeline-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 700px) {
  .release-timeline-grid {
    grid-template-columns: minmax(0, 1fr);
    padding: 0.85rem 0.9rem 1.25rem;
  }
}
</style>
