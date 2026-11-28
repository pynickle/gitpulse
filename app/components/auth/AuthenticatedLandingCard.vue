<template>
  <div class="auth-shell auth-shell--signed-in">
    <div class="auth-shell__box">
      <div class="auth-shell__avatar">
        <GitHubAvatar
          variant="raised"
          interactive
          :src="user.avatar_url"
          :alt="user.name"
          width="108"
          height="108"
          loading="eager"
          :preload="{ fetchPriority: 'high' }"
        />
      </div>

      <p class="auth-shell__eyebrow">{{ t('landing.sessionReady') }}</p>
      <h2 class="auth-shell__title">{{ user.name }}</h2>
      <p class="auth-shell__subtitle">@{{ user.login }}</p>

      <div class="gp-btn-group auth-shell__actions">
        <Button size="large" block @click="handleGoToDashboard">
          <LayoutDashboardIcon class="auth-shell__action-icon" :size="20" />
          {{ t('landing.goToDashboard') }}
        </Button>

        <Button variant="light" size="large" block @click="$emit('logout')">
          <LogOutIcon class="auth-shell__action-icon" :size="20" />
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
const { continueToReturnTarget } = useAuthReturnNavigation();

const handleGoToDashboard = async () => {
  await continueToReturnTarget();
};
</script>

<style scoped lang="scss">
.auth-shell {
  display: flex;
  justify-content: center;
}

.auth-shell__box {
  width: min(100%, 32rem);
  padding: 2.5rem 2.25rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: var(--gitpulse-radius-xl);
  background-color: var(--gitpulse-surface);
  color: var(--gitpulse-text);
  box-shadow: var(--gitpulse-shadow-raised);
  text-align: center;
}

.auth-shell__avatar {
  margin-bottom: 1.5rem;
}

.auth-shell__eyebrow {
  margin-bottom: 0.75rem;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--gitpulse-accent);
}

.auth-shell__title {
  margin-bottom: 0.5rem;
  color: var(--gitpulse-text-strong);
  font-size: 2rem;
  font-weight: 800;
  line-height: 1.125;
}

.auth-shell__subtitle {
  margin-bottom: 1.5rem;
  color: var(--gitpulse-text-muted);
  font-size: 1rem;
  font-weight: 400;
  line-height: 1.25;
}

.auth-shell__actions {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.auth-shell__action-icon {
  margin-inline-end: 0.75rem;
}
</style>
