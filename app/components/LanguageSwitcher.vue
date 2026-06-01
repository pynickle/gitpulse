<template>
  <div ref="dropdown" class="dropdown is-right" :class="{ 'is-active': langOpen }">
    <div class="dropdown-trigger">
      <button
        class="button is-small"
        aria-haspopup="true"
        :aria-controls="menuId"
        @click="langOpen = !langOpen"
      >
        <span>{{ currentLocaleName }}</span>
        <span class="icon is-small">
          <ChevronDownIcon />
        </span>
      </button>
    </div>

    <div :id="menuId" class="dropdown-menu" role="menu">
      <div class="dropdown-content">
        <a
          v-for="lang in locales"
          :key="lang.code"
          class="dropdown-item"
          :class="{ 'is-active': lang.code === locale }"
          @click="changeLang(lang.code)"
        >
          {{ lang.name }}
        </a>
      </div>
    </div>
  </div>
</template>

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
