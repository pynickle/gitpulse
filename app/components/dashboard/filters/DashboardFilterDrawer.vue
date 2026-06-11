<script setup lang="ts">
import { XIcon } from 'lucide-vue-next';
import { nextTick, ref, watch } from 'vue';

import createFocusTrapController from '~/utils/createFocusTrapController';

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const { t } = useI18n();
const panelElement = ref<HTMLElement | null>(null);
const focusTrap = createFocusTrapController();

watch(
  () => props.open,
  async (open) => {
    if (!import.meta.client) return;

    if (!open) {
      await nextTick();
      focusTrap.restorePreviousFocus();
      return;
    }

    focusTrap.capturePreviousFocus();

    await nextTick();
    if (panelElement.value) focusTrap.focusInitialElement(panelElement.value);
  }
);

const handlePanelKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    emit('close');
    return;
  }

  if (panelElement.value) focusTrap.trapTabKey(event, panelElement.value);
};
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="dashboard-filter-drawer"
      role="dialog"
      aria-labelledby="dashboard-filter-drawer-title"
      aria-modal="true"
      @keydown="handlePanelKeydown"
    >
      <button
        class="dashboard-filter-drawer__scrim"
        type="button"
        tabindex="-1"
        :aria-label="t('dashboard.filters.closeDrawer')"
        @click="emit('close')"
      />

      <aside ref="panelElement" class="dashboard-filter-drawer__panel" tabindex="-1">
        <header class="dashboard-filter-drawer__header">
          <h2 id="dashboard-filter-drawer-title">{{ t('dashboard.filters.title') }}</h2>
          <button
            class="button is-ghost is-small"
            type="button"
            :aria-label="t('dashboard.filters.closeDrawer')"
            :title="t('dashboard.filters.closeDrawer')"
            @click="emit('close')"
          >
            <XIcon v-once :size="18" aria-hidden="true" />
          </button>
        </header>
        <div class="dashboard-filter-drawer__body">
          <slot />
        </div>
      </aside>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.dashboard-filter-drawer {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: none;
}

.dashboard-filter-drawer__scrim {
  position: absolute;
  inset: 0;
  border: 0;
  background: rgb(0 0 0 / 0.38);
}

.dashboard-filter-drawer__panel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  display: flex;
  width: min(24rem, 90vw);
  flex-direction: column;
  background: var(--gitpulse-surface);
  box-shadow: -1rem 0 2rem rgb(0 0 0 / 0.18);
}

.dashboard-filter-drawer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem;
  border-bottom: 1px solid var(--gitpulse-border);
}

.dashboard-filter-drawer__header h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
}

.dashboard-filter-drawer__body {
  display: grid;
  gap: 1rem;
  overflow: auto;
  padding: 1rem;
}

@media (max-width: 860px) {
  .dashboard-filter-drawer {
    display: block;
  }
}
</style>
