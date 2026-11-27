<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import ScrollArea from '~/components/ui/ScrollArea.vue';
import {
  DETAIL_SHEET_LAYER_ID,
  useDetailOverlayChrome,
} from '~/composables/useDetailOverlayChrome';
import { useDetailSheetDrag } from '~/composables/useDetailSheetDrag';

const { hidden = false } = defineProps<{
  hidden?: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const { t } = useI18n();
const { isDetailSidebarSheetViewport } = useDetailSidebarViewport();
const { isAnyModalOpen } = useModalState();
const chrome = useDetailOverlayChrome();
const hasSheetLayer = shallowRef(false);

const isSheetOpen = computed(() => {
  if (!isDetailSidebarSheetViewport.value) {
    return false;
  }

  return chrome ? chrome.openSheet.value === 'sidebar' : !hidden;
});

const teleportTarget = computed(() => (hasSheetLayer.value ? `#${DETAIL_SHEET_LAYER_ID}` : 'body'));

const closeSheet = () => {
  chrome?.dispatch({ type: 'dismiss-sheet' });
  emit('close');
};

const { dragging, sheetStyle, onPointerDown, onPointerMove, onPointerUp, onPointerCancel } =
  useDetailSheetDrag({
    open: isSheetOpen,
    onDismiss: closeSheet,
  });

const handleEscape = (event: KeyboardEvent) => {
  if (!isSheetOpen.value || event.key !== 'Escape' || event.defaultPrevented) {
    return;
  }

  if (isAnyModalOpen.value) {
    return;
  }

  event.preventDefault();
  closeSheet();
};

const bindEscapeListener = (active: boolean) => {
  if (typeof document === 'undefined') return;
  if (active) {
    document.addEventListener('keydown', handleEscape);
  } else {
    document.removeEventListener('keydown', handleEscape);
  }
};

watch(isSheetOpen, bindEscapeListener, { immediate: true });

onMounted(() => {
  hasSheetLayer.value = Boolean(document.getElementById(DETAIL_SHEET_LAYER_ID));
});

onBeforeUnmount(() => {
  bindEscapeListener(false);
});
</script>

<template>
  <Teleport v-if="isDetailSidebarSheetViewport" :to="teleportTarget">
    <div
      v-if="isSheetOpen"
      class="detail-sidebar-sheet-layer-item"
      :class="{ 'detail-sheet--fixed': !hasSheetLayer }"
    >
      <button
        type="button"
        class="detail-sidebar-sheet-backdrop"
        tabindex="-1"
        :aria-label="t('detailOverlay.closeSheet')"
        @click="closeSheet"
      />
    </div>
    <aside
      class="detail-sidebar-column detail-sidebar-sheet"
      :class="{
        'is-open': isSheetOpen,
        'is-dragging': dragging,
        'detail-sheet--fixed': !hasSheetLayer,
      }"
      :style="sheetStyle"
      :inert="!isSheetOpen || undefined"
      :aria-hidden="!isSheetOpen ? 'true' : undefined"
      :role="isSheetOpen ? 'dialog' : undefined"
      :aria-modal="isSheetOpen ? 'true' : undefined"
      :aria-label="isSheetOpen ? t('detailOverlay.detailSidebarSheetTitle') : undefined"
      tabindex="-1"
    >
      <div
        class="detail-sidebar-sheet__handle-bar"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerCancel"
        @lostpointercapture="onPointerCancel"
      >
        <span class="detail-sidebar-sheet__handle" aria-hidden="true" />
      </div>
      <ScrollArea class="detail-sidebar-sheet__scroll" axis="y">
        <slot />
      </ScrollArea>
    </aside>
  </Teleport>

  <div v-else class="detail-sidebar-column" :inert="hidden || undefined">
    <slot />
  </div>
</template>

<style scoped lang="scss">
.detail-sidebar-sheet-layer-item {
  position: absolute;
  inset: 0;
  pointer-events: none;

  &.detail-sheet--fixed {
    position: fixed;
    z-index: 9999;
  }
}

.detail-sidebar-sheet-backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  padding: 0;
  background: rgb(0 0 0 / 0.4);
  pointer-events: auto;
  cursor: pointer;
  touch-action: none;
}

.detail-sidebar-sheet {
  position: absolute;
  right: 0;
  bottom: var(--detail-keyboard-inset, 0px);
  left: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  width: auto;
  margin: 0;
  padding: 0;
  max-height: min(
    75dvh,
    calc(100% - var(--detail-keyboard-inset, 0px) - 0.5rem),
    calc(var(--detail-keyboard-visible-height, 100%) - 0.5rem)
  );
  overflow: hidden;
  border-radius: 16px 16px 0 0;
  background: var(--gitpulse-surface);
  box-shadow: 0 -8px 32px rgb(0 0 0 / 0.25);
  pointer-events: none;
  transform: translateY(105%);
  visibility: hidden;
  opacity: 0;
  overscroll-behavior: contain;
  transition:
    transform 0.28s cubic-bezier(0.32, 0.72, 0, 1),
    opacity 0.28s ease,
    visibility 0.28s;

  &.is-open {
    pointer-events: auto;
    transform: translateY(0);
    visibility: visible;
    opacity: 1;
  }

  &.is-dragging {
    transition: none;
  }

  &.detail-sheet--fixed {
    position: fixed;
    z-index: 10000;
  }
}

.detail-sidebar-sheet__handle-bar {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.65rem 0 0.5rem;
  touch-action: none;
  cursor: grab;
}

.detail-sidebar-sheet.is-dragging .detail-sidebar-sheet__handle-bar {
  cursor: grabbing;
}

.detail-sidebar-sheet__handle {
  width: 2.25rem;
  height: 0.25rem;
  border-radius: 999px;
  background: var(--gitpulse-border-strong, var(--gitpulse-border));
}

.detail-sidebar-sheet__scroll {
  flex: 1 1 auto;
  min-height: 0;
  max-height: calc(75dvh - 1.5rem);
  padding: 0.25rem 1.25rem 1.5rem;
  overscroll-behavior: contain;
}

.detail-sidebar-sheet__scroll :deep(.sidebar-scroll) {
  height: auto;
  max-height: none;
  padding: 0;
  overflow: visible;
}

@media (prefers-reduced-motion: reduce) {
  .detail-sidebar-sheet {
    transition: none;
  }
}
</style>
