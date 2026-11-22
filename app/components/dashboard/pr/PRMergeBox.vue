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
      <CircleExclamationPointIcon :size="14" />
      <span>{{ error }}</span>
    </div>

    <template v-else-if="status">
      <!-- A reread that failed keeps this status on screen; the same alert is shown
      above it, because replacing the box would throw away data the reader can use. -->
      <div v-if="error" class="merge-box__note merge-box__note--danger" role="alert">
        <CircleExclamationPointIcon :size="14" />
        <span>{{ error }}</span>
      </div>

      <!-- Merged -->
      <template v-if="status.merged">
        <div
          class="merge-box__panel merge-box__panel--merged"
          :class="{ 'merge-box__panel--attached': showHeadBranchActions }"
        >
          <span class="merge-box__state-icon merge-box__state-icon--merged">
            <GitMergeIcon :size="16" />
          </span>
          <div class="merge-box__panel-body">
            <p class="merge-box__headline">{{ t('prReview.mergeBox.merged') }}</p>
            <p class="merge-box__subline">
              <GitHubProfileLink
                v-if="status.mergedBy"
                :login="status.mergedBy.login"
                :github-href="status.mergedBy.htmlUrl"
                class="merge-box__merged-by"
              >
                <GitHubAvatar
                  :src="status.mergedBy.avatarUrl"
                  :alt="status.mergedBy.login"
                  size="16"
                  class="merge-box__merged-avatar"
                />
                <span>{{ status.mergedBy.login }}</span>
              </GitHubProfileLink>
              <span>{{ t('prReview.mergeBox.mergedTime', { time: mergedTimeLabel }) }}</span>
              <code v-if="shortMergeSha" class="merge-box__sha">{{ shortMergeSha }}</code>
            </p>
          </div>
        </div>
      </template>

      <!-- Closed without merging -->
      <div
        v-else-if="status.state === 'closed'"
        class="merge-box__panel merge-box__panel--closed"
        :class="{ 'merge-box__panel--attached': showHeadBranchActions }"
      >
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
            <ScrollArea v-if="checksExpanded" class="merge-box__check-list">
              <!-- A truncated rollup already says so on the checks row itself. -->
              <CheckListRows :groups="checksView.groups" />
            </ScrollArea>
          </Transition>
        </template>

        <div class="merge-box__row merge-box__currency" :class="`merge-box__row--${currencyTone}`">
          <span class="merge-box__row-icon">
            <component :is="currencyIcon" :size="13" />
          </span>
          <p class="merge-box__row-title">{{ currencySentence }}</p>
          <div v-if="showBranchUpdate" class="merge-box__update">
            <div
              v-if="branchUpdateError"
              class="merge-box__note merge-box__note--danger"
              role="alert"
            >
              <CircleExclamationPointIcon :size="14" />
              <span>{{ branchUpdateError }}</span>
            </div>
            <div ref="updateControlsRef" class="merge-box__merge-controls">
              <button
                type="button"
                class="merge-box__merge-btn"
                :class="{
                  'merge-box__merge-btn--confirm': updateConfirming,
                  'merge-box__merge-btn--standalone': !updateConfirming && !rebaseUpdateAllowed,
                  'merge-box__merge-btn--busy': updating,
                }"
                :disabled="branchUpdateDisabled"
                :aria-busy="updating || undefined"
                @click="onBranchUpdateClick"
              >
                <span v-if="updating" class="merge-box__spinner" aria-hidden="true" />
                <GitMergeIcon v-else :size="14" />
                <span>{{ branchUpdateButtonLabel }}</span>
              </button>
              <button
                v-if="!updateConfirming && rebaseUpdateAllowed"
                type="button"
                class="merge-box__method-toggle"
                :disabled="branchUpdateDisabled"
                :aria-label="t('prReview.mergeBox.selectUpdateMethod')"
                :aria-expanded="updateMenuOpen"
                @click="toggleBranchUpdateMenu"
              >
                <ChevronDownIcon :size="14" />
              </button>
              <button
                v-else-if="updateConfirming"
                type="button"
                class="merge-box__cancel-btn"
                :disabled="updating"
                @click="cancelBranchUpdate"
              >
                {{ t('prReview.mergeBox.cancel') }}
              </button>
              <div v-if="updateMenuOpen" class="merge-box__method-menu" role="menu">
                <button
                  type="button"
                  class="merge-box__method-option"
                  role="menuitemradio"
                  :aria-checked="updateMethod === 'merge'"
                  @click="selectBranchUpdateMethod('merge')"
                >
                  <CheckIcon
                    :size="12"
                    class="merge-box__method-check"
                    :class="{ 'merge-box__method-check--hidden': updateMethod !== 'merge' }"
                  />
                  <span>{{ t('prReview.mergeBox.updateWithMerge') }}</span>
                </button>
                <button
                  type="button"
                  class="merge-box__method-option"
                  role="menuitemradio"
                  :aria-checked="updateMethod === 'rebase'"
                  @click="selectBranchUpdateMethod('rebase')"
                >
                  <CheckIcon
                    :size="12"
                    class="merge-box__method-check"
                    :class="{ 'merge-box__method-check--hidden': updateMethod !== 'rebase' }"
                  />
                  <span>{{ t('prReview.mergeBox.updateWithRebase') }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="merge-box__row" :class="`merge-box__row--${mergeabilityRow.tone}`">
          <span class="merge-box__row-icon">
            <component :is="mergeabilityRow.icon" :size="13" />
          </span>
          <div class="merge-box__row-body">
            <p class="merge-box__row-title">{{ mergeabilityRow.title }}</p>
          </div>
        </div>

        <div v-if="showStackRebase" class="merge-box__actions">
          <div class="merge-box__merge-controls">
            <button
              type="button"
              class="merge-box__merge-btn merge-box__merge-btn--standalone"
              aria-haspopup="dialog"
              @click="stackRebaseOpen = true"
            >
              <GitBranchIcon :size="14" aria-hidden="true" />
              {{ t('prReview.stackRebase.title') }}
            </button>
          </div>
        </div>
        <PRStackRebaseDialog
          v-if="stack && stackRebaseOpen"
          :key="`${owner}/${repo}/${pullNumber}`"
          :owner="owner"
          :repo="repo"
          :stack="stack"
          @close="stackRebaseOpen = false"
          @settled="refreshAfterStackRebase"
        />

        <div v-if="showMergeActions" class="merge-box__actions">
          <p class="is-sr-only" role="status" aria-live="polite">
            {{ loadingCommitDefaults ? t('prReview.mergeBox.loadingCommitDefaults') : '' }}
          </p>
          <ul v-if="confirming && landingLayers.length" class="merge-box__stack-layers">
            <li v-for="layer in landingLayers" :key="layer.number" class="merge-box__stack-layer">
              <span class="merge-box__stack-layer-number">#{{ layer.number }}</span
              >{{ stackLayerGap }}<span class="merge-box__stack-layer-title">{{ layer.title }}</span
              >{{ stackLayerGap
              }}<span class="merge-box__stack-layer-state" :data-state="layer.state">{{
                layerStateLabel(layer.state)
              }}</span>
            </li>
          </ul>
          <p
            v-if="stackMergeStatusLabel"
            class="merge-box__stack-outcome"
            :class="{ 'merge-box__note merge-box__note--danger': stackMergePhase === 'failed' }"
            :role="stackMergePhase === 'failed' ? 'alert' : 'status'"
          >
            {{ stackMergeStatusLabel }}
          </p>
          <div v-if="mergeError" class="merge-box__note merge-box__note--danger" role="alert">
            <CircleExclamationPointIcon :size="14" />
            <span>{{ mergeError }}</span>
          </div>
          <div
            v-if="!stackMergeHolding && !showCommitForm"
            ref="mergeControlsRef"
            class="merge-box__merge-controls"
          >
            <button
              type="button"
              class="merge-box__merge-btn"
              :class="{
                'merge-box__merge-btn--confirm': confirming,
                'merge-box__merge-btn--standalone': !confirming && !showMethodMenu,
                'merge-box__merge-btn--busy': mergeButtonBusy,
              }"
              :disabled="mergeDisabled"
              :aria-busy="mergeButtonBusy || undefined"
              @click="onMergeClick"
            >
              <span v-if="mergeButtonBusy" class="merge-box__spinner" aria-hidden="true" />
              <GitMergeIcon v-else :size="14" />
              <span>{{ mergeButtonLabel }}</span>
            </button>
            <button
              v-if="!confirming && showMethodMenu"
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
              v-else-if="confirming"
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
            v-else-if="!stackMergeHolding"
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

      <div v-if="showHeadBranchActions" class="merge-box__branch-actions">
        <div v-if="branchActionError" class="merge-box__note merge-box__note--danger" role="alert">
          <CircleExclamationPointIcon :size="14" />
          <span>{{ branchActionError }}</span>
        </div>

        <div class="merge-box__branch-row">
          <span class="merge-box__branch-icon">
            <GitBranchIcon :size="14" />
          </span>
          <code v-if="headBranchLabel" class="merge-box__branch-label">
            {{ headBranchLabel }}
          </code>

          <button
            v-if="headBranchActionMode"
            type="button"
            class="merge-box__branch-btn"
            :class="`merge-box__branch-btn--${headBranchActionMode}`"
            :disabled="branchActionInProgress"
            @click="performHeadBranchAction"
          >
            <span
              v-if="branchActionInProgress"
              class="merge-box__spinner merge-box__spinner--branch"
              aria-hidden="true"
            />
            <TrashIcon v-else-if="headBranchActionMode === 'delete'" :size="13" />
            <RotateCcwIcon v-else :size="13" />
            <span>{{ headBranchActionLabel }}</span>
          </button>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import {
  CircleExclamationPointIcon,
  CheckIcon,
  ChevronDownIcon,
  GitBranchIcon,
  ClockIcon,
  GitMergeIcon,
  GitPullRequestClosedIcon,
  RotateCcwIcon,
  TrashIcon,
  XIcon,
} from '@lucide/vue';
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useId, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type {
  PullRequestStack,
  PullRequestStackLayerState,
  StackMergeOutcome,
} from '#shared/types/pulls';
import { CHECK_ROLLUP_CONTEXT_LIMIT, toPullRequestChecksView } from '#shared/utils/pr-checks';
import CheckListRows from '~/components/dashboard/pr/CheckListRows.vue';
import PRStackRebaseDialog from '~/components/dashboard/pr/PRStackRebaseDialog.vue';
import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';
import GitHubProfileLink from '~/components/ui/GitHubProfileLink.vue';
import ScrollArea from '~/components/ui/ScrollArea.vue';
import type { PRMergeMethod, PRMergeStatus } from '~/composables/usePRMergeStatus';

