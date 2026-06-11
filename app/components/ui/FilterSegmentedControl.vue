<template>
  <div
    ref="containerEl"
    class="segmented-control"
    :class="{ 'segmented-control--disabled': disabled }"
    role="tablist"
    :aria-label="ariaLabel"
    @keydown="onKeydown"
  >
    <div v-if="activeIndex >= 0" class="segmented-control-indicator" :style="indicatorStyle" />
    <button
      v-for="(option, index) in options"
      :key="option.value"
      type="button"
      role="tab"
      class="segmented-control-option"
      :class="{
        'is-active': option.value === modelValue,
        'is-disabled': option.disabled,
      }"
      :aria-selected="option.value === modelValue"
      :aria-disabled="option.disabled || disabled"
      :tabindex="option.value === modelValue ? 0 : -1"
      :disabled="option.disabled || disabled"
      @click="selectOption(option)"
      @focus="focusedIndex = index"
      @blur="focusedIndex = -1"
    >
      <component
        :is="option.icon"
        v-if="option.icon"
        :size="13"
        class="segmented-control-option-icon"
        :style="option.value === modelValue && option.color ? { color: option.color } : undefined"
      />
      <span
        class="segmented-control-option-label"
        :style="option.value === modelValue && option.color ? { color: option.color } : undefined"
        >{{ option.label }}</span
      >
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue';

export interface SegmentedOption {
  value: string;
  label: string;
  disabled?: boolean;
  icon?: Component;
  color?: string;
}

const props = withDefaults(
  defineProps<{
    options: SegmentedOption[];
    modelValue?: string;
    disabled?: boolean;
    ariaLabel?: string;
  }>(),
  {
    modelValue: '',
    disabled: false,
    ariaLabel: undefined,
  }
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const focusedIndex = ref(-1);
const containerRef = useTemplateRef<HTMLDivElement>('containerEl');
const indicatorPos = ref({ left: 0, width: 0 });

const activeIndex = computed(() => props.options.findIndex((o) => o.value === props.modelValue));

function updateIndicator() {
  const container = containerRef.value;
  if (!container) return;
  const buttons = container.querySelectorAll<HTMLButtonElement>('.segmented-control-option');
  const active = buttons[activeIndex.value];
  if (!active) return;
  const containerRect = container.getBoundingClientRect();
  const activeRect = active.getBoundingClientRect();
  indicatorPos.value = {
    left: activeRect.left - containerRect.left,
    width: activeRect.width,
  };
}

let resizeObserver: ResizeObserver | null = null;

watch(
  [activeIndex, () => props.options],
  () => {
    nextTick(updateIndicator);
  },
  { immediate: true }
);

onMounted(() => {
  updateIndicator();
  resizeObserver = new ResizeObserver(() => updateIndicator());
  if (containerRef.value) resizeObserver.observe(containerRef.value);
});

onUnmounted(() => {
  resizeObserver?.disconnect();
});

const indicatorStyle = computed(() => {
  if (activeIndex.value < 0) return { display: 'none' };
  const activeColor = props.options[activeIndex.value]?.color;
  return {
    left: `${indicatorPos.value.left}px`,
    width: `${indicatorPos.value.width}px`,
    ...(activeColor
      ? { background: `color-mix(in srgb, ${activeColor} 15%, var(--gitpulse-surface))` }
      : undefined),
  };
});

function selectOption(option: SegmentedOption) {
  if (option.disabled || props.disabled) return;
  emit('update:modelValue', option.value);
}

function selectOptionAt(index: number) {
  const option = props.options[index];
  if (!option) return;
  selectOption(option);
  focusedIndex.value = index;
}

function onKeydown(e: KeyboardEvent) {
  const opts = props.options;
  const currentIdx = focusedIndex.value >= 0 ? focusedIndex.value : activeIndex.value;

  switch (e.key) {
    case 'ArrowRight':
    case 'Right': {
      e.preventDefault();
      let nextIdx = currentIdx + 1;
      while (nextIdx < opts.length && opts[nextIdx]?.disabled) nextIdx++;
      if (nextIdx < opts.length) {
        selectOptionAt(nextIdx);
      }
      break;
    }
    case 'ArrowLeft':
    case 'Left': {
      e.preventDefault();
      let prevIdx = currentIdx - 1;
      while (prevIdx >= 0 && opts[prevIdx]?.disabled) prevIdx--;
      if (prevIdx >= 0) {
        selectOptionAt(prevIdx);
      }
      break;
    }
    case 'Home': {
      e.preventDefault();
      let idx = 0;
      while (idx < opts.length && opts[idx]?.disabled) idx++;
      if (idx < opts.length) {
        selectOptionAt(idx);
      }
      break;
    }
    case 'End': {
      e.preventDefault();
      let idx = opts.length - 1;
      while (idx >= 0 && opts[idx]?.disabled) idx--;
      if (idx >= 0) {
        selectOptionAt(idx);
      }
      break;
    }
  }
}

watch(
  () => props.modelValue,
  (val) => {
    const idx = props.options.findIndex((o) => o.value === val);
    if (idx >= 0) focusedIndex.value = idx;
  },
  { immediate: true }
);
</script>

<style scoped lang="scss">
.segmented-control {
  position: relative;
  display: inline-flex;
  background: var(--gitpulse-surface-muted);
  border: 1px solid var(--gitpulse-border);
  border-radius: 9999px;
  padding: 2px;

  &--disabled {
    opacity: 0.5;
    pointer-events: none;
  }
}

.segmented-control-indicator {
  position: absolute;
  top: 2px;
  height: calc(100% - 4px);
  background: var(--gitpulse-surface);
  border-radius: 9999px;
  box-shadow: var(--gitpulse-shadow-card);
  transition:
    left 0.2s cubic-bezier(0.4, 0, 0.2, 1),
    width 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
  z-index: 0;
}

.segmented-control-option {
  position: relative;
  z-index: 1;
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  padding: 0.375rem 0.75rem;
  border: none;
  border-radius: 9999px;
  background: transparent;
  color: var(--gitpulse-text-muted);
  font-family: var(--gitpulse-app-font-family);
  font-size: 0.8125rem;
  font-weight: 400;
  line-height: 1.25;
  cursor: pointer;
  white-space: nowrap;
  transition:
    color 0.15s ease,
    font-weight 0.15s ease;
  user-select: none;

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring);
    outline-offset: -1px;
  }

  &.is-active {
    color: var(--gitpulse-text-strong);
    font-weight: 500;
  }

  &:hover:not(.is-active):not(.is-disabled) {
    color: var(--gitpulse-text);
  }

  &.is-disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.segmented-control-option-icon {
  flex-shrink: 0;
  transition: color 0.15s ease;
}

.segmented-control-option-label {
  pointer-events: none;
}
</style>
