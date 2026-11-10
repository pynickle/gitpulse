<script setup lang="ts">
import { computed } from 'vue';

import type { RepoCommitListItemPayload } from '#shared/types/repos';
import CheckStatusChip from '~/components/dashboard/pr/CheckStatusChip.vue';
import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';
import { formatDurationFromNow } from '~/utils/formatDurationFromNow';

const { commit } = defineProps<{
  commit: RepoCommitListItemPayload;
}>();

const { locale, t, te } = useI18n();
const localeCode = computed(() => locale.value);
const relativeTimeNow = useRelativeTimeNow();
const { open: openCheckList } = useCheckListModal();

const mark = computed(() => commitVerificationMark(commit.verification));

const authorLabel = computed(
  () => commit.author.login || commit.author.name || t('repoDetail.unknownAuthor')
);

const authorProfileUrl = computed(() =>
  commit.author.login ? `https://github.com/${commit.author.login}` : undefined
);

const relativeTime = computed(() => {
  if (!commit.committedAt) return '';
  return formatDurationFromNow(commit.committedAt, localeCode.value, relativeTimeNow.value);
});

const verifiedAtLabel = (iso: string) => {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return iso;
  return new Intl.DateTimeFormat(localeCode.value, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
};

const verificationLabel = computed(() => {
  if (mark.value === 'verified') return t('commitVerification.verified');
  if (mark.value === 'unverified') return t('commitVerification.unverified');
  return '';
});

const verificationTitle = computed(() => {
  const verification = commit.verification;
  if (!mark.value || !verification) return '';

  if (mark.value === 'verified') {
    if (!verification.verifiedAt) return t('commitVerification.verified');
    return t('commitVerification.verifiedAt', {
      time: verifiedAtLabel(verification.verifiedAt),
    });
  }

  const reasonKey = `commitVerification.reasons.${verification.reason}`;
  return te(reasonKey) ? t(reasonKey) : t('commitVerification.unverified');
});
</script>

<template>
  <div class="commit-list-row">
    <GitHubAvatar
      class="commit-list-row__avatar"
      variant="raised"
      :interactive="Boolean(authorProfileUrl)"
      :src="commit.author.avatarUrl"
      :alt="authorLabel"
      :size="24"
    />

    <div class="commit-list-row__body">
      <a
        v-if="commit.htmlUrl"
        :href="commit.htmlUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="commit-list-row__message"
        :title="commit.message || commit.shortSha"
      >
        {{ commit.message || commit.shortSha }}
      </a>
      <span
        v-else
        class="commit-list-row__message commit-list-row__message--plain"
        :title="commit.message || commit.shortSha"
      >
        {{ commit.message || commit.shortSha }}
      </span>

      <div class="commit-list-row__meta">
        <a
          v-if="authorProfileUrl"
          :href="authorProfileUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="commit-list-row__author"
        >
          {{ authorLabel }}
        </a>
        <span v-else class="commit-list-row__author commit-list-row__author--plain">
          {{ authorLabel }}
        </span>
        <span v-if="relativeTime" class="commit-list-row__time">
          {{ relativeTime }}
        </span>
        <CheckStatusChip :rollup="commit.checkRollup" @open="openCheckList" />
      </div>
    </div>

    <div class="commit-list-row__trailing">
      <span
        v-if="mark"
        class="commit-list-row__verification"
        :class="`commit-list-row__verification--${mark}`"
        :title="verificationTitle"
      >
        {{ verificationLabel }}
      </span>
      <a
        v-if="commit.htmlUrl"
        :href="commit.htmlUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="commit-list-row__sha"
      >
        {{ commit.shortSha }}
      </a>
      <span v-else class="commit-list-row__sha commit-list-row__sha--plain">
        {{ commit.shortSha }}
      </span>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '~/assets/scss/pointer' as *;

.commit-list-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  min-width: 0;
  padding: 0.6rem 0.85rem;

  @include hover-only {
    &:hover {
      background: var(--gitpulse-surface-hover);
    }
  }
}

.commit-list-row__avatar {
  flex-shrink: 0;
}

.commit-list-row__body {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
  flex: 1 1 auto;
}

.commit-list-row__message {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;

  @include hover-only {
    &:hover {
      color: var(--gitpulse-link);
    }
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

.commit-list-row__meta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
  color: var(--gitpulse-text-muted);
  font-size: 0.75rem;
}

.commit-list-row__author {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 12rem;
  color: var(--gitpulse-text);
  font-weight: 600;
  text-decoration: none;

  @include hover-only {
    &:hover {
      color: var(--gitpulse-link);
    }
  }

  &--plain {
    color: var(--gitpulse-text-muted);
  }
}

.commit-list-row__time {
  flex-shrink: 0;
  white-space: nowrap;
}

.commit-list-row__trailing {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  flex-shrink: 0;
}

.commit-list-row__verification {
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;

  &--verified {
    color: var(--gitpulse-success, #1a7f37);
  }

  &--unverified {
    color: var(--gitpulse-danger, #cf222e);
  }
}

.commit-list-row__sha {
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

  @include hover-only {
    &:hover {
      color: var(--gitpulse-link);
      border-color: var(--gitpulse-link);
    }
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring, var(--gitpulse-link));
    outline-offset: 1px;
  }

  @include hover-only {
    &--plain:hover {
      color: var(--gitpulse-text-muted);
      border-color: var(--gitpulse-border);
    }
  }
}

@media (max-width: 1024px) {
  .commit-list-row__message {
    display: -webkit-box;
    white-space: normal;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }

  .commit-list-row__meta {
    flex-wrap: wrap;
  }

  .commit-list-row__author {
    max-width: 8rem;
  }
}
</style>
