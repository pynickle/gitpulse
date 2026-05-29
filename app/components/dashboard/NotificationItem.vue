<template>
  <div
    class="card dashboard-list-card dashboard-list-card--activity dashboard-list-card--detailed notification-card"
    :class="{ 'is-unread': currentNotification.unread }"
  >
    <div class="card-content p-3">
      <div class="dashboard-list-card__main-row notification-card__main-row">
        <div class="dashboard-list-card__icon">
          <figure class="image is-32x32">
            <NuxtImg
              :src="currentNotification.repository.owner.avatar_url"
              :alt="currentNotification.repository.owner.login"
              width="32"
              height="32"
              loading="lazy"
              class="is-rounded"
            />
            <span
              v-if="subjectVisual.icon"
              class="notification-type-badge"
              :class="{
                'notification-type-badge--pending': isSubjectStatePending,
                'notification-type-badge--error': isSubjectStateError,
              }"
              :style="subjectVisualStyle"
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
          <div class="is-flex is-align-items-flex-start">
            <div class="dashboard-list-card__text-stack">
              <p class="title is-6 mb-1 dashboard-list-card__subject">
                {{ currentNotification.subject.title }}
              </p>

              <p class="subtitle is-7 has-text-grey mb-0 dashboard-list-card__meta">
                {{ currentNotification.repository.full_name }} &middot;
                {{ formatDurationFromNow(currentNotification.updated_at, localeCode) }}
              </p>
            </div>
            <div class="notification-card__actions ml-3">
              <div class="notification-card__reason-slot">
                <component :is="reasonIcon" :size="22" class="notification-card__reason-icon" />
              </div>
              <div class="notification-card__mark-read-slot">
                <button
                  v-if="currentNotification.unread"
                  class="mark-read-btn"
                  @click.stop="markAsRead"
                  :disabled="markingAsRead"
                >
                  <CheckIcon v-if="!markingAsRead" :size="16" />
                  <LoadingIcon v-else :spinning="true" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  CheckCircle,
  UserPlus,
  PenLine,
  Activity,
  MessageSquare,
  Mail,
  Bookmark,
  Users,
  AtSign,
  Eye,
  ShieldCheck,
  ShieldAlert,
  GitCommit,
  Bell,
  Users2,
  CheckIcon,
} from 'lucide-vue-next';
import { ref, computed } from 'vue';

import { formatDurationFromNow } from '#imports';
import type { DashboardNotification } from '#shared/types/notifications';
import LoadingIcon from '~/components/ui/LoadingIcon.vue';
import getDashboardSubjectStateVisual from '~/utils/getDashboardSubjectStateVisual';

const props = defineProps<{
  notification: DashboardNotification;
}>();

const { locale } = useI18n();
const localeCode = computed(() => locale.value);
const markingAsRead = ref(false);
const isLocallyRead = ref(false);

const currentNotification = computed(() => ({
  ...props.notification,
  unread: isLocallyRead.value ? false : props.notification.unread,
}));

const isSubjectStatePending = computed(() => {
  return currentNotification.value.subject?.stateStatus === 'pending';
});

const isSubjectStateError = computed(() => {
  return currentNotification.value.subject?.stateStatus === 'error';
});

const isPullRequestSubject = computed(() => {
  return currentNotification.value.subject?.type === 'PullRequest';
});

const subjectVisual = computed(() => {
  return getDashboardSubjectStateVisual({
    isPullRequest: isPullRequestSubject.value,
    state: currentNotification.value.subject?.state,
    subjectType: currentNotification.value.subject?.type,
  });
});

const subjectVisualStyle = computed(() => {
  return subjectVisual.value.color ? { color: subjectVisual.value.color } : {};
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

const markAsRead = async () => {
  if (markingAsRead.value || !currentNotification.value.unread) return;

  markingAsRead.value = true;

  const threadId = currentNotification.value.id;

  try {
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

const reasonIconMap: Record<string, any> = {
  approval_requested: CheckCircle, // Deployment approval requested
  assign: UserPlus, // You were assigned to the issue
  author: PenLine, // You created the thread
  ci_activity: Activity, // CI workflow activity completed
  comment: MessageSquare, // You commented on the thread
  invitation: Mail, // Repository invitation accepted
  manual: Bookmark, // Manually subscribed to the thread
  member_feature_requested: Users, // Organization members requested a feature
  mention: AtSign, // You were @mentioned
  review_requested: Eye, // Pull request review requested
  security_advisory_credit: ShieldCheck, // Credited for security advisory contribution
  security_alert: ShieldAlert, // Security vulnerability alert
  state_change: GitCommit, // Thread state changed (close / merge / etc.)
  subscribed: Bell, // Watching the repository
  team_mention: Users2, // Your team was mentioned
};

const reasonIcon = computed(() => {
  return reasonIconMap[currentNotification.value.reason ?? ''];
});
</script>

<style scoped lang="scss" src="~/assets/scss/card.scss" />
<style scoped lang="scss">
.card.is-unread {
  background-color: var(--gitpulse-unread-bg);
}

.card.is-unread::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 4px;
  background-color: var(--gitpulse-link);
  pointer-events: none;
  z-index: 1;
}

.notification-type-badge {
  position: absolute;
  right: -3px;
  bottom: -3px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: 2px solid var(--gitpulse-surface);
  border-radius: 999px;
  background-color: var(--gitpulse-surface);
  box-shadow: 0 1px 4px color-mix(in srgb, var(--gitpulse-text-strong) 18%, transparent);
  line-height: 1;
  transition:
    color 0.25s ease,
    opacity 0.3s ease,
    border-color 0.3s ease;
}

.notification-type-badge--pending {
  animation: notification-state-pulse 2s ease-in-out infinite;
  opacity: 0.45;
}

.notification-type-badge--error {
  border-color: var(--gitpulse-border-strong);
  opacity: 0.45;
}

.notification-state-icon-enter-active,
.notification-state-icon-leave-active {
  transition: opacity 0.2s ease;
}

.notification-state-icon-enter-from,
.notification-state-icon-leave-to {
  opacity: 0;
}

.mark-read-btn {
  opacity: 0;
  visibility: hidden;
  color: var(--gitpulse-text);
  cursor: pointer;
  padding: 4px;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  transition: all 0.3s ease;
}

.notification-card__actions {
  display: grid;
  grid-template-columns: 24px 24px;
  gap: 0.35rem;
  flex: 0 0 auto;
}

.notification-card__reason-slot,
.notification-card__mark-read-slot {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
}

.notification-card__reason-icon {
  color: var(--gitpulse-text-muted);
  flex: 0 0 auto;
}

.notification-card:hover .mark-read-btn {
  opacity: 1;
  visibility: visible;
}

.mark-read-btn:hover {
  background-color: var(--gitpulse-surface-hover);
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
}

.mark-read-btn:disabled {
  opacity: 0.8;
  cursor: not-allowed;
}

.is-spinning {
  animation: spin 1.4s linear infinite;
}

@keyframes notification-state-pulse {
  0%,
  100% {
    opacity: 0.35;
  }

  50% {
    opacity: 0.65;
  }
}
</style>
