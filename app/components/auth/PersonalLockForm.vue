<template>
  <div class="personal-lock-form">
    <div class="personal-lock-form__header mb-5 has-text-centered">
      <div class="personal-lock-form__logo mb-3">
        <LockKeyholeIcon :size="48" class="has-text-primary" />
      </div>
      <h2 class="title is-4 mb-2">{{ t('auth.personalModeTitle') }}</h2>
      <p class="subtitle is-6 has-text-grey mb-0">{{ t('auth.personalModeSubtitle') }}</p>
    </div>

    <div class="personal-lock-form__content">
      <form @submit.prevent="handleUnlock">
        <div class="field mb-4">
          <label class="label personal-lock-form__label" for="vault-password">{{
            t('auth.passwordLabel')
          }}</label>
          <div class="control has-icons-left">
            <input
              id="vault-password"
              v-model="password"
              class="input is-medium"
              type="password"
              autocomplete="current-password"
              spellcheck="false"
              :placeholder="t('auth.passwordPlaceholder')"
              :disabled="submitting"
              autofocus
            />
            <span class="icon is-left personal-lock-form__input-icon">
              <KeyRoundIcon :size="20" />
            </span>
          </div>
        </div>

        <div class="field mb-5">
          <label class="checkbox personal-lock-form__checkbox">
            <input v-model="remember" type="checkbox" :disabled="submitting" />
            <span class="ml-2">{{ t('auth.rememberDevice') }}</span>
          </label>
        </div>

        <div v-if="error" class="notification is-danger is-light personal-lock-form__error mb-4">
          {{ error }}
        </div>

        <Button type="submit" class="is-fullwidth is-justify-content-center" :disabled="submitting">
          <LoadingIcon v-if="submitting" class="mr-3" :size="18" />
          <UnlockIcon v-else class="mr-3" :size="18" />
          {{ submitting ? t('auth.unlocking') : t('auth.unlock') }}
        </Button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { KeyRoundIcon, LockKeyholeIcon, UnlockIcon } from 'lucide-vue-next';
import { ref } from 'vue';

import Button from '~/components/ui/Button.vue';
import LoadingIcon from '~/components/ui/LoadingIcon.vue';

const { t } = useI18n();
const { fetch: fetchUserSession } = useUserSession();

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
    await $fetch('/auth/unlock', {
      method: 'POST',
      body: {
        password: normalizedPassword,
        remember: remember.value,
      },
    });

    await fetchUserSession();
    await navigateTo('/dashboard');
  } catch (err: any) {
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
  background: rgba(79, 70, 229, 0.1); /* Primary color with opacity */
  color: #4f46e5;
}

.personal-lock-form__label {
  font-size: 0.9rem;
  margin-bottom: 0.55rem;
}

.personal-lock-form__input-icon {
  color: #6b7280;
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
