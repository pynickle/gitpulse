<template>
  <div>
    <!-- Reviewers section -->
    <div class="mb-4">
      <div class="is-flex items-center justify-between mb-3">
        <h3 class="title is-6 mb-0">Reviewers</h3>
      </div>
      <div class="is-flex flex-wrap mb-4">
        <span
          v-for="reviewer in requestedReviewers"
          :key="reviewer.id || reviewer.login"
          class="tag is-info is-light mr-2 mb-2"
        >
          {{ reviewer.login }}
        </span>
        <span v-if="requestedReviewers.length === 0" class="has-text-grey is-size-7">
          No reviewers
        </span>
      </div>
    </div>

    <!-- Additional info section -->
    <div class="mb-4">
      <h3 class="title is-6 mb-3">Additional Info</h3>
      <div class="is-size-7 has-text-grey">
        <p class="mb-2">Created: {{ formatDurationFromNow(createdAt, localeCode) }}</p>
        <p class="mb-2">Updated: {{ formatDurationFromNow(updatedAt, localeCode) }}</p>
        <p v-if="mergedAt" class="mb-2">
          Merged: {{ formatDurationFromNow(mergedAt, localeCode) }}
        </p>
        <p v-if="assignee" class="mb-2">Assignee: {{ assignee.login }}</p>
        <p v-else class="mb-2">Assignee: None</p>
        <p class="mb-2">Commits: {{ commits }}</p>
        <p class="mb-2">Changed Files: {{ changedFiles }}</p>
        <p class="mb-2">Additions: {{ additions }}</p>
        <p class="mb-2">Deletions: {{ deletions }}</p>
      </div>
    </div>

    <!-- GitHub link -->
    <div>
      <a
        :href="htmlUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="button is-small is-fullwidth"
      >
        View on GitHub
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import 'dayjs/locale/zh-cn';

const { locale } = useI18n();
const localeCode = computed(() => locale.value);

dayjs.extend(relativeTime);

defineProps<{
  requestedReviewers: any[];
  htmlUrl: string | undefined;
  createdAt: string | undefined;
  updatedAt: string | undefined;
  mergedAt: string | undefined;
  assignee: any | undefined;
  commits: number | undefined;
  changedFiles: number | undefined;
  additions: number | undefined;
  deletions: number | undefined;
}>();

const formatDurationFromNow = (dateString: string | undefined, locale: string) => {
  if (!dateString) return '';
  dayjs.locale(locale);
  return dayjs(dateString).fromNow();
};
</script>
