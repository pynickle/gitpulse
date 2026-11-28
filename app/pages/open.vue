<script setup lang="ts">
import { computed, watch } from 'vue';

import Button from '~/components/ui/Button.vue';

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
  <!-- The public shell that hosts this page already supplies the `main` landmark. -->
  <div class="open-page" aria-live="polite">
    <div v-if="destination" aria-busy="true">
      <p>{{ t('launch.opening') }}</p>
    </div>
    <div v-else class="open-page__error">
      <h1 class="open-page__title">{{ t('launch.unsupportedTitle') }}</h1>
      <p class="open-page__description">{{ t('launch.unsupportedDescription') }}</p>
      <Button variant="primary" :to="localePath('/dashboard')">
        {{ t('error.cta.dashboard') }}
      </Button>
    </div>
  </div>
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

.open-page__title {
  margin-bottom: 1.5rem;
  color: var(--gitpulse-text-strong);
  font-size: 1.5rem;
  font-weight: 800;
  line-height: 1.125;
}

.open-page__description {
  margin-bottom: 1.5rem;
}
</style>
