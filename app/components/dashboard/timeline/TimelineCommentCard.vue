<template>
  <div class="comment-item px-4 pt-4 pb-1">
    <div class="mb-4">
      <div class="is-flex is-align-items-center mb-2">
        <RoundImg
          class="mr-4"
          width="32"
          height="32"
          :src="item.author?.avatarUrl || ''"
          :alt="item.author?.login || ''"
        />
        <div class="is-flex is-flex-direction-column is-justify-content-center">
          <a
            :href="item.author?.url"
            target="_blank"
            rel="noopener"
            class="is-size-6 has-text-weight-medium has-text-link"
          >
            {{ item.author?.login }}
          </a>
          <slot name="meta">
            <span class="is-size-7 has-text-grey">
              {{ formatDurationFromNow(item.createdAt || '', localeCode) }}
            </span>
          </slot>
        </div>
      </div>
      <hr class="my-2" />
      <div class="content">
        <MarkdownRenderer
          v-if="item.body"
          :value="item.body"
          :repo-owner="repoOwner"
          :repo-name="repoName"
        />
        <p v-else class="has-text-grey is-size-7">{{ emptyText }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import MarkdownRenderer from '~/components/ui/MarkdownRenderer.vue';
import RoundImg from '~/components/ui/RoundImg.vue';
import type { TimelineActor } from '~/composables/usePRTimelineEvents';
import formatDurationFromNow from '~/utils/formatDurationFromNow';

interface TimelineCommentCardItem {
  author?: TimelineActor;
  createdAt?: string;
  body?: string;
}

withDefaults(
  defineProps<{
    item: TimelineCommentCardItem;
    emptyText?: string;
    repoOwner?: string;
    repoName?: string;
  }>(),
  {
    emptyText: 'No comment body',
  }
);

const { locale } = useI18n();
const localeCode = computed(() => locale.value);
</script>

<style scoped lang="scss">
.comment-item {
  border-radius: 20px;
  background-color: var(--gitpulse-surface-muted);
}
</style>
