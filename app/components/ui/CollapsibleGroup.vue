<template>
  <div class="collapsible-group">
    <button
      class="collapsible-group-header"
      :aria-expanded="!isCollapsed"
      :aria-controls="contentId"
      @click="toggle"
    >
      <ChevronRightIcon
        :size="12"
        class="collapsible-group-chevron"
        :class="{ 'collapsible-group-chevron--expanded': !isCollapsed }"
      />
      <span class="collapsible-group-label">
        <slot name="header" />
      </span>
      <span v-if="count !== undefined" class="collapsible-group-count">
        {{ count }}
      </span>
    </button>
    <Transition name="collapsible-group-content">
      <div v-show="!isCollapsed" :id="contentId" class="collapsible-group-content" role="region">
        <slot />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ChevronRightIcon } from '@lucide/vue';
import { computed, ref } from 'vue';

interface Props {
  id: string;
  defaultCollapsed?: boolean;
  count?: number;
}

const props = withDefaults(defineProps<Props>(), {
  defaultCollapsed: false,
  count: undefined,
});

const isCollapsed = ref(props.defaultCollapsed);

const contentId = computed(() => `collapsible-content-${props.id}`);

const toggle = () => {
  isCollapsed.value = !isCollapsed.value;
};

// 暴露方法供父组件调用
defineExpose({
  collapse: () => {
    isCollapsed.value = true;
  },
  expand: () => {
    isCollapsed.value = false;
  },
  toggle,
});
</script>

<style scoped lang="scss">
.collapsible-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.collapsible-group-header {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 4px 8px;
  margin: 0;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.12s ease;

  &:hover {
    background: var(--gitpulse-surface-hover);
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-accent);
    outline-offset: -2px;
  }
}

.collapsible-group-chevron {
  transition: transform 0.2s ease;
  color: var(--gitpulse-text-muted);
  flex-shrink: 0;

  &--expanded {
    transform: rotate(90deg);
  }
}

.collapsible-group-label {
  flex: 1;
  text-align: left;
  font-size: 11px;
  font-weight: 600;
  color: var(--gitpulse-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.collapsible-group-count {
  font-size: 11px;
  color: var(--gitpulse-text-muted);
}

.collapsible-group-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

// 折叠动画
.collapsible-group-content-enter-active,
.collapsible-group-content-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.collapsible-group-content-enter-from,
.collapsible-group-content-leave-to {
  opacity: 0;
  max-height: 0;
  transform: translateY(-4px);
}

.collapsible-group-content-enter-to,
.collapsible-group-content-leave-from {
  opacity: 1;
  max-height: 500px;
  transform: translateY(0);
}
</style>
