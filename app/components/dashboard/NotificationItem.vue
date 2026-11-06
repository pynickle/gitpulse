<template>
  <div
    class="card dashboard-list-card dashboard-list-card--activity dashboard-list-card--detailed notification-card"
    :class="{
      'is-unread': currentNotification.unread,
      'notification-card--todo': isTodoCard,
    }"
  >
    <div class="card-content p-3">
      <div class="dashboard-list-card__main-row notification-card__main-row">
        <div class="dashboard-list-card__icon">
          <figure class="image is-32x32">
            <Transition name="notification-avatar" mode="out-in">
              <GitHubAvatar
                v-if="avatarSrc"
                key="avatar"
                :src="avatarSrc"
                :alt="avatarAlt"
                width="32"
                height="32"
                loading="lazy"
              />
              <div
                v-else
                key="skeleton"
                class="avatar-skeleton"
                :class="{
                  'avatar-skeleton--error': enrichmentPresentation.avatarMode === 'error',
                  'avatar-skeleton--static': enrichmentPresentation.avatarMode === 'static',
                }"
              >
                <TriangleExclamationPointIcon
                  v-if="isSubjectStateError"
                  :size="15"
                  aria-hidden="true"
                />
              </div>
            </Transition>
            <span
              v-if="subjectVisual.icon && enrichmentPresentation.showsTypeBadge"
              class="notification-type-badge"
              :class="{
                'notification-type-badge--pending': enrichmentPresentation.animatesSubjectBadge,
                [`notification-type-badge--${subjectVisual.state}`]: subjectVisual.state,
              }"
              :title="subjectStateTitle"
              :aria-label="subjectStateTitle"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              <Transition name="notification-state-icon" mode="out-in">
                <component :is="subjectVisual.icon" :key="subjectVisual.label" :size="13" />
              </Transition>
            </span>
          </figure>
        </div>
        <div class="dashboard-list-card__content">
          <div class="notification-card__content-frame">
            <div class="dashboard-list-card__text-stack notification-card__text-stack">
              <p class="title is-6 mb-1 dashboard-list-card__subject">
                {{ subjectTitle }}
              </p>

              <div
                v-if="subjectIssueType || subjectLabels.length"
                class="notification-card__labels"
              >
                <IssueTypeBadge
                  v-if="subjectIssueType"
                  :name="subjectIssueType.name"
                  :color="subjectIssueType.color"
                />
                <span
                  v-for="label in subjectLabels"
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

              <p
                v-if="enrichmentPresentation.showsFailureMessage"
                class="notification-card__subject-error"
              >
                <TriangleExclamationPointIcon :size="12" aria-hidden="true" />
                <span>{{ t('dashboard.notificationSubjectEnrichment.itemError') }}</span>
              </p>

              <p class="subtitle is-7 has-text-grey mb-0 dashboard-list-card__meta">
                <span v-if="showSubjectNumber" class="notification-card__number">
                  #{{ subjectNumber }}
                </span>
                <span v-if="showSubjectNumber" class="notification-card__meta-separator"></span>
                {{ repositoryName }}
                <span class="dashboard-list-card__separator">&middot;</span>
                {{
                  formatDurationFromNow(currentNotification.updated_at, localeCode, relativeTimeNow)
                }}
                <template v-if="showCommentsCount">
                  <span class="dashboard-list-card__separator">&middot;</span>
                  <span
                    class="notification-card__comments"
                    :title="commentsTitle"
                    :aria-label="commentsTitle"
                  >
                    <MessageSquareIcon :size="12" aria-hidden="true" />
                    <span>{{ commentsLabel }}</span>
                  </span>
                </template>
                <template v-if="showCheckStatusChip">
                  <span class="dashboard-list-card__separator">&middot;</span>
                  <CheckStatusChip :rollup="checkRollup" @open="openCheckList" />
                </template>
                <template v-if="showLinkedPullRequestCount && linkedPullRequestSummary">
                  <span class="dashboard-list-card__separator">&middot;</span>
                  <LinkedPullRequestCountControl
                    :count="linkedPullRequestSummary.count"
                    @click="handleLinkedPullRequestCountClick"
                  />
                </template>
              </p>
            </div>

            <div v-if="showActionColumn" class="notification-card__action-column ml-3">
              <div v-if="showReason" class="notification-card__actions">
                <button
                  v-if="reasonMarksAsRead"
                  class="notification-card__reason-control notification-card__reason-control--action"
                  type="button"
                  :title="markAsReadTitle"
                  :aria-label="markAsReadTitle"
                  :disabled="markingAsRead"
                  @click.stop="handleMarkAsRead"
                >
                  <component :is="reasonIcon" :size="18" class="notification-card__reason-icon" />
                  <span class="notification-card__reason-read-hint" aria-hidden="true">
                    <Transition name="notification-read-icon" mode="out-in">
                      <CheckIcon v-if="!markingAsRead" key="check" :size="8" />
                      <LoadingIcon v-else key="loading" :spinning="true" :size="8" />
                    </Transition>
                  </span>
                </button>
                <span v-else class="notification-card__reason-control" :title="reasonTitle">
                  <component :is="reasonIcon" :size="18" class="notification-card__reason-icon" />
                </span>
              </div>

              <button
                v-if="todoAction && !hideTodoControl"
                class="notification-card__todo-btn"
                :class="
                  isTodoCard
                    ? 'notification-card__todo-btn--saved'
                    : 'notification-card__todo-btn--add'
                "
                type="button"
                :title="todoActionTitle"
                :aria-label="todoActionTitle"
                @click.stop="emit('todo-action', currentNotification)"
              >
                <ListChecksIcon v-if="isTodoCard" :size="16" />
                <ListPlusIcon v-else :size="16" />
              </button>

              <!-- The narrow touch list hands the action to the row's swipe, so a saved row
                   states the fact with the same glyph, unboxed: a plate there would read as
                   a second button. -->
              <span
                v-else-if="showsSavedMark"
                class="notification-card__todo-mark"
                role="img"
                :aria-label="savedStateTitle"
              >
                <ListChecksIcon :size="16" aria-hidden="true" />
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
  ActivityIcon,
  TriangleExclamationPointIcon,
  AtSignIcon,
  BellIcon,
  BookmarkIcon,
  CircleCheckBigIcon,
  CheckIcon,
  EyeIcon,
  GitCommitHorizontalIcon,
  ListChecksIcon,
  ListPlusIcon,
  MailIcon,
  MessageSquareIcon,
  PenLineIcon,
  ShieldExclamationPointIcon,
  ShieldCheckIcon,
  UserPlusIcon,
  UsersRoundIcon,
  UsersIcon,
} from '@lucide/vue';
import { ref, computed } from 'vue';