const {
  owner,
  repo,
  pullNumber,
  initialStatus,
  stack = null,
} = defineProps<{
  owner: string;
  repo: string;
  pullNumber: number;
  initialStatus?: PRMergeStatus | null;
  /** Present only when this pull request is a Layer. */
  stack?: PullRequestStack | null;
}>();

const emit = defineEmits<{
  merged: [];
  headBranchUpdated: [];
  branchUpdated: [];
}>();

const { t, locale } = useI18n();
const relativeTimeNow = useRelativeTimeNow();
const {
  mergeStatus,
  loading,
  error,
  mergeError,
  branchActionError,
  commitDefaults,
  setMergeStatus,
  resetMergeStatus,
  fetchMergeStatus,
  fetchCommitDefaults,
  clearCommitDefaults,
  mergePullRequest,
  mergeStack,
  deleteHeadBranch,
  restoreHeadBranch,
  branchUpdateError,
  updatePullRequestBranch,
} = usePRMergeStatus();

const ALL_MERGE_METHODS: PRMergeMethod[] = ['merge', 'squash', 'rebase'];
type BranchUpdateMethod = 'merge' | 'rebase';
const selectedMethod = shallowRef<PRMergeMethod>('merge');
const dropdownOpen = shallowRef(false);
const confirming = shallowRef(false);
const merging = shallowRef(false);
const updateMethod = shallowRef<BranchUpdateMethod>('merge');
const updateMenuOpen = shallowRef(false);
const updateConfirming = shallowRef(false);
const updating = shallowRef(false);
let suppressMergeabilityPoll = false;
/** The confirm step is open but its Default Commit Message is still being read. */
const loadingCommitDefaults = shallowRef(false);
const branchAction = shallowRef<'delete' | 'restore' | null>(null);
const checksExpanded = shallowRef(false);
const commitTitle = shallowRef('');
const commitMessage = shallowRef('');
const stackMergePhase = shallowRef<StackMergeOutcome | null>(null);
const stackRebaseOpen = shallowRef(false);
/** The flex row's gap is visual only; the text still needs a separator between fields. */
const stackLayerGap = ' ';
const prefillTitle = shallowRef('');
const prefillMessage = shallowRef('');
const mergeControlsRef = ref<HTMLElement | null>(null);
const updateControlsRef = ref<HTMLElement | null>(null);
const commitTitleId = useId();
const commitMessageId = useId();

