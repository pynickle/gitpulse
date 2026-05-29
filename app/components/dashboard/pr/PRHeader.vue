<template>
  <div class="mb-6">
    <!-- PR title and metadata -->
    <div class="is-flex is-align-items-center mb-4">
      <component :size="24" :is="stateIcon" :style="stateColor" />
      <h1 class="title is-3 ml-4">{{ pullRequest?.title }}</h1>
    </div>

    <div class="is-flex is-align-items-center my-4 is-flex-wrap-wrap">
      <span class="tag mr-2" :style="typeStyle">Pull Request</span>
      <span class="tag is-info is-light ml-2">#{{ pullRequest?.number }}</span>
      <span
        class="ml-2 tag"
        :class="
          displayState === 'open'
            ? 'is-success is-light'
            : displayState === 'merged'
              ? 'is-primary is-light'
              : 'is-danger is-light'
        "
      >
        {{ displayState }}
      </span>
      <span class="ml-4 has-text-grey has-text-weight-medium">
        {{ formatDurationFromNow(pullRequest?.updated_at, localeCode) }}
      </span>
    </div>

    <div class="mb-4">
      <span class="subtitle mb-0 is-6 has-text-weight-medium">{{ repoOwner }}/{{ repoName }}</span>
      <span v-if="pullRequest?.head?.ref && pullRequest?.base?.ref" class="ml-4">
        <span class="tag is-link is-light has-text-weight-medium">
          {{ pullRequest?.head?.ref }}
        </span>
        <span class="mx-2 has-text-grey">
          <ArrowRightIcon :size="14" />
        </span>
        <span class="tag is-link is-light has-text-weight-medium">
          {{ pullRequest?.base?.ref }}
        </span>
      </span>
    </div>

    <hr class="mr-4" />

    <!-- PR description -->
    <div>
      <div class="is-flex is-align-items-center mb-4">
        <RoundImg
          class="mr-4"
          width="32"
          height="32"
          :src="pullRequest?.user?.avatar_url"
          :alt="pullRequest?.user?.login"
        />
        <div class="is-flex is-flex-direction-column is-justify-content-center">
          <a
            :href="`https://github.com/${pullRequest?.user?.login}`"
            target="_blank"
            class="is-size-6 has-text-weight-medium has-text-link"
          >
            {{ pullRequest?.user?.login }}
          </a>
          <span class="is-size-7 has-text-grey">
            {{ formatDurationFromNow(pullRequest?.created_at, localeCode) }}
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
        <p v-else>No description provided</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ArrowRightIcon,
  GitPullRequestIcon,
  GitMergeIcon,
  GitPullRequestClosedIcon,
} from 'lucide-vue-next';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { formatDurationFromNow } from '#imports';
import MarkdownRenderer from '~/components/ui/MarkdownRenderer.vue';
import RoundImg from '~/components/ui/RoundImg.vue';

// Configure dayjs
const { locale } = useI18n();
const localeCode = computed(() => locale.value);

const props = defineProps<{
  pullRequest: any;
  repoOwner: string;
  repoName: string;
}>();

// Computed properties
const displayState = computed(() => {
  if (props.pullRequest?.merged_at) return 'merged';
  return props.pullRequest?.state || 'closed';
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
</script>