import type { LinkedPullRequestCountClickPayload } from '#shared/types/linked-pull-requests';
import type { DashboardNotification } from '#shared/types/notifications';
import { toLinkedPullRequestIdentity } from '#shared/utils/linked-pull-requests';
import { toPullRequestChecksView } from '#shared/utils/pr-checks';
import IssueTypeBadge from '~/components/dashboard/issue/IssueTypeBadge.vue';
import LinkedPullRequestCountControl from '~/components/dashboard/LinkedPullRequestCountControl.vue';
import CheckStatusChip from '~/components/dashboard/pr/CheckStatusChip.vue';
import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';
import LoadingIcon from '~/components/ui/LoadingIcon.vue';
import { getDashboardSubjectStateVisual } from '~/utils/getDashboardSubjectStateVisual';
import { shouldShowNotificationSubjectNumber } from '~/utils/shouldShowNotificationSubjectNumber';

const {
  notification,
  markAsRead,
  todoAction,
  showReason = true,
  showMarkAsRead = true,
  forceRead = false,
  hideTodoControl = false,
} = defineProps<{
  notification: DashboardNotification;
  markAsRead?: (notification: DashboardNotification) => Promise<boolean> | boolean;
  todoAction?: 'add' | 'remove';
  showReason?: boolean;
  showMarkAsRead?: boolean;
  forceRead?: boolean;
  /** The narrow touch list replaces this control with the row's right swipe. */
  hideTodoControl?: boolean;
}>();

