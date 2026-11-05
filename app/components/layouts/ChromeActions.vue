<template>
  <div class="chrome-actions">
    <slot name="actions" />

    <LinkIcon to="https://github.com/pynickle/gitpulse">
      <GitHubIcon class="is-centered" />
    </LinkIcon>

    <!-- Inline above the shell's narrow cutoff. The wrapper div carries the
         scoped class: passing it straight to the component loses the scope id
         through ColorScheme's extra root. -->
    <div class="chrome-actions__inline">
      <LanguageSwitcher />
    </div>
    <div class="chrome-actions__inline">
      <ColorModeToggle />
    </div>

    <!-- Below the cutoff the two extras collapse into one "more" menu, so the
         top bar keeps Brand + GitHub + menu on a 320px viewport instead of
         pushing a control off screen. -->
    <div ref="menuRef" class="chrome-actions__more">
      <button
        type="button"
        class="button is-light is-small chrome-actions__more-toggle"
        :title="t('detailOverlay.moreActions')"
        :aria-label="t('detailOverlay.moreActions')"
        :aria-expanded="isMenuOpen"
        aria-haspopup="menu"
        @click="toggleMenu"
      >
        <EllipsisIcon :size="16" aria-hidden="true" />
      </button>
      <Transition name="chrome-actions-menu">
        <div v-if="isMenuOpen" class="chrome-actions__menu" role="menu">
          <div class="chrome-actions__menu-row" role="none">
            <LanguageSwitcher @before-switch="armMenuForLocaleChange" />
          </div>
          <div class="chrome-actions__menu-row" role="none">
            <span class="chrome-actions__menu-label">{{ t('colorMode.label') }}</span>
            <ColorModeToggle />
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { EllipsisIcon } from '@lucide/vue';
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import LanguageSwitcher from '~/components/LanguageSwitcher.vue';
import ColorModeToggle from '~/components/ui/ColorModeToggle.vue';
import GitHubIcon from '~/components/ui/GitHubIcon.vue';
import LinkIcon from '~/components/ui/LinkIcon.vue';

/*
 * The trailing control group every shell's top bar renders: the GitHub link, the
 * language switcher and the color-mode toggle, with the two extras collapsing
 * into a menu below 860px (the shell's single narrow cutoff).
 *
 * The menu closes on outside clicks, on Escape and on scroll. A locale switch
 * replaces the URL and recreates the page, which would close the menu, so the
 * open state is held across that one recreation; the scroll from that
 * navigation does not count as a dismissal.
 */
defineSlots<{ actions?: () => unknown }>();

const { t } = useI18n();

const restoredMenu = holdDashboardMoreMenu.take();
const isMenuOpen = ref(restoredMenu);
let ignoreScrollClose = restoredMenu;
const menuRef = ref<HTMLElement | null>(null);

const armMenuForLocaleChange = () => {
  holdDashboardMoreMenu.arm();
};

const closeMenu = () => {
  isMenuOpen.value = false;
  ignoreScrollClose = false;
};

const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value;
};

const onDocumentClick = (event: MouseEvent) => {
  if (!isMenuOpen.value) return;
  const target = event.target as Node | null;
  if (target && menuRef.value?.contains(target)) return;
  closeMenu();
};

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') closeMenu();
};

const onScroll = () => {
  if (ignoreScrollClose) return;
  closeMenu();
};

onMounted(() => {
  document.addEventListener('click', onDocumentClick, true);
  document.addEventListener('keydown', onKeydown);
  document.addEventListener('scroll', onScroll, true);

  if (!ignoreScrollClose) return;

  // Nuxt scrolls to the top on the frame after the page finishes loading.
  nextTick(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        ignoreScrollClose = false;
      });
    });
  });
});

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick, true);
  document.removeEventListener('keydown', onKeydown);
  document.removeEventListener('scroll', onScroll, true);
});
</script>

<style scoped lang="scss">
.chrome-actions {
  display: flex;
  flex: none;
  flex-wrap: nowrap;
  align-items: center;
  /* One gap for every top bar: the GitHub link, the language switcher and the
     color-mode toggle must space identically on every surface. */
  gap: 0.75rem;
}

.chrome-actions__inline {
  display: flex;
  align-items: center;
}

.chrome-actions__more {
  display: none;
  position: relative;
}

.chrome-actions__more-toggle {
  height: 2.25rem;
}

.chrome-actions__menu {
  position: absolute;
  top: calc(100% + 0.35rem);
  right: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  min-width: 11rem;
  padding: 0.35rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: var(--gitpulse-radius-lg);
  background: var(--gitpulse-surface);
  box-shadow: var(--gitpulse-shadow-raised);
}

.chrome-actions__menu-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.4rem 0.5rem;

  & + & {
    border-top: 1px solid var(--gitpulse-border);
  }
}

.chrome-actions__menu-label {
  color: var(--gitpulse-text-muted);
  font-size: 0.8rem;
  font-weight: 500;
  white-space: nowrap;
}

.chrome-actions-menu-enter-active,
.chrome-actions-menu-leave-active {
  transition:
    opacity 0.16s ease,
    transform 0.16s ease;
}

.chrome-actions-menu-enter-from,
.chrome-actions-menu-leave-to {
  opacity: 0;
  transform: translateY(-0.3rem);
}

@media (max-width: 860px) {
  .chrome-actions__inline {
    display: none;
  }

  .chrome-actions__more {
    display: block;
  }
}

/* The narrow top bar's menu button: transparent at rest, so it shows whatever
   the bar paints (the public bar and the overlay bar differ), and the shared
   hover fill on interaction — the same convention as the dashboard icon
   buttons, which keeps it correct in both color modes. */
.chrome-actions .chrome-actions__more-toggle {
  height: 2.25rem;
  border-color: transparent;
  background-color: transparent;

  @media (hover: hover) {
    &:hover {
      background-color: var(--gitpulse-surface-hover);
    }
  }

  &:focus-visible {
    background-color: var(--gitpulse-surface-hover);
  }
}

/* The language switcher renders a Bulma dropdown; align its trigger with the
   other inline controls so no bar grows a taller item. */
.chrome-actions :deep(.dropdown),
.chrome-actions :deep(.dropdown-trigger) {
  display: inline-flex;
  align-items: center;
}

.chrome-actions :deep(.dropdown-trigger .button) {
  display: inline-flex;
  align-items: center;
  height: 2.25rem;
}
</style>
