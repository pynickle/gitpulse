<script setup lang="ts">
import { AlertCircleIcon, AlertTriangleIcon, StarIcon, Trash2Icon, XIcon } from '@lucide/vue';
import { computed, nextTick, ref, shallowRef, useId, watch } from 'vue';

import type { FollowedRepository, FollowedRepositoryMetadata } from '#shared/types/release-follows';
import type { FollowedRepositoryView } from '#shared/types/user-settings';
import ScrollArea from '~/components/ui/ScrollArea.vue';
import { getLanguageColor } from '~/utils/languageColors';

const props = defineProps<{
  items: FollowedRepository[];
  unavailableIds?: readonly string[];
  view: FollowedRepositoryView;
  metadata: ReadonlyMap<string, FollowedRepositoryMetadata>;
}>();

const emit = defineEmits<{
  remove: [id: string];
  clear: [];
  'update:view': [view: FollowedRepositoryView];
  retry: [id: string];
}>();

const { t, locale } = useI18n();
const { openRepository } = useDashboardRepositoryNavigation();

const instanceId = useId();
const confirmPanelId = `${instanceId}-clear-confirm`;
const confirmTitleId = `${instanceId}-clear-title`;
const confirmBodyId = `${instanceId}-clear-body`;

const unavailableIdSet = computed(() => new Set(props.unavailableIds ?? []));
const isUnavailable = (id: string) => unavailableIdSet.value.has(id);
const repoLabel = (item: FollowedRepository) => `${item.owner}/${item.name}`;
const isDetailed = computed(() => props.view === 'detailed');
const metadataFor = (id: string) => props.metadata.get(id);
const descriptionFor = (id: string) => {
  const metadata = metadataFor(id);
  return metadata?.status === 'available' ? metadata.description : null;
};
const languageFor = (id: string) => {
  const metadata = metadataFor(id);
  return metadata?.status === 'available' ? metadata.primaryLanguage : null;
};
const starCountFor = (id: string) => {
  const metadata = metadataFor(id);
  return metadata?.status === 'available' ? metadata.starCount : null;
};
const metadataFailed = (id: string) => metadataFor(id)?.status === 'transient';
const formattedStarCount = (id: string) => {
  const count = starCountFor(id);
  if (count === null) return '';
  return formatCompactNumber(count, String(locale.value));
};
const descriptionStyle = {
  display: '-webkit-box',
  overflow: 'hidden',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: '2',
  userSelect: 'text',
} as const;

const scrollElement = shallowRef<HTMLElement | null>(null);
const onScrollElement = (element: HTMLElement | null) => {
  scrollElement.value = element;
};

const chooseView = (view: FollowedRepositoryView) => {
  if (view === props.view) return;
  emit('update:view', view);
};

const captureViewedRepository = (scroller: HTMLElement) => {
  const port = scroller.getBoundingClientRect();
  const viewed = [...scroller.querySelectorAll<HTMLElement>('[data-followed-id]')].find((item) => {
    const box = item.getBoundingClientRect();
    return box.bottom > port.top && box.top < port.bottom;
  });
  if (!viewed?.dataset.followedId) return null;
  const box = viewed.getBoundingClientRect();
  return {
    id: viewed.dataset.followedId,
    offset: box.top - port.top,
    height: box.height,
  };
};

const restoreViewedRepository = (
  scroller: HTMLElement,
  anchor: { id: string; offset: number; height: number }
) => {
  const item = [...scroller.querySelectorAll<HTMLElement>('[data-followed-id]')].find(
    (candidate) => candidate.dataset.followedId === anchor.id
  );
  if (!item) return;
  const box = item.getBoundingClientRect();
  // Keep a partially visible row at the same relative position when it shrinks.
  const offset =
    anchor.offset < 0 && anchor.height > 0
      ? (anchor.offset / anchor.height) * box.height
      : anchor.offset;
  const delta = box.top - scroller.getBoundingClientRect().top - offset;
  if (delta !== 0) scroller.scrollTop += delta;
};

// Item heights change with the view, so keep the repository in the viewport
// rather than the previous pixel offset.
watch(
  () => props.view,
  async () => {
    const scroller = scrollElement.value;
    const anchor = scroller ? captureViewedRepository(scroller) : null;
    await nextTick();
    if (anchor && scroller) restoreViewedRepository(scroller, anchor);
  }
);

const confirmingClear = ref(false);
const clearTriggerRef = ref<HTMLButtonElement | null>(null);
const confirmAcceptRef = ref<HTMLButtonElement | null>(null);
const emptyStateRef = ref<HTMLElement | null>(null);
const focusEmptyAfterClear = ref(false);

const openClearConfirm = async () => {
  if (props.items.length === 0 || confirmingClear.value) return;
  confirmingClear.value = true;
  await nextTick();
  confirmAcceptRef.value?.focus();
};

