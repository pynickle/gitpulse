<script setup lang="ts">
import { HistoryIcon, XIcon } from '@lucide/vue';
import { useId, useTemplateRef } from 'vue';

import type { RecoveredRelease } from '#shared/types/timeline-history';
const props = defineProps<{
  open: boolean;
  records: RecoveredRelease[];
  saving: boolean;
  error: string | null;
}>();
const emit = defineEmits<{ close: []; clear: []; open: [item: RecoveredRelease] }>();
const { t } = useI18n();
const titleId = useId();
const panel = useTemplateRef<HTMLElement>('panel');
const { handleKeydown } = useModalLifecycle({
  open: () => props.open,
  panel,
  onRequestClose: () => emit('close'),
});
const {
  expanded,
  dragging,
  panelStyle,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
} = useReleaseOverlaySheet({ open: () => props.open, onRequestClose: () => emit('close') });
</script>
<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="recovered-history"
      :class="{ 'recovered-history--expanded': expanded, 'recovered-history--dragging': dragging }"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      @keydown="handleKeydown"
    >
      <button
        class="recovered-history__scrim"
        type="button"
        tabindex="-1"
        :aria-label="t('releaseTimeline.closeDrawer')"
        @click="emit('close')"
      />
      <aside
        ref="panel"
        class="recovered-history__panel"
        :class="{ 'recovered-history__panel--expanded': expanded }"
        :style="panelStyle"
        tabindex="-1"
      >
        <div
          class="recovered-history__grab"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerCancel"
          @lostpointercapture="onPointerCancel"
        >
          <div class="recovered-history__handle-row">
            <div class="recovered-history__handle" :aria-label="t('releaseTimeline.dragHandle')" />
          </div>
          <header class="recovered-history__chrome">
            <h2 :id="titleId" class="recovered-history__title">
              {{ t('releaseTimeline.recoveredTitle') }} ({{ records.length }})
            </h2>
            <button
              class="recovered-history__close"
              type="button"
              :aria-label="t('releaseTimeline.closeDrawer')"
              @click="emit('close')"
            >
              <XIcon :size="16" />
            </button>
          </header>
        </div>
        <div class="recovered-history__content">
          <p v-if="error" class="recovered-history__error" role="alert">
            {{ t('releaseTimeline.persistenceError') }}
          </p>
          <template v-if="records.length">
            <p class="recovered-history__description">
              {{ t('releaseTimeline.recoveredDescription') }}
            </p>
            <button
              class="button is-small recovered-history__clear"
              type="button"
              :disabled="saving"
              @click="emit('clear')"
            >
              {{ t('releaseTimeline.clearRecovered') }}
            </button>
            <ul class="recovered-history__list">
              <li v-for="record in records" :key="`${record.repository.id}:${record.id}`">
                <button
                  class="recovered-history__record"
                  type="button"
                  @click="emit('open', record)"
                >
                  <span>{{ record.repository.owner }}/{{ record.repository.name }}</span>
                  <strong>{{ record.title }}</strong>
                  <time :datetime="record.publishedAt">{{
                    new Date(record.publishedAt).toLocaleString()
                  }}</time>
                  <span class="recovered-history__summary">{{ record.changelog }}</span>
                </button>
              </li>
            </ul>
          </template>
          <div v-else class="recovered-history__empty">
            <div class="recovered-history__empty-icon" aria-hidden="true">
              <HistoryIcon :size="28" />
            </div>
            <p class="recovered-history__empty-title">{{ t('releaseTimeline.recoveredEmpty') }}</p>
            <p class="recovered-history__empty-description">
              {{ t('releaseTimeline.recoveredDescription') }}
            </p>
          </div>
        </div>
      </aside>
    </div>
  </Teleport>
</template>
<style scoped lang="scss">
.recovered-history {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: flex-end;
  overscroll-behavior: none;
}

.recovered-history__scrim {
  position: absolute;
  inset: 0;
  border: 0;
  background: var(--gitpulse-overlay-bg);
  cursor: pointer;
  touch-action: none;
  overscroll-behavior: none;
}

