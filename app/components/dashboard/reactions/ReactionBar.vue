<template>
  <div ref="rootEl" class="reaction-bar" @keydown.esc.stop="closePopover">
    <div class="reaction-bar__chips">
      <button
        v-for="item in visibleItems"
        :key="item.content"
        class="reaction-bar__chip"
        :class="{ 'reaction-bar__chip--active': item.viewerHasReacted }"
        type="button"
        :disabled="isBusy || isReactionDisabled"
        :title="getChipLabel(item)"
        :aria-label="getChipLabel(item)"
        :aria-pressed="item.viewerHasReacted"
        @click="toggleReaction(item.content)"
      >
        <span class="reaction-bar__emoji" aria-hidden="true">{{
          getReactionEmoji(item.content)
        }}</span>
        <span class="reaction-bar__count">{{ item.count }}</span>
      </button>

      <div class="reaction-bar__picker-anchor">
        <button
          class="reaction-bar__add"
          type="button"
          :disabled="isBusy || isReactionDisabled"
          :title="addButtonLabel"
          :aria-label="addButtonLabel"
          :aria-expanded="isPopoverOpen"
          @click="togglePopover"
        >
          <LoaderCircleIcon v-if="isLoading" :size="14" class="reaction-bar__loading" />
          <FaceSlightlySmilingPlusIcon v-else :size="14" aria-hidden="true" />
        </button>

        <div v-if="isPopoverOpen" class="reaction-bar__popover" role="menu">
          <button
            v-for="content in allowedContents"
            :key="content"
            class="reaction-bar__option"
            :class="{ 'reaction-bar__option--active': getItem(content)?.viewerHasReacted }"
            type="button"
            role="menuitemcheckbox"
            :aria-checked="Boolean(getItem(content)?.viewerHasReacted)"
            :disabled="isBusy || isReactionDisabled"
            :title="getReactionLabel(content)"
            :aria-label="getReactionLabel(content)"
            @click="toggleReaction(content)"
          >
            <span class="reaction-bar__option-emoji" aria-hidden="true">
              {{ getReactionEmoji(content) }}
            </span>
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="feedback"
      class="reaction-bar__feedback"
      :class="`reaction-bar__feedback--${feedback.tone}`"
      :role="feedback.tone === 'error' ? 'alert' : 'status'"
    >
      <CircleAlertIcon
        v-if="feedback.tone === 'error'"
        :size="13"
        class="reaction-bar__feedback-icon"
        aria-hidden="true"
      />
      <InfoIcon v-else :size="13" class="reaction-bar__feedback-icon" aria-hidden="true" />
      <span class="reaction-bar__feedback-text">{{ feedback.message }}</span>
      <button
        type="button"
        class="reaction-bar__feedback-dismiss"
        :aria-label="t('common.close')"
        :title="t('common.close')"
        @click="clearFeedback"
      >
        <XIcon :size="12" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  CircleAlertIcon,
  FaceSlightlySmilingPlusIcon,
  InfoIcon,
  LoaderCircleIcon,
  XIcon,
} from '@lucide/vue';
import { computed, onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type {
  ReactionContent,
  ReactionSummaryItem,
  ReactionSummaryPayload,
  ReactionTargetKind,
} from '#shared/types/reactions';
import {
  getReactionApiPathForTarget,
  getReactionContentsForTarget,
  isReactionForbiddenError,
  REACTION_EMOJI_MAP,
  REACTION_LABEL_MAP,
} from '#shared/utils/reactions';

type ReactionFeedbackTone = 'error' | 'muted';

const FEEDBACK_AUTO_CLEAR_MS = 5000;

const {
  targetKind,
  owner,
  repo,
  targetId,
  initialItems,
  initialItemsIncludeViewerState,
  deferViewerState,
  canReact = true,
} = defineProps<{
  targetKind: ReactionTargetKind;
  owner: string;
  repo: string;
  targetId: string | number;
  initialItems?: ReactionSummaryItem[];
  initialItemsIncludeViewerState?: boolean;
  deferViewerState?: boolean;
  canReact?: boolean;
}>();

const emit = defineEmits<{
  'update:items': [items: ReactionSummaryItem[]];
  'update:canReact': [canReact: boolean];
}>();

const { t } = useI18n();
const apiFetch = useGitPulseApiFetch();
const rootEl = useTemplateRef<HTMLElement>('rootEl');

const summaryItems = shallowRef<ReactionSummaryItem[]>(cloneSummaryItems(initialItems));
const canReactState = shallowRef<boolean>(canReact);
const isPopoverOpen = shallowRef(false);
const isLoading = shallowRef(false);
const pendingContent = shallowRef<ReactionContent | null>(null);
const feedback = shallowRef<{ message: string; tone: ReactionFeedbackTone } | null>(null);
const hasViewerState = shallowRef(Boolean(initialItemsIncludeViewerState));
let feedbackTimer: ReturnType<typeof setTimeout> | null = null;

const allowedContents = computed(() => getReactionContentsForTarget(targetKind));
const isBusy = computed(() => isLoading.value || Boolean(pendingContent.value));
const isReactionDisabled = computed(() => canReactState.value === false);
const addButtonLabel = computed(() =>
  isReactionDisabled.value ? t('reactions.cannotReact') : t('reactions.addReaction')
);
const hasHydratedInitialItems = computed(
  () => Boolean(initialItems) && Boolean(initialItemsIncludeViewerState)
);
const shouldDeferInitialViewerState = computed(
  () => Boolean(deferViewerState) && initialItems !== undefined && !initialItemsIncludeViewerState
);
const endpoint = computed(() => {
  const encodedOwner = encodeURIComponent(owner);
  const encodedRepo = encodeURIComponent(repo);
  const encodedTargetId = encodeURIComponent(String(targetId));
  const targetPath = getReactionApiPathForTarget(targetKind);

  return `/api/reactions/${targetPath}/${encodedOwner}/${encodedRepo}/${encodedTargetId}`;
});
const visibleItems = computed(() =>
  allowedContents.value
    .map((content) => getItem(content))
    .filter((item): item is ReactionSummaryItem => Boolean(item && item.count > 0))
);

watch(
  () => [initialItems, initialItemsIncludeViewerState] as const,
  (items) => {
    summaryItems.value = cloneSummaryItems(items[0]);
    hasViewerState.value = Boolean(initialItemsIncludeViewerState);
  }
);

watch(
  () => canReact,
  (value) => {
    canReactState.value = value;
    if (value === false) {
      closePopover();
    }
  }
);

watch(
  () => [targetKind, owner, repo, String(targetId)] as const,
  () => {
    hasViewerState.value = Boolean(initialItemsIncludeViewerState);
    canReactState.value = canReact;
    closePopover();
    clearFeedback();

    if (
      hasHydratedInitialItems.value ||
      hasViewerState.value ||
      shouldDeferInitialViewerState.value
    ) {
      return;
    }

    void loadSummary();
  },
  { immediate: true }
);

onMounted(() => {
  document.addEventListener('click', onDocumentClick);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick);
  clearFeedback();
});