const status = computed(() => mergeStatus.value);
const showSkeleton = computed(() => loading.value && !status.value);
const showError = computed(() => Boolean(error.value) && !status.value);

/** The repository's own list, or every method when the settings could not be read. */
const mergeMethods = computed<PRMergeMethod[]>(
  () => status.value?.allowedMergeMethods ?? ALL_MERGE_METHODS
);

/** GitHub hides the method picker when there is nothing to choose between. */
const showMethodMenu = computed(() => mergeMethods.value.length > 1);

/** A method the repository disables can never stay selected. */
watch(mergeMethods, (methods) => {
  if (!methods.includes(selectedMethod.value)) {
    selectedMethod.value = methods[0] ?? 'merge';
  }
});

const mergedTimeLabel = computed(() => {
  const mergedAt = status.value?.mergedAt;
  return mergedAt ? formatDurationFromNow(mergedAt, locale.value, relativeTimeNow.value) : '';
});

const shortMergeSha = computed(() => status.value?.mergeCommitSha?.slice(0, 7) ?? '');

const headBranch = computed(() => status.value?.headBranch ?? null);

const isHeadBranchActionEligiblePr = computed(
  () => Boolean(status.value?.merged) || status.value?.state === 'closed'
);

const headBranchActionMode = computed<'delete' | 'restore' | null>(() => {
  if (headBranch.value?.can_delete) return 'delete';
  if (headBranch.value?.can_restore) return 'restore';
  return null;
});

