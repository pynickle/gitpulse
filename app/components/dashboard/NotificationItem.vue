<template>
  <div
    class="card dashboard-list-card dashboard-list-card--activity dashboard-list-card--detailed notification-card"
    :class="{
      'is-unread': currentNotification.unread,
      'notification-card--subject-error': isSubjectStateError,
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
                <AlertTriangleIcon v-if="isSubjectStateError" :size="15" aria-hidden="true" />
              </div>
            </Transition>
            <span
              v-if="subjectVisual.icon"
              class="notification-type-badge"
              :class="{
                'notification-type-badge--pending': enrichmentPresentation.animatesSubjectBadge,
                'notification-type-badge--error': isSubjectStateError,
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
                <AlertTriangleIcon :size="12" aria-hidden="true" />
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
                v-if="todoAction"
                class="notification-card__todo-btn"
                :class="`notification-card__todo-btn--${todoAction}`"
                type="button"
                :title="todoActionTitle"
                :aria-label="todoActionTitle"
                @click.stop="emit('todo-action', currentNotification)"
              >
                <ListPlusIcon v-if="todoAction === 'add'" :size="16" />
                <ListMinusIcon v-else :size="16" />
              </button>
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
  AlertTriangleIcon,
  AtSignIcon,
  BellIcon,
  BookmarkIcon,
  CheckCircleIcon,
  CheckIcon,
  EyeIcon,
  GitCommitIcon,
  ListMinusIcon,
  ListPlusIcon,
  MailIcon,
  MessageSquareIcon,
  PenLineIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  UserPlusIcon,
  Users2Icon,
  UsersIcon,
} from '@lucide/vue';
import { ref, computed } from 'vue';

import { formatDurationFromNow } from '#imports';
import type { DashboardNotification } from '#shared/types/notifications';
import IssueTypeBadge from '~/components/dashboard/issue/IssueTypeBadge.vue';
import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';
import LoadingIcon from '~/components/ui/LoadingIcon.vue';
import getDashboardSubjectStateVisual from '~/utils/getDashboardSubjectStateVisual';
import shouldShowNotificationSubjectNumber from '~/utils/shouldShowNotificationSubjectNumber';

const props = withDefaults(
  defineProps<{
    notification: DashboardNotification;
    markAsRead?: (notification: DashboardNotification) => Promise<boolean> | boolean;
    todoAction?: 'add' | 'remove';
    showReason?: boolean;
    showMarkAsRead?: boolean;
    forceRead?: boolean;
  }>(),
  {
    todoAction: undefined,
    showReason: true,
    showMarkAsRead: true,
    forceRead: false,
  }
);

const emit = defineEmits<{
  'todo-action': [notification: DashboardNotification];
}>();

const { locale, t } = useI18n();
const localeCode = computed(() => locale.value);
const relativeTimeNow = useRelativeTimeNow();
const markingAsRead = ref(false);
const isLocallyRead = ref(false);

const currentNotification = computed(() => ({
  ...props.notification,
  unread: props.forceRead || isLocallyRead.value ? false : props.notification.unread,
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
const showReason = computed(() => props.showReason);
const showMarkAsRead = computed(() => props.showMarkAsRead);
const todoAction = computed(() => props.todoAction);
const showActionColumn = computed(() => showReason.value || Boolean(todoAction.value));
const reasonMarksAsRead = computed(() => {
  return (
    showReason.value &&
    showMarkAsRead.value &&
    Boolean(props.markAsRead) &&
    Boolean(currentNotification.value.unread)
  );
});
const markAsReadTitle = computed(() => t('dashboard.notifications.markAsReadAction'));
const reasonTitle = computed(() => t('dashboard.notifications.reasonAction'));
const todoActionTitle = computed(() => {
  return todoAction.value === 'remove'
    ? t('dashboard.todos.removeAction')
    : t('dashboard.todos.addAction');
});

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
  const markAsRead = props.markAsRead;
  if (!markAsRead || markingAsRead.value || !currentNotification.value.unread) return;

  markingAsRead.value = true;

  try {
    if (await markAsRead(props.notification)) {
      isLocallyRead.value = true;
    }
  } finally {
    markingAsRead.value = false;
  }
};

const reasonIconMap: Record<string, typeof BellIcon> = {
  approval_requested: CheckCircleIcon, // Deployment approval requested
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
  security_alert: ShieldAlertIcon, // Security vulnerability alert
  state_change: GitCommitIcon, // Thread state changed (close / merge / etc.)
  subscribed: BellIcon, // Watching the repository
  team_mention: Users2Icon, // Your team was mentioned
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