const emit = defineEmits<{
  'todo-action': [notification: DashboardNotification];
  'linked-pull-request-count-click': [payload: LinkedPullRequestCountClickPayload];
}>();

const { locale, t } = useI18n();
const { open: openCheckList } = useCheckListModal();
const localeCode = computed(() => locale.value);
const relativeTimeNow = useRelativeTimeNow();
const markingAsRead = ref(false);
const isLocallyRead = ref(false);

const currentNotification = computed(() => ({
  ...notification,
  unread: forceRead || isLocallyRead.value ? false : notification.unread,
}));

const subject = computed(() => currentNotification.value.subject);
const repository = computed(() => currentNotification.value.repository);
const subjectTitle = computed(() => subject.value?.title ?? '');
const subjectNumber = computed(() => subject.value?.number ?? '');
const repositoryName = computed(() => repository.value?.full_name ?? '');
const enrichmentPresentation = computed(() =>
  getNotificationSubjectEnrichmentPresentation(subject.value)
);

const showSubjectNumber = computed(() => {
  return shouldShowNotificationSubjectNumber(subject.value);
});

const avatarSrc = computed(() => {
  if (subject.value?.type === 'Release') {
    return repository.value?.owner?.avatar_url;
  }

  return enrichmentPresentation.value.avatarMode === 'avatar'
    ? subject.value?.authorAvatarUrl
    : undefined;
});

const avatarAlt = computed(() => {
  if (subject.value?.type === 'Release') {
    return repository.value?.owner?.login ?? '';
  }
  return subject.value?.authorLogin ?? '';
});

const isSubjectStatePending = computed(() => {
  return enrichmentPresentation.value.isPending;
});

const isSubjectStateError = computed(() => {
  return enrichmentPresentation.value.isError;
});

const isPullRequestSubject = computed(() => {
  return subject.value?.type === 'PullRequest';
});

const subjectVisual = computed(() => {
  return getDashboardSubjectStateVisual({
    isPullRequest: isPullRequestSubject.value,
    state: subject.value?.state,
    subjectType: subject.value?.type,
    isAnswered: subject.value?.isAnswered,
    draft: subject.value?.draft,
  });
});

const subjectLabels = computed(() => subject.value?.labels ?? []);
const subjectIssueType = computed(() =>
  subject.value?.type === 'Issue' ? subject.value.issueType : undefined
);

