<template>
  <div v-if="loggedIn && user" class="landing-shell landing-shell--authenticated">
    <AuthenticatedLandingCard :user="user" @logout="handleLogout" />
  </div>

  <div v-else class="landing-shell">
    <div class="columns is-variable is-8 is-vcentered landing-shell__columns">
      <div class="column is-6-desktop has-text-left landing-shell__copy">
        <div class="landing-shell__logo mb-5">
          <RoundImg src="/icon.png" alt="GitPulse Logo" width="84" height="84" />
        </div>

        <p class="landing-shell__eyebrow mb-4">{{ t('landing.heroEyebrow') }}</p>
        <h1 class="title is-2 has-text-weight-bold mb-4">{{ t('app.title') }}</h1>
        <p class="subtitle is-5 has-text-grey-dark landing-shell__subtitle">
          {{ t('landing.heroDescription') }}
        </p>

        <div class="landing-shell__highlights">
          <div class="landing-shell__highlight box">
            <p class="landing-shell__highlight-title">{{ t('landing.highlightFlexibleTitle') }}</p>
            <p class="landing-shell__highlight-copy">{{ t('landing.highlightFlexibleBody') }}</p>
          </div>
          <div class="landing-shell__highlight box">
            <p class="landing-shell__highlight-title">{{ t('landing.highlightUnifiedTitle') }}</p>
            <p class="landing-shell__highlight-copy">{{ t('landing.highlightUnifiedBody') }}</p>
          </div>
          <div class="landing-shell__highlight box">
            <p class="landing-shell__highlight-title">{{ t('landing.highlightPrivateTitle') }}</p>
            <p class="landing-shell__highlight-copy">{{ t('landing.highlightPrivateBody') }}</p>
          </div>
        </div>
      </div>

      <div class="column is-5-desktop is-offset-1-desktop">
        <div v-if="pageErrorMessage" class="notification is-danger is-light mb-4">
          {{ pageErrorMessage }}
        </div>

        <div
          v-for="warning in providerWarnings"
          :key="warning"
          class="notification is-warning is-light mb-4"
        >
          {{ warning }}
        </div>

        <div v-if="providersError" class="notification is-danger is-light mb-4">
          {{ t('auth.providerStateUnavailable') }}
        </div>

        <div v-if="providersPending" class="box landing-shell__loading has-text-centered">
          <LoadingIcon :size="22" />
          <p class="mt-3 has-text-grey">{{ t('auth.loadingProviders') }}</p>
        </div>

        <AuthGateway v-else-if="providerState" :providers="providerState" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import AuthenticatedLandingCard from '~/components/auth/AuthenticatedLandingCard.vue';
import AuthGateway from '~/components/auth/AuthGateway.vue';
import LoadingIcon from '~/components/ui/LoadingIcon.vue';
import RoundImg from '~/components/ui/RoundImg.vue';

const { user, loggedIn, clear } = useUserSession();
const { t } = useI18n();
const route = useRoute();

const {
  data: providersData,
  pending: providersPending,
  error: providersError,
} = await useFetch<AuthProviderState>('/api/auth/providers');

const providerState = computed(() => providersData.value ?? null);
const providerWarnings = computed(() => providerState.value?.warnings ?? []);
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

const handleLogout = async () => {
  await clear();
};
</script>

<style scoped lang="scss">
.landing-shell {
  padding: 2rem 0 6rem;
}

.landing-shell--authenticated {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: calc(100vh - 12rem);
}

.landing-shell__columns {
  align-items: center;
}

.landing-shell__copy {
  text-align: left;
}

.landing-shell__eyebrow {
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #4f46e5;
}

.landing-shell__subtitle {
  max-width: 36rem;
  line-height: 1.7;
}

.landing-shell__highlights {
  display: grid;
  gap: 1rem;
  margin-top: 2rem;
}

.landing-shell__highlight {
  padding: 1.1rem 1.15rem;
  margin: 0;
  text-align: left;
  border: 1px solid rgba(10, 10, 10, 0.05);
  box-shadow: 0 14px 34px rgba(10, 10, 10, 0.05);
}

.landing-shell__highlight-title {
  margin-bottom: 0.35rem;
  font-size: 0.96rem;
  font-weight: 700;
}

.landing-shell__highlight-copy {
  margin: 0;
  color: #4b5563;
  line-height: 1.65;
}

.landing-shell__loading {
  padding: 2rem;
}

@media (max-width: 1023px) {
  .landing-shell {
    padding-top: 1rem;
  }

  .landing-shell__copy {
    text-align: center;
    margin-bottom: 2rem;
  }

  .landing-shell__subtitle {
    margin-left: auto;
    margin-right: auto;
  }
}
</style>
