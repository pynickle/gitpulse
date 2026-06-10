<template>
  <div class="mb-6">
    <div class="is-flex is-align-items-center mb-4">
      <MessageSquareIcon :size="24" :style="stateColor" />
      <h1 class="title is-3 ml-4">
        {{ discussion.title || t('discussionDetail.titleFallback') }}
      </h1>
    </div>

    <div class="is-flex is-align-items-center my-4 is-flex-wrap-wrap">
      <span class="tag mr-2" :style="typeStyle">{{ t('discussionDetail.type') }}</span>
      <span class="tag is-info is-light ml-2">#{{ discussion.number }}</span>
      <span class="ml-2 tag" :class="discussion.isAnswered ? 'is-success is-light' : 'is-light'">
        {{ stateLabel }}
      </span>
      <span v-if="discussion.locked" class="ml-2 tag is-warning is-light">
        <LockIcon :size="13" class="mr-1" />
        {{ t('discussionDetail.locked') }}
      </span>
      <span v-if="discussion.category" class="ml-2 tag is-light" :style="categoryStyle">
        {{ discussion.category.name }}
      </span>
      <span class="ml-4 has-text-grey has-text-weight-medium">
        {{
          formatDurationFromNow(
            discussion.updatedAt || discussion.createdAt || '',
            localeCode,
            relativeTimeNow
          )
        }}
      </span>
    </div>

    <div class="mb-4">
      <a
        class="header-repo__link subtitle is-6 has-text-weight-medium"
        @click.prevent="handleRepoClick"
      >
        {{ repoOwner }}/{{ repoName }}
      </a>
    </div>

    <hr class="mr-4" />

    <div>
      <div class="is-flex is-align-items-center mb-4">
        <GitHubAvatar
          variant="raised"
          interactive
          class="mr-4"
          width="32"
          height="32"
          :src="discussion.author?.avatarUrl || ''"
          :alt="discussion.author?.login || t('discussionDetail.authorFallback')"
        />
        <div class="is-flex is-flex-direction-column is-justify-content-center">
          <a
            v-if="discussion.author?.url"
            :href="discussion.author.url"
            target="_blank"
            rel="noopener"
            class="is-size-6 has-text-weight-medium has-text-link"
          >
            {{ discussion.author.login }}
          </a>
          <span v-else class="is-size-6 has-text-weight-medium">
            {{ discussion.author?.login || t('discussionDetail.authorFallback') }}
          </span>
          <span class="is-size-7 has-text-grey">
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
import { LockIcon, MessageSquareIcon } from 'lucide-vue-next';
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

const typeStyle = {
  backgroundColor: 'var(--gitpulse-surface-muted)',
  color: 'var(--gitpulse-text-strong)',
};

const categoryStyle = {
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
</style>