const cancelClearConfirm = async () => {
  if (!confirmingClear.value) return;
  confirmingClear.value = false;
  await nextTick();
  clearTriggerRef.value?.focus();
};

const confirmClear = () => {
  confirmingClear.value = false;
  focusEmptyAfterClear.value = true;
  emit('clear');
};

// Closing the confirmation whenever the list empties keeps stale prompts from
// lingering; the focus hand-off only happens for an explicit clear.
watch(
  () => props.items.length,
  (length) => {
    if (length > 0) return;
    confirmingClear.value = false;
    if (!focusEmptyAfterClear.value) return;
    focusEmptyAfterClear.value = false;
    void nextTick(() => emptyStateRef.value?.focus());
  }
);
</script>

<template>
  <div class="followed-list">
    <div class="followed-list__header">
      <div class="followed-list__heading">
        <h2 class="followed-list__title">
          <span class="followed-list__title-text">{{ t('releaseFollows.followedHeading') }}</span>
          <span
            class="followed-list__count"
            :aria-label="t('releaseFollows.followedCount', { count: items.length })"
          >
            {{ items.length }}
          </span>
        </h2>

        <div class="followed-list__actions">
          <button
            ref="clearTriggerRef"
            class="followed-list__clear"
            type="button"
            :disabled="items.length === 0"
            :aria-expanded="confirmingClear"
            :aria-controls="confirmPanelId"
            :aria-label="t('releaseFollows.clear')"
            :title="t('releaseFollows.clear')"
            @click="openClearConfirm"
          >
            <Trash2Icon :size="15" aria-hidden="true" />
          </button>

          <slot name="close" />
        </div>
      </div>

      <div
        class="followed-list__view"
        role="radiogroup"
        :aria-label="t('releaseFollows.viewLabel')"
      >
        <button
          class="followed-list__view-option"
          :class="{ 'is-selected': view === 'compact' }"
          type="button"
          role="radio"
          :aria-checked="view === 'compact'"
          @click="chooseView('compact')"
        >
          {{ t('releaseFollows.compactView') }}
        </button>
        <button
          class="followed-list__view-option"
          :class="{ 'is-selected': view === 'detailed' }"
          type="button"
          role="radio"
          :aria-checked="view === 'detailed'"
          @click="chooseView('detailed')"
        >
          {{ t('releaseFollows.detailedView') }}
        </button>
      </div>
    </div>

    <div
      v-if="confirmingClear"
      :id="confirmPanelId"
      class="followed-list__confirm"
      role="alertdialog"
      :aria-labelledby="confirmTitleId"
      :aria-describedby="confirmBodyId"
      @keydown.esc.stop.prevent="cancelClearConfirm"
    >
      <div class="followed-list__confirm-heading">
        <AlertTriangleIcon :size="15" aria-hidden="true" />
        <p :id="confirmTitleId" class="followed-list__confirm-title">
          {{ t('releaseFollows.clearConfirmTitle') }}
        </p>
      </div>
      <p :id="confirmBodyId" class="followed-list__confirm-body">
        {{ t('releaseFollows.clearConfirmBody', { count: items.length }) }}
      </p>
      <div class="followed-list__confirm-actions">
        <button class="followed-list__confirm-cancel" type="button" @click="cancelClearConfirm">
          {{ t('releaseFollows.clearConfirmCancel') }}
        </button>
        <button
          ref="confirmAcceptRef"
          class="followed-list__confirm-accept"
          type="button"
          @click="confirmClear"
        >
          <Trash2Icon :size="13" aria-hidden="true" />
          {{ t('releaseFollows.clearConfirmAccept') }}
        </button>
      </div>
    </div>

    <p v-if="items.length === 0" ref="emptyStateRef" class="followed-list__empty" tabindex="-1">
      {{ t('releaseFollows.emptyFollowed') }}
    </p>

    <ScrollArea v-else class="followed-list__items" role="list" @scroll-element="onScrollElement">
      <li
        v-for="item in items"
        :key="item.id"
        class="followed-list__item"
        :class="{
          'followed-list__item--unavailable': isUnavailable(item.id),
          'followed-list__item--detailed': isDetailed,
        }"
        :data-followed-id="item.id"
      >
        <div class="followed-list__main">
          <div class="followed-list__identity">
            <AlertCircleIcon
              v-if="isUnavailable(item.id)"
              class="followed-list__status-icon"
              :size="14"
              aria-hidden="true"
            />
            <button
              class="followed-list__name"
              type="button"
              :aria-label="
                isUnavailable(item.id)
                  ? t('releaseFollows.unavailable', { repo: repoLabel(item) })
                  : repoLabel(item)
              "
              :title="
                isUnavailable(item.id)
                  ? t('releaseFollows.unavailable', { repo: repoLabel(item) })
                  : repoLabel(item)
              "
              @click="openRepository(item.owner, item.name)"
            >
              <template v-if="isDetailed"
                ><span class="followed-list__owner">{{ item.owner }}</span
                ><span class="followed-list__slash">/</span
                ><span class="followed-list__repo">{{ item.name }}</span></template
              ><template v-else>{{ repoLabel(item) }}</template>
            </button>
            <span v-if="isUnavailable(item.id)" class="followed-list__badge">
              {{ t('releaseFollows.unavailableLabel') }}
            </span>
          </div>

          <p
            v-if="isDetailed && descriptionFor(item.id)"
            class="followed-list__description"
            :style="descriptionStyle"
          >
            {{ descriptionFor(item.id) }}
          </p>

          <div
            v-if="isDetailed && (languageFor(item.id) || starCountFor(item.id) !== null)"
            class="followed-list__meta"
            :style="{ userSelect: 'text' }"
          >
            <span v-if="languageFor(item.id)" class="followed-list__language">
              <span
                class="followed-list__language-swatch"
                :style="{ backgroundColor: getLanguageColor(languageFor(item.id)) }"
                aria-hidden="true"
              />
              {{ languageFor(item.id) }}
            </span>
            <span
              v-if="starCountFor(item.id) !== null"
              class="followed-list__stars"
              :aria-label="t('releaseFollows.starCount', { count: formattedStarCount(item.id) })"
            >
              <StarIcon :size="12" aria-hidden="true" />
              {{ formattedStarCount(item.id) }}
            </span>
          </div>

          <button
            v-if="isDetailed && metadataFailed(item.id)"
            class="followed-list__retry"
            type="button"
            @click="emit('retry', item.id)"
          >
            {{ t('releaseFollows.retryMetadata', { repo: repoLabel(item) }) }}
          </button>
        </div>
        <button
          class="followed-list__remove"
          type="button"
          :aria-label="t('releaseFollows.remove', { repo: repoLabel(item) })"
          @click="emit('remove', item.id)"
        >
          <XIcon :size="14" aria-hidden="true" />
        </button>
      </li>
    </ScrollArea>
  </div>
