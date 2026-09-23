<script setup lang="ts">
import { XIcon } from '@lucide/vue';
import { computed, nextTick, shallowRef, watch } from 'vue';

import type { CheckStatusTone, PullRequestChecksView } from '#shared/types/pr-checks';
import { CHECK_ROLLUP_CONTEXT_LIMIT } from '#shared/utils/pr-checks';
import CheckListRows from '~/components/dashboard/pr/CheckListRows.vue';
import createFocusTrapController from '~/utils/createFocusTrapController';

const props = defineProps<{
  isVisible: boolean;
  /** The whole Check Rollup view model, so the modal reads the same source as the chip. */
  view: PullRequestChecksView;
}>();

const emit = defineEmits<{
  close: [];
}>();

const { t } = useI18n();

const panelRef = shallowRef<HTMLElement | null>(null);
const focusTrap = createFocusTrapController();

const summary = computed(() => {
  const { summaryKind, passedCount, failedCount, totalCount, isTruncated } = props.view;
  const counts = { passed: passedCount ?? 0, failed: failedCount ?? 0, total: totalCount };

  // A truncated rollup cannot report a fraction, so the fallback names the total
  // instead of inventing one from the contexts that were fetched.
  if (isTruncated) {
    return t('dashboard.checks.overLimit', {
      total: totalCount,
      limit: CHECK_ROLLUP_CONTEXT_LIMIT,
    });
  }

  if (summaryKind === 'failed') {
    return t('dashboard.checks.summaryFailed', counts);
  }

  if (summaryKind === 'pending') {
    return t('dashboard.checks.summaryPending', counts);
  }

  return t('dashboard.checks.summaryPassed', counts);
});

const summaryTone = computed<CheckStatusTone>(() =>
  props.view.summaryKind === 'failed'
    ? 'danger'
    : props.view.summaryKind === 'pending'
      ? 'warning'
      : 'success'
);

watch(
  () => props.isVisible,
  async (isVisible) => {
    if (!isVisible) {
      await nextTick();
      if (import.meta.client) focusTrap.restorePreviousFocus();
      return;
    }

    if (import.meta.client) focusTrap.capturePreviousFocus();
    await nextTick();
    if (panelRef.value) focusTrap.focusInitialElement(panelRef.value);
  }
);

const handleClose = () => {
  emit('close');
};

const handleOverlayKeydown = (event: KeyboardEvent) => {
  if (panelRef.value) focusTrap.trapTabKey(event, panelRef.value);
};
</script>

<template>
  <Teleport to="body">
    <Transition name="check-list-modal">
      <div
        v-if="isVisible"
        class="check-list-modal__overlay"
        @click.self="handleClose"
        @keydown.escape="handleClose"
        @keydown="handleOverlayKeydown"
      >
        <div
          ref="panelRef"
          class="check-list-modal__panel"
          role="dialog"
          aria-modal="true"
          :aria-label="t('dashboard.checks.modalTitle')"
          tabindex="-1"
        >
          <div class="check-list-modal__header">
            <h3 class="check-list-modal__title">{{ t('dashboard.checks.modalTitle') }}</h3>
            <button
              class="check-list-modal__close"
              type="button"
              :aria-label="t('dashboard.linkedPullRequests.closeAriaLabel')"
              @click="handleClose"
            >
              <XIcon :size="16" />
            </button>
          </div>

          <div class="check-list-modal__content">
            <!-- Summary line first: the headline before the list is scanned. -->
            <p class="check-list-modal__summary" :data-tone="summaryTone">
              <component :is="getCheckStatusToneIcon(summaryTone)" :size="15" aria-hidden="true" />
              <span>{{ summary }}</span>
            </p>

            <p v-if="view.isTruncated" class="check-list-modal__truncated">
              {{ t('dashboard.checks.truncated', { limit: CHECK_ROLLUP_CONTEXT_LIMIT }) }}
            </p>

            <CheckListRows :groups="view.groups" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.check-list-modal__overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: var(--gitpulse-overlay-bg);
  backdrop-filter: blur(6px);
}

.check-list-modal__panel {
  width: 100%;
  max-width: 460px;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  background: var(--gitpulse-surface);
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
  box-shadow: var(--gitpulse-shadow-raised);
  overflow: hidden;
}

.check-list-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 8px;
}

.check-list-modal__title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  letter-spacing: -0.01em;
}

.check-list-modal__close {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: transparent;
  border-radius: 6px;
  color: var(--gitpulse-text-subtle);
  cursor: pointer;
  transition: all 0.12s ease;

  &:hover {
    background: var(--gitpulse-surface-hover);
    color: var(--gitpulse-text);
  }
}

.check-list-modal__content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 20px 16px;
}

.check-list-modal__summary {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0 0 0.35rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--gitpulse-text);
}

.check-list-modal__summary[data-tone='danger'] {
  color: var(--gitpulse-danger, #cf222e);
}

.check-list-modal__summary[data-tone='warning'] {
  color: var(--gitpulse-warning, #bf8700);
}

.check-list-modal__truncated {
  margin: 0 0 0.35rem;
  color: var(--gitpulse-text-muted);
  font-size: 0.72rem;
}

.check-list-modal-enter-active,
.check-list-modal-leave-active {
  transition: opacity 0.16s ease;
}

.check-list-modal-enter-from,
.check-list-modal-leave-to {
  opacity: 0;
}
</style>
