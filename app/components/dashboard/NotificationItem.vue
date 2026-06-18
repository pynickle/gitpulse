<template>
  <div
    class="card dashboard-list-card dashboard-list-card--activity dashboard-list-card--detailed notification-card"
    :class="{ 'is-unread': currentNotification.unread }"
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
              <div v-else key="skeleton" class="avatar-skeleton" />
            </Transition>
            <span
              v-if="subjectVisual.icon"
              class="notification-type-badge"
              :class="{
                'notification-type-badge--pending': isSubjectStatePending,
                'notification-type-badge--error': isSubjectStateError,
                [`notification-type-badge--${subjectVisual.state}`]: subjectVisual.state,
              }"
              :title="subjectStateTitle"
              :aria-label="subjectStateTitle"
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

              <div v-if="subjectLabels.length" class="notification-card__labels">
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

const showSubjectNumber = computed(() => {
  return shouldShowNotificationSubjectNumber(subject.value);
});

const avatarSrc = computed(() => {
  // Release类型直接使用repository.owner的头像，无需等待GraphQL加载
  if (subject.value?.type === 'Release') {
    return repository.value?.owner?.avatar_url;
  }
  // 其他类型：只在loaded状态且有author信息时才显示
  if (subject.value?.stateStatus === 'loaded' && subject.value.authorAvatarUrl) {
    return subject.value.authorAvatarUrl;
  }
  return undefined; // 未加载完成返回undefined，触发骨架屏
});

const avatarAlt = computed(() => {
  if (subject.value?.type === 'Release') {
    return repository.value?.owner?.login ?? '';
  }
  return subject.value?.authorLogin ?? '';
});

const isSubjectStatePending = computed(() => {
  return subject.value?.stateStatus === 'pending';
});

const isSubjectStateError = computed(() => {
  return subject.value?.stateStatus === 'error';
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
  });
});

const subjectLabels = computed(() => subject.value?.labels ?? []);
const showReason = computed(() => props.showReason);
const showMarkAsRead = computed(() => props.showMarkAsRead);
const todoAction = computed(() => props.todoAction);
const showActionColumn = computed(() => showReason.value || Boolean(todoAction.value));
const reasonMarksAsRead = computed(() => {
  return showReason.value && showMarkAsRead.value && Boolean(currentNotification.value.unread);
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
    return `${subjectVisual.value.label}: status loading`;
  }

  if (isSubjectStateError.value) {
    return `${subjectVisual.value.label}: status unavailable`;
  }

  return subjectVisual.value.label;
});

const handleMarkAsRead = async () => {
  if (markingAsRead.value || !currentNotification.value.unread) return;

  markingAsRead.value = true;

  const threadId = String(currentNotification.value.id);

  try {
    if (props.markAsRead) {
      if (await props.markAsRead(props.notification)) {
        isLocallyRead.value = true;
      }
      return;
    }

    const { error } = await useFetch(`/api/notifications/${threadId}`, {
      method: 'PATCH',
    });

    if (error.value) {
      console.error('Failed to mark notification as read:', error.value);
      return;
    }

    isLocallyRead.value = true;
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
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

.dark-mode .avatar-skeleton {
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
</style>
