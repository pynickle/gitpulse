<script setup lang="ts">
import { AlertCircleIcon, AlertTriangleIcon, Trash2Icon, XIcon } from '@lucide/vue';
import { computed, nextTick, ref, useId, watch } from 'vue';

import type { FollowedRepository } from '#shared/types/release-follows';
import ScrollArea from '~/components/ui/ScrollArea.vue';

const props = defineProps<{
  items: FollowedRepository[];
  unavailableIds?: readonly string[];
}>();

const emit = defineEmits<{
  remove: [id: string];
  clear: [];
}>();

const { t } = useI18n();

const instanceId = useId();
const confirmPanelId = `${instanceId}-clear-confirm`;
const confirmTitleId = `${instanceId}-clear-title`;
const confirmBodyId = `${instanceId}-clear-body`;

const unavailableIdSet = computed(() => new Set(props.unavailableIds ?? []));
const isUnavailable = (id: string) => unavailableIdSet.value.has(id);
const repoLabel = (item: FollowedRepository) => `${item.owner}/${item.name}`;

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

    <ScrollArea v-else class="followed-list__items" role="list">
      <li
        v-for="item in items"
        :key="item.id"
        class="followed-list__item"
        :class="{ 'followed-list__item--unavailable': isUnavailable(item.id) }"
      >
        <AlertCircleIcon
          v-if="isUnavailable(item.id)"
          class="followed-list__status-icon"
          :size="14"
          aria-hidden="true"
        />
        <span
          class="followed-list__name"
          :title="
            isUnavailable(item.id)
              ? t('releaseFollows.unavailable', { repo: repoLabel(item) })
              : repoLabel(item)
          "
        >
          {{ repoLabel(item) }}
        </span>
        <span v-if="isUnavailable(item.id)" class="followed-list__badge">
          {{ t('releaseFollows.unavailableLabel') }}
        </span>
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
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-shrink: 0;
  margin-bottom: 0.75rem;
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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.85rem;
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
