<template>
  <div ref="rootEl" class="reaction-bar" @keydown.esc.stop="closePopover">
    <div class="reaction-bar__chips">
      <button
        v-for="item in visibleItems"
        :key="item.content"
        class="reaction-bar__chip"
        :class="{ 'reaction-bar__chip--active': item.viewerHasReacted }"
        type="button"
        :disabled="isBusy"
        :title="getReactionTitle(item)"
        :aria-label="getReactionTitle(item)"
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
          :disabled="isBusy"
          :title="t('reactions.addReaction')"
          :aria-label="t('reactions.addReaction')"
          :aria-expanded="isPopoverOpen"
          @click="togglePopover"
        >
          <LoaderCircleIcon v-if="isLoading" :size="14" class="reaction-bar__loading" />
          <SmilePlusIcon v-else :size="14" aria-hidden="true" />
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
            :disabled="isBusy"
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

    <p v-if="errorMessage" class="reaction-bar__error">
      {{ errorMessage }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { LoaderCircleIcon, SmilePlusIcon } from 'lucide-vue-next';
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
  REACTION_EMOJI_MAP,
  REACTION_LABEL_MAP,
} from '#shared/utils/reactions';

const props = defineProps<{
  targetKind: ReactionTargetKind;
  owner: string;
  repo: string;
  targetId: string | number;
  initialItems?: ReactionSummaryItem[];
  initialItemsIncludeViewerState?: boolean;
  deferViewerState?: boolean;
}>();

const { t } = useI18n();
const apiFetch = useGitPulseApiFetch();
const rootEl = useTemplateRef<HTMLElement>('rootEl');

const summaryItems = shallowRef<ReactionSummaryItem[]>(cloneSummaryItems(props.initialItems));
const isPopoverOpen = shallowRef(false);
const isLoading = shallowRef(false);
const pendingContent = shallowRef<ReactionContent | null>(null);
const errorMessage = shallowRef('');
const hasViewerState = shallowRef(Boolean(props.initialItemsIncludeViewerState));

const allowedContents = computed(() => getReactionContentsForTarget(props.targetKind));
const isBusy = computed(() => isLoading.value || Boolean(pendingContent.value));
const hasHydratedInitialItems = computed(
  () => Boolean(props.initialItems) && Boolean(props.initialItemsIncludeViewerState)
);
const shouldDeferInitialViewerState = computed(
  () =>
    Boolean(props.deferViewerState) &&
    props.initialItems !== undefined &&
    !props.initialItemsIncludeViewerState
);
const endpoint = computed(() => {
  const owner = encodeURIComponent(props.owner);
  const repo = encodeURIComponent(props.repo);
  const targetId = encodeURIComponent(String(props.targetId));
  const targetPath = getReactionApiPathForTarget(props.targetKind);

  return `/api/reactions/${targetPath}/${owner}/${repo}/${targetId}`;
});
const visibleItems = computed(() =>
  allowedContents.value
    .map((content) => getItem(content))
    .filter((item): item is ReactionSummaryItem => Boolean(item && item.count > 0))
);

watch(
  () => [props.initialItems, props.initialItemsIncludeViewerState] as const,
  (items) => {
    summaryItems.value = cloneSummaryItems(items[0]);
    hasViewerState.value = Boolean(props.initialItemsIncludeViewerState);
  }
);

watch(
  () => [props.targetKind, props.owner, props.repo, String(props.targetId)] as const,
  () => {
    hasViewerState.value = Boolean(props.initialItemsIncludeViewerState);

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
});

function cloneSummaryItems(items: ReactionSummaryItem[] | undefined): ReactionSummaryItem[] {
  return items?.map((item) => ({ ...item })) ?? [];
}

function applySummary(payload: ReactionSummaryPayload) {
  summaryItems.value = cloneSummaryItems(payload.items);
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

async function togglePopover() {
  isPopoverOpen.value = !isPopoverOpen.value;
  errorMessage.value = '';

  if (isPopoverOpen.value) {
    await ensureViewerState();
  }
}

function closePopover() {
  isPopoverOpen.value = false;
}

async function loadSummary() {
  if (!props.owner || !props.repo || !props.targetId) {
    return;
  }

  isLoading.value = true;
  errorMessage.value = '';

  try {
    applySummary(await apiFetch<ReactionSummaryPayload>(endpoint.value));
    hasViewerState.value = true;
  } catch {
    errorMessage.value = t('reactions.loadFailed');
  } finally {
    isLoading.value = false;
  }
}

async function toggleReaction(content: ReactionContent) {
  if (pendingContent.value) {
    return;
  }

  if (!(await ensureViewerState())) {
    return;
  }

  const item = getItem(content);
  const willRemove = Boolean(item?.viewerHasReacted);
  const snapshot = cloneSummaryItems(summaryItems.value);

  pendingContent.value = content;
  errorMessage.value = '';
  applyOptimisticReaction(content, !willRemove);

  try {
    const payload = await apiFetch<ReactionSummaryPayload>(endpoint.value, {
      method: willRemove ? 'DELETE' : 'POST',
      body: {
        content,
      },
    });

    applySummary(payload);
  } catch {
    summaryItems.value = snapshot;
    errorMessage.value = t('reactions.updateFailed');
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

  summaryItems.value = existingItems.filter((item) => item.count > 0);
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

  &:not(:disabled):hover {
    border-color: var(--gitpulse-accent);
    color: var(--gitpulse-accent);
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

.reaction-bar__error {
  margin-top: 0.35rem;
  color: var(--gitpulse-danger);
  font-size: 0.72rem;
}

@keyframes reaction-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
