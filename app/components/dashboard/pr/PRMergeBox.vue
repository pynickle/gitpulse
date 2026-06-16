<template>
  <section class="merge-box" :aria-busy="showSkeleton">
    <div
      v-if="showSkeleton"
      class="merge-box__skeleton"
      :aria-label="t('prReview.mergeBox.loading')"
    >
      <div class="merge-box__skeleton-line merge-box__skeleton-line--wide" />
      <div class="merge-box__skeleton-line" />
      <div class="merge-box__skeleton-line merge-box__skeleton-line--short" />
    </div>

    <div v-else-if="showError" class="merge-box__note merge-box__note--danger" role="alert">
      <AlertCircleIcon :size="14" />
      <span>{{ error }}</span>
    </div>

    <template v-else-if="status">
      <!-- Merged -->
      <div v-if="status.merged" class="merge-box__panel merge-box__panel--merged">
        <span class="merge-box__state-icon merge-box__state-icon--merged">
          <GitMergeIcon :size="16" />
        </span>
        <div class="merge-box__panel-body">
          <p class="merge-box__headline">{{ t('prReview.mergeBox.merged') }}</p>
          <p class="merge-box__subline">
            <a
              v-if="status.mergedBy"
              :href="status.mergedBy.htmlUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="merge-box__merged-by"
            >
              <GitHubAvatar
                :src="status.mergedBy.avatarUrl"
                :alt="status.mergedBy.login"
                size="16"
                class="merge-box__merged-avatar"
              />
              <span>{{ status.mergedBy.login }}</span>
            </a>
            <span>{{ t('prReview.mergeBox.mergedTime', { time: mergedTimeLabel }) }}</span>
            <code v-if="shortMergeSha" class="merge-box__sha">{{ shortMergeSha }}</code>
          </p>
        </div>
      </div>

      <!-- Closed without merging -->
      <div v-else-if="status.state === 'closed'" class="merge-box__panel merge-box__panel--closed">
        <span class="merge-box__state-icon merge-box__state-icon--closed">
          <GitPullRequestClosedIcon :size="16" />
        </span>
        <div class="merge-box__panel-body">
          <p class="merge-box__headline">{{ t('prReview.mergeBox.closedTitle') }}</p>
          <p class="merge-box__subline">{{ t('prReview.mergeBox.closedDescription') }}</p>
        </div>
      </div>

      <!-- Open -->
      <div v-else class="merge-box__open">
        <div class="merge-box__row" :class="`merge-box__row--${reviewRow.tone}`">
          <span class="merge-box__row-icon">
            <component :is="reviewRow.icon" :size="13" />
          </span>
          <div class="merge-box__row-body">
            <p class="merge-box__row-title">{{ reviewRow.title }}</p>
            <p v-if="reviewRow.detail" class="merge-box__row-detail">{{ reviewRow.detail }}</p>
          </div>
        </div>

        <template v-if="checksRow">
          <button
            type="button"
            class="merge-box__row merge-box__row--toggle"
            :class="`merge-box__row--${checksRow.tone}`"
            :aria-expanded="checksExpanded"
            :aria-label="t('prReview.mergeBox.toggleChecks')"
            @click="checksExpanded = !checksExpanded"
          >
            <span class="merge-box__row-icon">
              <component :is="checksRow.icon" :size="13" />
            </span>
            <div class="merge-box__row-body">
              <p class="merge-box__row-title">{{ checksRow.title }}</p>
              <p v-if="checksRow.detail" class="merge-box__row-detail">{{ checksRow.detail }}</p>
            </div>
            <ChevronDownIcon
              :size="14"
              class="merge-box__chevron"
              :class="{ 'merge-box__chevron--open': checksExpanded }"
            />
          </button>
          <Transition name="expand">
            <ul v-if="checksExpanded" class="merge-box__check-list">
              <li
                v-for="(run, index) in status.checks.runs"
                :key="`${run.name}:${index}`"
                class="merge-box__check-item"
              >
                <span
                  class="merge-box__check-dot"
                  :class="`merge-box__check-dot--${runTone(run)}`"
                />
                <a
                  v-if="run.htmlUrl"
                  :href="run.htmlUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="merge-box__check-name merge-box__check-name--link"
                >
                  {{ run.name }}
                </a>
                <span v-else class="merge-box__check-name">{{ run.name }}</span>
                <span v-if="run.appName" class="merge-box__check-app">{{ run.appName }}</span>
              </li>
            </ul>
          </Transition>
        </template>

        <div class="merge-box__row" :class="`merge-box__row--${mergeabilityRow.tone}`">
          <span class="merge-box__row-icon">
            <component :is="mergeabilityRow.icon" :size="13" />
          </span>
          <div class="merge-box__row-body">
            <p class="merge-box__row-title">{{ mergeabilityRow.title }}</p>
          </div>
        </div>

        <div v-if="status.viewerCanMerge && !status.draft" class="merge-box__actions">
          <div v-if="mergeError" class="merge-box__note merge-box__note--danger" role="alert">
            <AlertCircleIcon :size="14" />
            <span>{{ mergeError }}</span>
          </div>
          <div v-if="!showCommitForm" ref="mergeControlsRef" class="merge-box__merge-controls">
            <button
              type="button"
              class="merge-box__merge-btn"
              :class="{ 'merge-box__merge-btn--confirm': confirming }"
              :disabled="mergeDisabled"
              @click="onMergeClick"
            >
              <span v-if="merging" class="merge-box__spinner" aria-hidden="true" />
              <GitMergeIcon v-else :size="14" />
              <span>{{ mergeButtonLabel }}</span>
            </button>
            <button
              v-if="!confirming"
              type="button"
              class="merge-box__method-toggle"
              :disabled="mergeDisabled"
              :aria-label="t('prReview.mergeBox.selectMethod')"
              :aria-expanded="dropdownOpen"
              @click="dropdownOpen = !dropdownOpen"
            >
              <ChevronDownIcon :size="14" />
            </button>
            <button
              v-else
              type="button"
              class="merge-box__cancel-btn"
              :disabled="merging"
              @click="cancelConfirm"
            >
              {{ t('prReview.mergeBox.cancel') }}
            </button>
            <div v-if="dropdownOpen" class="merge-box__method-menu" role="menu">
              <button
                v-for="method in mergeMethods"
                :key="method"
                type="button"
                class="merge-box__method-option"
                role="menuitemradio"
                :aria-checked="method === selectedMethod"
                @click="selectMergeMethod(method)"
              >
                <CheckIcon
                  :size="12"
                  class="merge-box__method-check"
                  :class="{ 'merge-box__method-check--hidden': method !== selectedMethod }"
                />
                <span>{{ methodLabel(method) }}</span>
              </button>
            </div>
          </div>

          <form
            v-else
            class="merge-box__commit-form"
            @submit.prevent="performMerge"
            @keydown.esc.stop.prevent="cancelConfirm"
          >
            <div class="merge-box__field">
              <label class="merge-box__field-label" :for="commitTitleId">
                {{ t('prReview.mergeBox.commitTitleLabel') }}
              </label>
              <input
                :id="commitTitleId"
                v-model="commitTitle"
                class="input merge-box__commit-input"
                type="text"
                :disabled="merging"
              />
            </div>
            <div class="merge-box__field">
              <label class="merge-box__field-label" :for="commitMessageId">
                {{ t('prReview.mergeBox.commitMessageLabel') }}
              </label>
              <textarea
                :id="commitMessageId"
                v-model="commitMessage"
                class="textarea merge-box__commit-textarea"
                rows="4"
                :placeholder="t('prReview.mergeBox.commitMessagePlaceholder')"
                :disabled="merging"
              />
            </div>
            <div class="merge-box__form-actions">
              <button
                type="submit"
                class="merge-box__merge-btn merge-box__merge-btn--confirm"
                :disabled="merging"
              >
                <span v-if="merging" class="merge-box__spinner" aria-hidden="true" />
                <GitMergeIcon v-else :size="14" />
                <span>{{ merging ? t('prReview.mergeBox.merging') : confirmLabel }}</span>
              </button>
              <button
                type="button"
                class="merge-box__cancel-btn"
                :disabled="merging"
                @click="cancelConfirm"
              >
                {{ t('prReview.mergeBox.cancel') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import {
  AlertCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  GitMergeIcon,
  GitPullRequestClosedIcon,
  XIcon,
} from 'lucide-vue-next';
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useId, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { formatDurationFromNow } from '#imports';
import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';
import type {
  PRCheckRunSummary,
  PRMergeMethod,
  PRMergeStatus,
} from '~/composables/usePRMergeStatus';

const props = defineProps<{
  owner: string;
  repo: string;
  pullNumber: number;
  prTitle?: string;
  headLabel?: string;
  initialStatus?: PRMergeStatus | null;
}>();

const emit = defineEmits<{
  merged: [];
}>();

const { t, locale } = useI18n();
const relativeTimeNow = useRelativeTimeNow();
const {
  mergeStatus,
  loading,
  error,
  mergeError,
  setMergeStatus,
  fetchMergeStatus,
  mergePullRequest,
} = usePRMergeStatus();

const mergeMethods: PRMergeMethod[] = ['merge', 'squash', 'rebase'];
const selectedMethod = shallowRef<PRMergeMethod>('merge');
const dropdownOpen = shallowRef(false);
const confirming = shallowRef(false);
const merging = shallowRef(false);
const checksExpanded = shallowRef(false);
const commitTitle = shallowRef('');
const commitMessage = shallowRef('');
const mergeControlsRef = ref<HTMLElement | null>(null);
const commitTitleId = useId();
const commitMessageId = useId();

const status = computed(() => mergeStatus.value);
const showSkeleton = computed(() => loading.value && !status.value);
const showError = computed(() => Boolean(error.value) && !status.value);

const mergedTimeLabel = computed(() => {
  const mergedAt = status.value?.mergedAt;
  return mergedAt ? formatDurationFromNow(mergedAt, locale.value, relativeTimeNow.value) : '';
});

const shortMergeSha = computed(() => status.value?.mergeCommitSha?.slice(0, 7) ?? '');

type RowTone = 'success' | 'danger' | 'warning' | 'muted';

interface MergeBoxRow {
  tone: RowTone;
  icon: typeof CheckIcon;
  title: string;
  detail?: string;
}

const reviewRow = computed<MergeBoxRow>(() => {
  const current = status.value;
  const approved = current?.reviewSummary.approved ?? 0;
  const changesRequested = current?.reviewSummary.changesRequested ?? 0;

  switch (current?.reviewDecision) {
    case 'approved':
      return {
        tone: 'success',
        icon: CheckIcon,
        title: t('prReview.mergeBox.reviewApproved'),
        detail: t('prReview.mergeBox.reviewApprovedCount', { count: approved }),
      };
    case 'changes_requested':
      return {
        tone: 'danger',
        icon: XIcon,
        title: t('prReview.mergeBox.reviewChangesRequested'),
        detail: t('prReview.mergeBox.reviewChangesRequestedCount', { count: changesRequested }),
      };
    case 'review_required':
      return {
        tone: 'warning',
        icon: ClockIcon,
        title: t('prReview.mergeBox.reviewRequired'),
      };
    default:
      return {
        tone: 'muted',
        icon: CheckIcon,
        title: t('prReview.mergeBox.reviewNone'),
      };
  }
});

const checksRow = computed<MergeBoxRow | null>(() => {
  const checks = status.value?.checks;
  if (!checks || checks.total <= 0) {
    return null;
  }

  if (checks.failure > 0) {
    return {
      tone: 'danger',
      icon: XIcon,
      title: t('prReview.mergeBox.checksFailed'),
      detail: t('prReview.mergeBox.checksFailedCount', {
        failed: checks.failure,
        total: checks.total,
      }),
    };
  }

  if (checks.pending > 0) {
    return {
      tone: 'warning',
      icon: ClockIcon,
      title: t('prReview.mergeBox.checksPending'),
    };
  }

  return {
    tone: 'success',
    icon: CheckIcon,
    title: t('prReview.mergeBox.checksPassed'),
  };
});

const mergeabilityRow = computed<MergeBoxRow>(() => {
  const current = status.value;

  if (current?.draft) {
    return {
      tone: 'muted',
      icon: ClockIcon,
      title: t('prReview.mergeBox.mergeableDraft'),
    };
  }

  switch (current?.mergeableState) {
    case 'clean':
      return {
        tone: 'success',
        icon: CheckIcon,
        title: t('prReview.mergeBox.mergeableClean'),
      };
    case 'dirty':
      return {
        tone: 'danger',
        icon: XIcon,
        title: t('prReview.mergeBox.mergeableDirty'),
      };
    case 'behind':
      return {
        tone: 'warning',
        icon: AlertCircleIcon,
        title: t('prReview.mergeBox.mergeableBehind'),
      };
    case 'blocked':
      return {
        tone: 'danger',
        icon: AlertCircleIcon,
        title: t('prReview.mergeBox.mergeableBlocked'),
      };
    case 'unstable':
    case 'has_hooks':
      return {
        tone: 'muted',
        icon: AlertCircleIcon,
        title: t('prReview.mergeBox.mergeableUnstable'),
      };
    default:
      return {
        tone: 'muted',
        icon: ClockIcon,
        title: t('prReview.mergeBox.mergeableChecking'),
      };
  }
});

const runTone = (run: PRCheckRunSummary): RowTone => {
  if (run.status !== 'completed') {
    return 'warning';
  }

  switch (run.conclusion) {
    case 'success':
      return 'success';
    case 'failure':
    case 'timed_out':
    case 'cancelled':
    case 'action_required':
    case 'startup_failure':
      return 'danger';
    default:
      return 'muted';
  }
};

const mergeDisabled = computed(() => {
  const current = status.value;
  if (!current || merging.value || loading.value) {
    return true;
  }

  // Only enable once GitHub has positively confirmed mergeability:
  // mergeable === null means the check is still running.
  if (current.mergeable !== true) {
    return true;
  }

  return current.mergeableState === 'dirty' || current.mergeableState === 'blocked';
});

const methodLabel = (method: PRMergeMethod) => {
  switch (method) {
    case 'squash':
      return t('prReview.mergeBox.methodSquash');
    case 'rebase':
      return t('prReview.mergeBox.methodRebase');
    default:
      return t('prReview.mergeBox.methodMerge');
  }
};

const mergeButtonLabel = computed(() => {
  if (merging.value) {
    return t('prReview.mergeBox.merging');
  }

  if (confirming.value) {
    return confirmLabel.value;
  }

  return methodLabel(selectedMethod.value);
});

const confirmLabel = computed(() => {
  switch (selectedMethod.value) {
    case 'squash':
      return t('prReview.mergeBox.confirmSquash');
    case 'rebase':
      return t('prReview.mergeBox.confirmRebase');
    default:
      return t('prReview.mergeBox.confirmMerge');
  }
});

const showCommitForm = computed(() => confirming.value && selectedMethod.value !== 'rebase');

const defaultCommitTitle = (method: PRMergeMethod) => {
  if (method === 'squash') {
    return props.prTitle ? `${props.prTitle} (#${props.pullNumber})` : '';
  }

  return props.headLabel
    ? `Merge pull request #${props.pullNumber} from ${props.headLabel}`
    : `Merge pull request #${props.pullNumber}`;
};

const prefillCommitForm = () => {
  commitTitle.value = defaultCommitTitle(selectedMethod.value);
  commitMessage.value = '';
};

const selectMergeMethod = (method: PRMergeMethod) => {
  selectedMethod.value = method;
  dropdownOpen.value = false;
  confirming.value = false;
};

const cancelConfirm = () => {
  if (merging.value) {
    return;
  }

  confirming.value = false;
};

const performMerge = async () => {
  if (merging.value) {
    return;
  }

  const title = showCommitForm.value ? commitTitle.value.trim() : '';
  const message = showCommitForm.value ? commitMessage.value.trim() : '';

  merging.value = true;
  try {
    const succeeded = await mergePullRequest(props.owner, props.repo, props.pullNumber, {
      method: selectedMethod.value,
      ...(title ? { commitTitle: title } : {}),
      ...(message ? { commitMessage: message } : {}),
    });

    if (succeeded) {
      emit('merged');
      confirming.value = false;
    }
  } finally {
    merging.value = false;
  }
};

const onMergeClick = async () => {
  if (mergeDisabled.value) {
    return;
  }

  if (!confirming.value) {
    dropdownOpen.value = false;
    prefillCommitForm();
    confirming.value = true;
    return;
  }

  await performMerge();
  confirming.value = false;
};

const onDocumentClick = (event: MouseEvent) => {
  if (!dropdownOpen.value) {
    return;
  }

  const target = event.target;
  if (target instanceof Node && mergeControlsRef.value?.contains(target)) {
    return;
  }

  dropdownOpen.value = false;
};

// GitHub computes mergeability asynchronously; while `mergeable` is null,
// poll a few times so the button unlocks without a manual refresh.
const MERGEABILITY_POLL_DELAY_MS = 3000;
const MERGEABILITY_POLL_MAX_ATTEMPTS = 5;
let mergeabilityPollTimer: ReturnType<typeof setTimeout> | null = null;
let mergeabilityPollAttempts = 0;

const stopMergeabilityPolling = () => {
  if (mergeabilityPollTimer !== null) {
    clearTimeout(mergeabilityPollTimer);
    mergeabilityPollTimer = null;
  }
};

watch(
  () => status.value,
  (current) => {
    stopMergeabilityPolling();

    const shouldPoll =
      current &&
      !current.merged &&
      current.state === 'open' &&
      current.mergeable === null &&
      mergeabilityPollAttempts < MERGEABILITY_POLL_MAX_ATTEMPTS;

    if (!shouldPoll) {
      return;
    }

    mergeabilityPollTimer = setTimeout(() => {
      mergeabilityPollAttempts += 1;
      fetchMergeStatus(props.owner, props.repo, props.pullNumber);
    }, MERGEABILITY_POLL_DELAY_MS);
  }
);

onMounted(() => {
  document.addEventListener('click', onDocumentClick);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick);
  stopMergeabilityPolling();
});

watch(
  () => [props.owner, props.repo, props.pullNumber, props.initialStatus] as const,
  ([owner, repo, pullNumber, initialStatus]) => {
    dropdownOpen.value = false;
    confirming.value = false;
    checksExpanded.value = false;
    selectedMethod.value = 'merge';
    commitTitle.value = '';
    commitMessage.value = '';
    stopMergeabilityPolling();
    mergeabilityPollAttempts = 0;

    if (initialStatus) {
      setMergeStatus(initialStatus);
      return;
    }

    setMergeStatus(null);

    if (owner && repo && pullNumber) {
      fetchMergeStatus(owner, repo, pullNumber);
    }
  },
  { immediate: true }
);
</script>

<style scoped lang="scss">
.merge-box {
  border: 1px solid var(--gitpulse-border);
  border-radius: 12px;
  background: var(--gitpulse-surface);
  overflow: visible;
}

/* ── Skeleton ── */
.merge-box__skeleton {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
}

.merge-box__skeleton-line {
  height: 12px;
  width: 60%;
  border-radius: 6px;
  background: var(--gitpulse-skeleton-shimmer);
  background-size: 200% 100%;
  animation: merge-box-shimmer 1.4s ease infinite;

  &--wide {
    width: 85%;
  }

  &--short {
    width: 40%;
  }
}

@keyframes merge-box-shimmer {
  0% {
    background-position: 200% 0;
  }

  100% {
    background-position: -200% 0;
  }
}

/* ── Notes ── */
.merge-box__note {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 16px;
  font-size: 12px;
  border-radius: 8px;

  svg {
    flex-shrink: 0;
    margin-top: 1px;
  }

  &--danger {
    color: var(--gitpulse-danger-solid);
    background: var(--gitpulse-danger-soft);
  }
}

/* ── Terminal panels (merged / closed) ── */
.merge-box__panel {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  border-radius: 12px;

  &--merged {
    background: var(--gitpulse-purple-soft);
    border-left: 3px solid var(--gitpulse-purple);
  }

  &--closed {
    background: var(--gitpulse-surface-muted);
    border-left: 3px solid var(--gitpulse-danger);
  }
}

.merge-box__state-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  flex-shrink: 0;

  &--merged {
    background: var(--gitpulse-surface);
    color: var(--gitpulse-purple);
  }

  &--closed {
    background: var(--gitpulse-danger-soft);
    color: var(--gitpulse-danger);
  }
}

