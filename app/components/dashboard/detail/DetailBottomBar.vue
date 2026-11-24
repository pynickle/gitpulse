<script setup lang="ts">
import {
  FileDiffIcon,
  LockIcon,
  MessageSquarePlusIcon,
  PackageIcon,
  PanelBottomCloseIcon,
  PanelBottomOpenIcon,
  StarIcon,
} from '@lucide/vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { useDetailOverlayChrome } from '~/composables/useDetailOverlayChrome';

const { t } = useI18n();
const { compact, exact } = useCompactCount();
const chrome = useDetailOverlayChrome();

const activePaneType = computed(() => chrome?.activePaneType.value ?? null);
const bottomBar = computed(
  () => chrome?.bottomBar.value ?? { openSheet: null, showBottomBar: false }
);
const openSheet = computed(() => bottomBar.value.openSheet);
const composer = computed(
  () => chrome?.composer.value ?? { available: false, locked: false, hasDraft: false }
);
const metadataCount = computed(() => chrome?.metadataCount.value ?? 0);
const prSummary = computed(() => chrome?.prSummary.value ?? null);
const releaseSummary = computed(() => chrome?.releaseSummary.value ?? null);
const repoSummary = computed(() => chrome?.repoSummary.value ?? null);

const isConversationSubject = computed(
  () =>
    activePaneType.value === 'pull-request' ||
    activePaneType.value === 'issue' ||
    activePaneType.value === 'discussion'
);

const isComposerDisabled = computed(() => !composer.value.available || composer.value.locked);
const releaseAssetCount = computed(() => releaseSummary.value?.assetCount ?? 0);

const toggleComposer = () => {
  chrome?.dispatch({ type: 'toggle-composer' });
};

const toggleSidebar = () => {
  chrome?.dispatch({ type: 'toggle-sidebar' });
};

const openReview = () => {
  const handler = prSummary.value?.onOpenReview;
  chrome?.dispatch({ type: 'navigate-from-sheet' });
  handler?.();
};
</script>

<template>
  <nav
    v-if="bottomBar.showBottomBar"
    class="detail-bottom-bar"
    :aria-label="t('detailOverlay.bottomBar')"
  >
    <template v-if="isConversationSubject">
      <button
        type="button"
        class="detail-bottom-bar__entry detail-bottom-bar__composer-toggle"
        :class="{ 'detail-bottom-bar__entry--active': openSheet === 'composer' }"
        :disabled="isComposerDisabled"
        :aria-pressed="openSheet === 'composer'"
        @click="toggleComposer"
      >
        <LockIcon
          v-if="composer.locked"
          :size="16"
          class="detail-bottom-bar__icon"
          aria-hidden="true"
        />
        <MessageSquarePlusIcon
          v-else
          :size="16"
          class="detail-bottom-bar__icon"
          aria-hidden="true"
        />
        <span class="detail-bottom-bar__label">
          {{ composer.locked ? t('detailOverlay.commentLocked') : t('detailOverlay.writeComment') }}
        </span>
        <span
          v-if="composer.hasDraft && !composer.locked"
          class="detail-bottom-bar__draft-dot"
          aria-hidden="true"
        />
      </button>

      <button
        v-if="activePaneType === 'pull-request'"
        type="button"
        class="detail-bottom-bar__entry detail-bottom-bar__review-trigger"
        :disabled="!prSummary?.canOpenReview"
        @click="openReview"
      >
        <FileDiffIcon :size="16" class="detail-bottom-bar__icon" aria-hidden="true" />
        <span class="detail-bottom-bar__label">{{ t('detailOverlay.openReview') }}</span>
        <span
          v-if="prSummary && (prSummary.additions != null || prSummary.deletions != null)"
          class="detail-bottom-bar__diff-stats"
        >
          <span class="detail-bottom-bar__diff-add" :title="exact(prSummary.additions ?? 0)"
            >+{{ compact(prSummary.additions ?? 0) }}</span
          >
          <span class="detail-bottom-bar__diff-del" :title="exact(prSummary.deletions ?? 0)"
            >-{{ compact(prSummary.deletions ?? 0) }}</span
          >
        </span>
      </button>

      <button
        type="button"
        class="detail-bottom-bar__entry detail-bottom-bar__sidebar-toggle"
        :class="{ 'detail-bottom-bar__entry--active': openSheet === 'sidebar' }"
        :aria-pressed="openSheet === 'sidebar'"
        :aria-expanded="openSheet === 'sidebar'"
        @click="toggleSidebar"
      >
        <PanelBottomCloseIcon
          v-if="openSheet === 'sidebar'"
          :size="16"
          class="detail-bottom-bar__icon"
          aria-hidden="true"
        />
        <PanelBottomOpenIcon v-else :size="16" class="detail-bottom-bar__icon" aria-hidden="true" />
        <span class="detail-bottom-bar__label">{{ t('detailOverlay.details') }}</span>
        <strong v-if="metadataCount > 0" class="detail-bottom-bar__count">{{
          metadataCount
        }}</strong>
      </button>
    </template>

    <button
      v-else-if="activePaneType === 'release'"
      type="button"
      class="detail-bottom-bar__entry detail-bottom-bar__entry--summary detail-bottom-bar__sidebar-toggle"
      :class="{ 'detail-bottom-bar__entry--active': openSheet === 'sidebar' }"
      :aria-pressed="openSheet === 'sidebar'"
      :aria-expanded="openSheet === 'sidebar'"
      @click="toggleSidebar"
    >
      <span class="detail-bottom-bar__summary">
        <PackageIcon :size="16" class="detail-bottom-bar__icon" aria-hidden="true" />
        <span class="detail-bottom-bar__label">
          {{
            releaseAssetCount > 0
              ? t('releaseDetail.assetCount', { count: releaseAssetCount })
              : t('releaseDetail.noAssets')
          }}
        </span>
      </span>
      <span class="detail-bottom-bar__summary-action">
        <span>{{ t('detailOverlay.releaseDetails') }}</span>
        <PanelBottomCloseIcon
          v-if="openSheet === 'sidebar'"
          :size="16"
          class="detail-bottom-bar__icon"
          aria-hidden="true"
        />
        <PanelBottomOpenIcon v-else :size="16" class="detail-bottom-bar__icon" aria-hidden="true" />
      </span>
    </button>

    <button
      v-else-if="activePaneType === 'repository'"
      type="button"
      class="detail-bottom-bar__entry detail-bottom-bar__entry--summary detail-bottom-bar__sidebar-toggle"
      :class="{ 'detail-bottom-bar__entry--active': openSheet === 'sidebar' }"
      :aria-pressed="openSheet === 'sidebar'"
      :aria-expanded="openSheet === 'sidebar'"
      @click="toggleSidebar"
    >
      <span class="detail-bottom-bar__summary">
        <StarIcon :size="15" class="detail-bottom-bar__star-icon" aria-hidden="true" />
        <span class="detail-bottom-bar__stat-value" :title="exact(repoSummary?.starCount ?? 0)">{{
          compact(repoSummary?.starCount ?? 0)
        }}</span>
        <template v-if="repoSummary?.language">
          <span class="detail-bottom-bar__sep" aria-hidden="true">·</span>
          <span
            class="detail-bottom-bar__lang-dot"
            :style="
              repoSummary.languageColor ? { backgroundColor: repoSummary.languageColor } : undefined
            "
            aria-hidden="true"
          />
          <span class="detail-bottom-bar__label">{{ repoSummary.language }}</span>
        </template>
      </span>
      <span class="detail-bottom-bar__summary-action">
        <span>{{ t('detailOverlay.repoDetails') }}</span>
        <PanelBottomCloseIcon
          v-if="openSheet === 'sidebar'"
          :size="16"
          class="detail-bottom-bar__icon"
          aria-hidden="true"
        />
        <PanelBottomOpenIcon v-else :size="16" class="detail-bottom-bar__icon" aria-hidden="true" />
      </span>
    </button>
  </nav>
