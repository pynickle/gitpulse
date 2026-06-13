<template>
  <div class="mb-6">
    <!-- Title row -->
    <div class="is-flex is-align-items-center mb-3">
      <component :size="22" :is="stateIcon" :style="stateColor" />
      <h1 class="title is-3 ml-3 mb-0">{{ issue?.title }}</h1>
    </div>

    <!-- Meta row -->
    <div class="header-meta is-flex is-align-items-center is-flex-wrap-wrap mb-4">
      <span v-if="issue?.type?.name" class="header-badge" :style="typeStyle">
        {{ issue.type.name }}
      </span>
      <span class="header-number has-text-weight-medium">#{{ issue?.number }}</span>
      <span class="header-state-tag" :class="issue?.state === 'open' ? 'is-open' : 'is-closed'">
        <component :size="12" :is="issue?.state === 'open' ? CircleDotIcon : CircleMinusIcon" />
        <span>{{ issue?.state }}</span>
      </span>
      <span class="header-time is-flex is-align-items-center">
        <ClockIcon :size="13" />
        <span>{{ formatDurationFromNow(issue?.updated_at, localeCode, relativeTimeNow) }}</span>
      </span>
    </div>

    <!-- Repo row -->
    <div class="header-repo is-flex is-align-items-center mb-4">
      <GitForkIcon :size="14" />
      <a class="header-repo__link has-text-weight-medium" @click.prevent="handleRepoClick">
        {{ repoOwner }}/{{ repoName }}
      </a>
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
          :src="issue?.user?.avatar_url"
          :alt="issue?.user?.login"
        />
        <div class="is-flex is-align-items-center is-flex-wrap-wrap header-author">
          <a
            :href="`https://github.com/${issue?.user?.login}`"
            target="_blank"
            rel="noopener"
            class="header-author__name has-text-weight-medium has-text-link"
          >
            {{ issue?.user?.login }}
          </a>
          <span class="header-author__time">
            {{ formatDurationFromNow(issue?.created_at, localeCode, relativeTimeNow) }}
          </span>
        </div>
      </div>
      <div class="content">
        <MarkdownRenderer
          v-if="issue?.body"
          :value="issue.body"
          :repo-owner="repoOwner"
          :repo-name="repoName"
        />
        <p v-else>{{ t('issueDetail.noDescription') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CircleDotIcon, CircleMinusIcon, ClockIcon, GitForkIcon } from 'lucide-vue-next';
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

interface IssueHeaderIssue {
  title?: string;
  type?: { name?: string };
  number?: number | string;
  state?: string;
  updated_at?: string;
  user?: {
    avatar_url?: string | null;
    login?: string;
  } | null;
  created_at?: string;
  body?: string | null;
}

const props = defineProps<{
  issue?: IssueHeaderIssue | null;
  repoOwner: string;
  repoName: string;
}>();

const stateIcon = computed(() => {
  return props.issue?.state === 'open' ? CircleDotIcon : CircleMinusIcon;
});

const stateColor = computed(() => {
  return {
    color:
      props.issue?.state === 'open' ? 'var(--gitpulse-success)' : 'var(--gitpulse-text-strong)',
  };
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
  gap: 0.75rem;
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
  font-size: 0.75rem;
  font-weight: 500;
  padding: 0.15rem 0.5rem;
  border-radius: var(--gitpulse-radius-sm);
  color: var(--gitpulse-text-muted);
  background-color: var(--gitpulse-surface-muted);
  border: 1px solid var(--gitpulse-border);
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