</template>

<style scoped lang="scss">
.followed-list {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.followed-list__header {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.55rem;
  flex-shrink: 0;
  margin-bottom: 0.75rem;
}

.followed-list__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  min-width: 0;
}

.followed-list__title {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex: 0 1 auto;
  min-width: 0;
  margin: 0;
  color: var(--gitpulse-text-strong);
  font-size: 0.95rem;
  font-weight: 600;
}

// The heading never wraps; it ellipsizes before it can push the header
// actions onto a second line in the narrow desktop sidebar.
.followed-list__title-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.followed-list__count {
  flex-shrink: 0;
  padding: 0.05rem 0.45rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 999px;
  background: var(--gitpulse-surface);
  color: var(--gitpulse-text-muted);
  font-size: 0.72rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.followed-list__actions {
  display: flex;
  align-items: center;
  gap: 0.15rem;
  flex-shrink: 0;
  margin-left: auto;
}

.followed-list__view {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.15rem;
  padding: 0.15rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: var(--gitpulse-radius-md, 8px);
  background: var(--gitpulse-surface);
}

.followed-list__view-option {
  min-width: 0;
  min-height: 1.7rem;
  padding: 0.15rem 0.4rem;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--gitpulse-text-muted);
  font-size: 0.75rem;
  font-weight: 650;
  cursor: pointer;

  &.is-selected {
    background: var(--gitpulse-surface-hover);
    color: var(--gitpulse-text-strong);
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring, var(--gitpulse-accent));
    outline-offset: 2px;
  }
}

.followed-list__clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.9rem;
  height: 1.9rem;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--gitpulse-radius-md, 6px);
  background: transparent;
  color: var(--gitpulse-text-muted);
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;

  &:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--gitpulse-danger) 35%, transparent);
    background: var(--gitpulse-danger-soft);
    color: var(--gitpulse-danger);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring, var(--gitpulse-accent));
    outline-offset: 2px;
  }
}

.followed-list__confirm {
  display: grid;
  gap: 0.5rem;
  flex-shrink: 0;
  margin-bottom: 0.75rem;
  padding: 0.7rem 0.75rem;
  border: 1px solid color-mix(in srgb, var(--gitpulse-danger) 55%, transparent);
  border-left: 3px solid var(--gitpulse-danger-solid, var(--gitpulse-danger));
  border-radius: var(--gitpulse-radius-md, 8px);
  background: var(--gitpulse-danger-soft);
  animation: followed-confirm-in 0.16s ease;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
}

.followed-list__confirm-heading {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--gitpulse-danger);
}

.followed-list__confirm-title {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 700;
}

.followed-list__confirm-body {
  margin: 0;
  color: var(--gitpulse-text);
  font-size: 0.78rem;
  line-height: 1.5;
}