</template>

<style scoped lang="scss">
@use '~/assets/scss/pointer' as *;

.detail-bottom-bar {
  position: relative;
  z-index: 40;
  box-sizing: border-box;
  flex: none;
  display: flex;
  align-items: stretch;
  min-height: calc(3.25rem + env(safe-area-inset-bottom, 0px));
  padding-bottom: env(safe-area-inset-bottom, 0px);
  border-top: 1px solid var(--gitpulse-border);
  background: var(--gitpulse-surface);
}

@media (min-width: 1025px) {
  .detail-bottom-bar {
    display: none;
  }
}

.detail-bottom-bar__entry {
  position: relative;
  flex: 1 1 0;
  min-width: 0;
  min-height: 3.25rem;
  border: 0;
  background: transparent;
  color: var(--gitpulse-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0 0.5rem;
  font-family: var(--gitpulse-app-font-family);
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;

  @include hover-only {
    &:hover:not(:disabled):not(.detail-bottom-bar__entry--active) {
      background: var(--gitpulse-surface-hover);
      color: var(--gitpulse-text-strong);
    }
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring, var(--gitpulse-info));
    outline-offset: -2px;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.detail-bottom-bar__entry--active {
  background: var(--gitpulse-info-soft);
  color: var(--gitpulse-info);
}

.detail-bottom-bar__entry--summary {
  justify-content: space-between;
  padding: 0 1rem;
  gap: 0.75rem;
}

.detail-bottom-bar__icon {
  flex: none;
}

.detail-bottom-bar__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-bottom-bar__draft-dot {
  flex: none;
  width: 0.42rem;
  height: 0.42rem;
  border-radius: 999px;
  background: var(--gitpulse-accent);
}

.detail-bottom-bar__diff-stats {
  display: inline-flex;
  align-items: center;
  flex: 0 1 auto;
  min-width: 0;
  gap: 0.2rem;
  overflow: hidden;
  font-size: 0.68rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.detail-bottom-bar__diff-add {
  color: var(--gitpulse-success-solid);
}

.detail-bottom-bar__diff-del {
  color: var(--gitpulse-danger-solid);
}

.detail-bottom-bar__count {
  flex: none;
  min-width: 1.25rem;
  height: 1.25rem;
  padding: 0 0.3rem;
  border-radius: 999px;
  background: var(--gitpulse-surface-muted);
  color: inherit;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.68rem;
}

.detail-bottom-bar__entry--active .detail-bottom-bar__count {
  background: var(--gitpulse-surface);
}

.detail-bottom-bar__summary {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
  flex: 1 1 auto;
  color: var(--gitpulse-text-strong);
}

.detail-bottom-bar__star-icon {
  flex: none;
  color: var(--gitpulse-warning);
}

.detail-bottom-bar__stat-value {
  flex: none;
  font-variant-numeric: tabular-nums;
}

.detail-bottom-bar__sep {
  flex: none;
  opacity: 0.5;
}

.detail-bottom-bar__lang-dot {
  flex: none;
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 999px;
  background: var(--gitpulse-text-muted);
}

.detail-bottom-bar__summary-action {
  display: inline-flex;
  align-items: center;
  flex: none;
  gap: 0.35rem;
  color: var(--gitpulse-text-muted);
  font-weight: 600;
  white-space: nowrap;

  .detail-bottom-bar__entry--active & {
    color: var(--gitpulse-info);
  }
}
</style>
