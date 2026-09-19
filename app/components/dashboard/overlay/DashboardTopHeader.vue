<template>
  <div :class="['dashboard-top-header', { 'is-not-sticky': nonSticky }]">
    <div class="card-header-title dashboard-top-header__toolbar">
      <div class="buttons dashboard-top-header__nav">
        <button class="button is-light is-small" @click="$emit('back')">
          <ArrowLeftIcon :size="18" class="mr-1" />
          {{ backLabel }}
        </button>
        <button v-if="showHomeButton" class="button is-light is-small" @click="$emit('home')">
          <HomeIcon :size="18" class="mr-1" />
          {{ homeLabel }}
        </button>
      </div>
      <div class="dashboard-top-header__summary-shell">
        <Transition name="dashboard-top-header-summary">
          <div
            v-if="isDetailSummaryVisible"
            class="dashboard-top-header__summary"
            :class="{ 'is-mobile-compact': isDetailSidebarSheetViewport }"
          >
            <span
              v-if="detailState"
              class="dashboard-top-header__summary-state"
              :class="detailStateClass"
              :title="detailState"
            >
              <component :is="detailStateIcon" v-if="detailStateIcon" :size="12" />
              <span class="dashboard-top-header__summary-state-label">{{ detailState }}</span>
            </span>
            <span v-if="detailNumberLabel" class="dashboard-top-header__summary-number">
              {{ detailNumberLabel }}
            </span>
            <span class="dashboard-top-header__summary-title" :title="detailTitle">
              {{ detailTitle }}
            </span>
          </div>
        </Transition>
      </div>
      <div class="dashboard-top-header__actions">
        <button
          v-if="showDetailSidebarToggle"
          type="button"
          class="button is-light is-small dashboard-top-header__detail-sidebar-toggle"
          :title="detailSidebarToggleLabel"
          :aria-label="detailSidebarToggleLabel"
          @click="$emit('toggle-detail-sidebar')"
        >
          <PanelRightCloseIcon v-if="!detailSidebarHidden" :size="16" aria-hidden="true" />
          <PanelRightOpenIcon v-else :size="16" aria-hidden="true" />
        </button>
        <LinkIcon to="https://github.com/pynickle/gitpulse">
          <GitHubIcon class="is-centered" />
        </LinkIcon>
        <!-- Desktop-only: inline language switcher and color mode toggle. The
             wrapper div carries the scoped class — passing it straight to the
             component loses the scope id through ColorScheme's extra root. -->
        <div class="dashboard-top-header__inline-extra">
          <LanguageSwitcher />
        </div>
        <div class="dashboard-top-header__inline-extra">
          <ColorModeToggle />
        </div>

        <!-- Mobile-only (<=860px): the two extras collapse into a "more" menu
             so the toolbar always fits on one row. -->
        <div ref="moreMenuRef" class="dashboard-top-header__more">
          <button
            type="button"
            class="button is-light is-small dashboard-top-header__more-toggle"
            :title="t('detailOverlay.moreActions')"
            :aria-label="t('detailOverlay.moreActions')"
            :aria-expanded="isMoreMenuOpen"
            aria-haspopup="menu"
            @click="toggleMoreMenu"
          >
            <MoreHorizontalIcon :size="16" aria-hidden="true" />
          </button>
          <Transition name="dashboard-top-header-more-menu">
            <div v-if="isMoreMenuOpen" class="dashboard-top-header__more-menu" role="menu">
              <div class="dashboard-top-header__more-menu-row" role="none">
                <LanguageSwitcher />
              </div>
              <div class="dashboard-top-header__more-menu-row" role="none">
                <span class="dashboard-top-header__more-menu-label">
                  {{ t('colorMode.label') }}
                </span>
                <ColorModeToggle />
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ArrowLeftIcon,
  CircleDotIcon,
  CircleMinusIcon,
  HomeIcon,
  MessageSquareIcon,
  MoreHorizontalIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
} from '@lucide/vue';
import { type Component, computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { GitHubIcon } from 'vue3-simple-icons';

import LanguageSwitcher from '~/components/LanguageSwitcher.vue';
import ColorModeToggle from '~/components/ui/ColorModeToggle.vue';
import LinkIcon from '~/components/ui/LinkIcon.vue';
import { getPullRequestStateIcon } from '~/utils/getPullRequestStateVisual';

type DetailSummaryTone = 'open' | 'closed' | 'merged' | 'draft' | 'answered' | 'unanswered';
type DetailSubjectType = 'issue' | 'pull-request' | 'discussion';

interface DetailSummary {
  title?: string;
  number?: number | string;
  state?: string;
  stateTone?: DetailSummaryTone;
  subjectType?: DetailSubjectType;
  visible?: boolean;
}

const props = defineProps<{
  backLabel: string;
  homeLabel: string;
  showHomeButton: boolean;
  nonSticky?: boolean;
  detailSummary?: DetailSummary | null;
  showDetailSidebarToggle?: boolean;
  detailSidebarHidden?: boolean;
}>();

defineEmits<{
  (e: 'back'): void;
  (e: 'home'): void;
  (e: 'toggle-detail-sidebar'): void;
}>();

const { t } = useI18n();
const { isDetailSidebarSheetViewport } = useDetailSidebarViewport();

const detailSidebarToggleLabel = computed(() => {
  return props.detailSidebarHidden
    ? t('detailOverlay.showDetailSidebar')
    : t('detailOverlay.hideDetailSidebar');
});

const detailTitle = computed(() => props.detailSummary?.title?.trim() ?? '');

const detailState = computed(() => props.detailSummary?.state?.trim() ?? '');

const detailStateClass = computed(() => {
  const tone = props.detailSummary?.stateTone ?? 'closed';
  return `is-${tone}`;
});

const detailStateIcon = computed<Component | null>(() => {
  const subjectType = props.detailSummary?.subjectType;
  const stateTone = props.detailSummary?.stateTone;
  const state = detailState.value;

  if (subjectType === 'pull-request') {
    return getPullRequestStateIcon({
      state: stateTone === 'draft' || state === 'draft' ? 'open' : state || stateTone,
      merged: stateTone === 'merged' || state === 'merged',
      draft: stateTone === 'draft' || state === 'draft',
    });
  }

  if (subjectType === 'discussion') {
    return MessageSquareIcon;
  }

  // Default: issue
  if (stateTone === 'open' || state === 'open') return CircleDotIcon;
  return CircleMinusIcon;
});

const detailNumberLabel = computed(() => {
  const rawNumber = props.detailSummary?.number;

  if (rawNumber === undefined || rawNumber === null || rawNumber === '') {
    return '';
  }

  const number = String(rawNumber).trim();
  return number.startsWith('#') ? number : `#${number}`;
});

const isDetailSummaryVisible = computed(() => {
  return Boolean(
    props.detailSummary?.visible &&
    (detailTitle.value || detailState.value || detailNumberLabel.value)
  );
});

/*
 * Mobile "more" menu (<=860px): hosts the language switcher and color mode
 * toggle so the toolbar stays on one row. The menu closes on outside clicks,
 * on Escape, on any overlay scroll (the floating panel is absolute inside a
 * sticky header — it would not follow the content), and after picking a
 * language.
 */
const isMoreMenuOpen = ref(false);
const moreMenuRef = ref<HTMLElement | null>(null);

const closeMoreMenu = () => {
  isMoreMenuOpen.value = false;
};

const toggleMoreMenu = () => {
  isMoreMenuOpen.value = !isMoreMenuOpen.value;
};

const onMoreMenuDocumentClick = (event: MouseEvent) => {
  if (!isMoreMenuOpen.value) return;
  const target = event.target as Node | null;
  if (target && moreMenuRef.value?.contains(target)) return;
  closeMoreMenu();
};

const onMoreMenuKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') closeMoreMenu();
};

