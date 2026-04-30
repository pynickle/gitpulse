<template>
  <TimelineCommentCard
    v-if="isPlainComment"
    :item="item"
    :empty-text="t('issueDetail.noCommentBody')"
    :repo-owner="repoOwner"
    :repo-name="repoName"
  />
  <div v-else class="review-item p-4" :class="`review-item--${stateModifier}`">
    <div class="is-flex is-align-items-flex-start">
      <RoundImg
        class="mr-3 review-item__avatar"
        width="32"
        height="32"
        :src="item.author?.avatarUrl || ''"
        :alt="item.author?.login || ''"
      />
      <div class="review-item__content is-flex-grow-1">
        <div class="review-item__heading">
          <span class="review-item__badge" aria-hidden="true">
            <component :is="stateIcon" :size="14" :stroke-width="2.5" />
          </span>
          <a
            :href="item.author?.url"
            target="_blank"
            class="has-text-link has-text-weight-semibold review-item__author"
          >
            {{ item.author?.login }}
          </a>
          <span class="review-item__action">{{ stateAction }}</span>
          <span class="review-item__time has-text-grey">
            {{ formatDurationFromNow(item.createdAt || '', localeCode) }}
          </span>
        </div>
        <div v-if="item.body" class="review-item__body content">
          <MarkdownRenderer :value="item.body" :repo-owner="repoOwner" :repo-name="repoName" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Check, Clock, Slash, X } from 'lucide-vue-next';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import TimelineCommentCard from '~/components/dashboard/timeline/TimelineCommentCard.vue';
import MarkdownRenderer from '~/components/ui/MarkdownRenderer.vue';
import RoundImg from '~/components/ui/RoundImg.vue';
import type { PRTimelineItem } from '~/composables/usePRTimelineEvents';
import formatDurationFromNow from '~/utils/formatDurationFromNow';

const props = defineProps<{
  item: PRTimelineItem;
  repoOwner: string;
  repoName: string;
}>();

const { t, locale } = useI18n();
const localeCode = computed(() => locale.value);

const isPlainComment = computed(() => {
  const state = props.item.state;
  return !state || state === 'commented';
});

const stateModifier = computed(() => {
  switch (props.item.state) {
    case 'approved':
      return 'approved';
    case 'changes_requested':
      return 'changes-requested';
    case 'dismissed':
      return 'dismissed';
    case 'pending':
      return 'pending';
    default:
      return 'pending';
  }
});

const stateAction = computed(() => {
  switch (props.item.state) {
    case 'approved':
      return 'approved these changes';
    case 'changes_requested':
      return 'requested changes';
    case 'dismissed':
      return 'dismissed this review';
    case 'pending':
      return 'started a review';
    default:
      return 'reviewed';
  }
});

const stateIcon = computed(() => {
  switch (stateModifier.value) {
    case 'approved':
      return Check;
    case 'changes-requested':
      return X;
    case 'dismissed':
      return Slash;
    case 'pending':
    default:
      return Clock;
  }
});
</script>

<style scoped lang="scss">
.review-item {
  border-radius: 16px;
  background-color: #f8f9fa;
  border-left: 4px solid var(--review-accent, #d0d7de);
}

.review-item--approved {
  --review-accent: #1f883d;
  background-color: #f4fbf6;
}

.review-item--changes-requested {
  --review-accent: #cf222e;
  background-color: #fdf4f5;
}

.review-item--dismissed {
  --review-accent: #6e7781;
  background-color: #f6f7f9;
}

.review-item--pending {
  --review-accent: #9a6700;
  background-color: #fdf9ef;
}

.review-item__avatar {
  flex-shrink: 0;
}

.review-item__heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  column-gap: 0.5rem;
  row-gap: 0.25rem;
  min-height: 32px;
}

.review-item__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  flex-shrink: 0;
  color: #fff;
  background: var(--review-accent, #d0d7de);
}

.review-item__author {
  font-size: 0.95rem;
}

.review-item__action {
  color: #57606a;
  font-size: 0.9rem;
}

.review-item__time {
  font-size: 0.8rem;
}

.review-item__body {
  margin-top: 0.875rem;
  padding-top: 0.875rem;
  border-top: 1px solid rgba(15, 23, 42, 0.08);
}

.review-item__body :deep(*:last-child) {
  margin-bottom: 0;
}
</style>
