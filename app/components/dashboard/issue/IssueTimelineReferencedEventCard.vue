<template>
  <div class="commit-item px-4 pt-2 pb-1">
    <div class="is-flex is-align-items-center mb-2">
      <RoundImg
        v-if="item.actor?.avatarUrl"
        class="mr-3"
        width="32"
        height="32"
        :src="item.actor.avatarUrl"
        :alt="item.actor.login"
      />

      <div class="is-flex is-flex-direction-column is-justify-content-center is-flex-grow-1">
        <div class="is-flex is-align-items-center mt-1">
          <a
            :href="item.actor?.url"
            target="_blank"
            class="is-size-7 has-text-weight-medium has-text-link mr-2"
          >
            {{ item.actor?.login }}
          </a>
          <span class="commit-message is-size-7 has-text-grey">
            added a commit that references this issue
          </span>
        </div>

        <span
          v-if="item.commit?.messageHeadlineHTML"
          class="is-size-6 has-text-weight-medium commit-message"
          v-html="item.commit?.messageHeadlineHTML"
        />
        <span v-else class="is-size-7 has-text-grey">Referenced this issue from a commit</span>
      </div>

      <a
        v-if="item.commit?.commitUrl"
        :href="item.commit.commitUrl"
        target="_blank"
        class="tag is-light is-family-monospace ml-3"
      >
        {{ item.commit?.oid?.slice(0, 7) }}
      </a>
      <span v-else class="tag is-light is-family-monospace ml-3">
        {{ item.commit?.oid?.slice(0, 7) || 'commit' }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import RoundImg from '~/components/ui/RoundImg.vue';
import type { IssueTimelineItem } from '~/composables/useIssueTimelineEvents';

defineProps<{
  item: IssueTimelineItem;
}>();
</script>

<style scoped lang="scss">
.commit-item {
  border-radius: 12px;
  background-color: #f6f8fa;
  transition: background-color 0.2s ease;
}

.commit-message {
  ::v-deep(*) {
    font-size: 12px !important;
  }

  ::v-deep(a) {
    color: #0366d6;
    text-decoration: underline;
  }
}
</style>
