<template>
  <div
    v-if="loggedIn && user"
    class="landing-shell landing-shell--authenticated is-flex is-justify-content-center is-align-items-center"
  >
    <AuthenticatedLandingCard :user="user" @logout="handleLogout" />
  </div>

  <div v-else class="landing-shell">
    <div class="landing-shell__frame card">
      <div class="landing-shell__panel landing-shell__panel--copy">
        <div class="landing-shell__copy has-text-left-tablet has-text-centered-mobile">
          <div class="landing-shell__logo mb-4">
            <RoundImg src="/icon.png" alt="GitPulse Logo" width="80" height="80" />
          </div>

          <p class="landing-shell__eyebrow mb-3">{{ t('landing.heroEyebrow') }}</p>
          <h1 class="title is-2 has-text-weight-bold mb-3">{{ t('app.title') }}</h1>
          <p class="subtitle is-5 has-text-grey-dark mb-4">{{ t('app.subtitle') }}</p>
          <p class="landing-shell__subtitle">
            {{ t('landing.heroDescription') }}
          </p>
        </div>
      </div>

      <div class="landing-shell__panel landing-shell__panel--auth">
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

        <div
          v-if="showProvidersError"
          class="notification is-danger is-light landing-shell__notice"
        >
          {{ t('auth.providerStateUnavailable') }}
        </div>

        <div v-if="showProvidersLoading" class="landing-shell__loading has-text-centered">
          <LoadingIcon :size="22" />
          <p class="mt-3 has-text-grey">{{ t('auth.loadingProviders') }}</p>
        </div>

        <PersonalLockForm v-else-if="isPersonalMode" />
        <AuthGateway v-else-if="providerState" :providers="providerState" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';

import AuthenticatedLandingCard from '~/components/auth/AuthenticatedLandingCard.vue';
import AuthGateway from '~/components/auth/AuthGateway.vue';
import PersonalLockForm from '~/components/auth/PersonalLockForm.vue';
import LoadingIcon from '~/components/ui/LoadingIcon.vue';
import RoundImg from '~/components/ui/RoundImg.vue';

const { user, loggedIn, fetch: fetchUserSession } = useUserSession();
const { t } = useI18n();
const localePath = useLocalePath();
const route = useRoute();
const autoRestoreAttempted = ref(false);
const autoRestorePending = ref(false);

const {
  data: providersData,
  pending: providersPending,
  error: providersError,
} = await useFetch<AuthProviderState>('/api/auth/providers');

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
        await $fetch('/auth/unlock', {
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
          await navigateTo(localePath('/dashboard'));
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

const handleLogout = async () => {
  await navigateTo('/auth/logout', {
    external: true,
  });
};
</script>

<style scoped lang="scss">
@use '~/assets/scss/variables' as *;

.landing-shell {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 100%;
}

.landing-shell--authenticated {
  min-height: calc(100vh - 12rem);
}

.landing-shell__frame {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(22rem, 0.95fr);
  width: min(100%, 1040px);
  overflow: hidden;
  border: 1px solid rgba(10, 10, 10, 0.06);
  border-radius: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.landing-shell__panel {
  padding: 2.5rem;
}

.landing-shell__panel--copy {
  background:
    radial-gradient(circle at top left, rgba(79, 70, 229, 0.18), transparent 45%),
    linear-gradient(180deg, rgba(248, 250, 252, 0.96), rgba(241, 245, 249, 0.92));
  border-right: 1px solid rgba(10, 10, 10, 0.06);
}

.landing-shell__panel--auth {
  display: grid;
  align-content: center;
  gap: 1rem;
  background: #fff;
}

.landing-shell__eyebrow {
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: $brand-primary;
}

.landing-shell__subtitle {
  margin: 0;
  text-align: left;
  color: #4b5563;
  line-height: 1.7;
  max-width: 32rem;
}

.landing-shell__notice {
  margin-bottom: 0;
}

.landing-shell__loading {
  padding: 2rem;
  border: 1px solid rgba(10, 10, 10, 0.06);
  border-radius: 18px;
  background: rgba(248, 250, 252, 0.96);
}

@media (max-width: 1023px) {
  .landing-shell {
    align-items: stretch;
  }

  .landing-shell__frame {
    grid-template-columns: 1fr;
  }

  .landing-shell__panel {
    padding: 2rem;
  }

  .landing-shell__panel--copy {
    border-right: 0;
    border-bottom: 1px solid rgba(10, 10, 10, 0.06);
  }

  .landing-shell__subtitle {
    margin-left: auto;
    margin-right: auto;
    text-align: center;
  }
}
</style>