const onMoreMenuScroll = () => closeMoreMenu();

onMounted(() => {
  document.addEventListener('click', onMoreMenuDocumentClick, true);
  document.addEventListener('keydown', onMoreMenuKeydown);
  document.addEventListener('scroll', onMoreMenuScroll, true);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', onMoreMenuDocumentClick, true);
  document.removeEventListener('keydown', onMoreMenuKeydown);
  document.removeEventListener('scroll', onMoreMenuScroll, true);
});
</script>

<style scoped lang="scss">
.dashboard-top-header {
  background-color: var(--gitpulse-surface-muted);
  border-bottom: 1px solid var(--gitpulse-border);
  position: sticky;
  top: 0;
  z-index: 10;
}

.dashboard-top-header.is-not-sticky {
  position: static;
  z-index: auto;
}

.dashboard-top-header__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  min-height: 3rem;
  padding: 0.4rem 0.75rem;
  gap: 0.5rem 0.75rem;
}

.dashboard-top-header__nav {
  display: flex;
  flex: none;
  flex-wrap: nowrap;
  align-items: center;
  width: auto;
  gap: 0.5rem;
  margin-bottom: 0;
}

.dashboard-top-header__nav .button {
  display: inline-flex;
  align-items: center;
  margin-bottom: 0;
}

.dashboard-top-header__summary-shell {
  flex: 1 1 0;
  min-width: 0;
  /* The state/number badges are flex:none; without clipping they overflow the
     shrinkable shell and paint over the actions on narrow screens. */
  overflow: hidden;
}

.dashboard-top-header__summary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  max-width: 100%;
  color: var(--gitpulse-text);
}

/*
 * Mobile compact summary (<=860px): the "Closed #3619 Title" trio crowds the
 * narrow header, so it collapses to a state dot + title. Driven by the
 * viewport composable (not a CSS media query) so the state label text never
 * flashes during the breakpoint transition.
 */
