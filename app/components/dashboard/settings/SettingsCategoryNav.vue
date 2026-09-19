<script setup lang="ts">
import { ChevronRightIcon } from '@lucide/vue';
import type { Component } from 'vue';

type SettingsCategoryNavItem = {
  id: string;
  icon: Component;
  title: string;
  description: string;
};

defineProps<{
  items: SettingsCategoryNavItem[];
  activeId: string;
}>();

const emit = defineEmits<{
  select: [id: string];
}>();
</script>

<template>
  <div class="settings-category-nav">
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
.settings-category-nav {
  display: flex;
  flex-direction: column;
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
  border-left: 2px solid transparent;
  background: transparent;
  color: var(--gitpulse-text-muted);
  font: inherit;
  font-size: 0.8rem;
  font-weight: 550;
  text-align: left;
  cursor: pointer;
  transition:
    color 0.12s ease,
    border-color 0.12s ease,
    background 0.12s ease;

  &.is-active {
    color: var(--bulma-text-strong, var(--gitpulse-text-strong));
    border-left-color: var(--gitpulse-accent);
    font-weight: 650;
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

    &.is-active {
      border-left-color: transparent;
      font-weight: 650;
      background: transparent;
    }

    @media (hover: hover) {
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
</style>
