<template>
  <div
    class="card dashboard-list-card dashboard-list-card--activity dashboard-list-card--detailed notification-card"
  >
    <div class="card-content p-3">
      <div class="dashboard-list-card__main-row notification-card__main-row">
        <div class="dashboard-list-card__icon">
          <figure class="image is-32x32 issue-pr-notification-card__icon">
            <GitHubAvatar
              :src="card.actorAvatarUrl"
              :alt="card.actorLogin"
              width="32"
              height="32"
              loading="lazy"
            />
            <span
              v-if="subjectVisual.icon"
              class="notification-type-badge"
              :class="{
                [`notification-type-badge--${subjectVisual.state}`]: subjectVisual.state,
              }"
              :title="subjectVisual.label"
              :aria-label="subjectVisual.label"
            >
              <component :is="subjectVisual.icon" :size="13" />
            </span>
          </figure>
        </div>

        <div class="dashboard-list-card__content">
          <div class="is-flex is-align-items-flex-start">
            <div class="dashboard-list-card__text-stack">
              <p class="title is-6 mb-1 dashboard-list-card__subject">
                {{ card.title }}
              </p>

              <div v-if="card.issueType || card.labels.length" class="notification-card__labels">
                <IssueTypeBadge
                  v-if="card.issueType"
                  :name="card.issueType.name"
                  :color="card.issueType.color"
                />
                <span
                  v-for="label in card.labels"
                  :key="label.name"
                  class="notification-card__label"
                  :style="{
                    '--label-color': `#${label.color}`,
                    borderBottomColor: `#${label.color}`,
                  }"
                >
                  {{ label.name }}
                </span>
              </div>

              <p class="subtitle is-7 has-text-grey mb-0 dashboard-list-card__meta">
                <span v-if="card.number" class="notification-card__number">
                  #{{ card.number }}
                </span>
                <span v-if="card.number" class="notification-card__meta-separator"></span>
                <span v-if="card.repositoryName">{{ card.repositoryName }}</span>
                <span
                  v-if="card.repositoryName && card.updatedAt"
                  class="dashboard-list-card__separator"
                >
                  &middot;
                </span>
                <span v-if="card.updatedAt">
                  {{ formatDurationFromNow(card.updatedAt, localeCode, relativeTimeNow) }}
                </span>
                <template v-if="card.comments !== null">
                  <span
                    v-if="card.number || card.repositoryName || card.updatedAt"
                    class="dashboard-list-card__separator"
                  >
                    &middot;
                  </span>
                  <span
                    class="notification-card__comments"
                    :title="commentsTitle"
                    :aria-label="commentsTitle"
                  >
                    <MessageSquareIcon :size="12" aria-hidden="true" />
                    <span>{{ commentsLabel }}</span>
                  </span>
                </template>
                <template v-if="showLinkedPullRequestCount && linkedPullRequestSummary">
                  <span
                    v-if="
                      card.number || card.repositoryName || card.updatedAt || card.comments !== null
                    "
                    class="dashboard-list-card__separator"
                  >
                    &middot;
                  </span>
                  <LinkedPullRequestCountControl
                    :count="linkedPullRequestSummary.count"
                    @click="handleLinkedPullRequestCountClick"
                  />
                </template>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { MessageSquareIcon } from '@lucide/vue';
import { computed } from 'vue';

import { formatDurationFromNow } from '#imports';
import type { LinkedPullRequestCountClickPayload } from '#shared/types/linked-pull-requests';
import {
  readLinkedPullRequestListSummary,
  toLinkedPullRequestIdentity,
} from '#shared/utils/linked-pull-requests';
import IssueTypeBadge from '~/components/dashboard/issue/IssueTypeBadge.vue';
import LinkedPullRequestCountControl from '~/components/dashboard/LinkedPullRequestCountControl.vue';
import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';
import toDashboardIssuePrCard, { type DashboardIssuePrEntity } from '~/utils/dashboardIssuePrCard';
import getDashboardSubjectStateVisual from '~/utils/getDashboardSubjectStateVisual';

const props = defineProps<{
  item: DashboardIssuePrEntity;
}>();

const emit = defineEmits<{
  'linked-pull-request-count-click': [payload: LinkedPullRequestCountClickPayload];
}>();

const { locale, t } = useI18n();
const localeCode = computed(() => locale.value);
const relativeTimeNow = useRelativeTimeNow();

const card = computed(() => toDashboardIssuePrCard(props.item));

const commentsLabel = computed(() => {
  if (card.value.comments === null) return '';
  return formatCompactNumber(card.value.comments, locale.value);
});

const commentsTitle = computed(() => {
  if (card.value.comments === null) return '';
  return t('dashboard.meta.commentCount', { count: card.value.comments });
});

const linkedPullRequestSummary = computed(() =>
  readLinkedPullRequestListSummary(card.value.linkedPullRequestCount, card.value.linkedPullRequest)
);
const showLinkedPullRequestCount = computed(() => {
  const count = linkedPullRequestSummary.value?.count;
  return typeof count === 'number' && count > 0;
});
const linkedPullRequestIssue = computed(() => {
  const repoPath = parseGitHubRepoPath(props.item.repository_url);
  return toLinkedPullRequestIdentity({
    owner: repoPath?.owner,
    repo: repoPath?.repo,
    number: props.item.number,
  });
});
const handleLinkedPullRequestCountClick = () => {
  const summary = linkedPullRequestSummary.value;
  if (!summary) return;
  emit('linked-pull-request-count-click', {
    summary,
    issue: linkedPullRequestIssue.value,
  });
};

const subjectVisual = computed(() => {
  return getDashboardSubjectStateVisual({
    isPullRequest: card.value.subjectType === 'PullRequest',
    state: card.value.state,
    subjectType: card.value.subjectType,
    draft: card.value.draft,
  });
});
</script>

<style scoped lang="scss" src="~/assets/scss/card.scss" />
<style scoped lang="scss" src="~/assets/scss/notification-card.scss" />
<style scoped lang="scss">
.issue-pr-notification-card__icon {
  position: relative;
}
</style>
