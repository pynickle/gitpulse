<script setup lang="ts">
import { BuildingIcon, CalendarIcon, LinkIcon, MailIcon, MapPinIcon, UsersIcon } from '@lucide/vue';
import { computed } from 'vue';
import { GitHubIcon } from 'vue3-simple-icons';

import type { UserProfilePayload } from '#shared/types/users';
import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';

type ProfileConnectionTab = 'followers' | 'following';

const props = defineProps<{
  profile: UserProfilePayload;
}>();

const emit = defineEmits<{
  (e: 'show-connections', tab: ProfileConnectionTab): void;
}>();

const { t, locale } = useI18n();

const displayName = computed(() => props.profile.name?.trim() || props.profile.login);
const showSecondaryLogin = computed(() => Boolean(props.profile.name?.trim()));

const joinedLabel = computed(() => {
  if (!props.profile.createdAt) {
    return '';
  }
  const parsed = new Date(props.profile.createdAt);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  const formatted = new Intl.DateTimeFormat(locale.value, {
    year: 'numeric',
    month: 'long',
  }).format(parsed);
  return t('profile.joined', { date: formatted });
});

const blogHref = computed(() => {
  const blog = props.profile.blog?.trim();
  if (!blog) {
    return null;
  }
  return /^https?:\/\//i.test(blog) ? blog : `https://${blog}`;
});

const followerCount = computed(() => props.profile.followers);
const followingCount = computed(() => props.profile.following);
</script>

<template>
  <header class="profile-header">
    <GitHubAvatar
      :src="profile.avatarUrl"
      :alt="displayName"
      size="260"
      variant="raised"
      loading="eager"
      class="profile-header__avatar"
    />

    <div class="profile-header__identity">
      <h1 class="profile-header__name">{{ displayName }}</h1>
      <p v-if="showSecondaryLogin" class="profile-header__login">{{ profile.login }}</p>
    </div>

    <p v-if="profile.bio" class="profile-header__bio">{{ profile.bio }}</p>

    <div class="profile-header__connections">
      <button
        type="button"
        class="profile-header__connection"
        @click="emit('show-connections', 'followers')"
      >
        <UsersIcon :size="16" aria-hidden="true" />
        <span class="profile-header__connection-count">{{ followerCount }}</span>
        <span class="profile-header__connection-label">{{ t('profile.followers') }}</span>
      </button>
      <span class="profile-header__connection-separator" aria-hidden="true">·</span>
      <button
        type="button"
        class="profile-header__connection"
        @click="emit('show-connections', 'following')"
      >
        <span class="profile-header__connection-count">{{ followingCount }}</span>
        <span class="profile-header__connection-label">{{ t('profile.following') }}</span>
      </button>
    </div>

    <dl class="profile-header__meta">
      <div v-if="profile.company" class="profile-header__meta-item">
        <BuildingIcon :size="16" aria-hidden="true" />
        <dd>{{ profile.company }}</dd>
      </div>
      <div v-if="profile.location" class="profile-header__meta-item">
        <MapPinIcon :size="16" aria-hidden="true" />
        <dd>{{ profile.location }}</dd>
      </div>
      <div v-if="blogHref" class="profile-header__meta-item">
        <LinkIcon :size="16" aria-hidden="true" />
        <dd>
          <a :href="blogHref" target="_blank" rel="noopener noreferrer nofollow">
            {{ profile.blog }}
          </a>
        </dd>
      </div>
      <div v-if="profile.email" class="profile-header__meta-item">
        <MailIcon :size="16" aria-hidden="true" />
        <dd>
          <a :href="`mailto:${profile.email}`">{{ profile.email }}</a>
        </dd>
      </div>
      <div v-if="joinedLabel" class="profile-header__meta-item">
        <CalendarIcon :size="16" aria-hidden="true" />
        <dd>{{ joinedLabel }}</dd>
      </div>
    </dl>

    <a
      v-if="profile.htmlUrl"
      :href="profile.htmlUrl"
      target="_blank"
      rel="noopener noreferrer"
      class="profile-header__github-link"
    >
      <GitHubIcon :size="15" />
      <span>{{ t('profile.viewOnGitHub') }}</span>
    </a>
  </header>
</template>

<style scoped lang="scss">
.profile-header {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.profile-header__avatar {
  width: 100%;
  max-width: 260px;
  aspect-ratio: 1;
  height: auto;
}

.profile-header__identity {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.profile-header__name {
  margin: 0;
  color: var(--gitpulse-text-strong);
  font-size: 1.6rem;
  font-weight: 700;
  line-height: 1.2;
}

.profile-header__login {
  margin: 0;
  color: var(--gitpulse-text-muted);
  font-size: 1.1rem;
  font-weight: 400;
}

.profile-header__bio {
  margin: 0;
  color: var(--gitpulse-text);
  font-size: 0.95rem;
  line-height: 1.5;
}

.profile-header__connections {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.profile-header__connection {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--gitpulse-text-muted);
  font-size: 0.875rem;
  cursor: pointer;

  &:hover .profile-header__connection-count,
  &:focus-visible .profile-header__connection-count {
    color: var(--gitpulse-link);
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring);
    outline-offset: 2px;
    border-radius: 4px;
  }
}

.profile-header__connection-count {
  color: var(--gitpulse-text-strong);
  font-weight: 700;
}

.profile-header__connection-separator {
  color: var(--gitpulse-text-subtle);
}

.profile-header__meta {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0;
}

.profile-header__meta-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--gitpulse-text);
  font-size: 0.875rem;

  svg {
    flex-shrink: 0;
    color: var(--gitpulse-text-muted);
  }

  dd {
    margin: 0;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  a {
    color: var(--gitpulse-link);

    &:hover {
      text-decoration: underline;
    }
  }
}

.profile-header__github-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 0.25rem;
  padding: 0.5rem 0.9rem;
  border: 1px solid var(--gitpulse-border-strong);
  border-radius: var(--gitpulse-radius-md);
  background: var(--gitpulse-surface-muted);
  color: var(--gitpulse-text-strong);
  font-size: 0.85rem;
  font-weight: 600;
  transition:
    background 0.12s ease,
    border-color 0.12s ease;

  &:hover {
    background: var(--gitpulse-surface-hover);
    border-color: var(--gitpulse-accent);
  }
}

@media (max-width: 1023px) {
  .profile-header {
    align-items: center;
    text-align: center;
  }

  .profile-header__avatar {
    max-width: 160px;
  }

  .profile-header__meta {
    align-items: center;
  }
}
</style>