.recovered-history__panel {
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

.recovered-history--dragging .recovered-history__panel {
  transition: none;
}

.recovered-history__panel--expanded {
  height: 100dvh;
  max-height: 100dvh;
  border-radius: 0;
}

.recovered-history__grab {
  flex-shrink: 0;
  touch-action: none;
  cursor: grab;
}

.recovered-history--dragging .recovered-history__grab {
  cursor: grabbing;
}

.recovered-history__handle-row {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.55rem 0 0.2rem;
}

.recovered-history__handle {
  width: 2.5rem;
  height: 0.28rem;
  border-radius: 999px;
  background: var(--gitpulse-border-strong, var(--gitpulse-border));
}

.recovered-history__chrome {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-shrink: 0;
  padding: 0.35rem 1rem 0.75rem;
  border-bottom: 1px solid var(--gitpulse-border);
}

.recovered-history__title {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: var(--bulma-text-strong);
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recovered-history__close {
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

.recovered-history__close:hover,
.recovered-history__close:focus-visible {
  background: var(--gitpulse-surface-hover, var(--gitpulse-info-soft));
  color: var(--gitpulse-text-strong);
}

.recovered-history__close:focus-visible {
  outline: 2px solid var(--gitpulse-info);
  outline-offset: 2px;
}

.recovered-history__content {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow: auto;
  padding: 1rem 1.15rem 1.35rem;
  overscroll-behavior: contain;
}

@media (min-width: 861px) {
  .recovered-history {
    align-items: stretch;
    justify-content: flex-end;
  }

  .recovered-history__handle-row {
    display: none;
  }

  .recovered-history__grab {
    cursor: default;
    touch-action: auto;
  }

  .recovered-history__panel,
  .recovered-history__panel--expanded {
    width: 480px;
    max-width: 100vw;
    height: 100% !important;
    max-height: none;
    border-radius: 0;
    box-shadow: -1rem 0 2rem rgb(0 0 0 / 0.18);
    transform: none !important;
  }

  .recovered-history__chrome {
    padding: 1rem 1.15rem;
  }
}
.recovered-history__description {
  margin: 0 0 1rem;
  color: var(--gitpulse-text-muted);
  font-size: 0.875rem;
  line-height: 1.55;
}

.recovered-history__error {
  margin: 0 0 0.85rem;
  padding: 0.65rem 0.75rem;
  border-radius: 8px;
  background: var(--gitpulse-danger-soft);
  color: var(--gitpulse-danger);
  font-size: 0.8125rem;
  line-height: 1.45;
}

.recovered-history__clear {
  align-self: flex-start;
}

.recovered-history__empty {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 12rem;
  padding: clamp(1.5rem, 6vh, 3rem) 0.5rem;
  text-align: center;
}

.recovered-history__empty-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 4rem;
  height: 4rem;
  margin-bottom: 1rem;
  border-radius: 50%;
  background-color: var(--gitpulse-info-soft, var(--gitpulse-surface-muted));
  color: var(--gitpulse-accent, var(--gitpulse-link));
}

.recovered-history__empty-title {
  margin: 0 0 0.5rem;
  color: var(--gitpulse-text-strong);
  font-size: 1.05rem;
  font-weight: 600;
}

.recovered-history__empty-description {
  max-width: 24rem;
  margin: 0;
  color: var(--gitpulse-text-muted);
  font-size: 0.875rem;
  line-height: 1.55;
}

.recovered-history__list {
  list-style: none;
  padding: 0;
  margin: 1rem 0 0;
}
.recovered-history__record {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  width: 100%;
  padding: 1rem;
  margin-bottom: 0.75rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
  background: var(--gitpulse-surface);
  color: var(--gitpulse-text-strong);
  text-align: left;
  cursor: pointer;
  overflow-wrap: anywhere;
}
.recovered-history__record:focus-visible {
  outline: 2px solid var(--gitpulse-accent);
}
.recovered-history__summary {
  white-space: pre-wrap;
  color: var(--gitpulse-text-muted);
}
</style>
