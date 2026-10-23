<script setup lang="ts">
import { XIcon } from '@lucide/vue';
import { nextTick, onUnmounted, shallowRef, watch } from 'vue';

import type { FollowedRepository, FollowedRepositoryMetadata } from '#shared/types/release-follows';
import type { FollowedRepositoryView } from '#shared/types/user-settings';
import FollowedRepositoryList from '~/components/dashboard/release-follows/FollowedRepositoryList.vue';

defineProps<{
  items: FollowedRepository[];
  unavailableIds?: readonly string[];
  view: FollowedRepositoryView;
  metadata: ReadonlyMap<string, FollowedRepositoryMetadata>;
  pendingIds?: ReadonlySet<string>;
}>();

const emit = defineEmits<{
  remove: [id: string];
  clear: [];
  'update:view': [view: FollowedRepositoryView];
  retry: [id: string];
}>();

// The page renders the narrow-screen trigger inside its own fixed footer bar,
// so it owns the open state and this panel only draws the wide aside and sheet.
const open = defineModel<boolean>('open', { default: false });

const { t } = useI18n();
const { openModal, closeModal } = useModalState();
const sheetPanel = shallowRef<HTMLElement | null>(null);
const sheetCloseRef = shallowRef<HTMLElement | null>(null);
const focusTrap = createFocusTrapController();

const closeSheet = () => {
  open.value = false;
};

onUnmounted(() => {
  if (open.value) closeModal();
});

watch(open, async (isOpen) => {
  if (!import.meta.client) return;

  if (!isOpen) {
    closeModal();
    await nextTick();
    focusTrap.restorePreviousFocus();
    return;
  }

  openModal();
  focusTrap.capturePreviousFocus();
  await nextTick();
  // Prefer the close button; the clear trigger sits before it in DOM order.
  if (sheetCloseRef.value) sheetCloseRef.value.focus();
  else if (sheetPanel.value) focusTrap.focusInitialElement(sheetPanel.value);
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
      :view="view"
      :metadata="metadata"
      :pending-ids="pendingIds"
      @remove="emit('remove', $event)"
      @clear="emit('clear')"
      @update:view="emit('update:view', $event)"
      @retry="emit('retry', $event)"
    />
  </aside>

  <Teleport to="body">
    <Transition name="followed-sheet">
      <div
        v-if="open"
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
          <FollowedRepositoryList
            :items="items"
            :unavailable-ids="unavailableIds"
            :view="view"
            :metadata="metadata"
            :pending-ids="pendingIds"
            @remove="emit('remove', $event)"
            @clear="emit('clear')"
            @update:view="emit('update:view', $event)"
            @retry="emit('retry', $event)"
          >
            <template #close>
              <button
                ref="sheetCloseRef"
                class="followed-sheet__close"
                type="button"
                :aria-label="t('releaseFollows.closeSheet')"
                @click="closeSheet"
              >
                <XIcon :size="16" aria-hidden="true" />
              </button>
            </template>
          </FollowedRepositoryList>
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
  // A max-height alone leaves the nested flex panes indefinite, so SimpleBar's
  // percentage-height wrapper can overflow and create a second scrollport.
  height: 80vh;
  height: 80dvh;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 1rem 1.25rem 1.5rem;
  border-radius: 12px 12px 0 0;
  background: var(--gitpulse-surface);
  overflow: hidden;
}

.followed-sheet__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.9rem;
  height: 1.9rem;
  padding: 0;
  border: 0;
  border-radius: var(--gitpulse-radius-md, 6px);
  background: transparent;
  color: var(--gitpulse-text-muted);
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;

  &:hover {
    background: var(--gitpulse-surface-hover);
    color: var(--gitpulse-text-strong);
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring, var(--gitpulse-accent));
    outline-offset: 2px;
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
