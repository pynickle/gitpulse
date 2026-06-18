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
          <div v-if="isDetailSummaryVisible" class="dashboard-top-header__summary">
            <span
              v-if="detailState"
              class="dashboard-top-header__summary-state"
              :class="detailStateClass"
            >
              <component :is="detailStateIcon" v-if="detailStateIcon" :size="12" />
              {{ detailState }}
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
        <LinkIcon to="https://github.com/pynickle/gitpulse">
          <GitHubIcon class="is-centered" />
        </LinkIcon>
        <LanguageSwitcher />
        <ColorModeToggle />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ArrowLeftIcon,
  CircleDotIcon,
  CircleMinusIcon,
  GitMergeIcon,
  GitPullRequestClosedIcon,
  GitPullRequestIcon,
  HomeIcon,
  MessageSquareIcon,
} from '@lucide/vue';
import { type Component, computed } from 'vue';
import { GitHubIcon } from 'vue3-simple-icons';

import LanguageSwitcher from '~/components/LanguageSwitcher.vue';
import ColorModeToggle from '~/components/ui/ColorModeToggle.vue';
import LinkIcon from '~/components/ui/LinkIcon.vue';

type DetailSummaryTone = 'open' | 'closed' | 'merged' | 'answered' | 'unanswered';
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
}>();

defineEmits<{
  (e: 'back'): void;
  (e: 'home'): void;
}>();

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
    if (stateTone === 'merged' || state === 'merged') return GitMergeIcon;
    if (stateTone === 'open' || state === 'open') return GitPullRequestIcon;
    return GitPullRequestClosedIcon;
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
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  min-height: 3rem;
  padding: 0.4rem 0.75rem;
  gap: 0.75rem;
}

.dashboard-top-header__nav {
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0;
}

.dashboard-top-header__nav .button {
  display: inline-flex;
  align-items: center;
  margin-bottom: 0;
}

.dashboard-top-header__summary-shell {
  min-width: 0;
}

.dashboard-top-header__summary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  max-width: 100%;
  color: var(--gitpulse-text);
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
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-left: auto;
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

@media (max-width: 760px) {
  .dashboard-top-header__toolbar {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .dashboard-top-header__summary-shell {
    grid-column: 1 / -1;
  }

  .dashboard-top-header__summary {
    padding-bottom: 0.15rem;
  }
}
</style>
