<template>
  <div class="widgets-panel">
    <div class="widgets-panel__content">
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
// No props needed - panel is always visible
</script>

<style scoped lang="scss">
.widgets-panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: transparent;
  padding-left: 1.25rem;
  border-left: 1px solid var(--bulma-border-light, rgba(0, 0, 0, 0.05));

  @media (prefers-color-scheme: dark) {
    border-left: 1px solid rgba(255, 255, 255, 0.05);
  }

  &__content {
    flex: 1;
    padding: 0.5rem 0;
  }
}
</style>
