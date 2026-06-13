<script setup lang="ts">
import { Loader2Icon } from 'lucide-vue-next';
import { computed, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { DiscussionDetailPayload } from '#shared/types/discussions';
import type { IssueDetailPayload } from '#shared/types/issues';
import type { PullRequestDetailPayload } from '#shared/types/pulls';
import type { ReleaseDetailPayload } from '#shared/types/releases';
import type { RepositoryDetailPayload } from '#shared/types/repos';
import DiscussionDetail from '~/components/dashboard/detail/DiscussionDetail.vue';
import IssueDetail from '~/components/dashboard/detail/IssueDetail.vue';
import PrDetail from '~/components/dashboard/detail/PRDetail.vue';
import ReleaseDetail from '~/components/dashboard/detail/ReleaseDetail.vue';
import RepoDetail from '~/components/dashboard/detail/RepoDetail.vue';
import DashboardOverlayFrame from '~/components/dashboard/overlay/DashboardOverlayFrame.vue';

type DetailPaneType = 'issue' | 'pull-request' | 'discussion' | 'release' | 'repository';

interface ActiveDetailPane {
  type: DetailPaneType;
  key: string;
  loading: boolean;
  hasData: boolean;
  error: string;
  loadingTitle: string;
}

const props = defineProps<{
  issue: IssueDetailPayload | null;
  pullRequest: PullRequestDetailPayload | null;
  discussion: DiscussionDetailPayload | null;
  release: ReleaseDetailPayload | null;
  repository: RepositoryDetailPayload | null;
  issueError: string;
  discussionError: string;
  releaseError: string;
  repoError: string;
  isIssueVisible: boolean;
  isPullRequestVisible: boolean;
  isDiscussionVisible: boolean;
  isReleaseVisible: boolean;
  isRepositoryVisible: boolean;
  isPullRequestReviewRoute: boolean;
  issueDetailKey: string;
  pullRequestDetailKey: string;
  discussionDetailKey: string;
  releaseDetailKey: string;
  repositoryDetailKey: string;
  loadingIssue: boolean;
  loadingPullRequest: boolean;
  loadingDiscussion: boolean;
  loadingRelease: boolean;
  loadingRepository: boolean;
}>();

const emit = defineEmits<{
  (e: 'back'): void;
  (e: 'home'): void;
  (e: 'switch-issue', owner: string, repo: string, issueNumber: number): void;
  (e: 'switch-pull-request', owner: string, repo: string, pullNumber: number): void;
  (e: 'switch-discussion', owner: string, repo: string, discussionNumber: number): void;
  (e: 'open-pull-request-review'): void;
  (e: 'close-pull-request-review'): void;
}>();

const { t } = useI18n();
const { shouldShowHomeButton } = useNavigationHistory();
const isIssueHeaderNonSticky = shallowRef(false);
const isPullRequestReviewActive = shallowRef(false);

const activeDetailPane = computed<ActiveDetailPane | null>(() => {
  if (props.isIssueVisible) {
    return {
      type: 'issue',
      key: props.issueDetailKey,
      loading: props.loadingIssue,
      hasData: Boolean(props.issue),
      error: props.issueError,
      loadingTitle: t('detailOverlay.loading.issue'),
    };
  }

  if (props.isPullRequestVisible) {
    return {
      type: 'pull-request',
      key: props.pullRequestDetailKey,
      loading: props.loadingPullRequest,
      hasData: Boolean(props.pullRequest),
      error: '',
      loadingTitle: t('detailOverlay.loading.pullRequest'),
    };
  }

  if (props.isDiscussionVisible) {
    return {
      type: 'discussion',
      key: props.discussionDetailKey,
      loading: props.loadingDiscussion,
      hasData: Boolean(props.discussion),
      error: props.discussionError,
      loadingTitle: t('discussionDetail.loading'),
    };
  }

  if (props.isReleaseVisible) {
    return {
      type: 'release',
      key: props.releaseDetailKey,
      loading: props.loadingRelease,
      hasData: Boolean(props.release),
      error: props.releaseError,
      loadingTitle: t('releaseDetail.loading'),
    };
  }

  if (props.isRepositoryVisible) {
    return {
      type: 'repository',
      key: props.repositoryDetailKey,
      loading: props.loadingRepository,
      hasData: Boolean(props.repository),
      error: props.repoError,
      loadingTitle: t('detailOverlay.loading.repository'),
    };
  }

  return null;
});

const activeDetailKey = computed(() => activeDetailPane.value?.key ?? 'empty');

const isOverlayVisible = computed(() => Boolean(activeDetailPane.value));

const repositoryOwner = computed(() => {
  const owner = props.repository?.owner;
  return owner && typeof owner === 'object' && 'login' in owner ? String(owner.login || '') : '';
});

const repositoryName = computed(() => {
  return typeof props.repository?.name === 'string' ? props.repository.name : '';
});

const isContentLoading = computed(() => {
  const pane = activeDetailPane.value;
  return !pane || pane.loading || (!pane.hasData && !pane.error);
});

const isHeaderNonSticky = computed(() => {
  return activeDetailPane.value?.type === 'issue' && isIssueHeaderNonSticky.value;
});

const handleSwitchIssue = (owner: string, repo: string, issueNumber: number) => {
  emit('switch-issue', owner, repo, issueNumber);
};

const handleSwitchPullRequest = (owner: string, repo: string, pullNumber: number) => {
  emit('switch-pull-request', owner, repo, pullNumber);
};

const handleSwitchDiscussion = (owner: string, repo: string, discussionNumber: number) => {
  emit('switch-discussion', owner, repo, discussionNumber);
};

watch(activeDetailKey, () => {
  isIssueHeaderNonSticky.value = false;
  isPullRequestReviewActive.value = false;
});
</script>

<template>
  <Transition name="detail-overlay-fade">
    <DashboardOverlayFrame
      v-if="isOverlayVisible"
      :loading="false"
      :loading-title="activeDetailPane?.loadingTitle || t('detailOverlay.loading.issue')"
      :loading-subtitle="t('detailOverlay.syncing')"
      :back-label="t('detailOverlay.back')"
      :home-label="t('detailOverlay.home')"
      :show-home-button="shouldShowHomeButton"
      :non-sticky-header="isHeaderNonSticky"
      :hide-header="isPullRequestReviewActive"
      content-class="detail-host-content p-0 is-clipped"
      @back="emit('back')"
      @home="emit('home')"
    >
      <div class="detail-pane-stage is-clipped">
        <Transition name="detail-pane-slide">
          <div :key="activeDetailKey" class="detail-pane">
            <div
              v-if="isContentLoading"
              class="detail-loading-pane is-flex is-flex-direction-column is-justify-content-center is-align-items-center"
            >
              <div class="box has-text-centered py-5 px-6 shadow-md detail-loading-box">
                <Loader2Icon
                  class="spin-animation has-text-link mb-3"
                  :size="40"
                  :stroke-width="2.5"
                />

                <p class="is-size-6 has-text-weight-semibold has-text-grey-dark">
                  {{ activeDetailPane?.loadingTitle || t('detailOverlay.loading.issue') }}
                </p>
                <p class="is-size-7 has-text-grey-light mt-1">{{ t('detailOverlay.syncing') }}</p>
              </div>
            </div>

            <div v-else-if="activeDetailPane?.error" class="detail-feedback-pane">
              <div class="notification is-danger is-light mb-0 detail-feedback-box">
                <p class="is-size-6 has-text-weight-semibold mb-2">
                  {{ activeDetailPane.loadingTitle }}
                </p>
                <p class="is-size-7">{{ activeDetailPane.error }}</p>
              </div>
            </div>

            <IssueDetail
              v-else-if="activeDetailPane?.type === 'issue' && issue"
              :issue="issue"
              @update:non-sticky-header="isIssueHeaderNonSticky = $event"
              @switch-issue="handleSwitchIssue"
              @switch-pull-request="handleSwitchPullRequest"
            />

            <PrDetail
              v-else-if="activeDetailPane?.type === 'pull-request' && pullRequest"
              :pull-request="pullRequest"
              :review-active="isPullRequestReviewRoute"
              @update:review-active="isPullRequestReviewActive = $event"
              @open-review="emit('open-pull-request-review')"
              @close-review="emit('close-pull-request-review')"
              @switch-issue="handleSwitchIssue"
              @switch-pull-request="handleSwitchPullRequest"
            />

            <DiscussionDetail
              v-else-if="activeDetailPane?.type === 'discussion' && discussion"
              :discussion="discussion"
              @switch-issue="handleSwitchIssue"
              @switch-pull-request="handleSwitchPullRequest"
              @switch-discussion="handleSwitchDiscussion"
            />

            <ReleaseDetail
              v-else-if="activeDetailPane?.type === 'release' && release"
              :release="release"
            />

            <RepoDetail
              v-else-if="activeDetailPane?.type === 'repository' && repository"
              :repository="repository"
              :owner="repositoryOwner"
              :repo="repositoryName"
            />
          </div>
        </Transition>
      </div>
    </DashboardOverlayFrame>
  </Transition>
</template>

<style scoped lang="scss">
.detail-pane-stage {
  position: relative;
  height: 100%;
  min-height: 0;
  background: var(--gitpulse-surface);
}

.detail-pane {
  position: absolute;
  inset: 0;
  box-sizing: border-box;
  min-height: 0;
  padding: 2rem 4rem;
  overflow: hidden;
  background: var(--gitpulse-surface);
}

.detail-loading-pane {
  height: 100%;
  margin: -2rem -4rem;
  background: var(--gitpulse-surface-muted);
}

.detail-feedback-pane {
  height: 100%;
  margin: -2rem -4rem;
  padding: 2rem;
  background: var(--gitpulse-surface-muted);
}

.detail-loading-box {
  min-width: 200px;
}

.detail-feedback-box {
  max-width: 420px;
}

.detail-overlay-fade-enter-active,
.detail-overlay-fade-leave-active {
  transition: opacity 0.2s ease;
}

.detail-overlay-fade-enter-from,
.detail-overlay-fade-leave-to {
  opacity: 0;
}

.detail-pane-slide-enter-active,
.detail-pane-slide-leave-active {
  transition:
    transform 0.45s ease,
    opacity 0.45s ease;
}

.detail-pane-slide-enter-from {
  transform: translateX(100%);
  opacity: 0;
}

.detail-pane-slide-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}

.spin-animation {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.shadow-md {
  box-shadow: var(--gitpulse-shadow-raised);
}
</style>
