<script setup lang="ts">
import { Loader2Icon } from 'lucide-vue-next';
import { computed, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import DetailOverlay from '~/components/dashboard/DetailOverlay.vue';
import IssueDetail from '~/components/dashboard/IssueDetail.vue';
import PrDetail from '~/components/dashboard/PRDetail.vue';

type DetailPaneType = 'issue' | 'pull-request';

interface ActiveDetailPane {
  type: DetailPaneType;
  key: string;
  loading: boolean;
  hasData: boolean;
  error: string;
  loadingTitle: string;
}

const props = defineProps<{
  issue: Record<string, unknown> | null;
  pullRequest: Record<string, unknown> | null;
  issueError: string;
  isIssueVisible: boolean;
  isPullRequestVisible: boolean;
  issueDetailKey: string;
  pullRequestDetailKey: string;
  loadingIssue: boolean;
  loadingPullRequest: boolean;
}>();

const emit = defineEmits<{
  (e: 'back'): void;
  (e: 'home'): void;
  (e: 'switch-issue', owner: string, repo: string, issueNumber: number): void;
  (e: 'switch-pull-request', owner: string, repo: string, pullNumber: number): void;
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
      loadingTitle: t('issueDetail.loading'),
    };
  }

  if (props.isPullRequestVisible) {
    return {
      type: 'pull-request',
      key: props.pullRequestDetailKey,
      loading: props.loadingPullRequest,
      hasData: Boolean(props.pullRequest),
      error: '',
      loadingTitle: 'Loading Pull Request',
    };
  }

  return null;
});

const activeDetailKey = computed(() => activeDetailPane.value?.key ?? 'empty');

const isOverlayVisible = computed(() => Boolean(activeDetailPane.value));

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

watch(activeDetailKey, () => {
  isIssueHeaderNonSticky.value = false;
  isPullRequestReviewActive.value = false;
});
</script>

<template>
  <Transition name="detail-overlay-fade">
    <DetailOverlay
      v-if="isOverlayVisible"
      :loading="false"
      :loading-title="activeDetailPane?.loadingTitle || t('issueDetail.loading')"
      :loading-subtitle="t('issueDetail.syncing')"
      :back-label="t('issueDetail.back')"
      :home-label="t('issueDetail.home')"
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
                  {{ activeDetailPane?.loadingTitle || t('issueDetail.loading') }}
                </p>
                <p class="is-size-7 has-text-grey-light mt-1">{{ t('issueDetail.syncing') }}</p>
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
              @update:review-active="isPullRequestReviewActive = $event"
              @switch-issue="handleSwitchIssue"
              @switch-pull-request="handleSwitchPullRequest"
            />
          </div>
        </Transition>
      </div>
    </DetailOverlay>
  </Transition>
</template>

<style scoped lang="scss">
:deep(.detail-host-content) {
}

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
  padding: 2rem 8rem;
  overflow: hidden;
  background: var(--gitpulse-surface);
}

.detail-loading-pane {
  height: 100%;
  margin: -2rem -8rem;
  background: var(--gitpulse-surface-muted);
}

.detail-feedback-pane {
  height: 100%;
  margin: -2rem -8rem;
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
