<script setup lang="ts">
import { ShieldCheckIcon } from '@lucide/vue';
import { computed } from 'vue';

import type { NativeLoginBrowserPage } from '#shared/types/native-login-browser';
import PublicAuthCard from '~/components/auth/PublicAuthCard.vue';
import Button from '~/components/ui/Button.vue';
import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';
import GitHubIcon from '~/components/ui/GitHubIcon.vue';

const { model } = defineProps<{
  model: NativeLoginBrowserPage;
}>();

const { t } = useI18n();

const showApprove = computed(() => model.status === 'pending' && model.signedIn);
const showSignIn = computed(() => model.status === 'pending' && !model.signedIn);
const accountName = computed(() => (model.login ? `@${model.login}` : ''));
const showDisplayName = computed(() => Boolean(model.name) && model.name !== model.login);
const showResult = computed(() => model.status !== 'pending');
const statusText = computed(() => {
  switch (model.status) {
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
  switch (model.status) {
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
  <PublicAuthCard
    :eyebrow="t('nativeLogin.eyebrow')"
    :title="t('nativeLogin.title')"
    :paragraphs="[t('nativeLogin.lead'), t('nativeLogin.approveHelp')]"
  >
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
  </PublicAuthCard>
</template>

<style scoped lang="scss">
.native-login__code {
  padding: 0.85rem 0.75rem 0.75rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: var(--gitpulse-radius-lg);
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
  border-radius: var(--gitpulse-radius-lg);
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
  border-radius: var(--gitpulse-radius-lg);
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

@media (max-width: 1023px) {
  .native-login__code-value {
    font-size: 1.45rem;
    letter-spacing: 0.14em;
  }
}
</style>
