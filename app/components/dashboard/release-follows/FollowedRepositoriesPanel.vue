<script setup lang="ts">
import { RocketIcon, XIcon } from '@lucide/vue';
import { nextTick, onUnmounted, shallowRef, watch } from 'vue';

import type { FollowedRepository } from '#shared/types/release-follows';
import FollowedRepositoryList from '~/components/dashboard/release-follows/FollowedRepositoryList.vue';

defineProps<{
  items: FollowedRepository[];
  unavailableIds?: readonly string[];
}>();

const emit = defineEmits<{
  remove: [id: string];
  clear: [];
  return: [];
}>();

const { t } = useI18n();
const { openModal, closeModal } = useModalState();
const sheetOpen = shallowRef(false);
const sheetPanel = shallowRef<HTMLElement | null>(null);
const focusTrap = createFocusTrapController();

const closeSheet = () => {
  sheetOpen.value = false;
};

onUnmounted(() => {
  if (sheetOpen.value) closeModal();
});

watch(sheetOpen, async (open) => {
  if (!import.meta.client) return;

  if (!open) {
    closeModal();
    await nextTick();
    focusTrap.restorePreviousFocus();
    return;
  }

  openModal();
  focusTrap.capturePreviousFocus();
  await nextTick();
  if (sheetPanel.value) focusTrap.focusInitialElement(sheetPanel.value);
});

const handleSheetKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    closeSheet();
    return;
  }
  if (sheetPanel.value) focusTrap.trapTabKey(event, sheetPanel.value);
};
</script>

<template>
  <aside class="followed-panel followed-panel--desktop">
    <FollowedRepositoryList
      :items="items"
      :unavailable-ids="unavailableIds"
      @remove="emit('remove', $event)"
      @clear="emit('clear')"
      @return="emit('return')"
    />
  </aside>

  <button
    class="followed-panel__mobile-bar"
    type="button"
    :aria-expanded="sheetOpen"
    @click="sheetOpen = true"
  >
    <RocketIcon :size="16" aria-hidden="true" />
    <span>{{ t('releaseFollows.followedCount', { count: items.length }) }}</span>
  </button>

  <Teleport to="body">
    <Transition name="followed-sheet">
      <div
        v-if="sheetOpen"
        class="followed-sheet-overlay"
        @click.self="closeSheet"
        @keydown="handleSheetKeydown"
      >
        <div
          ref="sheetPanel"
          class="followed-sheet"
          role="dialog"
          aria-modal="true"
          :aria-label="t('releaseFollows.followedHeading')"
          tabindex="-1"
        >
          <div class="followed-sheet__chrome">
            <h2 class="followed-sheet__title">{{ t('releaseFollows.followedHeading') }}</h2>
            <button
              class="followed-sheet__close"
              type="button"
              :aria-label="t('releaseFollows.closeSheet')"
              @click="closeSheet"
            >
              <XIcon :size="16" aria-hidden="true" />
            </button>
          </div>
          <FollowedRepositoryList
            :items="items"
            :unavailable-ids="unavailableIds"
            @remove="emit('remove', $event)"
            @clear="emit('clear')"
            @return="emit('return')"
          />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.followed-panel--desktop {
  display: none;
  width: 18rem;
  flex-shrink: 0;
  min-height: 0;
  overflow: hidden;
  padding: 1rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: var(--gitpulse-radius-md, 8px);
  background: var(--gitpulse-surface-muted, var(--gitpulse-surface));

  @media (min-width: 861px) {
    display: flex;
    flex-direction: column;
  }
}

.followed-panel__mobile-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  flex-shrink: 0;
  z-index: 2;
  width: 100%;
  padding: 0.75rem 1rem;
  border: 0;
  border-top: 1px solid var(--gitpulse-border);
  background: var(--gitpulse-surface);
  color: var(--gitpulse-text-strong);
  font-size: 0.9rem;
  cursor: pointer;

  @media (min-width: 861px) {
    display: none;
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring, var(--gitpulse-accent));
    outline-offset: -2px;
  }
}

.followed-sheet-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: flex-end;
  background: var(--gitpulse-overlay-bg);
}

.followed-sheet {
  width: 100%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  padding: 1rem 1.25rem 1.5rem;
  border-radius: 12px 12px 0 0;
  background: var(--gitpulse-surface);
  overflow: hidden;
}

.followed-sheet__chrome {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.followed-sheet__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.followed-sheet__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--gitpulse-text-muted);
  cursor: pointer;

  &:hover {
    background: var(--gitpulse-surface-hover);
    color: var(--gitpulse-text-strong);
  }
}

.followed-sheet-enter-active,
.followed-sheet-leave-active {
  transition: opacity 0.16s ease;
}

.followed-sheet-enter-from,
.followed-sheet-leave-to {
  opacity: 0;
}
</style>
