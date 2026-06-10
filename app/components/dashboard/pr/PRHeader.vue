<template>
  <div class="mb-6">
    <!-- Title row -->
    <div class="is-flex is-align-items-center mb-3">
      <component :size="22" :is="stateIcon" :style="stateColor" />
      <h1 class="title is-3 ml-3 mb-0">{{ pullRequest?.title }}</h1>
    </div>

    <!-- Meta row -->
    <div class="header-meta is-flex is-align-items-center is-flex-wrap-wrap mb-4">
      <span class="header-badge" :style="typeStyle">Pull Request</span>
      <span class="header-number has-text-weight-medium">#{{ pullRequest?.number }}</span>
      <span
        class="header-state-tag"
        :class="
          displayState === 'open'
            ? 'is-open'
            : displayState === 'merged'
              ? 'is-merged'
              : 'is-closed'
        "
      >
        <component :size="12" :is="stateIcon" />
        <span>{{ displayState }}</span>
      </span>
      <span class="header-time is-flex is-align-items-center">
        <ClockIcon :size="13" />
        <span>{{ updatedAtLabel }}</span>
      </span>
    </div>

    <!-- Repo + Branch row -->
    <div class="header-repo is-flex is-align-items-center is-flex-wrap-wrap mb-4">
      <span class="header-repo__name is-flex is-align-items-center">
        <GitForkIcon :size="14" />
        <a class="header-repo__link has-text-weight-medium" @click.prevent="handleRepoClick">
          {{ repoOwner }}/{{ repoName }}
        </a>
      </span>
      <template v-if="pullRequest?.head?.ref && pullRequest?.base?.ref">
        <span class="header-branch is-flex is-align-items-center">
          <span class="header-branch__ref">{{ pullRequest?.head?.ref }}</span>
          <ArrowRightIcon :size="14" class="header-branch__arrow" />
          <span class="header-branch__ref">{{ pullRequest?.base?.ref }}</span>
        </span>
      </template>
    </div>

    <hr class="mr-4" />

    <!-- Author row -->
    <div>
      <div class="is-flex is-align-items-center mb-4">
        <GitHubAvatar
          variant="raised"
          interactive
          class="mr-3"
          width="28"
          height="28"
          :src="pullRequest?.user?.avatar_url ?? ''"
          :alt="pullRequest?.user?.login"
        />
        <div class="is-flex is-align-items-center is-flex-wrap-wrap header-author">
          <a
            :href="`https://github.com/${pullRequest?.user?.login}`"
            target="_blank"
            rel="noopener"
            class="header-author__name has-text-weight-medium has-text-link"
          >
            {{ pullRequest?.user?.login }}
          </a>
          <span class="header-author__time">
            {{ createdAtLabel }}
          </span>
        </div>
      </div>
      <div class="content">
        <MarkdownRenderer
          v-if="pullRequest?.body"
          :value="pullRequest.body"
          :repo-owner="repoOwner"
          :repo-name="repoName"
        />
        <p v-else>{{ t('prReview.noDescription') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ArrowRightIcon,
  ClockIcon,
  GitForkIcon,
  GitMergeIcon,
  GitPullRequestClosedIcon,
  GitPullRequestIcon,
} from 'lucide-vue-next';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { formatDurationFromNow } from '#imports';
import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';
import MarkdownRenderer from '~/components/ui/MarkdownRenderer.vue';

const { locale, t } = useI18n();
const { navigateToRepo } = useNavigationHistory();
const router = useRouter();
const localePath = useLocalePath();
const route = useRoute();
const localeCode = computed(() => locale.value);
const relativeTimeNow = useRelativeTimeNow();

interface PullRequestHeaderPullRequest {
  title?: string;
  number?: number | string;
  state?: string;
  merged_at?: string | null;
  updated_at?: string;
  head?: { ref?: string };
  base?: { ref?: string };
  user?: {
    avatar_url?: string;
    login?: string;
  };
  created_at?: string;
  body?: string;
}

const props = defineProps<{
  pullRequest?: PullRequestHeaderPullRequest | null;
  repoOwner: string;
  repoName: string;
}>();

const displayState = computed(() => {
  if (props.pullRequest?.merged_at) return 'merged';
  return props.pullRequest?.state || 'closed';
});

const updatedAtLabel = computed(() => {
  return props.pullRequest?.updated_at
    ? formatDurationFromNow(props.pullRequest.updated_at, localeCode.value, relativeTimeNow.value)
    : '-';
});

const createdAtLabel = computed(() => {
  return props.pullRequest?.created_at
    ? formatDurationFromNow(props.pullRequest.created_at, localeCode.value, relativeTimeNow.value)
    : '-';
});

const stateIcon = computed(() => {
  if (displayState.value === 'open') {
    return GitPullRequestIcon;
  } else if (displayState.value === 'merged') {
    return GitMergeIcon;
  } else {
    return GitPullRequestClosedIcon;
  }
});

const stateColor = computed(() => {
  if (displayState.value === 'open') {
    return { color: 'var(--gitpulse-success)' };
  } else if (displayState.value === 'merged') {
    return { color: 'var(--gitpulse-info)' };
  } else {
    return { color: 'var(--gitpulse-text-strong)' };
  }
});

const typeStyle = {
  backgroundColor: 'var(--gitpulse-surface-muted)',
  color: 'var(--gitpulse-text-strong)',
};

const handleRepoClick = async () => {
  if (props.repoOwner && props.repoName) {
    const currentTab = route.query.tab as string;
    navigateToRepo(props.repoOwner, props.repoName, currentTab);

    await router.push({
      path: localePath('/dashboard'),
      query: {
        tab: currentTab,
        repo: `${props.repoOwner}/${props.repoName}`,
      },
    });
  }
};
</script>

<style scoped lang="scss">
.header-meta {
  gap: 0.5rem;
}

.header-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.55rem;
  border-radius: var(--gitpulse-radius-sm);
  font-size: 0.75rem;
  font-weight: 500;
  background-color: var(--gitpulse-surface-muted);
  color: var(--gitpulse-text);
  border: 1px solid var(--gitpulse-border);
}

