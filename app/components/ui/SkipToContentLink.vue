<script setup lang="ts">
const { t } = useI18n();
</script>

<template>
  <a class="skip-link" href="#main-content">{{ t('app.skipToContent') }}</a>
</template>

<style scoped lang="scss">
/* The first Tab stop on every page: parked above the viewport so it costs no layout, and pulled
   into view only once it holds focus. */
.skip-link {
  position: fixed;
  top: 0.5rem;
  left: 0.5rem;
  z-index: 1000;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  background: var(--gitpulse-surface-raised);
  color: var(--gitpulse-text-strong);
  font-size: 0.85rem;
  font-weight: 600;
  box-shadow: var(--gitpulse-shadow-card);
  transform: translateY(-200%);
  transition: transform 0.15s ease;

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring);
    outline-offset: 2px;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .skip-link {
    transition: none;
  }
}
</style>
