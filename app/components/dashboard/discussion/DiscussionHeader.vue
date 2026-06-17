<template>
  <div class="mb-6">
    <!-- Title row -->
    <div class="is-flex is-align-items-center mb-3">
      <MessageSquareIcon :size="22" :style="stateColor" />
      <h1 class="title is-3 ml-3 mb-0">
        {{ discussion.title || t('discussionDetail.titleFallback') }}
      </h1>
    </div>

    <!-- Meta row -->
    <div class="header-meta is-flex is-align-items-center is-flex-wrap-wrap mb-4">
      <span class="header-number has-text-weight-medium">#{{ discussion.number }}</span>
      <span
        class="header-state-tag"
        :class="discussion.isAnswered ? 'is-answered' : 'is-unanswered'"
      >
        <component :size="12" :is="discussion.isAnswered ? CheckCircle2Icon : CircleDotIcon" />
        <span>{{ stateLabel }}</span>
      </span>
      <span v-if="discussion.locked" class="header-locked-tag">
        <LockIcon :size="12" />
        <span>{{ t('discussionDetail.locked') }}</span>
      </span>
      <span class="header-time is-flex is-align-items-center">
        <ClockIcon :size="13" />
        <span>
          {{
            formatDurationFromNow(
              discussion.updatedAt || discussion.createdAt || '',
              localeCode,
              relativeTimeNow
            )
          }}
        </span>
      </span>
    </div>

    <!-- Repo row -->
    <div class="header-repo is-flex is-align-items-center mb-4">
      <span class="header-repo__name is-flex is-align-items-center">
        <GitForkIcon :size="14" />
        <a class="header-repo__link has-text-weight-medium" @click.prevent="handleRepoClick">
          {{ repoOwner }}/{{ repoName }}
        </a>
      </span>
    </div>

    <hr class="mr-4" />
    <div data-detail-compact-threshold aria-hidden="true"></div>

    <!-- Author row -->
    <div>
      <div class="is-flex is-align-items-center mb-4">
        <GitHubAvatar
          variant="raised"
          interactive
          class="mr-3"
          width="28"
          height="28"
          :src="discussion.author?.avatarUrl || ''"
          :alt="discussion.author?.login || t('discussionDetail.authorFallback')"
        />
        <div class="is-flex is-align-items-center is-flex-wrap-wrap header-author">
          <a
            v-if="discussion.author?.url"
            :href="discussion.author.url"
            target="_blank"
            rel="noopener"
            class="header-author__name has-text-weight-medium has-text-link"
          >
            {{ discussion.author.login }}
          </a>
          <span v-else class="header-author__name has-text-weight-medium">
            {{ discussion.author?.login || t('discussionDetail.authorFallback') }}
          </span>
          <span class="header-author__time">
            {{ formatDurationFromNow(discussion.createdAt || '', localeCode, relativeTimeNow) }}
          </span>
        </div>
      </div>
      <div class="content">
        <MarkdownRenderer
          v-if="discussion.body"
          :value="discussion.body"
          :repo-owner="repoOwner"
          :repo-name="repoName"
        />
        <p v-else>{{ t('discussionDetail.noDescription') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  CheckCircle2Icon,
  CircleDotIcon,
  ClockIcon,
  GitForkIcon,
  LockIcon,
  MessageSquareIcon,
} from '@lucide/vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import type { DiscussionDetailPayload } from '#shared/types/discussions';
import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';
import MarkdownRenderer from '~/components/ui/MarkdownRenderer.vue';

const { locale, t } = useI18n();
const { navigateToRepo } = useNavigationHistory();
const router = useRouter();
const localePath = useLocalePath();
const route = useRoute();
const localeCode = computed(() => locale.value);
const relativeTimeNow = useRelativeTimeNow();

const props = defineProps<{
  discussion: DiscussionDetailPayload;
  repoOwner: string;
  repoName: string;
}>();

const stateLabel = computed(() =>
  props.discussion.isAnswered ? t('discussionDetail.answered') : t('discussionDetail.unanswered')
);

const stateColor = computed(() => ({
  color: props.discussion.isAnswered ? 'var(--gitpulse-success)' : 'var(--gitpulse-text-strong)',
}));

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

  &.is-answered {
    background-color: var(--gitpulse-success-soft);
    color: var(--gitpulse-success-solid);
    border: 1px solid color-mix(in srgb, var(--gitpulse-success) 24%, transparent);
  }

  &.is-unanswered {
    background-color: var(--gitpulse-surface-muted);
    color: var(--gitpulse-text);
    border: 1px solid var(--gitpulse-border);
  }
}

.header-locked-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  background-color: var(--gitpulse-warning-soft);
  color: var(--gitpulse-warning-solid);
  border: 1px solid color-mix(in srgb, var(--gitpulse-warning) 24%, transparent);
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
