<script setup lang="ts">
import { Loader2Icon, XIcon } from '@lucide/vue';
import { computed, nextTick, onUnmounted, shallowRef, useId, watch } from 'vue';

import type { TimelineRelease } from '#shared/types/release-follows';
import type { ReleaseDetailPayload } from '#shared/types/releases';
import ReleaseDrawerBody from '~/components/dashboard/release-timeline/ReleaseDrawerBody.vue';

const props = defineProps<{
  open: boolean;
  item: TimelineRelease | null;
  detail: ReleaseDetailPayload | null;
  loading: boolean;
  error: string | null;
}>();

const emit = defineEmits<{
  close: [];
  retry: [];
}>();

const { t } = useI18n();
const { openModal, closeModal } = useModalState();
const titleId = useId();
const panel = shallowRef<HTMLElement | null>(null);
const focusTrap = createFocusTrapController();
const expanded = shallowRef(false);
const dragging = shallowRef(false);
const dragOffsetY = shallowRef(0);
const dragStartY = shallowRef<number | null>(null);

const title = computed(
  () => props.detail?.name?.trim() || props.item?.title || t('releaseTimeline.drawerLabel')
);

const panelStyle = computed(() => {
  const offset = dragOffsetY.value;
  const lift = Math.max(0, -offset);
  const drop = Math.max(0, offset);
  return {
    transform: drop ? `translateY(${drop}px)` : undefined,
    height: !expanded.value && lift ? `calc(70vh + ${lift}px)` : undefined,
  };
});

const resetGesture = () => {
  expanded.value = false;
  dragging.value = false;
  dragOffsetY.value = 0;
  dragStartY.value = null;
};

watch(
  () => props.open,
  async (open) => {
    if (!import.meta.client) return;

    if (!open) {
      closeModal();
      resetGesture();
      await nextTick();
      focusTrap.restorePreviousFocus();
      return;
    }

    openModal();
    focusTrap.capturePreviousFocus();
    await nextTick();
    if (panel.value) focusTrap.focusInitialElement(panel.value);
  }
);

onUnmounted(() => {
  if (props.open) closeModal();
});

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    emit('close');
    return;
  }
  if (panel.value) focusTrap.trapTabKey(event, panel.value);
};

const isSheetViewport = () => import.meta.client && window.matchMedia('(max-width: 860px)').matches;

const onPointerDown = (event: PointerEvent) => {
  if (event.button !== 0 || !isSheetViewport()) return;
  const target = event.target;
  if (target instanceof Element && target.closest('button, a[href]')) return;
  dragStartY.value = event.clientY;
  dragging.value = true;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
};

const applySheetGesture = (event: PointerEvent, phase: 'move' | 'end') => {
  if (dragStartY.value == null) return;
  const result = resolveReleaseDrawerSheetGesture({
    deltaY: event.clientY - dragStartY.value,
    expanded: expanded.value,
    phase,
  });
  dragOffsetY.value = result.offsetY;
  if (phase === 'move') return;

  dragging.value = false;
  dragStartY.value = null;
  dragOffsetY.value = 0;

  if (result.outcome === 'dismiss') {
    emit('close');
    return;
  }
  if (result.outcome === 'expand') expanded.value = true;
  if (result.outcome === 'collapse') expanded.value = false;
};

const onPointerMove = (event: PointerEvent) => {
  applySheetGesture(event, 'move');
};

const onPointerUp = (event: PointerEvent) => {
  applySheetGesture(event, 'end');
};
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open && item"
      class="release-drawer"
      :class="{
        'release-drawer--expanded': expanded,
        'release-drawer--dragging': dragging,
      }"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      @keydown="handleKeydown"
    >
      <button
        class="release-drawer__scrim"
        type="button"
        tabindex="-1"
        :aria-label="t('releaseTimeline.closeDrawer')"
        @click="emit('close')"
      />

      <aside
        ref="panel"
        class="release-drawer__panel"
        :class="{ 'release-drawer__panel--expanded': expanded }"
        :style="panelStyle"
        tabindex="-1"
      >
        <div
          class="release-drawer__grab"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
        >
          <div class="release-drawer__handle-row">
            <div class="release-drawer__handle" :aria-label="t('releaseTimeline.dragHandle')" />
          </div>

          <header class="release-drawer__chrome">
            <h2 :id="titleId" class="release-drawer__chrome-title">{{ title }}</h2>
            <button
              class="release-drawer__close"
              type="button"
              :aria-label="t('releaseTimeline.closeDrawer')"
              :title="t('releaseTimeline.closeDrawer')"
              @click="emit('close')"
            >
              <XIcon :size="16" aria-hidden="true" />
            </button>
          </header>
        </div>

        <div class="release-drawer__content">
          <div
            v-if="loading && !detail"
            class="release-drawer__status"
            role="status"
            :aria-label="t('releaseDetail.loading')"
            aria-busy="true"
          >
            <Loader2Icon :size="22" class="spin-animation" aria-hidden="true" />
          </div>

          <div v-else-if="error && !detail" class="release-drawer__status">
            <p class="release-drawer__error">{{ error }}</p>
            <button
              class="button is-small is-danger is-outlined"
              type="button"
              @click="emit('retry')"
            >
              {{ t('releaseTimeline.retry') }}
            </button>
          </div>

          <ReleaseDrawerBody v-else-if="detail" :item="item" :detail="detail" />
        </div>
      </aside>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.release-drawer {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: flex-end;
  overscroll-behavior: none;
}

