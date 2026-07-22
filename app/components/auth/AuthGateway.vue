<template>
  <div class="auth-gateway">
    <div class="auth-gateway__header mb-4">
      <p class="auth-gateway__eyebrow mb-2">{{ modeLabel }}</p>
      <h2 class="title is-4 mb-2">{{ t('landing.authCardTitle') }}</h2>
      <p class="subtitle is-6 has-text-grey mb-0">{{ t('landing.authCardSubtitle') }}</p>
    </div>

    <div class="auth-gateway__content">
      <Button
        v-if="providers.oauthEnabled"
        href="/auth/github"
        class="is-fullwidth is-justify-content-center mb-0"
      >
        <GitHubIcon class="mr-3" />
        {{ t('auth.connectWithGithub') }}
      </Button>

      <div v-if="showDivider" class="auth-gateway__divider" aria-hidden="true">
        <span>{{ t('auth.or') }}</span>
      </div>

      <form v-if="showPatSection" class="auth-gateway__pat" @submit.prevent="handlePatSubmit">
        <div class="field">
          <label class="label auth-gateway__label" for="github-pat-input">{{
            t('auth.tokenLabel')
          }}</label>
          <div class="control has-icons-left">
            <input
              id="github-pat-input"
              v-model="token"
              class="input"
              type="password"
              autocomplete="off"
              spellcheck="false"
              :placeholder="t('auth.tokenPlaceholder')"
              :disabled="submitting"
            />
            <span class="icon is-left auth-gateway__input-icon">
              <KeyRoundIcon :size="18" />
            </span>
          </div>
          <p class="help has-text-grey-dark auth-gateway__help">
            {{ t('auth.tokenHelp') }}
            <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer">
              {{ t('auth.tokenHelpLink') }}
            </a>
          </p>

          <div
            class="auth-gateway__gh-auth-tip"
            v-html="
              t('auth.tokenTipGhAuth').replace(
                /`([^`]+)`/g,
                '<code class=&quot;auth-gateway__code&quot;>$1</code>'
              )
            "
          />
        </div>

        <div v-if="tokenError" class="notification is-danger is-light auth-gateway__error">
          {{ tokenError }}
        </div>

        <Button type="submit" class="is-fullwidth is-justify-content-center" :disabled="submitting">
          <LoadingIcon v-if="submitting" class="mr-3" :size="18" />
          <KeyRoundIcon v-else class="mr-3" :size="18" />
          {{ submitting ? t('auth.connectingWithPat') : t('auth.continueWithPat') }}
        </Button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { KeyRoundIcon } from '@lucide/vue';
import { computed, ref, watch } from 'vue';
import { GitHubIcon } from 'vue3-simple-icons';

import Button from '~/components/ui/Button.vue';
import LoadingIcon from '~/components/ui/LoadingIcon.vue';

const props = defineProps<{
  providers: AuthProviderState;
}>();

const { t } = useI18n();
const { fetch: fetchUserSession } = useUserSession();
const localePath = useLocalePath();
const apiFetch = useGitPulseApiFetch();
const token = ref('');
const tokenError = ref('');
const submitting = ref(false);

const getTokenLoginErrorMessage = (error: unknown) => {
  if (typeof error !== 'object' || error === null) {
    return '';
  }

  const data = 'data' in error ? error.data : undefined;
  const dataStatusMessage =
    typeof data === 'object' &&
    data !== null &&
    'statusMessage' in data &&
    typeof data.statusMessage === 'string'
      ? data.statusMessage
      : '';

  if (dataStatusMessage) {
    return dataStatusMessage;
  }

  return 'statusMessage' in error && typeof error.statusMessage === 'string'
    ? error.statusMessage
    : '';
};

watch(
  () => props.providers,
  (_) => {
    tokenError.value = '';
    token.value = '';
  },
  { deep: true }
);

const modeLabel = computed(() => {
  switch (props.providers.mode) {
    case 'hybrid':
      return t('landing.authStatusHybrid');
    case 'oauth-only':
      return t('landing.authStatusOAuthOnly');
    default:
      return t('landing.authStatusPatOnly');
  }
});

const showDivider = computed(() => props.providers.oauthEnabled && props.providers.patEnabled);
const showPatSection = computed(() => props.providers.patEnabled);

const handlePatSubmit = async () => {
  const normalizedToken = token.value.trim();

  if (!normalizedToken) {
    tokenError.value = t('auth.tokenRequired');
    return;
  }

  submitting.value = true;
  tokenError.value = '';

  try {
    await apiFetch('/auth/pat', {
      method: 'POST',
      body: {
        token: normalizedToken,
      },
    });

    await fetchUserSession();
    await navigateTo(localePath('/dashboard'));
  } catch (error) {
    const statusMessage = getTokenLoginErrorMessage(error);

    tokenError.value =
      statusMessage === 'Invalid GitHub token'
        ? t('auth.tokenInvalid')
        : statusMessage || t('auth.tokenLoginFailed');
  } finally {
    submitting.value = false;
  }
};
</script>

<style scoped lang="scss">
@use '~/assets/scss/variables' as *;

.auth-gateway {
  height: 100%;
}

.auth-gateway__eyebrow {
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: $brand-primary;
}

.auth-gateway__divider {
  position: relative;
  margin: 1.2rem 0;
  text-align: center;
}

.auth-gateway__divider::before {
  position: absolute;
  inset: 50% 0 auto;
  border-top: 1px solid var(--gitpulse-border);
  content: '';
}

.auth-gateway__divider span {
  position: relative;
  display: inline-block;
  padding: 0 0.85rem;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--gitpulse-text-muted);
  background: var(--gitpulse-surface);
}

.auth-gateway__label {
  font-size: 0.9rem;
  margin-bottom: 0.55rem;
}

.auth-gateway__input-icon {
  color: var(--gitpulse-text-muted);
}

.auth-gateway__help {
  margin-top: 0.55rem;
  line-height: 1.55;
}

.auth-gateway__help a {
  font-weight: 600;
}

.auth-gateway__pat {
  display: grid;
  gap: 0.9rem;
}

.auth-gateway__error {
  margin: 0;
}

.auth-gateway__gh-auth-tip {
  margin-top: 0.25rem;
  padding: 0.5rem 0.65rem;
  font-size: 0.8rem;
  line-height: 1.45;
  color: var(--gitpulse-text-muted);
  background: var(--gitpulse-accent-soft);
  border: 1px solid color-mix(in srgb, var(--gitpulse-accent) 18%, transparent);
  border-radius: var(--gitpulse-radius-md);
}

.auth-gateway__gh-auth-tip :deep(.auth-gateway__code) {
  padding: 0.15em 0.4em;
  font-size: 0.92em;
  font-weight: 600;
  font-family: var(--gitpulse-code-font-family);
  background: var(--gitpulse-code-bg);
  border: 1px solid color-mix(in srgb, var(--gitpulse-accent) 15%, transparent);
  border-radius: 4px;
  color: var(--gitpulse-text-strong);
}
</style>
