<script setup lang="ts">
import { computed } from 'vue';

const emit = defineEmits<{
  beforeSwitch: [];
}>();

const { locale, locales, t } = useI18n();
const switchLocalePath = useSwitchLocalePath();
const router = useRouter();

type AppLocale = Parameters<typeof switchLocalePath>[0];

const localeCode = (entry: (typeof locales.value)[number]) =>
  typeof entry === 'string' ? entry : entry.code;

const isAppLocale = (code: string): code is AppLocale =>
  locales.value.some((entry) => localeCode(entry) === code);

const localeOptions = computed(() =>
  locales.value.flatMap((entry) => {
    const code = localeCode(entry);
    if (!code || !isAppLocale(code)) return [];

    const label = typeof entry === 'string' ? entry : entry.name || code;
    return [{ code, label }];
  })
);

/**
 * The localized URL is this same page. `setLocale()` pushes a history entry,
 * so Back would only undo the language. Replacing keeps Back on the page the
 * user actually left. The i18n route middleware applies the locale and cookie.
 */
const switchLocale = async (code: AppLocale) => {
  if (code === locale.value) return;

  const target = switchLocalePath(code);
  if (!target) return;

  emit('beforeSwitch');
  await router.replace(target);
};
</script>

<template>
  <div class="language-switcher" role="group" :aria-label="t('language.label')">
    <button
      v-for="option in localeOptions"
      :key="option.code"
      class="language-switcher__option"
      :class="{ 'is-active': option.code === locale }"
      type="button"
      :aria-pressed="option.code === locale"
      @click="switchLocale(option.code)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped lang="scss">
.language-switcher {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  padding: 0.18rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 999px;
  background: var(--gitpulse-surface-muted);
}

.language-switcher__option {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 1.9rem;
  padding: 0 0.6rem;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--gitpulse-text-muted);
  font: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color 0.16s ease,
    color 0.16s ease,
    box-shadow 0.16s ease;

  &:hover,
  &:focus-visible {
    background: var(--gitpulse-surface-hover);
    color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-accent);
    outline-offset: 2px;
  }

  &.is-active {
    background: var(--gitpulse-accent);
    color: #fff;
    box-shadow: 0 1px 3px color-mix(in srgb, var(--gitpulse-accent) 35%, transparent);
  }
}
</style>
