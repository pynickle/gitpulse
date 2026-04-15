<template>
  <div class="mb-6">
    <!-- Issue title and metadata -->
    <div class="is-flex items-center mb-4">
      <component :size="24" :is="stateIcon" :style="stateColor" />
      <h1 class="title is-3 ml-4">{{ issue?.title }}</h1>
    </div>

    <div class="is-flex items-center my-4 flex-wrap">
      <span class="tag mr-2" :style="typeStyle">
        {{ issue?.type?.name || 'Issue' }}
      </span>
      <span class="tag is-info is-light ml-2">#{{ issue?.number }}</span>
      <span
        class="ml-2 tag"
        :class="issue?.state === 'open' ? 'is-success is-light' : 'is-danger is-light'"
      >
        {{ issue?.state }}
      </span>
      <span class="ml-4 has-text-grey has-text-weight-medium">
        {{ formatDurationFromNow(issue?.updated_at, localeCode) }}
      </span>
    </div>

    <div class="mb-4">
      <span class="subtitle is-6 has-text-weight-medium"> {{ repoOwner }}/{{ repoName }} </span>
    </div>

    <hr class="mr-4" />

    <!-- Issue description -->
    <div class="mb-8">
      <div class="is-flex is-align-items-center mb-4">
        <RoundImg
          class="mr-4"
          width="32"
          height="32"
          :src="issue?.user?.avatar_url"
          :alt="issue?.user?.login"
        />
        <div class="is-flex is-flex-direction-column is-justify-content-center">
          <a
            :href="`https://github.com/${issue?.user?.login}`"
            target="_blank"
            class="is-size-6 has-text-weight-medium has-text-link"
          >
            {{ issue?.user?.login }}
          </a>
          <span class="is-size-7 has-text-grey">
            {{ formatDurationFromNow(issue?.created_at, localeCode) }}
          </span>
        </div>
      </div>
      <div class="content">
        <MarkdownRenderer v-if="issue?.body" :value="issue.body" />
        <p v-else>No description provided</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CircleDotIcon, CircleMinusIcon } from 'lucide-vue-next';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { formatDurationFromNow } from '#imports';
import MarkdownRenderer from '~/components/ui/MarkdownRenderer.vue';
import RoundImg from '~/components/ui/RoundImg.vue';

// Configure dayjs
const { locale } = useI18n();
const localeCode = computed(() => locale.value);

const props = defineProps<{
  issue: any;
  repoOwner: string;
  repoName: string;
}>();

// Computed properties
const stateIcon = computed(() => {
  return props.issue?.state === 'open' ? CircleDotIcon : CircleMinusIcon;
});

const stateColor = computed(() => {
  return {
    color: props.issue?.state === 'open' ? '#1a7f37' : '#000000',
  };
});

const typeStyle = {
  backgroundColor: '#f0f0f0',
  color: '#333',
};
</script>
