<template>
  <FilterDropdown :options="localeOptions" :model-value="locale" @update:model-value="changeLang" />
</template>

<script setup lang="ts">
import { computed } from 'vue';

import FilterDropdown from '~/components/ui/FilterDropdown.vue';
import type { FilterOption } from '~/components/ui/FilterDropdown.vue';

const { locale, setLocale, locales } = useI18n();

const localeOptions = computed<FilterOption[]>(() =>
  locales.value.map((l) => ({
    value: l.code,
    label: l.name ?? l.code,
  }))
);

const changeLang = (code: string) => {
  const nextLocale = locales.value.find((l) => l.code === code);
  if (!nextLocale) return;
  setLocale(nextLocale.code);
};
</script>