.dashboard-top-header__summary.is-mobile-compact {
  gap: 0.4rem;
}

.dashboard-top-header__summary.is-mobile-compact .dashboard-top-header__summary-number {
  display: none;
}

.dashboard-top-header__summary.is-mobile-compact .dashboard-top-header__summary-state {
  width: 1.35rem;
  min-height: 1.35rem;
  padding: 0;
  justify-content: center;
  border-radius: 999px;
}

.dashboard-top-header__summary.is-mobile-compact .dashboard-top-header__summary-state-label {
  display: none;
}

.dashboard-top-header__summary-state,
.dashboard-top-header__summary-number {
  display: inline-flex;
  align-items: center;
  flex: none;
  min-height: 1.5rem;
  padding: 0.15rem 0.5rem;
  border-radius: var(--gitpulse-radius-sm);
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1;
}

.dashboard-top-header__summary-state {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  text-transform: capitalize;

  &.is-open {
    background-color: var(--gitpulse-success-soft);
    color: var(--gitpulse-success-solid);
    border: 1px solid color-mix(in srgb, var(--gitpulse-success) 24%, transparent);
  }

  &.is-merged {
    background-color: var(--gitpulse-info-soft);
    color: var(--gitpulse-info-solid);
    border: 1px solid color-mix(in srgb, var(--gitpulse-info) 24%, transparent);
  }

  &.is-closed {
    background-color: var(--gitpulse-danger-soft);
    color: var(--gitpulse-danger-solid);
    border: 1px solid color-mix(in srgb, var(--gitpulse-danger) 24%, transparent);
  }

  &.is-draft {
    background-color: var(--gitpulse-surface-muted);
    color: var(--gitpulse-text-muted);
    border: 1px solid var(--gitpulse-border);
  }

  &.is-answered {
    background-color: var(--gitpulse-success-soft);
    color: var(--gitpulse-success-solid);
    border: 1px solid color-mix(in srgb, var(--gitpulse-success) 24%, transparent);
  }

  &.is-unanswered {
    background-color: var(--gitpulse-surface-muted);
    color: var(--gitpulse-text);
    border: 1px solid var(--gitpulse-border);
  }
}

.dashboard-top-header__summary-number {
  color: var(--gitpulse-text-muted);
  background-color: var(--gitpulse-surface);
  border: 1px solid var(--gitpulse-border);
}

.dashboard-top-header__summary-title {
  min-width: 0;
  overflow: hidden;
  font-size: 0.9rem;
  font-weight: 600;
  line-height: 1.25;
  color: var(--gitpulse-text-strong);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dashboard-top-header-summary-enter-active,
.dashboard-top-header-summary-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}

.dashboard-top-header-summary-enter-from,
.dashboard-top-header-summary-leave-to {
  opacity: 0;
  transform: translateY(-0.4rem);
}

.dashboard-top-header__actions {
  display: flex;
  flex: none;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-left: auto;
}

.dashboard-top-header__detail-sidebar-toggle {
  height: 2.25rem;
}

/* Mobile "more" menu: hidden on desktop, replaces the inline extras below
   860px so the toolbar never wraps to a second row. */
.dashboard-top-header__more {
  display: none;
  position: relative;
}

.dashboard-top-header__more-toggle {
  height: 2.25rem;
}

.dashboard-top-header__more-menu {
  position: absolute;
  top: calc(100% + 0.35rem);
  right: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  min-width: 11rem;
  padding: 0.35rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: var(--gitpulse-radius, 8px);
  background: var(--gitpulse-surface);
  box-shadow: var(--gitpulse-shadow-raised);
}

.dashboard-top-header__more-menu-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.4rem 0.5rem;

  & + & {
    border-top: 1px solid var(--gitpulse-border-subtle, var(--gitpulse-border));
  }
}

.dashboard-top-header__more-menu-label {
  color: var(--gitpulse-text-muted);
  font-size: 0.8rem;
  font-weight: 500;
  white-space: nowrap;
}

.dashboard-top-header-more-menu-enter-active,
.dashboard-top-header-more-menu-leave-active {
  transition:
    opacity 0.16s ease,
    transform 0.16s ease;
}

.dashboard-top-header-more-menu-enter-from,
.dashboard-top-header-more-menu-leave-to {
  opacity: 0;
  transform: translateY(-0.3rem);
}

@media (max-width: 860px) {
  .dashboard-top-header__inline-extra {
    display: none;
  }

  .dashboard-top-header__more {
    display: block;
  }
}

.dashboard-top-header__actions :deep(.dropdown),
.dashboard-top-header__actions :deep(.dropdown-trigger) {
  display: inline-flex;
  align-items: center;
}

.dashboard-top-header__actions :deep(.dropdown-trigger .button) {
  display: inline-flex;
  align-items: center;
  height: 2.25rem;
}
</style>
