<script setup lang="ts">
import { SendIcon, UserIcon } from '@lucide/vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import DetailPeoplePickerModal from '~/components/dashboard/detail/DetailPeoplePickerModal.vue';
import type {
  PRReviewerCandidate,
  PRReviewerCandidateWarning,
  PRReviewerMutationPayload,
} from '~/composables/usePRReviewers';
import type {
  DetailPeoplePickerCandidate,
  DetailPeoplePickerSubmitPayload,
  DetailPeoplePickerWarning,
} from '~/types/detail-people-picker';

const props = defineProps<{
  isVisible: boolean;
  candidates: PRReviewerCandidate[];
  warnings: PRReviewerCandidateWarning[];
  loading: boolean;
  submitting: boolean;
  error: string;
}>();

const emit = defineEmits<{
  close: [];
  submit: [payload: PRReviewerMutationPayload];
  clearError: [];
}>();

const { t } = useI18n();

const reviewerGroupLabels = computed(() => ({
  user: t('prReview.reviewerPicker.kind.user'),
  team: t('prReview.reviewerPicker.kind.team'),
}));

const pickerCandidates = computed<DetailPeoplePickerCandidate[]>(() =>
  props.candidates.map((candidate) => ({
    key: candidate.key,
    kind: candidate.kind,
    name: candidate.name,
    avatarUrl: candidate.avatarUrl,
    login: candidate.login,
    slug: candidate.slug,
    disabled: candidate.requested,
    badgeLabel: candidate.requested ? t('prReview.status.requested') : '',
    ariaLabel: t('prReview.reviewerPicker.selectCandidate', { name: candidate.name }),
  }))
);

const pickerWarnings = computed<DetailPeoplePickerWarning[]>(() =>
  props.warnings.map((warning) => ({
    key: `${warning.source}:${warning.message}`,
    message: warning.message,
  }))
);

const submitSelection = ({ candidates }: DetailPeoplePickerSubmitPayload) => {
  const payload = candidates.reduce<PRReviewerMutationPayload>((nextPayload, candidate) => {
    if (candidate.kind === 'team' && candidate.slug) {
      nextPayload.teamReviewers ??= [];
      nextPayload.teamReviewers.push(candidate.slug);
    }

    if (candidate.kind === 'user' && candidate.login) {
      nextPayload.reviewers ??= [];
      nextPayload.reviewers.push(candidate.login);
    }

    return nextPayload;
  }, {});

  if (!payload.reviewers?.length && !payload.teamReviewers?.length) {
    return;
  }

  emit('submit', payload);
};
</script>

<template>
  <DetailPeoplePickerModal
    :is-visible="isVisible"
    :title="t('prReview.reviewerPicker.requestReviewers')"
    :close-label="t('prReview.reviewerPicker.close')"
    :search-placeholder="t('prReview.reviewerPicker.placeholder')"
    :search-label="t('prReview.reviewerPicker.search')"
    :loading-label="t('prReview.reviewerPicker.loading')"
    :empty-label="t('prReview.reviewerPicker.empty')"
    :cancel-label="t('prReview.reviewerPicker.cancel')"
    :submit-label="t('prReview.reviewerPicker.requestSelected')"
    :candidates="pickerCandidates"
    :group-labels="reviewerGroupLabels"
    :warnings="pickerWarnings"
    :loading="loading"
    :submitting="submitting"
    :error="error"
    show-selected-count
    @close="emit('close')"
    @submit="submitSelection"
    @clear-error="emit('clearError')"
  >
    <template #empty-icon>
      <UserIcon :size="24" />
    </template>
    <template #submit-icon>
      <SendIcon :size="14" />
    </template>
  </DetailPeoplePickerModal>
</template>