.merge-box__panel-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.merge-box__headline {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));

  .merge-box__panel--merged & {
    color: var(--gitpulse-purple);
  }
}

.merge-box__subline {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  font-size: 12px;
  color: var(--gitpulse-text-muted);
}

.merge-box__merged-by {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-weight: 500;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  text-decoration: none;
  transition: color 0.2s ease;

  &:hover {
    color: var(--gitpulse-purple);
  }
}

.merge-box__merged-avatar {
  width: 16px;
  height: 16px;
  border-radius: 50%;
}

.merge-box__sha {
  padding: 1px 6px;
  font-family: var(--gitpulse-code-font-family);
  font-size: 11px;
  color: var(--gitpulse-purple);
  background: var(--gitpulse-surface);
  border: 1px solid var(--gitpulse-border);
  border-radius: 6px;
}

/* ── Open state rows ── */
.merge-box__open {
  display: flex;
  flex-direction: column;
}

.merge-box__row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px 16px;
  border: 0;
  border-bottom: 1px solid var(--gitpulse-border);
  background: transparent;
  text-align: left;

  &--toggle {
    cursor: pointer;
    font: inherit;
    transition: background-color 0.2s ease;

    &:hover {
      background: var(--gitpulse-surface-hover);
    }
  }
}

.merge-box__row-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  flex-shrink: 0;

  .merge-box__row--success & {
    background: var(--gitpulse-success-soft);
    color: var(--gitpulse-success);
  }

  .merge-box__row--danger & {
    background: var(--gitpulse-danger-soft);
    color: var(--gitpulse-danger);
  }

  .merge-box__row--warning & {
    background: var(--gitpulse-warning-soft);
    color: var(--gitpulse-warning);
  }

  .merge-box__row--muted & {
    background: var(--gitpulse-surface-hover);
    color: var(--gitpulse-text-muted);
  }
}

