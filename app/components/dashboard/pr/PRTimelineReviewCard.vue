<template>
  <TimelineCommentCard
    v-if="isPlainComment"
    :item="item"
    :empty-text="t('issueDetail.noCommentBody')"
    :repo-owner="repoOwner"
    :repo-name="repoName"
  />
  <div
    v-else
    class="review-item p-4"
    :class="[`review-item--${stateModifier}`, { 'review-item--has-dismissal': item.dismissal }]"
  >
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
          <span v-if="item.dismissal" class="review-item__dismissed-note">dismissed</span>
          <span class="review-item__time has-text-grey">
            {{ formatDurationFromNow(item.createdAt || '', localeCode) }}
          </span>
        </div>
        <div v-if="item.body" class="review-item__body content">
          <MarkdownRenderer :value="item.body" :repo-owner="repoOwner" :repo-name="repoName" />
        </div>
        <div v-if="item.dismissal" class="review-item__dismissal">
          <div class="review-item__dismissal-heading">
            <SlashIcon :size="14" :stroke-width="2.5" />
            <span>
              Dismissed
              <template v-if="item.dismissal.actor?.login">
                by
                <a :href="item.dismissal.actor.url" target="_blank" class="has-text-link">
                  {{ item.dismissal.actor.login }}
                </a>
              </template>
            </span>
            <span v-if="item.dismissal.createdAt" class="has-text-grey">
              {{ formatDurationFromNow(item.dismissal.createdAt, localeCode) }}
            </span>
          </div>
          <MarkdownRenderer
            v-if="item.dismissal.message"
            class="review-item__dismissal-message"
            :value="item.dismissal.message"
            :repo-owner="repoOwner"
            :repo-name="repoName"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CheckIcon, ClockIcon, SlashIcon, XIcon } from 'lucide-vue-next';
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
  return !state || (state === 'commented' && !props.item.dismissal);
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
      return CheckIcon;
    case 'changes-requested':
      return XIcon;
    case 'dismissed':
      return SlashIcon;
    case 'pending':
    default:
      return ClockIcon;
  }
});
</script>

<style scoped lang="scss">
.review-item {
  border-radius: 16px;
  background-color: var(--gitpulse-surface-muted);
  border-left: 4px solid var(--review-accent, var(--gitpulse-border-strong));
}

.review-item--approved {
  --review-accent: var(--gitpulse-success);
  background-color: var(--gitpulse-success-soft);
}

.review-item--changes-requested {
  --review-accent: var(--gitpulse-danger);
  background-color: var(--gitpulse-danger-soft);
}

.review-item--dismissed {
  --review-accent: var(--gitpulse-text-subtle);
  background-color: var(--gitpulse-surface-muted);
}

.review-item--has-dismissal {
  --review-accent: var(--gitpulse-warning);
  background-color: var(--gitpulse-warning-soft);
}

.review-item--pending {
  --review-accent: var(--gitpulse-warning);
  background-color: var(--gitpulse-warning-soft);
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
  background: var(--review-accent, var(--gitpulse-border-strong));
}

.review-item__author {
  font-size: 0.95rem;
}

.review-item__action {
  color: var(--gitpulse-text-muted);
  font-size: 0.9rem;
}

.review-item__dismissed-note {
  display: inline-flex;
  align-items: center;
  min-height: 1.35rem;
  padding: 0 0.45rem;
  border-radius: 999px;
  background-color: color-mix(in srgb, var(--gitpulse-warning) 18%, transparent);
  color: var(--gitpulse-warning);
  font-size: 0.72rem;
  font-weight: 700;
}

.review-item__time {
  font-size: 0.8rem;
}

.review-item__body {
  margin-top: 0.875rem;
  padding-top: 0.875rem;
  border-top: 1px solid var(--gitpulse-border);
}

.review-item__body :deep(*:last-child) {
  margin-bottom: 0;
}

.review-item__dismissal {
  margin-top: 0.875rem;
  padding-top: 0.875rem;
  border-top: 1px solid var(--gitpulse-border);
}

.review-item__dismissal-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  color: var(--gitpulse-text-muted);
}

.review-item__dismissal-message {
  margin-top: 0.625rem;
}

.review-item__dismissal-message :deep(*:last-child) {
  margin-bottom: 0;
}
</style>