.release-drawer__scrim {
  position: absolute;
  inset: 0;
  border: 0;
  background: var(--gitpulse-overlay-bg);
  cursor: pointer;
  touch-action: none;
  overscroll-behavior: none;
}

.release-drawer__panel {
  position: relative;
  z-index: 1;
  display: flex;
  width: 100%;
  max-height: 100dvh;
  height: 70vh;
  flex-direction: column;
  overflow: hidden;
  border-radius: 12px 12px 0 0;
  background: var(--gitpulse-surface);
  box-shadow: 0 -1rem 2rem rgb(0 0 0 / 0.18);
  transition:
    transform 0.2s ease,
    height 0.2s ease,
    max-height 0.2s ease,
    border-radius 0.2s ease;
}

.release-drawer--dragging .release-drawer__panel {
  transition: none;
}

.release-drawer__panel--expanded {
  height: 100dvh;
  max-height: 100dvh;
  border-radius: 0;
}

.release-drawer__grab {
  flex-shrink: 0;
  touch-action: none;
  cursor: grab;
}

.release-drawer--dragging .release-drawer__grab {
  cursor: grabbing;
}

.release-drawer__handle-row {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.55rem 0 0.2rem;
}

.release-drawer__handle {
  width: 2.5rem;
  height: 0.28rem;
  border-radius: 999px;
  background: var(--gitpulse-border-strong, var(--gitpulse-border));
}

.release-drawer__chrome {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-shrink: 0;
  padding: 0.35rem 1rem 0.75rem;
  border-bottom: 1px solid var(--gitpulse-border);
}

.release-drawer__chrome-title {
  margin: 0;
  min-width: 0;
  overflow: hidden;
  color: var(--gitpulse-text-strong);
  font-size: 0.95rem;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.release-drawer__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--gitpulse-text-muted);
  cursor: pointer;
}

.release-drawer__close:hover,
.release-drawer__close:focus-visible {
  background: var(--gitpulse-surface-hover, var(--gitpulse-info-soft));
  color: var(--gitpulse-text-strong);
}

.release-drawer__close:focus-visible {
  outline: 2px solid var(--gitpulse-info);
  outline-offset: 2px;
}

.release-drawer__content {
  min-height: 0;
  flex: 1;
  overflow: auto;
  padding: 1rem 1.15rem 1.35rem;
  overscroll-behavior: contain;
}

.release-drawer__status {
  display: flex;
  min-height: 10rem;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.85rem;
  text-align: center;
}

.release-drawer__error {
  margin: 0;
  color: var(--gitpulse-danger);
  font-size: 0.88rem;
}

.spin-animation {
  animation: release-drawer-spin 1s linear infinite;
  color: var(--gitpulse-accent);
}

@keyframes release-drawer-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@media (min-width: 861px) {
  .release-drawer {
    align-items: stretch;
    justify-content: flex-end;
  }

  .release-drawer__handle-row {
    display: none;
  }

  .release-drawer__grab {
    cursor: default;
    touch-action: auto;
  }

  .release-drawer__panel,
  .release-drawer__panel--expanded {
    width: 480px;
    max-width: 100vw;
    height: 100% !important;
    max-height: none;
    border-radius: 0;
    box-shadow: -1rem 0 2rem rgb(0 0 0 / 0.18);
    transform: none !important;
  }

  .release-drawer__chrome {
    padding: 1rem 1.15rem;
  }
}
</style>
