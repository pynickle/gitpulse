<script setup lang="ts">
import { FlaskConicalIcon, Loader2Icon, PackageIcon } from '@lucide/vue';
import { computed } from 'vue';

import type { TimelineRelease } from '#shared/types/release-follows';
import ReleaseTimelineReactionBar from '~/components/dashboard/release-timeline/ReleaseTimelineReactionBar.vue';
import MarkdownRenderer from '~/components/ui/MarkdownRenderer.vue';

const props = defineProps<{
  item: TimelineRelease;
  expandedBody?: string | null;
  expanding?: boolean;
  expandError?: string | null;
}>();

const emit = defineEmits<{
  open: [item: TimelineRelease];
  expand: [item: TimelineRelease];
}>();

const { locale, t } = useI18n();
const relativeTimeNow = useRelativeTimeNow();
const { openRepository } = useDashboardRepositoryNavigation();

const expanded = computed(() => props.expandedBody != null);

const repoFullName = computed(() => `${props.item.repository.owner}/${props.item.repository.name}`);
const releasedAtLabel = computed(() =>
  formatDurationFromNow(props.item.publishedAt, locale.value, relativeTimeNow.value)
);
const assetsCountLabel = computed(() =>
  t('releaseDetail.assetCount', { count: props.item.assetCount })
);
const showReadMore = computed(() => props.item.changelogTruncated && !expanded.value);
const showSummary = computed(() => Boolean(props.item.changelog) && !expanded.value);

const handleOpenRepo = async () => {
  await openRepository(props.item.repository.owner, props.item.repository.name);
};

const handleOpenDrawer = () => {
  emit('open', props.item);
};

const handleCardClick = (event: MouseEvent) => {
  if (!shouldOpenReleaseDrawer(event.target)) return;
  handleOpenDrawer();
};

const handleReadMore = () => {
  if (expanded.value || props.expanding) return;
  emit('expand', props.item);
};
</script>

<template>
  <article class="release-timeline-card" @click="handleCardClick">
    <div class="release-timeline-card__header">
      <button
        class="release-timeline-card__repo"
        type="button"
        data-release-drawer-ignore
        :title="t('releaseTimeline.openRepo', { repo: repoFullName })"
        @click.stop="handleOpenRepo"
      >
        {{ repoFullName }}
      </button>
      <time class="release-timeline-card__time" :datetime="item.publishedAt">
        {{ releasedAtLabel }}
      </time>
    </div>

    <div class="release-timeline-card__title-row">
      <button class="release-timeline-card__title" type="button" @click.stop="handleOpenDrawer">
        {{ item.title }}
      </button>
      <span v-if="item.isPrerelease" class="release-timeline-card__prerelease">
        <FlaskConicalIcon
          :size="11"
          class="release-timeline-card__prerelease-icon"
          aria-hidden="true"
        />
        <span>{{ t('releaseDetail.prerelease') }}</span>
      </span>
    </div>

    <p v-if="showSummary" class="release-timeline-card__summary">{{ item.changelog }}</p>

    <div v-if="expanded" class="release-timeline-card__expanded">
      <MarkdownRenderer
        v-if="expandedBody"
        :value="expandedBody"
        :repo-owner="item.repository.owner"
        :repo-name="item.repository.name"
      />
      <p v-else class="release-timeline-card__empty-body">{{ t('releaseDetail.noDescription') }}</p>
    </div>

    <button
      v-if="showReadMore"
      class="release-timeline-card__read-more"
      type="button"
      data-release-drawer-ignore
      :disabled="expanding"
      @click.stop="handleReadMore"
    >
      <Loader2Icon v-if="expanding" :size="14" class="spin-animation" aria-hidden="true" />
      <span>{{ t('releaseTimeline.readMore') }}</span>
    </button>
    <p v-if="expandError" class="release-timeline-card__expand-error">{{ expandError }}</p>

    <div class="release-timeline-card__footer">
      <span class="release-timeline-card__assets" :title="assetsCountLabel">
        <PackageIcon :size="13" aria-hidden="true" />
        <span>{{ assetsCountLabel }}</span>
      </span>
      <p v-if="item.isOldestShown" class="release-timeline-card__oldest">
        {{ t('releaseTimeline.oldestShown') }}
      </p>
    </div>

    <ReleaseTimelineReactionBar :item="item" />
  </article>
</template>

<style scoped lang="scss">
.release-timeline-card {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.45rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 0.75rem;
  background: var(--gitpulse-surface);
  cursor: pointer;
}

.release-timeline-card__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  min-width: 0;
}

.release-timeline-card__repo {
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--gitpulse-link);
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1.3;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.release-timeline-card__repo:hover,
.release-timeline-card__repo:focus-visible {
  text-decoration: underline;
}

.release-timeline-card__repo:focus-visible {
  outline: 2px solid var(--gitpulse-info);
  outline-offset: 2px;
}

.release-timeline-card__time {
  flex-shrink: 0;
  color: var(--gitpulse-text-muted);
  font-size: 0.75rem;
  white-space: nowrap;
}

.release-timeline-card__title-row {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 0.4rem 0.55rem;
}

.release-timeline-card__title {
  margin: 0;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--gitpulse-text-strong);
  font-size: 0.98rem;
  font-weight: 650;
  line-height: 1.3;
  text-align: left;
  overflow-wrap: anywhere;
  cursor: pointer;
}

.release-timeline-card__title:focus-visible {
  outline: 2px solid var(--gitpulse-info);
  outline-offset: 2px;
}

.release-timeline-card__prerelease {
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  flex-shrink: 0;
  padding: 0.12rem 0.45rem 0.12rem 0.35rem;
  border: 1px solid color-mix(in srgb, var(--gitpulse-info) 22%, transparent);
  border-radius: 0.35rem;
  background: var(--gitpulse-info-soft);
  color: var(--gitpulse-info);
  font-size: 0.68rem;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: 0.01em;
  white-space: nowrap;
}

.release-timeline-card__prerelease-icon {
  flex-shrink: 0;
}

.release-timeline-card__summary {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: var(--gitpulse-text-muted);
  font-size: 0.82rem;
  line-height: 1.45;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.release-timeline-card__expanded {
  min-width: 0;
  color: var(--gitpulse-text);
  font-size: 0.85rem;
}

.release-timeline-card__empty-body {
  margin: 0;
  color: var(--gitpulse-text-muted);
  font-size: 0.82rem;
}

.release-timeline-card__read-more {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: 0.3rem;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--gitpulse-link);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
}

.release-timeline-card__read-more:hover,
.release-timeline-card__read-more:focus-visible {
  text-decoration: underline;
}

.release-timeline-card__read-more:focus-visible {
  outline: 2px solid var(--gitpulse-info);
  outline-offset: 2px;
}

.release-timeline-card__read-more:disabled {
  cursor: progress;
  text-decoration: none;
}

.release-timeline-card__expand-error {
  margin: 0;
  color: var(--gitpulse-danger);
  font-size: 0.75rem;
}

.release-timeline-card__footer {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 0.35rem 0.75rem;
  margin-top: auto;
  padding-top: 0.2rem;
}

.release-timeline-card__assets {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--gitpulse-text-muted);
  font-size: 0.75rem;
}

.release-timeline-card__oldest {
  margin: 0;
  color: var(--gitpulse-text-muted);
  font-size: 0.72rem;
  line-height: 1.4;
}

.spin-animation {
  animation: release-timeline-spin 1s linear infinite;
}

@keyframes release-timeline-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
