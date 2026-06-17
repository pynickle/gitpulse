<template>
  <div class="auth-shell auth-shell--signed-in is-flex is-justify-content-center">
    <div class="box auth-shell__box has-text-centered">
      <div class="auth-shell__avatar mb-5">
        <GitHubAvatar
          variant="raised"
          interactive
          :src="user.avatar_url"
          :alt="user.name"
          width="108"
          height="108"
          loading="eager"
          fetch-priority="high"
        />
      </div>

      <p class="auth-shell__eyebrow mb-3">{{ t('landing.sessionReady') }}</p>
      <h2 class="title is-3 mb-2">{{ user.name }}</h2>
      <p class="subtitle is-6 has-text-grey mb-5">@{{ user.login }}</p>

      <div class="buttons is-flex is-flex-direction-column auth-shell__actions">
        <Button class="is-fullwidth is-justify-content-center" @click="handleGoToDashboard">
          <LayoutDashboardIcon class="mr-3" :size="20" />
          {{ t('landing.goToDashboard') }}
        </Button>

        <Button
          color="light"
          :lifted="false"
          class="is-fullwidth is-justify-content-center"
          @click="$emit('logout')"
        >
          <LogOutIcon class="mr-3" :size="20" />
          {{ t('landing.loggedOut') }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { LayoutDashboardIcon, LogOutIcon } from '@lucide/vue';

import Button from '~/components/ui/Button.vue';
import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';

defineEmits<{
  logout: [];
}>();

defineProps<{
  user: {
    login: string;
    name: string;
    avatar_url: string;
  };
}>();

const { t } = useI18n();
const localePath = useLocalePath();

const handleGoToDashboard = async () => {
  await navigateTo(localePath('/dashboard'));
};
</script>

<style scoped lang="scss">
@use '~/assets/scss/variables' as *;

.auth-shell__box {
  width: min(100%, 32rem);
  padding: 2.5rem 2.25rem;
  border: 1px solid var(--gitpulse-border);
  box-shadow: var(--gitpulse-shadow-raised);
}

.auth-shell__eyebrow {
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: $brand-primary;
}

.auth-shell__actions {
  gap: 0.85rem;
}
</style>
