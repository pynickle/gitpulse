<template>
  <div class="commit-item">
    <div class="commit-item__row">
      <GitHubAvatar
        variant="raised"
        interactive
        v-if="item.actor?.avatarUrl"
        width="32"
        height="32"
        :src="item.actor.avatarUrl"
        :alt="item.actor.login"
      />

      <div class="commit-item__body">
        <div class="commit-item__meta">
          <GitHubProfileLink
            :login="item.actor?.login"
            :github-href="item.actor?.url"
            class="commit-item__actor"
          >
            {{ item.actor?.login }}
          </GitHubProfileLink>
          <span class="commit-message commit-item__muted">
            {{ t('issueDetail.referenceCommitIntro') }}
          </span>
        </div>

        <!-- v-html: computed headline passes through sanitizeHtml's xss allowlist. -->
        <span
          v-if="sanitizedCommitMessageHeadlineHtml"
          class="commit-item__headline commit-message"
          v-html="sanitizedCommitMessageHeadlineHtml"
        />
        <span v-else class="commit-item__muted">
          {{ t('issueDetail.referenceCommitFallback') }}
        </span>
      </div>

      <a
        v-if="item.commit?.commitUrl"
        :href="item.commit.commitUrl"
        target="_blank"
        rel="noopener"
        class="gp-tag commit-item__sha"
      >
        {{ item.commit?.oid?.slice(0, 7) }}
      </a>
      <span v-else class="gp-tag commit-item__sha">
        {{ item.commit?.oid?.slice(0, 7) || t('issueDetail.commitFallbackRef') }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';
import GitHubProfileLink from '~/components/ui/GitHubProfileLink.vue';
import type { IssueTimelineItem } from '~/composables/useIssueTimelineEvents';
import { sanitizeHtml } from '~/utils/sanitizeHtml';

const { item } = defineProps<{
  item: IssueTimelineItem;
}>();

const { t } = useI18n();

const sanitizedCommitMessageHeadlineHtml = computed(() => {
  const headlineHtml = item.commit?.messageHeadlineHTML;

  if (!headlineHtml) {
    return '';
  }

  return sanitizeHtml(headlineHtml);
});
</script>

<style scoped lang="scss">
.commit-item {
  padding: 0.5rem 1rem 0.25rem;
  border-radius: 12px;
  background-color: var(--gitpulse-surface-muted);
  transition: background-color 0.2s ease;
}

.commit-item__row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.commit-item__body {
  display: flex;
  flex-direction: column;
  justify-content: center;
  flex-grow: 1;
}

.commit-item__meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.commit-item__actor {
  color: var(--gitpulse-link);
  font-size: 0.75rem;
  font-weight: 500;
}

.commit-item__muted {
  color: var(--gitpulse-text-muted);
  font-size: 0.75rem;
}

.commit-item__headline {
  font-size: 1rem;
  font-weight: 500;
}

.commit-item__sha {
  font-family: var(--gitpulse-code-font-family);
}

.commit-message {
  ::v-deep(*) {
    font-size: 12px !important;
  }

  ::v-deep(a) {
    color: var(--gitpulse-link);
    text-decoration: underline;
  }
}
</style>
