<template>
  <div class="detail-header">
    <!-- Tier 1: Eyebrow -->
    <div class="detail-header-eyebrow">
      <span class="header-repo">
        <GitForkIcon :size="13" class="header-repo__icon" aria-hidden="true" />
        <a class="header-repo__link" href="#" @click.prevent="handleRepoClick">
          {{ repoOwner }}/{{ repoName }}
        </a>
      </span>
      <span v-if="issue?.number != null" class="header-number">#{{ issue.number }}</span>
    </div>

    <!-- Tier 2: Full-width Title -->
    <div class="detail-header-title">
      <h1 class="header-title__text">{{ issue?.title }}</h1>
    </div>

    <!-- Tier 3: Single-line Status Strip -->
    <div class="detail-header-status header-meta">
      <span class="header-state-tag" :class="stateTagClass">
        <component :size="12" :is="stateVisual.icon" :style="stateColor" aria-hidden="true" />
        <span>{{ issue?.state }}</span>
      </span>
      <span class="header-time">
        <ClockIcon :size="13" aria-hidden="true" />
        <span>{{ formatDurationFromNow(issue?.updated_at, localeCode, relativeTimeNow) }}</span>
      </span>
    </div>

    <p v-if="issue?.duplicate_of" class="header-duplicate" data-duplicate-target>
      <span>{{ t('issueDetail.duplicateOf') }}</span>
      <ReferenceSubject
        :ref-subject="issue.duplicate_of"
        resource-type="issue"
        :cross-repository="isOtherRepository(issue.duplicate_of)"
        @switch-issue="(owner, repo, number) => emit('switch-issue', owner, repo, number)"
      />
    </p>

    <p v-if="issue?.parent_issue" class="header-duplicate">
      <span>{{ t('dashboard.subIssues.parent') }}</span>
      <ReferenceSubject
        :ref-subject="issue.parent_issue"
        resource-type="issue"
        :cross-repository="isOtherRepository(issue.parent_issue)"
        @switch-issue="(owner, repo, number) => emit('switch-issue', owner, repo, number, true)"
      />
    </p>

    <slot name="before-description" />

    <hr class="header-rule" />
    <div data-detail-compact-threshold aria-hidden="true"></div>

    <!-- Author row -->
    <div>
      <div class="detail-header-author">
        <GitHubAvatar
          variant="raised"
          interactive
          width="28"
          height="28"
          :src="issue?.user?.avatar_url"
          :alt="issue?.user?.login"
        />
        <div class="header-author">
          <GitHubProfileLink
            :login="issue?.user?.login"
            :github-href="issue?.user?.html_url"
            class="header-author__name header-author__name--link"
          >
            {{ issue?.user?.login }}
          </GitHubProfileLink>
          <span class="header-author__time">
            {{ formatDurationFromNow(issue?.created_at, localeCode, relativeTimeNow) }}
          </span>
        </div>
      </div>
      <div>
        <MarkdownRenderer
          v-if="issue?.body"
          :value="issue.body"
          :repo-owner="repoOwner"
          :repo-name="repoName"
        />
        <p v-else>{{ t('issueDetail.noDescription') }}</p>
      </div>
      <ReactionBar
        v-if="repoOwner && repoName && issue?.number"
        class="header-reactions"
        target-kind="issue"
        :owner="repoOwner"
        :repo="repoName"
        :target-id="issue.number"
        :initial-items="issue.reactions"
        :can-react="issue.canReact"
        initial-items-include-viewer-state
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ClockIcon, GitForkIcon } from '@lucide/vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import type { IssueDuplicateTarget, IssueReferenceTarget } from '#shared/types/issues';
import type { ReactionSummaryItem } from '#shared/types/reactions';
import ReactionBar from '~/components/dashboard/reactions/ReactionBar.vue';
import ReferenceSubject from '~/components/dashboard/timeline/ReferenceSubject.vue';
import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';
import GitHubProfileLink from '~/components/ui/GitHubProfileLink.vue';
import MarkdownRenderer from '~/components/ui/MarkdownRenderer.vue';
import {
  getIssueStatePillClass,
  getIssueStateVisual,
} from '~/utils/getDashboardSubjectStateVisual';

const { locale, t } = useI18n();
const { openRepository } = useDashboardRepositoryNavigation();
const localeCode = computed(() => locale.value);
const relativeTimeNow = useRelativeTimeNow();

interface IssueHeaderIssue {
  title?: string;
  number?: number | string;
  state?: string;
  state_reason?: string | null;
  duplicate_of?: IssueDuplicateTarget | null;
  parent_issue?: IssueReferenceTarget | null;
  updated_at?: string;
  user?: {
    avatar_url?: string | null;
    html_url?: string | null;
    login?: string;
  } | null;
  created_at?: string;
  body?: string | null;
  reactions?: ReactionSummaryItem[];
  canReact?: boolean;
}

const { issue, repoOwner, repoName } = defineProps<{
  issue?: IssueHeaderIssue | null;
  repoOwner: string;
  repoName: string;
}>();

const emit = defineEmits<{
  (
    e: 'switch-issue',
    owner: string,
    repo: string,
    issueNumber: number,
    openInOverlay?: boolean
  ): void;
}>();

const isOtherRepository = ({ repository }: IssueReferenceTarget) =>
  repository.owner.login.toLowerCase() !== repoOwner.toLowerCase() ||
  repository.name.toLowerCase() !== repoName.toLowerCase();

const stateVisual = computed(() => getIssueStateVisual(issue?.state, issue?.state_reason));

const stateTagClass = computed(() =>
  issue?.state === 'open' ? 'is-open' : getIssueStatePillClass(stateVisual.value.isCompleted)
);

// Open is the only state the visual leaves uncoloured.
const stateColor = computed(() => ({
  color: stateVisual.value.color ?? 'var(--gitpulse-success)',
}));

const handleRepoClick = async () => {
  await openRepository(repoOwner, repoName);
};
</script>

<style scoped lang="scss">
@use '~/assets/scss/detail-header' as *;

@include detail-header-shared;

.header-state-tag {
  &.is-open {
    background-color: var(--gitpulse-success-soft);
    color: var(--gitpulse-success-solid);
    border: 1px solid color-mix(in srgb, var(--gitpulse-success) 24%, transparent);
  }

  &.is-completed {
    background-color: var(--gitpulse-purple-soft);
    color: var(--gitpulse-purple);
    border: 1px solid color-mix(in srgb, var(--gitpulse-purple) 24%, transparent);
  }

  &.is-closed {
    background-color: var(--gitpulse-danger-soft);
    color: var(--gitpulse-danger-solid);
    border: 1px solid color-mix(in srgb, var(--gitpulse-danger) 24%, transparent);
  }
}

.header-duplicate {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem;
  margin-bottom: 0.75rem;
  font-size: 0.8rem;
  color: var(--gitpulse-text-muted);

  // A timeline pill keeps a bottom margin so wrapped rows of pills stay apart; this row
  // centres its pill instead, and that margin would lift the pill above the label.
  :deep(.gp-tag--activity) {
    margin-bottom: 0;
  }
}
</style>