function clearFeedback() {
  if (feedbackTimer !== null) {
    clearTimeout(feedbackTimer);
    feedbackTimer = null;
  }
  feedback.value = null;
}

function showFeedback(message: string, tone: ReactionFeedbackTone) {
  clearFeedback();
  feedback.value = { message, tone };
  feedbackTimer = setTimeout(() => {
    feedbackTimer = null;
    feedback.value = null;
  }, FEEDBACK_AUTO_CLEAR_MS);
}

function setCanReact(value: boolean) {
  if (canReactState.value === value) {
    return;
  }
  canReactState.value = value;
  emit('update:canReact', value);
  if (!value) {
    closePopover();
  }
}

function cloneSummaryItems(items: ReactionSummaryItem[] | undefined): ReactionSummaryItem[] {
  return items?.map((item) => ({ ...item })) ?? [];
}

function publishSummary(items: ReactionSummaryItem[]) {
  summaryItems.value = items;
  emit('update:items', cloneSummaryItems(items));
}

function applySummary(payload: ReactionSummaryPayload) {
  publishSummary(cloneSummaryItems(payload.items));
  if (typeof payload.canReact === 'boolean') {
    setCanReact(payload.canReact);
  }
}

function getItem(content: ReactionContent): ReactionSummaryItem | null {
  return summaryItems.value.find((item) => item.content === content) ?? null;
}

