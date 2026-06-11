<template>
  <div ref="wrapperRef" class="filter-pill" :class="classes">
    <button
      ref="buttonRef"
      class="filter-pill__trigger"
      type="button"
      role="combobox"
      :aria-expanded="isOpen"
      :aria-haspopup="true"
      :disabled="disabled"
      :title="active && value ? value : undefined"
      @click="toggle"
      @keydown.escape="close"
    >
      <span class="filter-pill__label">{{ label }}</span>
      <span class="filter-pill__value">
        {{ active && value ? value : placeholder }}
      </span>
      <ChevronDownIcon
        :size="12"
        class="filter-pill__chevron"
        :class="{ 'filter-pill__chevron--open': isOpen }"
      />
    </button>

    <Teleport to="body">
      <Transition name="filter-pill-panel">
        <div
          v-if="isOpen"
          ref="panelRef"
          class="filter-pill__panel"
          :style="panelStyle"
          @wheel.stop
        >
          <slot />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ChevronDownIcon } from 'lucide-vue-next';
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';

const props = withDefaults(
  defineProps<{
    label: string;
    value?: string;
    placeholder?: string;
    disabled?: boolean;
    active?: boolean;
  }>(),
  {
    value: '',
    placeholder: 'Any',
    disabled: false,
    active: false,
  }
);

const isOpen = shallowRef(false);

const wrapperRef = ref<HTMLDivElement | null>(null);
const buttonRef = ref<HTMLButtonElement | null>(null);
const panelRef = ref<HTMLDivElement | null>(null);

const panelStyle = shallowRef<Record<string, string>>({});

const classes = computed(() => ({
  'filter-pill--active': props.active,
  'filter-pill--disabled': props.disabled,
  'filter-pill--open': isOpen.value,
}));

function updatePanelPosition() {
  const trigger = wrapperRef.value;
  if (!trigger) return;
  const rect = trigger.getBoundingClientRect();
  panelStyle.value = {
    position: 'fixed',
    top: `${rect.bottom + 6}px`,
    left: `${rect.left}px`,
    minWidth: `${rect.width}px`,
    zIndex: '9999',
  };
}

function open() {
  if (props.disabled) return;
  updatePanelPosition();
  isOpen.value = true;
}

function close() {
  isOpen.value = false;
}

function toggle() {
  if (props.disabled) return;
  if (isOpen.value) close();
  else open();
}

function onClickOutside(e: MouseEvent) {
  const target = e.target as Node;
  if (wrapperRef.value?.contains(target)) return;
  if (panelRef.value?.contains(target)) return;
  close();
}

onMounted(() => {
  document.addEventListener('mousedown', onClickOutside);
  window.addEventListener('resize', close);
  window.addEventListener('scroll', close, true);
});

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onClickOutside);
  window.removeEventListener('resize', close);
  window.removeEventListener('scroll', close, true);
});
</script>

<style scoped lang="scss">
.filter-pill {
  position: relative;
  display: inline-flex;
}

.filter-pill__trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 9999px;
  background: var(--gitpulse-surface);
  font-size: 0.8125rem;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;

  &:hover:not(:disabled) {
    border-color: var(--gitpulse-border-strong);
    background: var(--gitpulse-surface-hover);
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-accent);
    outline-offset: -1px;
  }
}

.filter-pill__label {
  color: var(--gitpulse-text-muted);
  font-weight: 500;
  flex-shrink: 0;
}

.filter-pill__value {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
}

.filter-pill__chevron {
  flex-shrink: 0;
  color: var(--gitpulse-text-muted);
  transition: transform 0.15s ease;

  &--open {
    transform: rotate(180deg);
  }
}

// Active state
.filter-pill--active .filter-pill__trigger {
  border-color: var(--gitpulse-accent);
  background: var(--gitpulse-accent-soft);
}

.filter-pill--active .filter-pill__value {
  color: var(--gitpulse-accent);
}

// Disabled state
.filter-pill--disabled {
  opacity: 0.5;

  .filter-pill__trigger {
    cursor: not-allowed;
    pointer-events: none;
  }
}
</style>

<style lang="scss">
// Panel styles (outside scoped since teleported)
.filter-pill__panel {
  background: var(--gitpulse-surface);
  border: 1px solid var(--gitpulse-border);
  border-radius: var(--gitpulse-radius-md);
  box-shadow: var(--gitpulse-shadow-raised);
  overflow: hidden;
}

// Transition
.filter-pill-panel-enter-active,
.filter-pill-panel-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.filter-pill-panel-enter-from,
.filter-pill-panel-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.filter-pill-panel-enter-to,
.filter-pill-panel-leave-from {
  opacity: 1;
  transform: translateY(0);
}
</style>
