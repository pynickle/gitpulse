<template>
  <div
    class="card dashboard-list-card dashboard-list-card--activity notification-card"
    :class="{ 'is-unread': currentNotification.unread }"
  >
    <div class="card-content p-3">
      <div class="media mb-2">
        <div class="media-left">
          <figure class="image is-32x32">
            <NuxtImg
              :src="currentNotification.repository.owner.avatar_url"
              :alt="currentNotification.repository.owner.login"
              width="32"
              height="32"
              loading="lazy"
              class="is-rounded"
            />
          </figure>
        </div>
        <div class="media-content dashboard-list-card__content">
          <div class="is-flex is-flex-direction-row">
            <div class="is-flex-grow-1">
              <p class="title is-6 dashboard-list-card__title">
                {{ currentNotification.repository.full_name }}
              </p>
              <p class="subtitle is-7 has-text-grey">
                {{ formatDurationFromNow(currentNotification.updated_at, localeCode) }}
              </p>
            </div>
            <div class="ml-4">
              <component :is="reasonIcon" :size="22" />
            </div>
          </div>
        </div>
      </div>

      <div class="is-flex is-justify-content-space-between is-align-items-center">
        <div class="is-flex is-justify-content-flex-start is-align-items-center">
          <component :is="typeIcon" class="mr-2" />
          <span class="has-text-weight-semibold is-size-6 dashboard-list-card__subject">
            {{ currentNotification.subject.title }}
          </span>
        </div>
        <button
          v-if="currentNotification.unread"
          class="mark-read-btn"
          @click.stop="markAsRead"
          :disabled="markingAsRead"
        >
          <CheckIcon v-if="!markingAsRead" :size="16" />
          <LoadingIcon v-else :size="16" :spinning="true" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  BugIcon,
  GitPullRequestIcon,
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
import LoadingIcon from '~/components/ui/LoadingIcon.vue';

const props = defineProps<{
  notification: any;
}>();

const { locale } = useI18n();
const localeCode = computed(() => locale.value);
const markingAsRead = ref(false);
const localNotification = ref({ ...props.notification });

const currentNotification = computed(() => localNotification.value);

const markAsRead = async () => {
  if (markingAsRead.value || !localNotification.value.unread) return;

  markingAsRead.value = true;

  const threadId = localNotification.value.id;

  try {
    const { error } = await useFetch(`/api/notifications/${threadId}`, {
      method: 'PATCH',
    });

    if (error.value) {
      console.error('Failed to mark notification as read:', error.value);
      return;
    }

    localNotification.value.unread = false;
  } finally {
    markingAsRead.value = false;
  }
};

const typeIconMap: Record<string, any> = {
  Issue: BugIcon,
  PullRequest: GitPullRequestIcon,
};

const typeIcon = computed(() => {
  return typeIconMap[localNotification.value.subject.type];
});

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
  return reasonIconMap[localNotification.value.reason];
});
</script>

<style scoped lang="scss" src="~/assets/scss/card.scss" />
<style scoped lang="scss">
@use 'bulma/sass/utilities/initial-variables' as iv;

.card.is-unread {
  border-left: 4px solid #3e8ed0;
  background-color: #f5f9ff;
}

.mark-read-btn {
  opacity: 0;
  visibility: hidden;
  color: #4a4a4a;
  cursor: pointer;
  padding: 4px;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  transition: all 0.3s ease;
}

.notification-card:hover .mark-read-btn {
  opacity: 1;
  visibility: visible;
}

.mark-read-btn:hover {
  background-color: iv.$white-ter;
  color: iv.$grey;
}

.mark-read-btn:disabled {
  opacity: 0.8;
  cursor: not-allowed;
}

.is-spinning {
  animation: spin 1.4s linear infinite;
}
</style>
