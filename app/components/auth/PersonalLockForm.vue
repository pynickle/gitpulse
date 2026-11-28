<template>
  <div class="personal-lock-form">
    <div class="personal-lock-form__header">
      <div class="personal-lock-form__logo">
        <LockKeyholeIcon :size="48" />
      </div>
      <h2 class="personal-lock-form__title">{{ t('auth.personalModeTitle') }}</h2>
      <p class="personal-lock-form__subtitle">
        {{ t('auth.personalModeSubtitle') }}
      </p>
    </div>

    <div class="personal-lock-form__content">
      <form @submit.prevent="handleUnlock">
        <div class="gp-field personal-lock-form__field">
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

        <div class="gp-field personal-lock-form__remember-field">
          <label class="gp-checkbox personal-lock-form__checkbox">
            <input v-model="remember" type="checkbox" :disabled="submitting" />
            <span>{{ t('auth.rememberDevice') }}</span>
          </label>
        </div>

        <div
          v-if="error"
          class="gp-notice gp-notice--danger personal-lock-form__error"
          role="alert"
        >
          {{ error }}
        </div>

        <Button type="submit" size="large" block :disabled="submitting">
          <LoadingIcon v-if="submitting" class="personal-lock-form__btn-icon" :size="18" />
          <LockOpenIcon v-else class="personal-lock-form__btn-icon" :size="18" />
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

.personal-lock-form__header {
  margin-bottom: 1.5rem;
  text-align: center;
}

.personal-lock-form__logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  margin-bottom: 0.75rem;
  border-radius: 50%;
  background: var(--gitpulse-accent-soft);
  color: var(--gitpulse-accent);
}

.personal-lock-form__title {
  margin-bottom: 0.5rem;
  color: var(--gitpulse-text-strong);
  font-size: 1.5rem;
  font-weight: 800;
  line-height: 1.125;
}

.personal-lock-form__subtitle {
  margin-bottom: 0;
  color: var(--gitpulse-text-muted);
  font-size: 1rem;
  font-weight: 400;
  line-height: 1.25;
}

.personal-lock-form__field {
  margin-bottom: 1rem;
}

.personal-lock-form__remember-field {
  margin-bottom: 1.5rem;
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
  gap: 0.5rem;
  font-size: 0.95rem;
  user-select: none;
}

.personal-lock-form__error {
  margin: 0 0 1rem;
  text-align: center;
}

.personal-lock-form__btn-icon {
  margin-inline-end: 0.75rem;
}
</style>
