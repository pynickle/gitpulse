<template>
  <div class="public-shell">
    <SkipToContentLink />
    <Navbar variant="public" />
    <main id="main-content" tabindex="-1" class="public-shell__main">
      <div class="public-shell__container">
        <slot />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import Navbar from '~/components/layouts/Navbar.vue';
import SkipToContentLink from '~/components/ui/SkipToContentLink.vue';
</script>

<style scoped lang="scss">
/*
 * One shell for every signed-out surface: the landing pages, the native approval
 * page, and the Browser Launch Link entry. It owns the chrome (skip link,
 * navbar), the frame height, and the page gutter, so those surfaces cannot drift
 * apart again.
 */
.public-shell {
  display: flex;
  flex-direction: column;
  min-height: var(--gitpulse-frame-height);
  background: var(--gitpulse-page-bg);
}

.public-shell__main {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  padding: 1.5rem 1rem 2rem;
}

.public-shell__container {
  display: flex;
  flex: 0 1 auto;
  flex-direction: column;
  width: 100%;
  max-width: 1040px;
  /* Auto margins centre short content and collapse to zero when the content is
     taller than the frame, so a long page never clips its top. */
  margin: auto;
}

@media (max-width: 1023px) {
  .public-shell__main {
    padding: 1rem 0.75rem 1.5rem;
  }
}
</style>
