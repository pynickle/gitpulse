<template>
  <div class="commit-item px-4 pt-3 pb-1">
    <div class="is-flex is-align-items-start mb-2">
      <RoundImg
        v-if="item.commit?.author?.user?.avatarUrl"
        class="mr-3"
        width="32"
        height="32"
        :src="item.commit.author.user.avatarUrl"
        :alt="item.commit.author.user.login"
      />
      <div v-else class="mr-3 has-background-grey-lighter commit-avatar-fallback">
        <span class="is-size-7">💻</span>
      </div>

      <div class="is-flex is-flex-direction-column is-justify-content-center is-flex-grow-1">
        <span class="is-size-6 has-text-weight-medium commit-message">
          {{ item.commit?.message?.split('\n')[0] || 'Commit' }}
        </span>

        <div class="is-flex is-align-items-center mt-1">
          <a
            v-if="item.commit?.author?.user?.login"
            :href="item.commit.author.user.url"
            target="_blank"
            rel="noopener"
            class="is-size-7 has-text-weight-medium has-text-link mr-2"
          >
            {{ item.commit.author.user.login }}
          </a>
          <span v-else class="is-size-7 has-text-grey mr-1">
            {{ item.commit?.author?.name || 'Unknown' }}
          </span>
          <span class="is-size-7 has-text-grey">
            committed {{ formatDurationFromNow(item.commit?.committedDate || '', localeCode) }}
          </span>
        </div>
      </div>

      <a
        v-if="item.commit?.oid"
        :href="
          item.commit?.commitUrl ||
          `https://github.com/${repoOwner}/${repoName}/commit/${item.commit.oid}`
        "
        target="_blank"
        rel="noopener"
        class="tag is-light is-family-monospace ml-3"
        style="font-size: 0.75rem"
      >
        {{ item.commit.oid.slice(0, 7) }}
      </a>
      <span v-else class="tag is-light is-family-monospace ml-3" style="font-size: 0.75rem">
        commit
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import RoundImg from '~/components/ui/RoundImg.vue';
import type { IssueTimelineItem } from '~/composables/useIssueTimelineEvents';
import formatDurationFromNow from '~/utils/formatDurationFromNow';

defineProps<{
  item: IssueTimelineItem;
  repoOwner: string;
  repoName: string;
}>();

const { locale } = useI18n();
const localeCode = computed(() => locale.value);
</script>

<style scoped lang="scss">
.commit-item {
  border-radius: 12px;
  background-color: var(--gitpulse-surface-muted);
  transition: background-color 0.2s ease;
}

.commit-avatar-fallback {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.commit-message {
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  line-height: 1.5;
}

.is-family-monospace {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
}
</style>
