<script setup lang="ts">
import { ChevronRightIcon } from '@lucide/vue';
import type { Component } from 'vue';
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  useTemplateRef,
  watch,
} from 'vue';

type SettingsCategoryNavItem = {
  id: string;
  icon: Component;
  title: string;
  description: string;
};

const { activeId } = defineProps<{
  items: SettingsCategoryNavItem[];
  activeId: string;
}>();

const emit = defineEmits<{
  select: [id: string];
}>();

const navRef = useTemplateRef<HTMLElement>('nav');

// One accent bar travels between rows instead of a per-row border snapping on and off.
// Only `transform` is animated, so switching categories never re-runs layout.
const activeIndicator = shallowRef<{ x: number; y: number; height: number } | null>(null);

const measureActiveIndicator = () => {
  const nav = navRef.value;
  const activeItem = nav?.querySelector<HTMLElement>('.settings-category-nav__item.is-active');
  if (!nav || !activeItem) {
    activeIndicator.value = null;
    return;
  }

  const navRect = nav.getBoundingClientRect();
  const itemRect = activeItem.getBoundingClientRect();
  // Integer offsets keep the 2px bar on whole pixels. The height is applied rather than
  // animated: rows are one line tall, and in the rare case a label wraps, a taller bar
  // beats scaling a 1px box into a blurry one.
  const next = {
    x: Math.round(itemRect.left - navRect.left),
    y: Math.round(itemRect.top - navRect.top),
    height: Math.round(itemRect.height),
  };
  const current = activeIndicator.value;
  // A resize can report unchanged geometry; re-rendering for it would only repatch rows.
  if (current?.x === next.x && current.y === next.y && current.height === next.height) {
    return;
  }

  activeIndicator.value = next;
};

const indicatorStyle = computed(() => {
  const indicator = activeIndicator.value;
  if (!indicator) return undefined;

  return {
    height: `${indicator.height}px`,
    transform: `translate(${indicator.x}px, ${indicator.y}px)`,
  };
});

// Measure once the active row's own render has landed, so the bar never paints on the
// previous row for a frame after a click. `immediate` covers the first render too: the
// queued tick runs after mount, when the rows have their geometry.
watch(
  () => activeId,
  () => {
    void nextTick(measureActiveIndicator);
  },
  { immediate: true }
);

let navResizeObserver: ResizeObserver | undefined;

onMounted(() => {
  const nav = navRef.value;
  if (typeof ResizeObserver === 'undefined' || !nav) return;

  // Rows move without any prop change when the viewport narrows enough to wrap a label,
  // or when a swapped app font changes the line box.
  navResizeObserver = new ResizeObserver(() => measureActiveIndicator());
  navResizeObserver.observe(nav);
});

onBeforeUnmount(() => {
  navResizeObserver?.disconnect();
  navResizeObserver = undefined;
});
</script>

<template>
  <div ref="nav" class="settings-category-nav">
    <!-- Decorative: the active row already carries `aria-current`. -->
    <span
      v-if="activeIndicator"
      class="settings-category-nav__indicator"
      :style="indicatorStyle"
      aria-hidden="true"
    />
    <button
      v-for="item in items"
      :key="item.id"
      class="settings-category-nav__item"
      :class="{ 'is-active': item.id === activeId }"
      type="button"
      :aria-current="item.id === activeId ? 'page' : undefined"
      @click="emit('select', item.id)"
    >
      <span class="settings-category-nav__icon" aria-hidden="true">
        <component :is="item.icon" :size="16" />
      </span>
      <span class="settings-category-nav__body">
        <span class="settings-category-nav__title">{{ item.title }}</span>
        <span class="settings-category-nav__desc">{{ item.description }}</span>
      </span>
      <ChevronRightIcon class="settings-category-nav__chevron" :size="16" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped lang="scss">
@use '~/assets/scss/pointer' as *;

.settings-category-nav {
  position: relative;
  display: flex;
  flex-direction: column;
}

.settings-category-nav__indicator {
  position: absolute;
  top: 0;
  left: 0;
  width: 2px;
  background: var(--gitpulse-accent);
  pointer-events: none;
  transition: transform 0.28s cubic-bezier(0.22, 0.61, 0.36, 1);
}

.settings-category-nav__item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.45rem 0.6rem 0.45rem 0.85rem;
  margin-left: 0.25rem;
  border-radius: 0 6px 6px 0;
  border: 0;
  /* Space only: the travelling indicator paints the accent, so this never changes. */
  border-left: 2px solid transparent;
  background: transparent;
  color: var(--gitpulse-text-muted);
  font: inherit;
  font-size: 0.8rem;
  font-weight: 550;
  text-align: left;
  cursor: pointer;
  transition:
    color 0.18s ease,
    background 0.18s ease;

  // No font-weight change on the active row: the glyph reflow reads as a jitter
  // that fights the bar sliding under it.
  &.is-active {
    color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring);
    outline-offset: 2px;
  }
}

.settings-category-nav__icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
}

.settings-category-nav__body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
}

.settings-category-nav__title {
  min-width: 0;
}

.settings-category-nav__desc,
.settings-category-nav__chevron {
  display: none;
}

/* Same breakpoint as dashboard home chrome / overlay padding. */
@media screen and (max-width: 860px) {
  .settings-category-nav {
    border: 1px solid var(--gitpulse-border);
    border-radius: var(--gitpulse-radius-xl);
    overflow: hidden;
    background: var(--gitpulse-surface);
  }

  /* The rows are cards here; a left-edge bar has nothing to mark. */
  .settings-category-nav__indicator {
    display: none;
  }

  .settings-category-nav__item {
    align-items: flex-start;
    gap: 0.75rem;
    width: 100%;
    margin-left: 0;
    padding: 0.9rem 1rem;
    border-radius: 0;
    border-left: 0;
    border-bottom: 1px solid var(--gitpulse-border);
    color: var(--bulma-text-strong, var(--gitpulse-text-strong));
    font-size: 0.95rem;
    font-weight: 650;

    &:last-child {
      border-bottom: 0;
    }

    @include hover-only {
      &:hover {
        background: var(--gitpulse-surface-hover);
      }
    }
  }

  .settings-category-nav__icon {
    width: 2rem;
    height: 2rem;
    border-radius: var(--gitpulse-radius-lg);
    background: var(--gitpulse-accent-soft);
    color: var(--gitpulse-accent);
  }

  .settings-category-nav__body {
    gap: 0.2rem;
  }

  .settings-category-nav__desc {
    display: block;
    color: var(--gitpulse-text-muted);
    font-size: 0.78rem;
    font-weight: 500;
    line-height: 1.4;
  }

  .settings-category-nav__chevron {
    display: block;
    flex-shrink: 0;
    align-self: center;
    color: var(--gitpulse-text-subtle);
  }
}

@media (prefers-reduced-motion: reduce) {
  .settings-category-nav__indicator,
  .settings-category-nav__item {
    transition: none;
  }
}
</style>
