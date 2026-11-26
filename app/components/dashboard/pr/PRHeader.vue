<template>
  <div class="mb-4">
    <!-- Tier 1: Eyebrow -->
    <div class="detail-header-eyebrow">
      <span class="header-repo">
        <GitForkIcon :size="13" class="header-repo__icon" aria-hidden="true" />
        <a class="header-repo__link" href="#" @click.prevent="handleRepoClick">
          {{ repoOwner }}/{{ repoName }}
        </a>
      </span>
      <span v-if="pullRequest?.number != null" class="header-number"
        >#{{ pullRequest.number }}</span
      >
    </div>

    <!-- Tier 2: Full-width Title -->
    <div class="detail-header-title">
      <h1 class="title is-3 mb-0 header-title__text">{{ pullRequest?.title }}</h1>
    </div>

    <!-- Tier 3: Single-line Status Strip -->
    <div class="detail-header-status header-meta">
      <span class="header-state-tag" :class="`is-${displayState}`">
        <component :size="12" :is="stateIcon" aria-hidden="true" />
        <span>{{ displayState }}</span>
      </span>
      <PRStackChip
        v-if="pullRequest?.stack"
        :stack="pullRequest.stack"
        :current-pull-number="Number(pullRequest.number) || undefined"
        @select="emit('switch-pull-request', repoOwner, repoName, $event)"
      />
      <span class="header-time">
        <ClockIcon :size="13" aria-hidden="true" />
        <span>{{ updatedAtLabel }}</span>
      </span>
    </div>

    <!-- Tier 4: Branch Merge Row -->
    <div
      v-if="headBranch.ref && baseBranch.ref"
      class="pr-branch-row"
      :class="{ 'is-expanded': isBranchExpanded }"
    >
      <button
        type="button"
        class="pr-branch-row__toggle"
        :aria-expanded="isBranchExpanded"
        :aria-label="
          isBranchExpanded ? t('detailOverlay.collapseBranches') : t('detailOverlay.expandBranches')
        "
        @click="toggleBranchExpanded"
      >
        <span class="header-branch">
          <span
            class="header-branch__side header-branch__side--head"
            :class="{ 'header-branch__side--split': headBranch.ownerLogin }"
          >
            <span v-if="headBranch.ownerLogin" class="header-branch__owner">{{
              headBranch.ownerLogin
            }}</span>
            <span class="header-branch__ref">{{ headBranch.ref }}</span>
          </span>
          <ArrowRightIcon :size="14" class="header-branch__arrow" aria-hidden="true" />
          <span
            class="header-branch__side header-branch__side--base"
            :class="{ 'header-branch__side--split': baseBranch.ownerLogin }"
          >
            <span v-if="baseBranch.ownerLogin" class="header-branch__owner">{{
              baseBranch.ownerLogin
            }}</span>
            <span class="header-branch__ref">{{ baseBranch.ref }}</span>
          </span>
        </span>
      </button>
      <button
        type="button"
        class="pr-branch-row__copy"
        :class="{ 'is-copied': isHeadBranchCopied }"
        :aria-label="
          isHeadBranchCopied
            ? t('detailOverlay.copiedHeadBranch')
            : t('detailOverlay.copyHeadBranch')
        "
        :title="
          isHeadBranchCopied
            ? t('detailOverlay.copiedHeadBranch')
            : t('detailOverlay.copyHeadBranch')
        "
        @click.stop="copyHeadBranch"
      >
        <CheckIcon v-if="isHeadBranchCopied" :size="13" aria-hidden="true" />
        <CopyIcon v-else :size="13" aria-hidden="true" />
      </button>
    </div>

    <hr class="header-rule" />
    <div data-detail-compact-threshold aria-hidden="true"></div>

    <!-- Author row -->
    <div>
      <div class="is-flex is-align-items-center mb-4">
        <GitHubAvatar
          variant="raised"
          interactive
          class="mr-3"
          width="28"
          height="28"
          :src="pullRequest?.user?.avatar_url ?? ''"
          :alt="pullRequest?.user?.login"
        />
        <div class="is-flex is-align-items-center is-flex-wrap-wrap header-author">
          <GitHubProfileLink
            :login="pullRequest?.user?.login"
            :github-href="pullRequest?.user?.html_url"
            class="header-author__name has-text-weight-medium has-text-link"
          >
            {{ pullRequest?.user?.login }}
          </GitHubProfileLink>
          <span class="header-author__time">
            {{ createdAtLabel }}
          </span>
        </div>
      </div>
      <div>
        <MarkdownRenderer
          v-if="pullRequest?.body"
          :value="pullRequest.body"
          :repo-owner="repoOwner"
          :repo-name="repoName"
        />
        <p v-else>{{ t('prReview.noDescription') }}</p>
      </div>
      <ReactionBar
        v-if="repoOwner && repoName && pullRequest?.number"
        class="header-reactions"
        target-kind="issue"
        :owner="repoOwner"
        :repo="repoName"
        :target-id="pullRequest.number"
        :initial-items="pullRequest.reactions"
        :can-react="pullRequest.canReact"
        initial-items-include-viewer-state
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowRightIcon, CheckIcon, ClockIcon, CopyIcon, GitForkIcon } from '@lucide/vue';
import { computed, onBeforeUnmount, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { PullRequestStack } from '#shared/types/pulls';
import type { ReactionSummaryItem } from '#shared/types/reactions';
import PRStackChip from '~/components/dashboard/pr/PRStackChip.vue';
import ReactionBar from '~/components/dashboard/reactions/ReactionBar.vue';
import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';
import GitHubProfileLink from '~/components/ui/GitHubProfileLink.vue';
import MarkdownRenderer from '~/components/ui/MarkdownRenderer.vue';
import { getPullRequestStateVisual } from '~/utils/getPullRequestStateVisual';
import {
  resolvePullRequestBranchRef,
  type PullRequestBranchRefSource,
} from '~/utils/resolvePullRequestBranchRef';

const { locale, t } = useI18n();
const { openRepository } = useDashboardRepositoryNavigation();
const localeCode = computed(() => locale.value);
const relativeTimeNow = useRelativeTimeNow();

interface PullRequestHeaderPullRequest {
  title?: string;
  number?: number | string;
  state?: string;
  merged_at?: string | null;
  draft?: boolean;
  updated_at?: string;
  head?: PullRequestBranchRefSource;
  base?: PullRequestBranchRefSource;
  user?: {
    avatar_url?: string | null;
    html_url?: string | null;
    login?: string;
  };
  created_at?: string;
  body?: string | null;
  reactions?: ReactionSummaryItem[];
  canReact?: boolean;
  stack?: PullRequestStack | null;
}

const { pullRequest, repoOwner, repoName } = defineProps<{
  pullRequest?: PullRequestHeaderPullRequest | null;
  repoOwner: string;
  repoName: string;
}>();

const emit = defineEmits<{
  'switch-pull-request': [owner: string, repo: string, pullNumber: number];
}>();

const isBranchExpanded = shallowRef(false);
const isHeadBranchCopied = shallowRef(false);
let copyResetTimer: ReturnType<typeof setTimeout> | null = null;

const headBranch = computed(() =>
  resolvePullRequestBranchRef(repoOwner, repoName, pullRequest?.head)
);
const baseBranch = computed(() =>
  resolvePullRequestBranchRef(repoOwner, repoName, pullRequest?.base)
);

const stateVisual = computed(() => getPullRequestStateVisual(pullRequest));
const displayState = computed(() => stateVisual.value.state);
const stateIcon = computed(() => stateVisual.value.icon);

const updatedAtLabel = computed(() => {
  return pullRequest?.updated_at
    ? formatDurationFromNow(pullRequest.updated_at, localeCode.value, relativeTimeNow.value)
    : '-';
});

const createdAtLabel = computed(() => {
  return pullRequest?.created_at
    ? formatDurationFromNow(pullRequest.created_at, localeCode.value, relativeTimeNow.value)
    : '-';
});

const clearCopyTimer = () => {
  if (copyResetTimer !== null) {
    clearTimeout(copyResetTimer);
    copyResetTimer = null;
  }
};

watch(
  () => [repoOwner, repoName, pullRequest?.number],
  () => {
    isBranchExpanded.value = false;
    isHeadBranchCopied.value = false;
    clearCopyTimer();
  }
);

onBeforeUnmount(clearCopyTimer);

const toggleBranchExpanded = () => {
  isBranchExpanded.value = !isBranchExpanded.value;
};

const copyHeadBranch = async () => {
  const refName = headBranch.value.ref;
  if (!refName || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    return;
  }

  try {
    await navigator.clipboard.writeText(refName);
    isHeadBranchCopied.value = true;
    clearCopyTimer();
    copyResetTimer = setTimeout(() => {
      isHeadBranchCopied.value = false;
      copyResetTimer = null;
    }, 1800);
  } catch {
    // Clipboard writes can be blocked by browser permissions.
  }
};

const handleRepoClick = async () => {
  await openRepository(repoOwner, repoName);
};
</script>

<style scoped lang="scss">
@use '~/assets/scss/detail-header' as *;
@use '~/assets/scss/pointer' as *;

@include detail-header-shared;

.header-state-tag {
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
}

.pr-branch-row {
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  min-width: 0;
  max-width: 100%;
  margin-bottom: 0.75rem;
}

.pr-branch-row__toggle {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font-family: inherit;
  text-align: left;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring, var(--gitpulse-link));
    outline-offset: 2px;
    border-radius: var(--gitpulse-radius-sm);
  }
}