.header-number {
  font-size: 0.85rem;
  color: var(--gitpulse-text-muted);
}

.header-state-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: capitalize;

  &.is-open {
    background-color: var(--gitpulse-success-soft);
    color: var(--gitpulse-success-solid);
    border: 1px solid color-mix(in srgb, var(--gitpulse-success) 24%, transparent);
  }

  &.is-merged {
    background-color: var(--gitpulse-info-soft);
    color: var(--gitpulse-info-solid);
    border: 1px solid color-mix(in srgb, var(--gitpulse-info) 24%, transparent);
  }

  &.is-closed {
    background-color: var(--gitpulse-danger-soft);
    color: var(--gitpulse-danger-solid);
    border: 1px solid color-mix(in srgb, var(--gitpulse-danger) 24%, transparent);
  }
}

.header-time {
  gap: 0.3rem;
  font-size: 0.8rem;
  color: var(--gitpulse-text-muted);
}

.header-repo {
  gap: 0.4rem;
  font-size: 0.875rem;
  color: var(--gitpulse-text-muted);
}

.header-repo__name {
  gap: 0.4rem;
}

.header-repo__link {
  color: var(--gitpulse-text-muted);
  text-decoration: none;
  cursor: pointer;
  transition: color 0.16s ease;

  &:hover {
    color: var(--gitpulse-accent-hover);
    text-decoration: underline;
  }
}

.header-branch {
  gap: 0.25rem;
  margin-left: 0.75rem;
}

.header-branch__arrow {
  color: var(--gitpulse-text-subtle);
}

.header-branch__ref {
  font-size: 0.75rem;
  font-weight: 500;
  padding: 0.1rem 0.4rem;
  border-radius: var(--gitpulse-radius-sm);
  background-color: var(--gitpulse-info-soft);
  color: var(--gitpulse-info);
}

.header-author {
  gap: 0.6rem;
}

.header-author__name {
  font-size: 0.875rem;
  transition: color 0.16s ease;

  &:hover {
    color: var(--gitpulse-accent-hover);
  }
}

.header-author__time {
  font-size: 0.8rem;
  color: var(--gitpulse-text-muted);
}
</style>
