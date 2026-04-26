<script setup lang="ts">
import type { DashboardTab } from '~/composables/useDashboardTabs';

const props = defineProps<{
  currentTab: DashboardTab;
}>();

const skeletonCardCount = 5;
</script>

<template>
  <div class="dashboard-loading-list" aria-busy="true" aria-live="polite">
    <div class="dashboard-loading-list__pagination-spacer" aria-hidden="true" />

    <SimpleBar class="dashboard-loading-list__scroll">
      <div
        v-for="index in skeletonCardCount"
        :key="`${props.currentTab}-loading-card-${index}`"
        class="mb-4 mr-4"
      >
        <div
          class="card dashboard-list-card dashboard-loading-card"
          :class="
            props.currentTab === 'repos'
              ? 'dashboard-list-card--repo'
              : 'dashboard-list-card--activity'
          "
        >
          <div class="card-content p-3" :class="{ 'pl-4': props.currentTab === 'repos' }">
            <div class="media mb-2">
              <div v-if="props.currentTab !== 'repos'" class="media-left ml-2 mt-2">
                <span class="dashboard-loading-card__icon" />
              </div>

              <div class="media-content">
                <div class="is-flex is-justify-content-space-between is-align-items-center">
                  <span class="dashboard-loading-card__line dashboard-loading-card__line--title" />
                  <span class="dashboard-loading-card__pill" />
                </div>

                <div
                  v-if="props.currentTab === 'notifications'"
                  class="dashboard-loading-card__line dashboard-loading-card__line--subtitle mt-2"
                />

                <div v-else class="dashboard-loading-card__tags mt-2">
                  <span class="dashboard-loading-card__tag" />
                  <span class="dashboard-loading-card__tag dashboard-loading-card__tag--short" />
                </div>
              </div>
            </div>

            <div v-if="props.currentTab === 'repos'" class="dashboard-loading-card__stats">
              <span class="dashboard-loading-card__metric" />
              <span class="dashboard-loading-card__metric" />
              <span class="dashboard-loading-card__metric" />
            </div>

            <div v-else class="ml-2 dashboard-loading-card__footer">
              <span class="dashboard-loading-card__line dashboard-loading-card__line--footer" />
            </div>
          </div>
        </div>
      </div>
    </SimpleBar>
  </div>
</template>

<style scoped lang="scss" src="~/assets/scss/card.scss" />
<style scoped lang="scss">
.dashboard-loading-list {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  width: 100%;
  height: calc(100vh - 12rem);
  min-height: 0;
  flex: 1;
  gap: 0.85rem;
}

.dashboard-loading-list__pagination-spacer {
  width: 100%;
  height: 40px;
  flex-shrink: 0;
}

.dashboard-loading-list__scroll {
  min-height: 0;
  height: 100%;
}

.dashboard-loading-card {
  overflow: hidden;
  background:
    radial-gradient(circle at top left, rgba(62, 142, 208, 0.12), transparent 36%),
    linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(250, 252, 255, 0.92));
}

.dashboard-loading-card__icon,
.dashboard-loading-card__line,
.dashboard-loading-card__pill,
.dashboard-loading-card__tag,
.dashboard-loading-card__metric {
  display: block;
  overflow: hidden;
  position: relative;
  border-radius: 999px;
  background: linear-gradient(90deg, #eef3f8 0%, #f8fbff 42%, #e7eef6 74%);
  background-size: 220% 100%;
  animation: dashboard-loading-shimmer 1.35s ease-in-out infinite;
}

.dashboard-loading-card__icon {
  width: 24px;
  height: 24px;
}

.dashboard-loading-card__line--title {
  width: min(62%, 18rem);
  height: 1.25rem;
  border-radius: 0.5rem;
}

.dashboard-loading-card__line--subtitle {
  width: 42%;
  height: 0.875rem;
  border-radius: 0.45rem;
}

.dashboard-loading-card__line--footer {
  width: 38%;
  height: 0.875rem;
  border-radius: 0.45rem;
}

.dashboard-loading-card__pill {
  width: 3rem;
  height: 1.5rem;
}

.dashboard-loading-card__tags,
.dashboard-loading-card__stats,
.dashboard-loading-card__footer {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.dashboard-loading-card__tag {
  width: 5.25rem;
  height: 1.5rem;
}

.dashboard-loading-card__tag--short {
  width: 3.5rem;
}

.dashboard-loading-card__metric {
  width: 3.25rem;
  height: 0.875rem;
}

@keyframes dashboard-loading-shimmer {
  from {
    background-position: 120% 0;
  }

  to {
    background-position: -120% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .dashboard-loading-card__icon,
  .dashboard-loading-card__line,
  .dashboard-loading-card__pill,
  .dashboard-loading-card__tag,
  .dashboard-loading-card__metric {
    animation: none;
  }
}
</style>