.header-branch {
  display: inline-flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 0.25rem;
  min-width: 0;
  max-width: 100%;
}

.pr-branch-row.is-expanded .header-branch {
  flex-wrap: wrap;
  align-items: flex-start;
}

.header-branch__side {
  display: inline-flex;
  align-items: stretch;
  min-width: 0;
  max-width: 100%;
}

.pr-branch-row:not(.is-expanded) .header-branch__side--head {
  flex: 1 1 auto;
}

.pr-branch-row:not(.is-expanded) .header-branch__side--base {
  flex: 0 0 auto;
  max-width: 44%;
}

.header-branch__side--split {
  border-radius: var(--gitpulse-radius-sm);
  overflow: hidden;

  .header-branch__owner,
  .header-branch__ref {
    border-radius: 0;
  }
}

.header-branch__owner {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  padding: 0.1rem 0.4rem;
  border-right: 1px solid color-mix(in srgb, var(--gitpulse-purple) 32%, transparent);
  background-color: color-mix(in srgb, var(--gitpulse-purple) 18%, var(--gitpulse-surface));
  color: var(--gitpulse-purple);
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}

.header-branch__arrow {
  flex: none;
  color: var(--gitpulse-text-subtle);
}

.header-branch__ref {
  min-width: 0;
  padding: 0.1rem 0.4rem;
  border-radius: var(--gitpulse-radius-sm);
  background-color: var(--gitpulse-info-soft);
  color: var(--gitpulse-info);
  font-size: 0.75rem;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pr-branch-row.is-expanded .header-branch__owner,
.pr-branch-row.is-expanded .header-branch__ref {
  white-space: normal;
  overflow-wrap: anywhere;
  text-overflow: clip;
  overflow: visible;
}

.pr-branch-row__copy {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 1.5rem;
  height: 1.5rem;
  padding: 0;
  border: 1px solid var(--gitpulse-border);
  border-radius: var(--gitpulse-radius-sm);
  background-color: var(--gitpulse-surface-muted);
  color: var(--gitpulse-text-muted);
  cursor: pointer;
  transition:
    color 0.14s ease,
    border-color 0.14s ease,
    background-color 0.14s ease;

  @include hover-only {
    &:hover {
      border-color: var(--gitpulse-border-strong);
      color: var(--gitpulse-text-strong);
      background-color: var(--gitpulse-surface-hover);
    }
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring, var(--gitpulse-link));
    outline-offset: 2px;
  }

  &.is-copied {
    color: var(--gitpulse-success-solid);
    border-color: color-mix(in srgb, var(--gitpulse-success) 35%, transparent);
    background-color: var(--gitpulse-success-soft);
  }
}
</style>
