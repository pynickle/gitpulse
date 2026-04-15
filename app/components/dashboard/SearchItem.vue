<template>
  <div class="card">
    <div class="card-content p-3">
      <div class="media mb-2">
        <div class="media-left ml-2 mt-2">
          <component :size="24" :is="stateIcon" :style="stateColor" />
        </div>
        <div class="media-content">
          <div class="is-flex is-justify-content-space-between is-align-items-center">
            <p class="title is-6 mb-0">{{ issue.title }}</p>
            <span class="tag is-info is-light ml-2">#{{ issue.number }}</span>
          </div>

          <!-- Type and Labels -->
          <div class="is-flex flex-wrap mt-2">
            <span
              v-if="issue.type?.name"
              class="tag mr-2 has-text-weight-medium"
              :style="typeStyle"
            >
              {{ issue.type.name }}
            </span>

            <span
              v-for="label in issue.labels"
              :key="label.id"
              class="tag mr-2 has-text-weight-medium"
              :style="{
                backgroundColor: `#${label.color}`,
                color: `#${getTextColorFromBackground(label.color)}`,
              }"
            >
              {{ label.name }}
            </span>
          </div>
        </div>
      </div>
      <div class="ml-2">
        <span class="subtitle is-7">{{ getRepoName(issue.repository_url) }} · </span>
        <span class="has-text-info-40 subtitle is-7">{{
          formatDurationFromNow(issue.updated_at, localeCode)
        }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  CircleDotIcon,
  CircleMinusIcon,
  GitMergeIcon,
  GitPullRequestClosedIcon,
  GitPullRequestIcon,
} from 'lucide-vue-next';
import { computed } from 'vue';

import { formatDurationFromNow, getRepoName } from '#imports';
import getTextColorFromBackground from '~/utils/getTextColorFromBackground';

const props = defineProps<{
  issue: any;
}>();

const { issue } = props;
const { locale } = useI18n();
const localeCode = computed(() => locale.value);

const typeStyle = computed(() => {
  if (!issue.type?.name) return null;
  const bg = getTypeColor(issue.type.name);
  return {
    backgroundColor: `#${bg}`,
    color: `#${getTextColorFromBackground(bg)}`,
  };
});

// Type color mapping
const typeColorMap: Record<string, string> = {
  red: 'd1242f',
  green: '2ea44f',
  purple: '8250df',
  gray: '6e7781',
  blue: '0969da',
  yellow: 'bf8700',
  orange: 'bc4c00',
  pink: 'bf3989',
};

// Get type color
const getTypeColor = (typeName: string) => {
  return typeColorMap[typeName] || '6e7781';
};

const stateIcon = computed(() => {
  return issue.pull_request
    ? issue.state === 'open'
      ? GitPullRequestIcon
      : issue.state === 'merged'
        ? GitMergeIcon
        : GitPullRequestClosedIcon
    : issue.state === 'open'
      ? CircleDotIcon
      : CircleMinusIcon;
});

const stateColor = computed(() => {
  return {
    color: issue.state === 'open' ? '#1a7f37' : '#000000',
  };
});
</script>

<style scoped lang="scss" src="~/assets/scss/card.scss" />
<style scoped lang="scss"></style>