.merge-box__row-body {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1;
}

.merge-box__row-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
}

.merge-box__row-detail {
  margin: 0;
  font-size: 11px;
  line-height: 1.4;
  color: var(--gitpulse-text-muted);
}

.merge-box__chevron {
  flex-shrink: 0;
  color: var(--gitpulse-text-muted);
  transition: transform 0.2s ease;

  &--open {
    transform: rotate(180deg);
  }
}

/* ── Checks list ── */
.merge-box__check-list {
  margin: 0;
  padding: 6px 0;
  list-style: none;
  max-height: 240px;
  overflow-y: auto;
  background: var(--gitpulse-surface-muted);
  border-bottom: 1px solid var(--gitpulse-border);
}

.merge-box__check-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 16px 5px 22px;
  font-size: 12px;
}

.merge-box__check-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;

  &--success {
    background: var(--gitpulse-success);
  }

  &--danger {
    background: var(--gitpulse-danger);
  }

  &--warning {
    background: var(--gitpulse-warning);
  }

  &--muted {
    background: var(--gitpulse-text-subtle);
  }
}

.merge-box__check-name {
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &--link {
    text-decoration: none;
    transition: color 0.2s ease;

    &:hover {
      color: var(--gitpulse-accent);
      text-decoration: underline;
    }
  }
}

