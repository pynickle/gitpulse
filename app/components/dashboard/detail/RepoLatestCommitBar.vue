<script setup lang="ts">
import {
  ChevronRightIcon,
  ExternalLinkIcon,
  GitCommitHorizontalIcon,
  Loader2Icon,
} from '@lucide/vue';
import { computed } from 'vue';

import type { RepoLatestCommitPayload } from '#shared/types/repos';
import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';
import formatDurationFromNow from '~/utils/formatDurationFromNow';

const props = defineProps<{
  commit: RepoLatestCommitPayload | null;
  loading: boolean;
  error: string | null;
  /** Route "All commits" to the in-app Commits panel instead of github.com. */
  allCommitsInApp?: boolean;
}>();

const emit = defineEmits<{
  retry: [];
  'view-all-commits': [];
}>();

const { locale, t } = useI18n();
const localeCode = computed(() => locale.value);
const relativeTimeNow = useRelativeTimeNow();

const authorLabel = computed(() => {
  const author = props.commit?.author;
  if (!author) return '';
  return author.login || author.name || t('repoDetail.unknownAuthor');
});

const relativeTime = computed(() => {
  const at = props.commit?.committedAt;
  if (!at) return '';
  return formatDurationFromNow(at, localeCode.value, relativeTimeNow.value);
});

const authorProfileUrl = computed(() => {
  const login = props.commit?.author?.login;
  return login ? `https://github.com/${login}` : null;
});
</script>

<template>
  <div class="repo-latest-commit-bar" aria-live="polite">
    <template v-if="loading && !commit">
      <div class="repo-latest-commit-bar__skeleton" aria-hidden="true">
        <span class="repo-latest-commit-bar__skeleton-avatar" />
        <span
          class="repo-latest-commit-bar__skeleton-line repo-latest-commit-bar__skeleton-line--wide"
        />
        <span
          class="repo-latest-commit-bar__skeleton-line repo-latest-commit-bar__skeleton-line--narrow"
        />
      </div>
      <span class="is-sr-only">{{ t('repoDetail.loadingCommit') }}</span>
    </template>

    <template v-else-if="error && !commit">
      <div class="repo-latest-commit-bar__error">
        <span>{{ error }}</span>
        <button type="button" class="repo-latest-commit-bar__retry" @click="emit('retry')">
          {{ t('repoDetail.retry') }}
        </button>
      </div>
    </template>

    <template v-else-if="!commit">
      <div class="repo-latest-commit-bar__empty">
        <GitCommitHorizontalIcon :size="14" aria-hidden="true" />
        <span>{{ t('repoDetail.noCommits') }}</span>
      </div>
    </template>

    <template v-else>
      <div class="repo-latest-commit-bar__main">
        <GitHubAvatar
          class="repo-latest-commit-bar__avatar"
          variant="raised"
          :interactive="Boolean(authorProfileUrl)"
          :src="commit.author.avatarUrl"
          :alt="authorLabel"
          :size="20"
        />

        <div class="repo-latest-commit-bar__body">
          <a
            v-if="authorProfileUrl"
            :href="authorProfileUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="repo-latest-commit-bar__author"
          >
            {{ authorLabel }}
          </a>
          <span v-else class="repo-latest-commit-bar__author repo-latest-commit-bar__author--plain">
            {{ authorLabel }}
          </span>

          <a
            v-if="commit.htmlUrl"
            :href="commit.htmlUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="repo-latest-commit-bar__message"
            :title="commit.message || commit.shortSha"
          >
            {{ commit.message || commit.shortSha }}
          </a>
          <span
            v-else
            class="repo-latest-commit-bar__message repo-latest-commit-bar__message--plain"
            :title="commit.message || commit.shortSha"
          >
            {{ commit.message || commit.shortSha }}
          </span>

          <span v-if="relativeTime" class="repo-latest-commit-bar__time">{{ relativeTime }}</span>
        </div>
      </div>

      <button
        v-if="allCommitsInApp"
        type="button"
        class="repo-latest-commit-bar__all"
        @click="emit('view-all-commits')"
      >
        <span>{{ t('repoDetail.allCommits') }}</span>
        <ChevronRightIcon :size="12" aria-hidden="true" />
      </button>
      <a
        v-else
        :href="commit.commitsUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="repo-latest-commit-bar__all"
      >
        <span>{{ t('repoDetail.allCommits') }}</span>
        <ExternalLinkIcon :size="12" aria-hidden="true" />
      </a>

      <Loader2Icon
        v-if="loading"
        :size="14"
        class="repo-latest-commit-bar__refresh spin-animation"
        aria-hidden="true"
      />
    </template>
  </div>
