<template>
  <div class="personal-lock-form">
    <div class="personal-lock-form__header mb-5 has-text-centered">
      <div class="personal-lock-form__logo mb-3">
        <LockKeyholeIcon :size="48" class="has-text-primary" />
      </div>
      <h2 class="personal-lock-form__title mb-2">{{ t('auth.personalModeTitle') }}</h2>
      <p class="personal-lock-form__subtitle has-text-grey mb-0">
        {{ t('auth.personalModeSubtitle') }}
      </p>
    </div>

    <div class="personal-lock-form__content">
      <form @submit.prevent="handleUnlock">
        <div class="gp-field mb-4">
          <label class="gp-label personal-lock-form__label" for="vault-password">{{
            t('auth.passwordLabel')
          }}</label>
          <div class="gp-control gp-control--icon-left">
            <input
              id="vault-password"
              v-model="password"
              class="gp-input gp-input--medium"
              type="password"
              autocomplete="current-password"
              spellcheck="false"
              :placeholder="t('auth.passwordPlaceholder')"
              :disabled="submitting"
              autofocus
            />
            <span class="gp-control__icon personal-lock-form__input-icon">
              <KeyRoundIcon :size="20" />
            </span>
          </div>
        </div>

        <div class="gp-field mb-5">
          <label class="gp-checkbox personal-lock-form__checkbox">
            <input v-model="remember" type="checkbox" :disabled="submitting" />
            <span class="ml-2">{{ t('auth.rememberDevice') }}</span>
          </label>
        </div>

        <div
          v-if="error"
          class="gp-notice gp-notice--danger personal-lock-form__error mb-4"
          role="alert"
        >
          {{ error }}
        </div>

        <Button type="submit" size="large" block :disabled="submitting">
          <LoadingIcon v-if="submitting" class="mr-3" :size="18" />
          <LockOpenIcon v-else class="mr-3" :size="18" />
          {{ submitting ? t('auth.unlocking') : t('auth.unlock') }}
        </Button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { KeyRoundIcon, LockKeyholeIcon, LockOpenIcon } from '@lucide/vue';
import { ref } from 'vue';

import Button from '~/components/ui/Button.vue';
import LoadingIcon from '~/components/ui/LoadingIcon.vue';

const { t } = useI18n();
const { fetch: fetchUserSession } = useUserSession();
const apiFetch = useGitPulseApiFetch();
const { continueToReturnTarget } = useAuthReturnNavigation();

const password = ref('');
const remember = ref(false);
const error = ref('');
const submitting = ref(false);

const handleUnlock = async () => {
  const normalizedPassword = password.value.trim();

  if (!normalizedPassword) {
    return;
  }

  submitting.value = true;
  error.value = '';

  try {
    await apiFetch('/auth/unlock', {
      method: 'POST',
      body: {
        password: normalizedPassword,
        remember: remember.value,
      },
    });

    await fetchUserSession();
    await continueToReturnTarget();
  } catch {
    error.value = t('auth.invalidPassword');
  } finally {
    submitting.value = false;
  }
};
</script>

<style scoped lang="scss">
.personal-lock-form {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.personal-lock-form__logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: var(--gitpulse-accent-soft);
  color: var(--gitpulse-accent);
}

.personal-lock-form__title {
  color: var(--gitpulse-text-strong);
  font-size: 1.5rem;
  font-weight: 800;
  line-height: 1.125;
}

.personal-lock-form__subtitle {
  color: var(--gitpulse-text-muted);
  font-size: 1rem;
  font-weight: 400;
  line-height: 1.25;
}

.personal-lock-form__label {
  font-size: 0.9rem;
  margin-bottom: 0.55rem;
}

.personal-lock-form__input-icon {
  color: var(--gitpulse-text-muted);
}

.personal-lock-form__checkbox {
  display: flex;
  align-items: center;
  font-size: 0.95rem;
  user-select: none;
}

.personal-lock-form__error {
  margin: 0;
  text-align: center;
}
</style>
