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
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { formatDurationFromNow } from '#imports';
import IssueTypeBadge from '~/components/dashboard/issue/IssueTypeBadge.vue';
import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';
import toDashboardIssuePrCard, { type DashboardIssuePrEntity } from '~/utils/dashboardIssuePrCard';
import getDashboardSubjectStateVisual from '~/utils/getDashboardSubjectStateVisual';

const props = defineProps<{
  item: DashboardIssuePrEntity;
}>();

const { locale } = useI18n();
const localeCode = computed(() => locale.value);
const relativeTimeNow = useRelativeTimeNow();

const card = computed(() => toDashboardIssuePrCard(props.item));

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
