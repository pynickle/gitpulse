<template>
  <div class="widgets-panel">
    <div class="widgets-panel__content">
      <slot></slot>
    </div>
  </div>
</template>
<style scoped lang="scss">
.widgets-panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: transparent;
  padding-left: 1.25rem;
  border-left: 1px solid var(--gitpulse-border);

  &__content {
    flex: 1;
    padding: 0.5rem 0;
  }
}
</style>