.merge-box__check-app {
  margin-left: auto;
  flex-shrink: 0;
  font-size: 11px;
  color: var(--gitpulse-text-subtle);
}

/* ── Merge actions ── */
.merge-box__actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px;
  background: var(--gitpulse-surface-muted);
  border-radius: 0 0 12px 12px;
}

.merge-box__merge-controls {
  position: relative;
  display: flex;
  align-items: stretch;
  gap: 0;
}

.merge-box__merge-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 14px;
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  color: #ffffff;
  background: var(--gitpulse-success-solid);
  border: 1px solid var(--gitpulse-success-solid);
  border-radius: 8px 0 0 8px;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease;

  &:hover:not(:disabled) {
    background: var(--gitpulse-success-solid-hover);
    border-color: var(--gitpulse-success-solid-hover);
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  &--confirm {
    border-radius: 8px;
  }
}

.merge-box__method-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 34px;
  padding: 0 8px;
  color: #ffffff;
  background: var(--gitpulse-success-solid);
  border: 1px solid var(--gitpulse-success-solid);
  border-left-color: color-mix(in srgb, #ffffff 28%, transparent);
  border-radius: 0 8px 8px 0;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease;

  &:hover:not(:disabled) {
    background: var(--gitpulse-success-solid-hover);
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  svg {
    display: block;
  }
}

.merge-box__cancel-btn {
  margin-left: 8px;
  height: 34px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 500;
  color: var(--gitpulse-text-muted);
  background: var(--gitpulse-surface);
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
  cursor: pointer;
  transition:
    color 0.2s ease,
    border-color 0.2s ease;

  &:hover:not(:disabled) {
    color: var(--bulma-text-strong, var(--gitpulse-text-strong));
    border-color: var(--gitpulse-border-strong);
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
}

.merge-box__method-menu {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  min-width: 200px;
  padding: 4px;
  background: var(--gitpulse-surface-raised);
  border: 1px solid var(--gitpulse-border);
  border-radius: 10px;
  box-shadow: var(--gitpulse-shadow-card);
}

.merge-box__method-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  background: transparent;
  border: 0;
  border-radius: 6px;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.2s ease;

  &:hover {
    background: var(--gitpulse-surface-hover);
  }
}

.merge-box__method-check {
  flex-shrink: 0;
  color: var(--gitpulse-success);

  &--hidden {
    visibility: hidden;
  }
}

.merge-box__commit-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--gitpulse-surface);
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
}