function getReactionEmoji(content: ReactionContent) {
  return REACTION_EMOJI_MAP[content];
}

function getReactionLabel(content: ReactionContent) {
  return REACTION_LABEL_MAP[content];
}

function getReactionTitle(item: ReactionSummaryItem) {
  return t('reactions.reactionCount', {
    reaction: getReactionLabel(item.content),
    count: item.count,
  });
}

function getChipLabel(item: ReactionSummaryItem) {
  const baseTitle = getReactionTitle(item);
  return isReactionDisabled.value ? `${baseTitle} · ${t('reactions.cannotReact')}` : baseTitle;
}

async function togglePopover() {
  if (isReactionDisabled.value) {
    return;
  }

  isPopoverOpen.value = !isPopoverOpen.value;
  clearFeedback();

  if (isPopoverOpen.value) {
    await ensureViewerState();
    if (isReactionDisabled.value) {
      closePopover();
      showFeedback(t('reactions.cannotReact'), 'muted');
    }
  }
}

function closePopover() {
  isPopoverOpen.value = false;
}

async function loadSummary() {
  if (!owner || !repo || !targetId) {
    return;
  }

  isLoading.value = true;
  clearFeedback();

  try {
    applySummary(await apiFetch<ReactionSummaryPayload>(endpoint.value));
    hasViewerState.value = true;
  } catch {
    showFeedback(t('reactions.loadFailed'), 'error');
  } finally {
    isLoading.value = false;
  }
}

async function toggleReaction(content: ReactionContent) {
  if (pendingContent.value || isReactionDisabled.value) {
    return;
  }

  closePopover();

  if (!(await ensureViewerState())) {
    return;
  }

  if (isReactionDisabled.value) {
    showFeedback(t('reactions.cannotReact'), 'muted');
    return;
  }

  const item = getItem(content);
  const willRemove = Boolean(item?.viewerHasReacted);
  const snapshot = cloneSummaryItems(summaryItems.value);

  pendingContent.value = content;
  clearFeedback();
  applyOptimisticReaction(content, !willRemove);

  try {
    const payload = await apiFetch<ReactionSummaryPayload>(endpoint.value, {
      method: willRemove ? 'DELETE' : 'POST',
      body: {
        content,
      },
    });

    applySummary(payload);
  } catch (error: unknown) {
    publishSummary(snapshot);
    if (isReactionForbiddenError(error)) {
      setCanReact(false);
      showFeedback(t('reactions.cannotReact'), 'muted');
    } else {
      showFeedback(t('reactions.updateFailed'), 'error');
    }
  } finally {
    pendingContent.value = null;
  }
}

async function ensureViewerState() {
  if (hasViewerState.value) {
    return true;
  }

  await loadSummary();
  return hasViewerState.value;
}

function applyOptimisticReaction(content: ReactionContent, viewerHasReacted: boolean) {
  const existingItems = cloneSummaryItems(summaryItems.value);
  const existingIndex = existingItems.findIndex((item) => item.content === content);
  const existing = existingIndex >= 0 ? existingItems[existingIndex] : null;

  if (!existing && viewerHasReacted) {
    existingItems.push({
      content,
      count: 1,
      viewerHasReacted: true,
      viewerReactionId: null,
    });
  } else if (existing) {
    const nextCount = Math.max(0, existing.count + (viewerHasReacted ? 1 : -1));

    existingItems[existingIndex] = {
      ...existing,
      count: nextCount,
      viewerHasReacted,
      viewerReactionId: viewerHasReacted ? existing.viewerReactionId : null,
    };
  }

  publishSummary(existingItems.filter((item) => item.count > 0));
}

