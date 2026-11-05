<template>
  <div v-if="loggedIn && user" class="landing-shell">
    <AuthenticatedLandingCard :user="user" @logout="handleLogout" />
  </div>

  <PublicAuthCard
    v-else
    :eyebrow="t('landing.heroEyebrow')"
    :title="t('app.title')"
    :paragraphs="[t('app.subtitle'), t('landing.heroDescription')]"
    logo-alt="GitPulse Logo"
  >
    <div v-if="pageErrorMessage" class="notification is-danger is-light landing-shell__notice">
      {{ pageErrorMessage }}
    </div>

    <div
      v-for="warning in providerWarnings"
      :key="warning"
      class="notification is-warning is-light landing-shell__notice"
    >
      {{ warning }}
    </div>

    <div v-if="showProvidersError" class="notification is-danger is-light landing-shell__notice">
      {{ t('auth.providerStateUnavailable') }}
    </div>

    <div v-if="showProvidersLoading" class="landing-shell__loading has-text-centered">
      <LoadingIcon :size="22" />
      <p class="mt-3 has-text-grey">{{ t('auth.loadingProviders') }}</p>
    </div>

    <PersonalLockForm v-else-if="isPersonalMode" />
    <AuthGateway v-else-if="providerState" :providers="providerState" />
  </PublicAuthCard>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';

import { parseCanonicalOrigin } from '#shared/utils/canonical-origin';
import AuthenticatedLandingCard from '~/components/auth/AuthenticatedLandingCard.vue';
import AuthGateway from '~/components/auth/AuthGateway.vue';
import PersonalLockForm from '~/components/auth/PersonalLockForm.vue';
import LoadingIcon from '~/components/ui/LoadingIcon.vue';
import RoundImg from '~/components/ui/RoundImg.vue';

const { user, loggedIn, fetch: fetchUserSession } = useUserSession();
const { t } = useI18n();
const apiFetch = useGitPulseApiFetch();
const localePath = useLocalePath();
const requestUrl = useRequestURL();
const runtimeConfig = useRuntimeConfig();
const { continueToReturnTarget } = useAuthReturnNavigation();

usePageMeta(undefined, {
  description: t('landing.heroDescription'),
});
const route = useRoute();
const installedOrigin = parseCanonicalOrigin(runtimeConfig.public.i18n?.baseUrl);

useHead(() => {
  const head = landingAuthReturnHead({
    hasReturnTo: hasAuthReturnQuery(route.query),
    canonicalHref: landingCanonicalHref({
      localePath: localePath('/'),
      canonicalOrigin: installedOrigin.ok ? installedOrigin.origin : undefined,
      requestOrigin: requestUrl.origin,
    }),
  });
  if (!head) return {};

  return {
    link: [{ key: 'canonical', rel: 'canonical', href: head.canonicalHref }],
    meta: [
      { key: 'robots', name: 'robots', content: head.robots },
      { key: 'nuxt-seo-utils:og-url', property: 'og:url', content: head.canonicalHref },
    ],
  };
});
const autoRestoreAttempted = ref(false);
const autoRestorePending = ref(false);

const {
  data: providersData,
  pending: providersPending,
  error: providersError,
} = await useFetch('/api/auth/providers');

const providerState = computed(() => providersData.value ?? null);
const isPersonalMode = computed(() => providerState.value?.mode === 'personal');
const providerWarnings = computed(() => providerState.value?.warnings ?? []);
const showProvidersLoading = computed(() => providersPending.value && !isPersonalMode.value);
const showProvidersError = computed(() => Boolean(providersError.value) && !isPersonalMode.value);
const pageErrorMessage = computed(() => {
  const errorCode = Array.isArray(route.query.error) ? route.query.error[0] : route.query.error;

  switch (errorCode) {
    case 'auth_failed':
      return t('auth.authFailed');
    case 'oauth_unavailable':
      return t('auth.oauthUnavailable');
    default:
      return '';
  }
});

if (import.meta.client) {
  watch(
    [isPersonalMode, loggedIn],
    async ([personalMode, isLoggedIn]) => {
      if (!personalMode || isLoggedIn || autoRestoreAttempted.value || autoRestorePending.value) {
        return;
      }

      autoRestoreAttempted.value = true;
      autoRestorePending.value = true;

      try {
        try {
          await apiFetch('/auth/unlock', {
            method: 'POST',
            body: {},
          });
        } catch {
          // Ignore: missing/invalid remember cookie falls back to manual unlock.
          return;
        }

        try {
          await fetchUserSession();
          await nextTick();

          if (loggedIn.value) {
            await continueToReturnTarget();
          }
        } catch (error) {
          console.error('Auto-restore session refresh failed', error);
        }
      } finally {
        autoRestorePending.value = false;
      }
    },
    { immediate: true }
  );
}

const handleLogout = async () => {
  await apiFetch('/auth/logout', {
    method: 'POST',
  });

  await fetchUserSession();
};
</script>

<style scoped lang="scss">
.landing-shell {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.landing-shell__notice {
  margin-bottom: 0;
}

.landing-shell__loading {
  padding: 2rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: var(--gitpulse-radius-lg);
  background: var(--gitpulse-surface-muted);

  @media (max-width: 480px) {
    padding: 1.25rem;
  }
}
</style>
