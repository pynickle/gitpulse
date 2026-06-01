<template>
  <div class="dropdown is-right" :class="{ 'is-active': langOpen }">
    <div class="dropdown-trigger">
      <button
        class="button is-small"
        aria-haspopup="true"
        aria-controls="lang-menu"
        @click="langOpen = !langOpen"
      >
        <span>{{ currentLocaleName }}</span>
        <span class="icon is-small">
          <ChevronDownIcon />
        </span>
      </button>
    </div>

    <div class="dropdown-menu" id="lang-menu" role="menu">
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
import { onMounted, onBeforeUnmount, ref, computed } from 'vue';

const { locale, setLocale, locales } = useI18n();

const langOpen = ref(false);

type LocaleCode = (typeof locales.value)[number]['code'];

const changeLang = (code: LocaleCode) => {
  setLocale(code);
  langOpen.value = false;
};

const currentLocaleName = computed(() => {
  return locales.value.find((l) => l.code === locale.value)?.name ?? locale.value;
});

const onClickOutside = (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  if (!target.closest('.dropdown')) {
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
