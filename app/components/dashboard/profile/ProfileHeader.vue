<script setup lang="ts">
import {
  BuildingIcon,
  CalendarIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  LinkIcon,
  MailIcon,
  MapPinIcon,
  StarIcon,
  UsersIcon,
} from '@lucide/vue';
import { computed } from 'vue';
import { GitHubIcon } from 'vue3-simple-icons';

import type { UserOrganizationSummary, UserProfilePayload } from '#shared/types/users';
import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';

type ProfileConnectionTab = 'followers' | 'following';

const props = withDefaults(
  defineProps<{
    profile: UserProfilePayload;
    organizations?: UserOrganizationSummary[];
  }>(),
  {
    organizations: () => [],
  }
);

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

const starredTo = computed(() => ({
  path: '/dashboard/starred',
  query: { user: props.profile.login },
}));
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
      <p v-if="profile.bio" class="profile-header__bio">{{ profile.bio }}</p>
    </div>

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

    <NuxtLinkLocale class="profile-header__starred" :to="starredTo">
      <span class="profile-header__starred-icon" aria-hidden="true">
        <StarIcon :size="15" />
      </span>
      <span class="profile-header__starred-label">{{ t('starred.openStarred') }}</span>
      <ChevronRightIcon :size="16" aria-hidden="true" class="profile-header__starred-chevron" />
    </NuxtLinkLocale>

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

    <section v-if="organizations.length" class="profile-header__orgs">
      <h2 class="profile-header__orgs-title">{{ t('profile.organizations') }}</h2>
      <ul class="profile-header__orgs-list">
        <li v-for="org in organizations" :key="org.login">
          <a
            :href="org.htmlUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="profile-header__org"
            :title="org.description ? `${org.login} — ${org.description}` : org.login"
            :aria-label="org.login"
          >
            <GitHubAvatar :src="org.avatarUrl" :alt="org.login" size="32" />
          </a>
        </li>
      </ul>
    </section>

    <!-- External source escape hatch: after all profile content, not inside it. -->
    <a
      v-if="profile.htmlUrl"
      :href="profile.htmlUrl"
      target="_blank"
      rel="noopener noreferrer"
      class="profile-header__github"
    >
      <GitHubIcon :size="14" aria-hidden="true" />
      <span>{{ t('profile.viewOnGitHub') }}</span>
      <ExternalLinkIcon :size="12" aria-hidden="true" />
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
  gap: 0.35rem;
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

.profile-header__starred {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid color-mix(in srgb, var(--gitpulse-accent) 28%, var(--gitpulse-border));
  border-radius: var(--gitpulse-radius-md);
  background: color-mix(in srgb, var(--gitpulse-accent-soft) 55%, var(--gitpulse-surface));
  color: var(--gitpulse-text-strong);
  text-decoration: none;
  transition:
    background 0.12s ease,
    border-color 0.12s ease,
    box-shadow 0.12s ease;

  &:hover {
    background: color-mix(in srgb, var(--gitpulse-accent-soft) 78%, var(--gitpulse-surface));
    border-color: color-mix(in srgb, var(--gitpulse-accent) 48%, var(--gitpulse-border));
  }

  &:hover .profile-header__starred-chevron {
    transform: translateX(2px);
    color: var(--gitpulse-accent);
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring);
    outline-offset: 2px;
  }
}

.profile-header__starred-icon {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: var(--gitpulse-radius-sm);
  background: color-mix(in srgb, var(--gitpulse-accent) 14%, transparent);
  color: var(--gitpulse-accent);
}

.profile-header__starred-label {
  flex: 1;
  min-width: 0;
  font-size: 0.85rem;
  font-weight: 600;
  line-height: 1.3;
  text-align: start;
}

.profile-header__starred-chevron {
  flex-shrink: 0;
  color: var(--gitpulse-text-muted);
  transition:
    transform 0.12s ease,
    color 0.12s ease;
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

.profile-header__orgs {
  margin-top: 0.25rem;
  padding-top: 0.85rem;
  border-top: 1px solid var(--gitpulse-border);
}

.profile-header__orgs-title {
  margin: 0 0 0.6rem;
  color: var(--gitpulse-text-strong);
  font-size: 0.95rem;
  font-weight: 600;
}

.profile-header__orgs-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.profile-header__org {
  display: inline-flex;
  border-radius: 6px;

  // GitHub renders organization avatars as rounded squares, not circles
  :deep(.github-avatar) {
    border-radius: 6px;
  }

  &:hover :deep(.github-avatar),
  &:focus-visible :deep(.github-avatar) {
    box-shadow: 0 0 0 2px var(--gitpulse-accent);
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring);
    outline-offset: 2px;
  }
}

// Footer escape hatch — outside identity/meta, clearly "leave the app".
.profile-header__github {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.15rem;
  padding-top: 0.85rem;
  border-top: 1px solid var(--gitpulse-border);
  width: fit-content;
  color: var(--gitpulse-text-muted);
  font-size: 0.8rem;
  font-weight: 500;
  line-height: 1.3;
  text-decoration: none;
  transition: color 0.12s ease;

  &:hover {
    color: var(--gitpulse-accent);
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring);
    outline-offset: 2px;
    border-radius: var(--gitpulse-radius-sm);
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

  .profile-header__identity {
    align-items: center;
  }

  .profile-header__starred {
    width: 100%;
    max-width: 20rem;
  }

  .profile-header__starred-label {
    text-align: center;
  }

  .profile-header__meta {
    align-items: center;
  }

  .profile-header__orgs-list {
    justify-content: center;
  }
}
</style>