const headBranchLabel = computed(() => headBranch.value?.label || headBranch.value?.ref || '');

const showHeadBranchActions = computed(() =>
  Boolean(
    isHeadBranchActionEligiblePr.value && (headBranchActionMode.value || branchActionError.value)
  )
);

const branchActionInProgress = computed(() => branchAction.value !== null);

const headBranchActionLabel = computed(() => {
  if (branchAction.value === 'delete') return t('prReview.mergeBox.deletingBranch');
  if (branchAction.value === 'restore') return t('prReview.mergeBox.restoringBranch');
  if (headBranchActionMode.value === 'restore') return t('prReview.mergeBox.restoreBranch');
  return t('prReview.mergeBox.deleteBranch');
});

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

/** The same Check Rollup view model the Check Status Chip reads. */
const checksView = computed(() => toPullRequestChecksView(status.value?.checkRollup));

const checksRow = computed<MergeBoxRow | null>(() => {
  if (!checksView.value.isVisible) {
    return null;
  }

  const { tone, passedCount, totalCount } = checksView.value;
  const counts = {
    passed: passedCount ?? 0,
    failed: totalCount - (passedCount ?? 0),
    total: totalCount,
  };

  if (tone === 'danger') {
    return {
      tone: 'danger',
      icon: getCheckStatusToneIcon('danger'),
      title: t('prReview.mergeBox.checksFailed'),
      detail: checksView.value.isTruncated
        ? t('dashboard.checks.overLimit', {
            total: totalCount,
            limit: CHECK_ROLLUP_CONTEXT_LIMIT,
          })
        : t('prReview.mergeBox.checksFailedCount', counts),
    };
  }

  if (tone === 'warning') {
    return {
      tone: 'warning',
      icon: getCheckStatusToneIcon('warning'),
      title: t('prReview.mergeBox.checksPending'),
      detail: checksView.value.isTruncated
        ? t('dashboard.checks.overLimit', {
            total: totalCount,
            limit: CHECK_ROLLUP_CONTEXT_LIMIT,
          })
        : t('prReview.mergeBox.checksPendingCount', counts),
    };
  }

  return {
    tone: 'success',
    icon: getCheckStatusToneIcon('success'),
    title: t('prReview.mergeBox.checksPassed'),
    detail: checksView.value.isTruncated
      ? t('dashboard.checks.overLimit', {
          total: totalCount,
          limit: CHECK_ROLLUP_CONTEXT_LIMIT,
        })
      : t('prReview.mergeBox.checksPassedCount', counts),
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
        icon: CircleExclamationPointIcon,
        title: t('prReview.mergeBox.mergeableBehind'),
      };
    case 'blocked':
      return {
        tone: 'danger',
        icon: CircleExclamationPointIcon,
        title: t('prReview.mergeBox.mergeableBlocked'),
      };
    case 'unstable':
    case 'has_hooks':
      return {
        tone: 'muted',
        icon: CircleExclamationPointIcon,
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

/** Missing base commits. Null when the comparison could not be read. */
const behindCount = computed(() => {
  const value = status.value?.behindBy;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
});

const currencyTone = computed(() => {
  if (behindCount.value === null) return 'muted';
  return behindCount.value > 0 ? 'warning' : 'success';
});

const currencyIcon = computed(() => {
  if (behindCount.value === null) return ClockIcon;
  return behindCount.value > 0 ? CircleExclamationPointIcon : CheckIcon;
});

const currencySentence = computed(() => {
  const base = status.value?.baseRef ?? '';
  if (behindCount.value === null) {
    return t('prReview.mergeBox.branchUnreadable');
  }
  if (behindCount.value > 0) {
    const sha = status.value?.baseSha?.slice(0, 7) ?? '';
    if (behindCount.value === 1) {
      return t('prReview.mergeBox.branchBehindOne', { base, sha });
    }
    return t('prReview.mergeBox.branchBehindMany', {
      base,
      sha,
      count: behindCount.value,
    });
  }
  return t('prReview.mergeBox.branchCurrent', { base });
});

/** A known conflict is a finished check that found conflicts. Null is still running. */
const branchConflicts = computed(() => {
  const current = status.value;
  if (!current) return false;
  return current.mergeable === false || current.mergeableState === 'dirty';
});

const branchMergeabilityKnown = computed(() => {
  const current = status.value;
  return current?.mergeable === true && current.mergeableState !== 'dirty';
});

const showBranchUpdate = computed(
  () =>
    !stack &&
    behindCount.value !== null &&
    behindCount.value > 0 &&
    Boolean(status.value?.viewerCanWriteHead) &&
    !branchConflicts.value
);

const showStackRebase = computed(
  () =>
    status.value?.viewerCanMerge &&
    !branchConflicts.value &&
    stack?.history === 'not-linear' &&
    stack.number &&
    !stack.hasConflicts &&
    stack.layers.length === stack.count &&
    stack.layers.every(
      (layer) => layer.state === 'merged' || layer.state === 'closed' || layer.rebaseProof
    )
);

const refreshAfterStackRebase = () => {
  void fetchMergeStatus(owner, repo, pullNumber);
  emit('branchUpdated');
};

/** A Layer lands with a Stack Merge only while the history is linear. */
const showMergeActions = computed(() => {
  const current = status.value;
  if (!current?.viewerCanMerge || current.draft) return false;
  if (stack) return stack.history === 'linear';
  return true;
});

/** Layers from the first through this one. Empty when this pull request is not a Layer. */
const landingLayers = computed(() => {
  if (!stack) return [];
  const through = Math.min(stack.place, stack.layers.length);
  if (through < 1) return [];
  return stack.layers.slice(0, through);
});

/** A running Stack Merge is the merge button's spinner; only an outcome needs a line. */
const stackMergeStatusLabel = computed(() => {
  switch (stackMergePhase.value) {
    case 'landed':
      return t('prReview.mergeBox.stackMergeLanded');
    case 'queued':
      return t('prReview.mergeBox.stackMergeQueued');
    case 'failed':
      return t('prReview.mergeBox.stackMergeFailed');
    default:
      return '';
  }
});

/** A landed or queued Stack Merge stays on its outcome. A failure can be tried again. */
const stackMergeHolding = computed(() => {
  const phase = stackMergePhase.value;
  return phase === 'landed' || phase === 'queued';
});

const layerStateLabel = (state: PullRequestStackLayerState) =>
  t(`prReview.stackDetail.state.${state}`);

const rebaseUpdateAllowed = computed(() => mergeMethods.value.includes('rebase'));

const branchUpdateDisabled = computed(() => !branchMergeabilityKnown.value || updating.value);

const branchUpdateButtonLabel = computed(() => {
  if (updating.value) {
    return t('prReview.mergeBox.updating');
  }
  if (updateConfirming.value) {
    return updateMethod.value === 'rebase'
      ? t('prReview.mergeBox.confirmRebaseBranch')
      : t('prReview.mergeBox.confirmUpdateBranch');
  }
  return updateMethod.value === 'rebase'
    ? t('prReview.mergeBox.rebaseBranch')
    : t('prReview.mergeBox.updateBranch');
});

/** The button is working on the reader's own request: a merge, or the text its form opens on. */
const mergeButtonBusy = computed(() => merging.value || loadingCommitDefaults.value);

const mergeDisabled = computed(() => {
  const current = status.value;
  if (!current || mergeButtonBusy.value || loading.value) {
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

  // The confirm form is not on screen yet, so the button still answers the request
  // the reader made with it.
  if (confirming.value && !loadingCommitDefaults.value) {
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

const showCommitForm = computed(
  () =>
    confirming.value &&
    !loadingCommitDefaults.value &&
    selectedMethod.value !== 'rebase' &&
    landingLayers.value.length <= 1
);

/** The default text GitHub forms for a method. Rebase keeps every commit's own message. */
const commitDefaultsFor = (method: PRMergeMethod) => {
  if (method === 'merge') return commitDefaults.value?.merge ?? null;
  if (method === 'squash') return commitDefaults.value?.squash ?? null;
  return null;
};

const resetCommitForm = () => {
  commitTitle.value = '';
  commitMessage.value = '';
  prefillTitle.value = '';
  prefillMessage.value = '';
};

/** Fills only the fields the reader has not typed into while the defaults were loading. */
const applyCommitDefaults = () => {
  const defaults = commitDefaultsFor(selectedMethod.value);
  if (!defaults) return;

  if (commitTitle.value === '') {
    commitTitle.value = defaults.title;
    prefillTitle.value = defaults.title;
  }

  if (commitMessage.value === '') {
    commitMessage.value = defaults.message;
    prefillMessage.value = defaults.message;
  }
};

const selectMergeMethod = (method: PRMergeMethod) => {
  selectedMethod.value = method;
  dropdownOpen.value = false;
  confirming.value = false;
};

const selectBranchUpdateMethod = (method: BranchUpdateMethod) => {
  updateMethod.value = method;
  updateMenuOpen.value = false;
  updateConfirming.value = false;
};

const cancelBranchUpdate = () => {
  if (updating.value) {
    return;
  }
  updateConfirming.value = false;
};

const toggleBranchUpdateMenu = () => {
  if (branchUpdateDisabled.value || updateConfirming.value) {
    return;
  }
  updateMenuOpen.value = !updateMenuOpen.value;
};

const performBranchUpdate = async () => {
  if (updating.value) {
    return;
  }

  const headOid = status.value?.headSha;
  if (!headOid) {
    return;
  }

  updating.value = true;
  // The reread often comes back with mergeable still null. That status must
  // not start the mergeability poll; this update settles after one reread.
  suppressMergeabilityPoll = true;
  try {
    const succeeded = await updatePullRequestBranch(owner, repo, pullNumber, {
      method: updateMethod.value,
      expectedHeadOid: headOid,
    });
    if (succeeded) {
      emit('branchUpdated');
    }
  } finally {
    updating.value = false;
    updateConfirming.value = false;
  }
};

const onBranchUpdateClick = async () => {
  if (branchUpdateDisabled.value) {
    return;
  }

  if (updateConfirming.value) {
    await performBranchUpdate();
    return;
  }

  updateMenuOpen.value = false;
  updateConfirming.value = true;
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

  // Only a field the reader changed is sent. An untouched field keeps GitHub's own
  // default, which is the text we would otherwise have to reproduce byte for byte.
  // More than one Layer keeps each Layer's own Default Commit Message.
  const includeCommitText = !stack || landingLayers.value.length === 1;
  const title =
    includeCommitText && showCommitForm.value && commitTitle.value !== prefillTitle.value
      ? commitTitle.value.trim()
      : '';
  const message =
    includeCommitText && showCommitForm.value && commitMessage.value !== prefillMessage.value
      ? commitMessage.value.trim()
      : '';
  const payload = {
    method: selectedMethod.value,
    ...(title ? { commitTitle: title } : {}),
    ...(message ? { commitMessage: message } : {}),
  };

  merging.value = true;
  try {
    if (stack) {
      if (stack.history !== 'linear') return;

      stackMergePhase.value = 'in-progress';
      const result = await mergeStack(owner, repo, pullNumber, payload);
      stackMergePhase.value = result?.outcome ?? 'failed';
      if (result?.outcome === 'failed' && result.message) {
        mergeError.value = result.message;
      }
      if (result?.outcome === 'landed') {
        emit('merged');
      }
      confirming.value = false;
      return;
    }

    const succeeded = await mergePullRequest(owner, repo, pullNumber, payload);

    if (succeeded) {
      emit('merged');
      confirming.value = false;
    }
  } finally {
    merging.value = false;
  }
};

const performHeadBranchAction = async () => {
  const action = headBranchActionMode.value;
  if (!action || branchAction.value) {
    return;
  }

  branchAction.value = action;
  try {
    const succeeded =
      action === 'delete'
        ? await deleteHeadBranch(owner, repo, pullNumber)
        : await restoreHeadBranch(owner, repo, pullNumber);

    if (succeeded) {
      emit('headBranchUpdated');
    }
  } finally {
    branchAction.value = null;
  }
};

const onMergeClick = async () => {
  if (mergeDisabled.value) {
    return;
  }

  if (confirming.value) {
    await performMerge();
    confirming.value = false;
    return;
  }

  dropdownOpen.value = false;
  resetCommitForm();
  stackMergePhase.value = null;
  confirming.value = true;

  // Rebase writes one commit per change, each keeping its own message: no form.
  // A Stack Merge of more than one Layer keeps each Layer's own message too.
  if (selectedMethod.value === 'rebase' || landingLayers.value.length > 1) {
    return;
  }

  // Read on every open: the pull request's own text may have moved since the last
  // one, and the answer is only shown, never sent unchanged. The form waits for it,
  // so the button that asked for it carries the progress until the text is in hand.
  const method = selectedMethod.value;
  loadingCommitDefaults.value = true;
  try {
    await fetchCommitDefaults(owner, repo, pullNumber);
  } finally {
    loadingCommitDefaults.value = false;
  }

  // The reader may have cancelled or switched method while the request was in flight.
  if (!confirming.value || selectedMethod.value !== method) {
    return;
  }

  applyCommitDefaults();
};

const isEventNode = (value: EventTarget | null): value is Node =>
  !!value && typeof value === 'object' && 'nodeType' in value;

const onDocumentClick = (event: MouseEvent) => {
  const target = event.target;
  const containsTarget = (root: HTMLElement | null) =>
    Boolean(root && isEventNode(target) && root.contains(target));

  if (dropdownOpen.value && !containsTarget(mergeControlsRef.value)) {
    dropdownOpen.value = false;
  }

  if (updateMenuOpen.value && !containsTarget(updateControlsRef.value)) {
    updateMenuOpen.value = false;
  }
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

    if (suppressMergeabilityPoll) {
      suppressMergeabilityPoll = false;
      return;
    }

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
      fetchMergeStatus(owner, repo, pullNumber);
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
  () => [owner, repo, pullNumber],
  () => {
    stackRebaseOpen.value = false;
  }
);

/** Every local control this box owns, back to the state a fresh pull request opens in. */
const resetMergeBoxState = () => {
  dropdownOpen.value = false;
  confirming.value = false;
  stackMergePhase.value = null;
  updateMenuOpen.value = false;
  updateConfirming.value = false;
  updateMethod.value = 'merge';
  suppressMergeabilityPoll = false;
  loadingCommitDefaults.value = false;
  checksExpanded.value = false;
  resetCommitForm();
  clearCommitDefaults();
  branchAction.value = null;
  stopMergeabilityPolling();
  mergeabilityPollAttempts = 0;
};

// A different pull request is the only thing that may forget the status: the old
// box's data must not sit under the new one's heading.
watch(
  () => [owner, repo, pullNumber] as const,
  ([owner, repo, pullNumber]) => {
    resetMergeBoxState();
    resetMergeStatus();

    // A terminal status comes from the detail payload, which already read it.
    // Fetching anyway would race the answer the reader is about to be given.
    if (initialStatus) {
      setMergeStatus(initialStatus);
    } else if (owner && repo && pullNumber) {
      fetchMergeStatus(owner, repo, pullNumber);
    }

    // Pick from the status in hand, so the first paint names the method the
    // repository actually offers.
    selectedMethod.value = mergeMethods.value[0] ?? 'merge';
  },
  { immediate: true }
);

// The same pull request, re-read: a Stack Rebase finishing or the detail page
// refreshing. The box keeps showing what it has while the answer is in flight,
// so nothing the reader is reading is torn off the screen.
watch(
  () => [initialStatus, stack?.history, stack?.place] as const,
  ([initialStatus, history, place], previous) => {
    // `previous` is undefined on the first run, where nothing has moved yet. The
    // identity watch owns that read; comparing against a missing previous would
    // treat every Layer as having just changed shape and read the status twice.
    const [previousHistory, previousPlace] = previous?.slice(1) ?? [history, place];
    const stackMoved = history !== previousHistory || place !== previousPlace;

    if (stackMoved) {
      // A Stack that turned linear or changed shape invalidates the open confirm
      // step, but not the status the reader is looking at.
      dropdownOpen.value = false;
      confirming.value = false;
      stackMergePhase.value = null;
      updateMenuOpen.value = false;
      updateConfirming.value = false;
      resetCommitForm();
      clearCommitDefaults();
    }

    // The detail payload may already carry a fresh status; otherwise re-read it
    // while still showing the one on screen.
    if (initialStatus) {
      setMergeStatus(initialStatus);
    } else if (stackMoved) {
      fetchMergeStatus(owner, repo, pullNumber);
    }
  },
  { immediate: true }
);
</script>

<style scoped lang="scss">
@use '~/assets/scss/pointer' as *;

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

  /* When a branch-action strip follows, flatten the bottom corners so the
     panel + strip read as one continuous card. */
  &--attached {
    border-radius: 12px 12px 0 0;
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

  @include hover-only {
    &:hover {
      color: var(--gitpulse-purple);
    }
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

.merge-box__branch-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 16px;
  background: var(--gitpulse-surface-muted);
  border-top: 1px solid var(--gitpulse-border);
  border-radius: 0 0 12px 12px;
}

.merge-box__branch-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.merge-box__branch-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  color: var(--gitpulse-text-muted);
}

.merge-box__branch-label {
  flex: 1;
  min-width: 0;
  padding: 4px 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--gitpulse-code-font-family);
  font-size: 12px;
  color: var(--gitpulse-text-muted);
  background: var(--gitpulse-surface);
  border: 1px solid var(--gitpulse-border);
  border-radius: 6px;
}

.merge-box__branch-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 30px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  color: var(--gitpulse-text-muted);
  background: var(--gitpulse-surface);
  border: 1px solid var(--gitpulse-border);
  border-radius: 6px;
  cursor: pointer;
  transition:
    color 0.2s ease,
    border-color 0.2s ease,
    background-color 0.2s ease;

  @include hover-only {
    &:hover:not(:disabled) {
      color: var(--bulma-text-strong, var(--gitpulse-text-strong));
      background: var(--gitpulse-surface-hover);
      border-color: var(--gitpulse-border-strong);
    }
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  @include hover-only {
    &--delete:hover:not(:disabled) {
      color: var(--gitpulse-danger-solid);
      border-color: var(--gitpulse-danger);
    }
  }

  @include hover-only {
    &--restore:hover:not(:disabled) {
      color: var(--gitpulse-success-solid);
      border-color: var(--gitpulse-success);
    }
  }
}

/* ── Open state rows ── */
.merge-box__open {
  display: flex;
  flex-direction: column;
}

.merge-box__currency {
  .merge-box__row-title {
    flex: 1;
    min-width: 0;
  }
}

.merge-box__update {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex-shrink: 0;
  gap: 8px;
  margin-left: auto;
}

.merge-box__row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 20px;
  border: 0;
  border-bottom: 1px solid var(--gitpulse-border);
  background: transparent;
  text-align: left;

  &--toggle {
    cursor: pointer;
    font: inherit;
    transition: background-color 0.2s ease;

    @include hover-only {
      &:hover {
        background: var(--gitpulse-surface-hover);
      }
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
  max-height: 240px;

  padding: 0 20px 10px;
  background: var(--gitpulse-surface-muted);
  border-bottom: 1px solid var(--gitpulse-border);

  :deep(.check-list__row) {
    gap: 12px;
    font-size: 12px;
  }

  :deep(.check-list__name) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  }

  :deep(.check-list__name--link) {
    text-decoration: none;
    transition: color 0.2s ease;
  }

  @include hover-only {
    :deep(.check-list__name--link:hover) {
      color: var(--gitpulse-accent);
      text-decoration: underline;
    }
  }

  :deep(.check-list__app) {
    margin-left: auto;
    flex-shrink: 0;
    font-size: 11px;
  }
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
  height: 30px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  color: #ffffff;
  background: var(--gitpulse-success-solid);
  border: 1px solid var(--gitpulse-success-solid);
  border-radius: 6px 0 0 6px;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease;

  @include hover-only {
    &:hover:not(:disabled) {
      background: var(--gitpulse-success-solid-hover);
      border-color: var(--gitpulse-success-solid-hover);
    }
  }

  &:focus-visible,
  &:active:not(:disabled) {
    background: var(--gitpulse-success-solid-hover);
    border-color: var(--gitpulse-success-solid-hover);
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  /* A busy control keeps its own fill: the spinner is the progress, not a refusal. */
  &--busy:disabled {
    opacity: 1;
    cursor: progress;
  }

  &--confirm {
    border-radius: 6px;
  }

  /* No method picker beside it, so the split button's right edge rounds too. */
  &--standalone {
    border-radius: 6px;
  }
}

.merge-box__method-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 30px;
  padding: 0 7px;
  color: #ffffff;
  background: var(--gitpulse-success-solid);
  border: 1px solid var(--gitpulse-success-solid);
  border-left-color: color-mix(in srgb, #ffffff 28%, transparent);
  border-radius: 0 6px 6px 0;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease;

  @include hover-only {
    &:hover:not(:disabled) {
      background: var(--gitpulse-success-solid-hover);
    }
  }

  &:focus-visible,
  &:active:not(:disabled) {
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
  height: 30px;
  padding: 0 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--gitpulse-text-muted);
  background: var(--gitpulse-surface);
  border: 1px solid var(--gitpulse-border);
  border-radius: 6px;
  cursor: pointer;
  transition:
    color 0.2s ease,
    border-color 0.2s ease;

  @include hover-only {
    &:hover:not(:disabled) {
      color: var(--bulma-text-strong, var(--gitpulse-text-strong));
      border-color: var(--gitpulse-border-strong);
    }
  }

  &:focus-visible {
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

  @include hover-only {
    &:hover {
      background: var(--gitpulse-surface-hover);
    }
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

.merge-box__stack-layers {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.merge-box__stack-layer {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
}

.merge-box__stack-layer-number {
  flex-shrink: 0;
  font-family: var(--gitpulse-code-font-family);
  font-size: 11px;
  color: var(--gitpulse-text-subtle);
}

.merge-box__stack-layer-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.merge-box__stack-layer-state {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  color: var(--gitpulse-text-muted);

  &[data-state='open'] {
    color: var(--gitpulse-success-solid);
  }

  &[data-state='merged'] {
    color: var(--gitpulse-info);
  }

  &[data-state='closed'] {
    color: var(--gitpulse-danger-solid);
  }
}

.merge-box__stack-outcome {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
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

  &--branch {
    border-color: color-mix(in srgb, currentColor 25%, transparent);
    border-top-color: currentColor;
  }
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