const subjectComments = computed(() => {
  const count = subject.value?.comments;
  return typeof count === 'number' && Number.isFinite(count) && count >= 0
    ? Math.trunc(count)
    : null;
});
const showCommentsCount = computed(() => subjectComments.value !== null);
const commentsLabel = computed(() => {
  if (subjectComments.value === null) return '';
  return formatCompactNumber(subjectComments.value, locale.value);
});
const commentsTitle = computed(() => {
  if (subjectComments.value === null) return '';
  return t('dashboard.meta.commentCount', { count: subjectComments.value });
});
const linkedPullRequestSummary = computed(() =>
  getNotificationLinkedPullRequestListSummary(subject.value)
);
const showLinkedPullRequestCount = computed(() => {
  const count = linkedPullRequestSummary.value?.count;
  return typeof count === 'number' && count > 0;
});
const linkedPullRequestIssue = computed(() => {
  const target = parseGitHubNotificationSubjectTarget(subject.value);
  return toLinkedPullRequestIdentity({
    owner: target?.owner,
    repo: target?.repo,
    number: target?.number,
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
const checkRollup = computed(() => subject.value?.checkRollup);
const showCheckStatusChip = computed(
  () =>
    subject.value?.type === 'PullRequest' && toPullRequestChecksView(checkRollup.value).isVisible
);
/**
 * The card is in the reader's todos. The todo action names it: a saved notification is
 * exactly the one whose control would remove it, in both the notifications and the todo
 * list.
 */
const isTodoCard = computed(() => todoAction === 'remove');

/**
 * On the narrow touch list the row's swipe owns the action and the control is gone, so
 * the row has to state "already saved" itself.
 */
const showsSavedMark = computed(() => hideTodoControl && isTodoCard.value);

const showActionColumn = computed(
  () => showReason || Boolean(todoAction && !hideTodoControl) || showsSavedMark.value
);
const reasonMarksAsRead = computed(() => {
  return (
    showReason && showMarkAsRead && Boolean(markAsRead) && Boolean(currentNotification.value.unread)
  );
});
const markAsReadTitle = computed(() => t('dashboard.notifications.markAsReadAction'));
const reasonTitle = computed(() => t('dashboard.notifications.reasonAction'));
const todoActionTitle = computed(() => {
  return isTodoCard.value ? t('dashboard.todos.removeAction') : t('dashboard.todos.addAction');
});
const savedStateTitle = computed(() => t('dashboard.todos.savedState'));

const subjectStateTitle = computed(() => {
  if (isSubjectStatePending.value) {
    return t('dashboard.notificationSubjectEnrichment.itemLoading');
  }

  if (isSubjectStateError.value) {
    return t('dashboard.notificationSubjectEnrichment.itemError');
  }

  return subjectVisual.value.label;
});

const handleMarkAsRead = async () => {
  if (!markAsRead || markingAsRead.value || !currentNotification.value.unread) return;

  markingAsRead.value = true;

  try {
    if (await markAsRead(notification)) {
      isLocallyRead.value = true;
    }
  } finally {
    markingAsRead.value = false;
  }
};

const reasonIconMap: Record<string, typeof BellIcon> = {
  approval_requested: CircleCheckBigIcon, // Deployment approval requested
  assign: UserPlusIcon, // You were assigned to the issue
  author: PenLineIcon, // You created the thread
  ci_activity: ActivityIcon, // CI workflow activity completed
  comment: MessageSquareIcon, // You commented on the thread
  invitation: MailIcon, // Repository invitation accepted
  manual: BookmarkIcon, // Manually subscribed to the thread
  member_feature_requested: UsersIcon, // Organization members requested a feature
  mention: AtSignIcon, // You were @mentioned
  review_requested: EyeIcon, // Pull request review requested
  security_advisory_credit: ShieldCheckIcon, // Credited for security advisory contribution
  security_alert: ShieldExclamationPointIcon, // Security vulnerability alert
  state_change: GitCommitHorizontalIcon, // Thread state changed (close / merge / etc.)
  subscribed: BellIcon, // Watching the repository
  team_mention: UsersRoundIcon, // Your team was mentioned
};

const reasonIcon = computed(() => {
  return reasonIconMap[String(currentNotification.value.reason ?? '')] ?? BellIcon;
});
</script>

<style scoped lang="scss" src="~/assets/scss/card.scss" />
<style scoped lang="scss" src="~/assets/scss/notification-card.scss" />
<style scoped lang="scss">
.avatar-skeleton {
  display: inline-flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

.avatar-skeleton--error {
  border: 1px solid color-mix(in srgb, var(--gitpulse-warning) 45%, var(--gitpulse-border));
  background: color-mix(in srgb, var(--gitpulse-warning) 10%, var(--gitpulse-surface));
  color: var(--gitpulse-warning);
  animation: none;
}

.avatar-skeleton--static {
  background: var(--gitpulse-surface-muted);
  animation: none;
}

.dark-mode .avatar-skeleton:not(.avatar-skeleton--error):not(.avatar-skeleton--static) {
  background: linear-gradient(90deg, #2a2a2a 25%, #3a3a3a 50%, #2a2a2a 75%);
  background-size: 200% 100%;
}

@keyframes skeleton-pulse {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.notification-avatar-enter-active,
.notification-avatar-leave-active {
  transition: opacity 0.25s ease;
}

.notification-avatar-enter-from,
.notification-avatar-leave-to {
  opacity: 0;
}

.notification-card__subject-error {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  margin: 0 0 0.3rem;
  color: var(--gitpulse-warning);
  font-size: 0.72rem;
  line-height: 1.35;
}
</style>