</template>

<style scoped lang="scss">
.repo-latest-commit-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem 0.75rem;
  box-sizing: border-box;
  /* Fill the fixed parent subtoolbar slot; fall back if rendered alone. */
  height: 100%;
  min-height: 2.125rem;
  min-width: 0;
  padding: 0;
  width: 100%;
}

.repo-latest-commit-bar__main {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  height: 100%;
  flex: 1 1 auto;
}

.repo-latest-commit-bar__avatar {
  flex-shrink: 0;
}

.repo-latest-commit-bar__body {
  display: flex;
  align-items: center;
  gap: 0.35rem 0.5rem;
  min-width: 0;
  height: 100%;
  flex: 1 1 auto;
  flex-wrap: nowrap;
  overflow: hidden;
}

.repo-latest-commit-bar__author {
  flex-shrink: 0;
  max-width: 8rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  font-size: 0.8125rem;
  font-weight: 600;
  text-decoration: none;

  &:hover {
    color: var(--gitpulse-link);
  }

  &--plain {
    color: var(--gitpulse-text);
  }
}

.repo-latest-commit-bar__message {
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--gitpulse-text);
  font-size: 0.8125rem;
  text-decoration: none;

  &:hover {
    color: var(--gitpulse-link);
  }

  &--plain {
    color: var(--gitpulse-text-muted);
  }
}

.repo-latest-commit-bar__time {
  flex-shrink: 0;
  color: var(--gitpulse-text-muted);
  font-size: 0.75rem;
  white-space: nowrap;
}

.repo-latest-commit-bar__all {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
  height: 1.75rem;
  margin-left: auto;
  padding: 0 0.5rem;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--gitpulse-text-muted);
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  transition:
    color 0.12s ease,
    background 0.12s ease;

  &:hover {
    color: var(--gitpulse-link);
    background: var(--gitpulse-surface-hover);
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring, var(--gitpulse-link));
    outline-offset: 1px;
  }
}

.repo-latest-commit-bar__refresh {
  flex-shrink: 0;
  color: var(--gitpulse-text-muted);
}

.repo-latest-commit-bar__empty,
.repo-latest-commit-bar__error {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
  height: 100%;
  color: var(--gitpulse-text-muted);
  font-size: 0.8125rem;
  line-height: 1;
}

.repo-latest-commit-bar__retry {
  border: none;
  background: transparent;
  color: var(--gitpulse-link);
  font: inherit;
  font-weight: 500;
  cursor: pointer;
  padding: 0.1rem 0.25rem;
  border-radius: 4px;

  &:hover {
    text-decoration: underline;
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring, var(--gitpulse-link));
    outline-offset: 1px;
  }
}

.repo-latest-commit-bar__skeleton {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  height: 100%;
  min-width: 0;
}

.repo-latest-commit-bar__skeleton-avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--gitpulse-surface-hover);
}

.repo-latest-commit-bar__skeleton-line {
  display: block;
  height: 0.65rem;
  border-radius: 4px;
  background: var(--gitpulse-surface-hover);

  &--wide {
    flex: 1 1 auto;
    max-width: 16rem;
  }

  &--narrow {
    width: 4rem;
    flex-shrink: 0;
    margin-left: auto;
  }
}

.is-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
