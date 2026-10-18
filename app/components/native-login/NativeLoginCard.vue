<script setup lang="ts">
import { ShieldCheckIcon } from '@lucide/vue';
import { computed } from 'vue';
import { GitHubIcon } from 'vue3-simple-icons';

import type { NativeLoginBrowserPage } from '#shared/types/native-login-browser';
import Button from '~/components/ui/Button.vue';
import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';
import RoundImg from '~/components/ui/RoundImg.vue';

const props = defineProps<{
  model: NativeLoginBrowserPage;
}>();

const { t } = useI18n();

const showApprove = computed(() => props.model.status === 'pending' && props.model.signedIn);
const showSignIn = computed(() => props.model.status === 'pending' && !props.model.signedIn);
const accountName = computed(() => (props.model.login ? `@${props.model.login}` : ''));
const showDisplayName = computed(
  () => Boolean(props.model.name) && props.model.name !== props.model.login
);
const showResult = computed(() => props.model.status !== 'pending');
const statusText = computed(() => {
  switch (props.model.status) {
    case 'approved':
      return t('nativeLogin.status.approved');
    case 'cancelled':
      return t('nativeLogin.status.cancelled');
    case 'expired':
      return t('nativeLogin.status.expired');
    case 'redeemed':
      return t('nativeLogin.status.redeemed');
    default:
      return '';
  }
});
const statusClass = computed(() => {
  switch (props.model.status) {
    case 'approved':
    case 'redeemed':
      return 'is-success';
    case 'cancelled':
    case 'expired':
      return 'is-warning';
    default:
      return '';
  }
});
</script>

<template>
  <article class="native-login">
    <section class="native-login__copy">
      <div class="native-login__logo">
        <RoundImg src="/icon.png" alt="GitPulse" width="56" height="56" />
      </div>
      <p class="native-login__eyebrow">{{ t('nativeLogin.eyebrow') }}</p>
      <h1 class="title is-3 native-login__title">{{ t('nativeLogin.title') }}</h1>
      <p class="native-login__text">{{ t('nativeLogin.lead') }}</p>
      <p class="native-login__text">{{ t('nativeLogin.approveHelp') }}</p>
    </section>

    <section class="native-login__decision">
      <div class="native-login__code">
        <p class="native-login__code-label">{{ t('nativeLogin.codeLabel') }}</p>
        <p class="native-login__code-value">{{ model.confirmationCode }}</p>
      </div>

      <div v-if="model.signedIn" class="native-login__identity">
        <GitHubAvatar
          variant="raised"
          :src="model.avatarUrl"
          :alt="accountName"
          :width="40"
          :height="40"
          loading="eager"
        />
        <div class="native-login__identity-copy">
          <p class="native-login__identity-login">{{ accountName }}</p>
          <p v-if="showDisplayName" class="native-login__identity-name">{{ model.name }}</p>
        </div>
      </div>

      <form v-if="showApprove" method="post" :action="model.approveAction">
        <input type="hidden" name="id" :value="model.id" />
        <input type="hidden" name="browserToken" :value="model.browserToken" />
        <input type="hidden" name="csrfToken" :value="model.csrfToken" />
        <Button type="submit" class="is-fullwidth is-justify-content-center">
          <ShieldCheckIcon class="mr-3" :size="20" />
          {{ t('nativeLogin.approve') }}
        </Button>
      </form>

      <Button
        v-else-if="showSignIn"
        :href="model.signInUrl"
        class="is-fullwidth is-justify-content-center"
      >
        <GitHubIcon class="mr-3" />
        {{ t('nativeLogin.continueWithGithub') }}
      </Button>

      <p v-if="showResult" class="native-login__result" :class="statusClass" role="status">
        {{ statusText }}
      </p>
    </section>
  </article>
</template>

<style scoped lang="scss">
@use '~/assets/scss/variables' as *;

.native-login {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(18rem, 0.95fr);
  width: min(100%, 960px);
  overflow: hidden;
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
  background: var(--gitpulse-surface);
  box-shadow: var(--gitpulse-shadow-card);
  text-align: left;
}

.native-login__copy,
.native-login__decision {
  padding: 1.75rem 2rem;
}

.native-login__copy {
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: var(--gitpulse-surface-muted);
  border-right: 1px solid var(--gitpulse-border);
}

.native-login__decision {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.9rem;
}

.native-login__logo {
  margin-bottom: 0.85rem;
}

.native-login__eyebrow {
  margin: 0 0 0.45rem;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: $brand-primary;
}

.native-login__title {
  margin-bottom: 0.75rem;
}

.native-login__text {
  margin: 0;
  color: var(--gitpulse-text);
  font-size: 1rem;
  line-height: 1.55;
}

.native-login__text + .native-login__text {
  margin-top: 0.7rem;
}

.native-login__code {
  padding: 0.85rem 0.75rem 0.75rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
  background: var(--gitpulse-accent-soft);
  text-align: center;
}

.native-login__code-label {
  margin: 0 0 0.2rem;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--gitpulse-text);
}

.native-login__code-value {
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 1.85rem;
  font-weight: 700;
  letter-spacing: 0.22em;
  color: var(--gitpulse-text-strong);
}

.native-login__identity {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
  background: var(--gitpulse-surface-muted);
}

.native-login__identity-copy {
  min-width: 0;
}

.native-login__identity-login,
.native-login__identity-name {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.native-login__identity-login {
  font-weight: 700;
  color: var(--gitpulse-text-strong);
}

.native-login__identity-name {
  color: var(--gitpulse-text);
}

.native-login__result {
  margin: 0;
  padding: 0.8rem 0.9rem;
  border-radius: 8px;
  font-weight: 600;
  line-height: 1.45;
}

.native-login__result.is-success {
  background: var(--gitpulse-success-soft);
  color: var(--gitpulse-success);
}

.native-login__result.is-warning {
  background: var(--gitpulse-warning-soft);
  color: var(--gitpulse-warning);
}

@media (max-width: 860px) {
  .native-login {
    grid-template-columns: 1fr;
  }

  .native-login__copy,
  .native-login__decision {
    padding: 1rem 1rem 1.05rem;
  }

  .native-login__copy {
    border-right: 0;
    border-bottom: 1px solid var(--gitpulse-border);
  }

  .native-login__logo {
    margin-bottom: 0.55rem;
  }

  .native-login__title {
    margin-bottom: 0.45rem;
    font-size: 1.45rem;
  }

  .native-login__text {
    font-size: 0.95rem;
  }

  .native-login__code-value {
    font-size: 1.45rem;
    letter-spacing: 0.14em;
  }
}
</style>
