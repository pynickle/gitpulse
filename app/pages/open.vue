<script setup lang="ts">
import { computed, watch } from 'vue';

const route = useRoute();
const router = useRouter();
const localePath = useLocalePath();
const { t } = useI18n();

const rawUrl = computed(() => {
  const value = route.query.url;
  return typeof value === 'string' ? value : null;
});
const destination = computed(() => {
  if (!Object.hasOwn(route.query, 'url')) {
    return localePath('/dashboard');
  }

  const target = resolveGitPulseLaunchRoute(rawUrl.value);
  return target ? localePath(target) : null;
});

watch(
  destination,
  (resolvedDestination) => {
    if (!import.meta.client || !resolvedDestination) {
      return;
    }

    void router.replace(resolvedDestination);
  },
  { immediate: true }
);
</script>

<template>
  <main class="open-page" aria-live="polite">
    <div v-if="destination" aria-busy="true">
      <p>{{ t('launch.opening') }}</p>
    </div>
    <div v-else class="open-page__error">
      <h1 class="title is-4">{{ t('launch.unsupportedTitle') }}</h1>
      <p class="mb-5">{{ t('launch.unsupportedDescription') }}</p>
      <NuxtLinkLocale class="button is-primary" :to="localePath('/dashboard')">
        {{ t('error.cta.dashboard') }}
      </NuxtLinkLocale>
    </div>
  </main>
</template>

<style scoped lang="scss">
.open-page {
  display: grid;
  min-height: 50vh;
  place-items: center;
  padding: 2rem;
}

.open-page__error {
  max-width: 36rem;
  text-align: center;
}
</style>
