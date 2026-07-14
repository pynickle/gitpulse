<script setup lang="ts">
import { AlertTriangleIcon, GitCommitHorizontalIcon, Loader2Icon } from '@lucide/vue';
import { computed } from 'vue';

import type { RepoCommitListItemPayload } from '#shared/types/repos';
import Button from '~/components/ui/Button.vue';
import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';
import formatDurationFromNow from '~/utils/formatDurationFromNow';

defineProps<{
  items: RepoCommitListItemPayload[];
  loading: boolean;
  error: string;
  emptyMessage: string;
}>();

const emit = defineEmits<{
  retry: [];
}>();

const { locale, t } = useI18n();
const localeCode = computed(() => locale.value);
const relativeTimeNow = useRelativeTimeNow();

const authorLabel = (commit: RepoCommitListItemPayload) => {
  return commit.author.login || commit.author.name || t('repoDetail.unknownAuthor');
};

const authorProfileUrl = (commit: RepoCommitListItemPayload) => {
  return commit.author.login ? `https://github.com/${commit.author.login}` : undefined;
};

const relativeTime = (commit: RepoCommitListItemPayload) => {
  if (!commit.committedAt) return '';
  return formatDurationFromNow(commit.committedAt, localeCode.value, relativeTimeNow.value);
};
</script>

<template>
  <section class="repo-commit-list" :aria-label="t('repoDetail.commits')">
    <div v-if="loading" class="repo-commit-list__loading" aria-busy="true">
      <Loader2Icon :size="20" class="spin-animation" />
      <span>{{ t('repoDetail.loadingList') }}</span>
    </div>

    <div v-else-if="error" class="repo-commit-list__error" role="alert">
      <div class="repo-commit-list__error-icon" aria-hidden="true">
        <AlertTriangleIcon :size="28" />
      </div>
      <p class="repo-commit-list__error-title">{{ t('repoDetail.listErrorTitle') }}</p>
      <p class="repo-commit-list__error-message">{{ error }}</p>
      <Button color="primary" size="normal" @click="emit('retry')">
        {{ t('repoDetail.retry') }}
      </Button>
    </div>

    <template v-else>
      <div v-if="items.length === 0" class="repo-commit-list__empty">
        <GitCommitHorizontalIcon :size="16" aria-hidden="true" />
        <span>{{ emptyMessage }}</span>
      </div>

      <ul v-else class="repo-commit-list__items">
        <li v-for="commit in items" :key="commit.sha" class="repo-commit-list__item">
          <GitHubAvatar
            class="repo-commit-list__avatar"
            variant="raised"
            :interactive="Boolean(authorProfileUrl(commit))"
            :src="commit.author.avatarUrl"
            :alt="authorLabel(commit)"
            :size="24"
          />

          <div class="repo-commit-list__body">
            <a
              v-if="commit.htmlUrl"
              :href="commit.htmlUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="repo-commit-list__message"
              :title="commit.message || commit.shortSha"
            >
              {{ commit.message || commit.shortSha }}
            </a>
            <span
              v-else
              class="repo-commit-list__message repo-commit-list__message--plain"
              :title="commit.message || commit.shortSha"
            >
              {{ commit.message || commit.shortSha }}
            </span>

            <div class="repo-commit-list__meta">
              <a
                v-if="authorProfileUrl(commit)"
                :href="authorProfileUrl(commit)"
                target="_blank"
                rel="noopener noreferrer"
                class="repo-commit-list__author"
              >
                {{ authorLabel(commit) }}
              </a>
              <span v-else class="repo-commit-list__author repo-commit-list__author--plain">
                {{ authorLabel(commit) }}
              </span>
              <span v-if="relativeTime(commit)" class="repo-commit-list__time">
                {{ relativeTime(commit) }}
              </span>
            </div>
          </div>

          <a
            v-if="commit.htmlUrl"
            :href="commit.htmlUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="repo-commit-list__sha"
          >
            {{ commit.shortSha }}
          </a>
          <span v-else class="repo-commit-list__sha repo-commit-list__sha--plain">
            {{ commit.shortSha }}
          </span>
        </li>
      </ul>
    </template>
  </section>
</template>

<style scoped lang="scss">
.repo-commit-list {
  min-height: 8rem;
  min-width: 0;
  /* Match sticky chrome horizontal inset so left/right edges line up. */
  padding: 0.5rem 0.35rem 1rem;
}

.repo-commit-list__loading,
.repo-commit-list__empty,
.repo-commit-list__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 2.5rem 1rem;
  color: var(--gitpulse-text-muted);
  font-size: 0.875rem;
  text-align: center;
}

.repo-commit-list__error-icon {
  color: var(--gitpulse-warning, #d97706);
}

.repo-commit-list__error-title {
  margin: 0;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  font-size: 0.9375rem;
  font-weight: 600;
}

.repo-commit-list__error-message {
  margin: 0 0 0.5rem;
  max-width: 28rem;
}

.repo-commit-list__items {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--gitpulse-border);
  border-radius: 10px;
  background: var(--gitpulse-surface);
  overflow: hidden;
}

.repo-commit-list__item {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  min-width: 0;
  padding: 0.6rem 0.85rem;
  transition: background-color 0.12s ease;

  & + & {
    border-top: 1px solid var(--gitpulse-border-subtle, var(--gitpulse-border));
  }

  &:hover {
    background: var(--gitpulse-surface-hover);
  }
}

.repo-commit-list__avatar {
  flex-shrink: 0;
}

.repo-commit-list__body {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
  flex: 1 1 auto;
}

.repo-commit-list__message {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;

  &:hover {
    color: var(--gitpulse-link);
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring, var(--gitpulse-link));
    outline-offset: 1px;
    border-radius: 4px;
  }

  &--plain {
    color: var(--gitpulse-text);
  }
}

.repo-commit-list__meta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
  color: var(--gitpulse-text-muted);
  font-size: 0.75rem;
}

.repo-commit-list__author {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 12rem;
  color: var(--gitpulse-text);
  font-weight: 600;
  text-decoration: none;

  &:hover {
    color: var(--gitpulse-link);
  }

  &--plain {
    color: var(--gitpulse-text-muted);
  }
}

.repo-commit-list__time {
  flex-shrink: 0;
  white-space: nowrap;
}

.repo-commit-list__sha {
  flex-shrink: 0;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 6px;
  background: var(--gitpulse-surface-muted, var(--gitpulse-surface));
  color: var(--gitpulse-text-muted);
  font-family: var(--gitpulse-code-font-family, monospace);
  font-size: 0.75rem;
  line-height: 1;
  text-decoration: none;
  white-space: nowrap;
  transition:
    color 0.12s ease,
    border-color 0.12s ease;

  &:hover {
    color: var(--gitpulse-link);
    border-color: var(--gitpulse-link);
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring, var(--gitpulse-link));
    outline-offset: 1px;
  }

  &--plain:hover {
    color: var(--gitpulse-text-muted);
    border-color: var(--gitpulse-border);
  }
}

.spin-animation {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
