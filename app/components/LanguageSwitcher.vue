<template>
  <div ref="dropdown" class="lang-switcher" :class="{ 'is-open': langOpen }">
    <button
      class="lang-switcher__trigger"
      aria-haspopup="true"
      :aria-controls="menuId"
      @click="langOpen = !langOpen"
    >
      <span>{{ currentLocaleName }}</span>
      <ChevronDownIcon :size="14" class="lang-switcher__chevron" />
    </button>

    <Transition name="lang-switcher-panel">
      <div v-if="langOpen" :id="menuId" class="lang-switcher__menu" role="menu">
        <a
          v-for="lang in locales"
          :key="lang.code"
          class="lang-switcher__item"
          :class="{ 'is-active': lang.code === locale }"
          @click="changeLang(lang.code)"
        >
          {{ lang.name }}
        </a>
      </div>
    </Transition>
  </div>
</template>

<style scoped lang="scss">
.lang-switcher {
  position: relative;
  display: inline-flex;
}

.lang-switcher__trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 10px;
  font-size: 13px;
  font-weight: 500;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  background: var(--gitpulse-surface);
  border: 1px solid var(--gitpulse-input-border);
  border-radius: var(--gitpulse-radius-md);
  cursor: pointer;
  white-space: nowrap;
  transition:
    border-color 0.12s ease,
    background 0.12s ease;

  &:hover {
    border-color: var(--gitpulse-border-strong);
    background: var(--gitpulse-surface-hover);
  }
}

.lang-switcher__chevron {
  flex-shrink: 0;
  color: var(--gitpulse-text-muted);
  transition: transform 0.18s ease;

  .is-open & {
    transform: rotate(180deg);
  }
}

.lang-switcher__menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 1000;
  min-width: 100px;
  padding: 4px;
  background: var(--gitpulse-surface);
  border: 1px solid var(--gitpulse-border);
  border-radius: var(--gitpulse-radius-md);
  box-shadow: var(--gitpulse-shadow-raised);
  overflow: hidden;
}

.lang-switcher__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: var(--gitpulse-radius-md);
  font-size: 13px;
  font-weight: 500;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  cursor: pointer;
  user-select: none;
  text-decoration: none;
  transition: background 0.1s ease;

  &:hover {
    background: var(--gitpulse-surface-active);
  }

  &.is-active {
    background: var(--gitpulse-accent-soft);
    color: var(--gitpulse-accent);
  }
}

.lang-switcher-panel-enter-active,
.lang-switcher-panel-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.lang-switcher-panel-enter-from,
.lang-switcher-panel-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.lang-switcher-panel-enter-to,
.lang-switcher-panel-leave-from {
  opacity: 1;
  transform: translateY(0);
}
</style>

<script setup lang="ts">
import { ChevronDownIcon } from 'lucide-vue-next';
import { computed, onBeforeUnmount, onMounted, shallowRef, useId, useTemplateRef } from 'vue';

const { locale, setLocale, locales } = useI18n();

const langOpen = shallowRef(false);
const dropdown = useTemplateRef<HTMLElement>('dropdown');
const menuId = useId();

type LocaleCode = (typeof locales.value)[number]['code'];

const changeLang = (code: LocaleCode) => {
  setLocale(code);
  langOpen.value = false;
};

const currentLocaleName = computed(() => {
  return locales.value.find((l) => l.code === locale.value)?.name ?? locale.value;
});

const onClickOutside = (e: MouseEvent) => {
  const target = e.target;
  if (!(target instanceof Node) || !dropdown.value?.contains(target)) {
    langOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', onClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside);
});
</script>
