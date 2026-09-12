<script setup lang="ts">
import { CalendarIcon, PackageIcon, TagIcon } from '@lucide/vue';
import { computed } from 'vue';
import { GitHubIcon } from 'vue3-simple-icons';

import type { TimelineRelease } from '#shared/types/release-follows';
import type { ReleaseDetailPayload } from '#shared/types/releases';
import ReleaseTimelineReactionBar from '~/components/dashboard/release-timeline/ReleaseTimelineReactionBar.vue';
import ReleaseAssetsList from '~/components/dashboard/releases/ReleaseAssetsList.vue';
import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';
import MarkdownRenderer from '~/components/ui/MarkdownRenderer.vue';

const props = defineProps<{
  item: TimelineRelease;
  detail: ReleaseDetailPayload;
}>();

const emit = defineEmits<{
  'open-release': [];
}>();

const { locale, t } = useI18n();
const relativeTimeNow = useRelativeTimeNow();

const repoOwner = computed(() => props.item.repository.owner);
const repoName = computed(() => props.item.repository.name);
const releaseTitle = computed(
  () => props.detail.name?.trim() || props.detail.tag_name || props.item.title
);
const tagName = computed(() => props.detail.tag_name || props.item.tagName);
const isPrerelease = computed(() => Boolean(props.detail.prerelease || props.item.isPrerelease));
const releasedAt = computed(
  () => props.detail.published_at || props.item.publishedAt || props.detail.created_at || ''
);
const releasedAtLabel = computed(() =>
  releasedAt.value
    ? formatDurationFromNow(releasedAt.value, locale.value, relativeTimeNow.value)
    : t('releaseDetail.unpublished')
);
const body = computed(() => props.detail.body?.trim() || '');
const assets = computed(() => props.detail.assets ?? []);
const githubUrl = computed(() => props.detail.html_url || props.item.htmlUrl || '');
const author = computed(() => props.detail.author ?? null);
</script>

<template>
  <div class="release-drawer-body">
    <header class="release-drawer-body__header">
      <div class="release-drawer-body__tag-row">
        <span class="release-drawer-body__tag">
          <TagIcon :size="14" aria-hidden="true" />
          <span>{{ tagName }}</span>
        </span>
        <span v-if="isPrerelease" class="tag is-info is-light">
          {{ t('releaseDetail.prerelease') }}
        </span>
      </div>

      <button
        class="release-drawer-body__title"
        type="button"
        :title="t('releaseTimeline.openRelease')"
        @click="emit('open-release')"
      >
        {{ releaseTitle }}
      </button>

      <div class="release-drawer-body__meta">
        <span v-if="author?.login" class="release-drawer-body__meta-item">
          <GitHubAvatar :src="author.avatar_url" :alt="author.login" :size="18" />
          <span>{{ author.login }}</span>
        </span>
        <span v-if="author?.login && releasedAt" class="release-drawer-body__separator">·</span>
        <span v-if="releasedAt" class="release-drawer-body__meta-item">
          <CalendarIcon :size="14" aria-hidden="true" />
          <span>{{ releasedAtLabel }}</span>
        </span>
        <span
          v-if="githubUrl && (author?.login || releasedAt)"
          class="release-drawer-body__separator"
        >
          ·
        </span>
        <a
          v-if="githubUrl"
          class="release-drawer-body__github"
          :href="githubUrl"
          target="_blank"
          rel="noopener noreferrer"
          :aria-label="t('releaseDetail.openOnGitHub')"
          :title="t('releaseDetail.openOnGitHub')"
        >
          <GitHubIcon :size="14" aria-hidden="true" />
        </a>
      </div>
    </header>

    <article class="release-drawer-body__changelog">
      <MarkdownRenderer v-if="body" :value="body" :repo-owner="repoOwner" :repo-name="repoName" />
      <p v-else class="release-drawer-body__empty">{{ t('releaseDetail.noDescription') }}</p>
    </article>

    <ReleaseTimelineReactionBar :item="item" />

    <section class="release-drawer-body__section" :aria-label="t('releaseDetail.assets')">
      <div class="release-drawer-body__section-header">
        <span class="release-drawer-body__section-title">
          <PackageIcon :size="14" aria-hidden="true" />
          <span>{{ t('releaseDetail.assets') }}</span>
        </span>
        <span class="release-drawer-body__section-count">
          {{ t('releaseDetail.assetCount', { count: assets.length }) }}
        </span>
      </div>

      <ReleaseAssetsList :assets="assets" />
    </section>
  </div>
</template>

<style scoped lang="scss">
.release-drawer-body {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 1.15rem;
}

.release-drawer-body__header {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.65rem;
}

.release-drawer-body__tag-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.release-drawer-body__tag {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  min-width: 0;
  color: var(--gitpulse-text-muted);
  font-size: 0.82rem;
  font-weight: 650;
}

.release-drawer-body__title {
  margin: 0;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--gitpulse-text-strong);
  font-size: 1.2rem;
  font-weight: 700;
  line-height: 1.3;
  text-align: left;
  overflow-wrap: anywhere;
  cursor: pointer;
}

.release-drawer-body__title:hover,
.release-drawer-body__title:focus-visible {
  color: var(--gitpulse-link);
}

.release-drawer-body__title:focus-visible {
  outline: 2px solid var(--gitpulse-info);
  outline-offset: 2px;
}

.release-drawer-body__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem 0.5rem;
  color: var(--gitpulse-text-muted);
  font-size: 0.85rem;
}

.release-drawer-body__meta-item {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
}

.release-drawer-body__separator {
  opacity: 0.5;
}

.release-drawer-body__github {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 999px;
  color: var(--gitpulse-text-muted);
}

.release-drawer-body__github:hover,
.release-drawer-body__github:focus-visible {
  color: var(--gitpulse-text-strong);
  background: var(--gitpulse-surface-hover, var(--gitpulse-info-soft));
}

.release-drawer-body__github:focus-visible {
  outline: 2px solid var(--gitpulse-info);
  outline-offset: 2px;
}

.release-drawer-body__changelog {
  min-width: 0;
  overflow-wrap: anywhere;
}

.release-drawer-body__empty {
  margin: 0;
  color: var(--gitpulse-text-muted);
  font-size: 0.88rem;
}

.release-drawer-body__section {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.65rem;
}

.release-drawer-body__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.release-drawer-body__section-title {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--gitpulse-text-strong);
  font-size: 0.85rem;
  font-weight: 650;
}

.release-drawer-body__section-count {
  color: var(--gitpulse-text-muted);
  font-size: 0.75rem;
}
</style>
