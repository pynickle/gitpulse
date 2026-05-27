<template>
  <div class="card dashboard-list-card dashboard-list-card--activity dashboard-list-card--detailed">
    <div class="card-content p-3">
      <div class="dashboard-list-card__main-row">
        <div class="dashboard-list-card__icon ml-2 mt-1">
          <component :size="24" :is="stateIcon" :style="stateColor" />
        </div>
        <div class="dashboard-list-card__content">
          <div class="dashboard-list-card__text-stack">
            <p class="title is-6 mb-1 dashboard-list-card__title">{{ issue.title }}</p>

            <p class="subtitle is-7 has-text-grey mb-2 dashboard-list-card__meta">
              <span class="dashboard-list-card__repo">{{ getRepoName(issue.repository_url) }}</span>
              <span class="tag is-small dashboard-list-card__number">#{{ issue.number }}</span>
              <span class="dashboard-list-card__separator">&middot;</span>
              <span>{{ formatDurationFromNow(issue.updated_at, localeCode) }}</span>
            </p>
          </div>

          <!-- Type and Labels -->
          <div v-if="hasTags" class="dashboard-list-card__tags-container">
            <div class="is-flex dashboard-list-card__tags">
              <span v-if="issue.type?.name" class="tag has-text-weight-medium" :style="typeStyle">
                {{ issue.type.name }}
              </span>

              <span
                v-for="label in issue.labels"
                :key="label.id"
                class="tag has-text-weight-medium"
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

const { locale } = useI18n();
const localeCode = computed(() => locale.value);

const hasTags = computed(() => {
  return Boolean(props.issue.type?.name || props.issue.labels?.length);
});

const typeStyle = computed(() => {
  if (!props.issue.type?.name) return null;
  const bg = getTypeColor(props.issue.type.name);
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

const displayState = computed(() => {
  if (props.issue.merged_at) return 'merged';
  return props.issue.state || 'closed';
});

const stateIcon = computed(() => {
  return props.issue.pull_request
    ? displayState.value === 'open'
      ? GitPullRequestIcon
      : displayState.value === 'merged'
        ? GitMergeIcon
        : GitPullRequestClosedIcon
    : props.issue.state === 'open'
      ? CircleDotIcon
      : CircleMinusIcon;
});

const stateColor = computed(() => {
  return {
    color: props.issue.state === 'open' ? '#1a7f37' : '#000000',
  };
});
</script>

<style scoped lang="scss" src="~/assets/scss/card.scss" />
