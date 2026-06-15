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
    label: l.name,
  }))
);

const changeLang = (code: string) => {
  setLocale(code);
};
</script>