.merge-box__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.merge-box__field-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--gitpulse-text-muted);
}

.merge-box__commit-input,
.merge-box__commit-textarea {
  width: 100%;
  padding: 7px 10px;
  font-size: 12px;
  font-family: inherit;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  background: var(--gitpulse-input-bg);
  border: 1px solid var(--gitpulse-input-border);
  border-radius: 8px;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;

  &::placeholder {
    color: var(--gitpulse-text-subtle);
  }

  &:focus {
    outline: none;
    border-color: var(--gitpulse-focus-ring);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--gitpulse-focus-ring) 24%, transparent);
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
}

.merge-box__commit-textarea {
  font-family: var(--gitpulse-code-font-family);
  line-height: 1.5;
  resize: vertical;
  min-height: 84px;
}

.merge-box__form-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;

  .merge-box__cancel-btn {
    margin-left: 0;
  }
}

.merge-box__spinner {
  width: 13px;
  height: 13px;
  border: 2px solid color-mix(in srgb, #ffffff 35%, transparent);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: merge-box-spin 0.7s linear infinite;
}

@keyframes merge-box-spin {
  to {
    transform: rotate(360deg);
  }
}

.expand-enter-active,
.expand-leave-active {
  max-height: 240px;
  transition:
    opacity 0.15s ease,
    transform 0.2s ease,
    max-height 0.2s ease,
    padding-top 0.2s ease,
    padding-bottom 0.2s ease;
  overflow: hidden;
  will-change: transform, opacity;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
  transform: translateY(-4px);
  padding-top: 0;
  padding-bottom: 0;
}
</style>