.followed-list__confirm-actions {
  display: flex;
  gap: 0.5rem;
}

.followed-list__confirm-cancel,
.followed-list__confirm-accept {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  flex: 1;
  min-width: 0;
  min-height: 2.1rem;
  padding: 0.3rem 0.6rem;
  border-radius: var(--gitpulse-radius-md, 6px);
  font-size: 0.82rem;
  font-weight: 650;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring, var(--gitpulse-accent));
    outline-offset: 2px;
  }
}

.followed-list__confirm-cancel {
  border: 1px solid var(--gitpulse-border);
  background: var(--gitpulse-surface);
  color: var(--gitpulse-text);

  &:hover {
    background: var(--gitpulse-surface-hover);
  }
}

.followed-list__confirm-accept {
  border: 1px solid var(--gitpulse-danger-solid, var(--gitpulse-danger));
  background: var(--gitpulse-danger-solid, var(--gitpulse-danger));
  color: #fff;

  &:hover {
    border-color: var(--gitpulse-danger-solid-hover, var(--gitpulse-danger));
    background: var(--gitpulse-danger-solid-hover, var(--gitpulse-danger));
  }
}

.followed-list__empty {
  margin: 0;
  color: var(--gitpulse-text-muted);
  font-size: 0.85rem;
  line-height: 1.4;

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring, var(--gitpulse-accent));
    outline-offset: 2px;
  }
}

.followed-list__items {
  flex: 1;
  list-style: none;
  margin: 0;
  padding: 0;
  min-height: 0;
}

.followed-list__item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0;
  border-bottom: 1px solid var(--gitpulse-border);

  &:last-child {
    border-bottom: 0;
  }
}

.followed-list__item--detailed {
  align-items: flex-start;
}

.followed-list__main {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.followed-list__identity {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.followed-list__item--detailed .followed-list__identity {
  align-items: flex-start;
}

.followed-list__item--unavailable .followed-list__name {
  color: var(--gitpulse-danger);
}

.followed-list__status-icon {
  flex-shrink: 0;
  color: var(--gitpulse-danger);
}

.followed-list__badge {
  flex-shrink: 0;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  background: var(--gitpulse-danger-soft);
  color: var(--gitpulse-danger);
  font-size: 0.7rem;
  font-weight: 600;
}

.followed-list__name {
  flex: 1;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--gitpulse-text);
  font-size: 0.85rem;
  font-weight: 600;
  line-height: 1.3;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring, var(--gitpulse-accent));
    outline-offset: 2px;
  }
}

// Detailed View stacks a quiet owner label, a title-weight name, and body copy.
// Compact View keeps a single identity line, so these spans exist only there.
.followed-list__item--detailed .followed-list__name {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.08rem;
  overflow: visible;
  color: inherit;
  font-size: inherit;
  font-weight: inherit;
  white-space: normal;
  text-overflow: unset;
}

.followed-list__item--detailed .followed-list__owner {
  color: var(--gitpulse-text-muted);
  font-size: 0.68rem;
  font-weight: 650;
  letter-spacing: 0.06em;
  line-height: 1.2;
  text-transform: uppercase;
}

.followed-list__item--detailed .followed-list__slash {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.followed-list__item--detailed .followed-list__repo {
  color: var(--gitpulse-text-strong);
  font-size: 0.98rem;
  font-weight: 700;
  letter-spacing: -0.015em;
  line-height: 1.25;
}

.followed-list__item--unavailable .followed-list__repo {
  color: var(--gitpulse-danger);
}

.followed-list__description {
  display: -webkit-box;
  margin: 0.4rem 0 0;
  overflow: hidden;
  color: var(--gitpulse-text);
  font-size: 0.84rem;
  font-weight: 400;
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  user-select: text;
}

.followed-list__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.75rem;
  margin-top: 0.25rem;
  color: var(--gitpulse-text-muted);
  font-size: 0.72rem;
  user-select: text;
}

.followed-list__language,
.followed-list__stars {
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  min-width: 0;
}

.followed-list__language-swatch {
  width: 0.55rem;
  height: 0.55rem;
  flex-shrink: 0;
  border-radius: 999px;
}

.followed-list__retry {
  align-self: flex-start;
  margin-top: 0.3rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--gitpulse-accent);
  font-size: 0.75rem;
  font-weight: 650;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring, var(--gitpulse-accent));
    outline-offset: 2px;
  }
}

.followed-list__remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--gitpulse-text-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;

  &:hover {
    background: var(--gitpulse-danger-soft);
    color: var(--gitpulse-danger);
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring, var(--gitpulse-accent));
    outline-offset: 2px;
  }
}

@keyframes followed-confirm-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }

  to {
    opacity: 1;
    transform: none;
  }
}
</style>