function onDocumentClick(event: MouseEvent) {
  if (!isPopoverOpen.value) {
    return;
  }

  const target = event.target;

  if (!(target instanceof Node) || !rootEl.value?.contains(target)) {
    closePopover();
  }
}
</script>

<style scoped lang="scss">
@use '~/assets/scss/pointer' as *;

.reaction-bar {
  position: relative;
}

.reaction-bar__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
}

.reaction-bar__chip,
.reaction-bar__add,
.reaction-bar__option {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--gitpulse-border);
  background: var(--gitpulse-surface);
  color: var(--gitpulse-text);
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease,
    color 0.15s ease,
    transform 0.15s ease;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.65;
  }

  @include hover-only {
    &:not(:disabled):hover {
      border-color: var(--gitpulse-accent);
      color: var(--gitpulse-accent);
    }
  }
}

.reaction-bar__chip {
  min-width: 2.7rem;
  height: 1.75rem;
  gap: 0.25rem;
  padding: 0 0.45rem;
  border-radius: 999px;
  font-size: 0.78rem;
  line-height: 1;
}

.reaction-bar__chip--active {
  border-color: var(--gitpulse-accent);
  background: color-mix(in srgb, var(--gitpulse-accent) 12%, var(--gitpulse-surface));
  color: var(--gitpulse-accent);
}

.reaction-bar__emoji,
.reaction-bar__option-emoji {
  font-size: 0.95rem;
  line-height: 1;
}

.reaction-bar__count {
  min-width: 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
}

.reaction-bar__picker-anchor {
  position: relative;
  display: inline-flex;
}

.reaction-bar__add {
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 999px;
}

.reaction-bar__loading {
  animation: reaction-spin 0.8s linear infinite;
}

.reaction-bar__popover {
  position: absolute;
  z-index: 20;
  bottom: calc(100% + 0.35rem);
  left: 0;
  display: grid;
  grid-template-columns: repeat(4, 2rem);
  gap: 0.25rem;
  padding: 0.35rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
  background: var(--gitpulse-surface);
  box-shadow: 0 12px 30px rgb(15 23 42 / 16%);
}

.reaction-bar__option {
  width: 2rem;
  height: 2rem;
  border-radius: 6px;
}

.reaction-bar__option--active {
  border-color: var(--gitpulse-accent);
  background: color-mix(in srgb, var(--gitpulse-accent) 14%, var(--gitpulse-surface));
}

.reaction-bar__feedback {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  max-width: 100%;
  margin-top: 0.45rem;
  padding: 0.25rem 0.35rem 0.25rem 0.5rem;
  border-radius: var(--gitpulse-radius-md, 6px);
  font-size: 0.75rem;
  line-height: 1.3;
}

.reaction-bar__feedback--error {
  border: 1px solid color-mix(in srgb, var(--gitpulse-danger) 24%, transparent);
  background: var(--gitpulse-danger-soft);
  color: var(--gitpulse-danger);
}

.reaction-bar__feedback--muted {
  border: 1px solid var(--gitpulse-border);
  background: var(--gitpulse-surface-muted);
  color: var(--gitpulse-text-muted);
}

.reaction-bar__feedback-icon {
  flex: none;
}

.reaction-bar__feedback-text {
  min-width: 0;
  overflow-wrap: anywhere;
}

.reaction-bar__feedback-dismiss {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 1.25rem;
  height: 1.25rem;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  opacity: 0.72;
  cursor: pointer;

  @include hover-only {
    &:hover {
      opacity: 1;
      background: color-mix(in srgb, currentcolor 10%, transparent);
    }
  }

  &:focus-visible {
    opacity: 1;
    outline: 2px solid var(--gitpulse-focus-ring);
    outline-offset: 1px;
  }
}

@keyframes reaction-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
