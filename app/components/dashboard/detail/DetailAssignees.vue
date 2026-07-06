<template>
  <div class="sidebar-card mb-4">
    <div class="sidebar-card__header">
      <div class="sidebar-card__header-left">
        <UserRoundIcon :size="14" class="sidebar-card__icon" />
        <span class="sidebar-card__title">{{ t('detailAssignees.title') }}</span>
      </div>
      <div class="sidebar-card__header-actions">
        <span v-if="visibleAssignees.length > 0" class="sidebar-badge">
          {{ visibleAssignees.length }}
        </span>
        <button
          v-if="canEditAssignees"
          class="assignees-action-btn"
          type="button"
          :aria-label="t('detailAssignees.edit')"
          :title="t('detailAssignees.edit')"
          @click="openAssigneeEditor"
        >
          <PlusIcon :size="13" />
        </button>
      </div>
    </div>

    <div class="sidebar-card__content">
      <div v-if="visibleAssignees.length > 0" class="assignee-list">
        <div v-for="assignee in visibleAssignees" :key="assignee.login" class="assignee-item">
          <GitHubAvatar
            v-if="assignee.avatar_url"
            :src="assignee.avatar_url"
            :alt="assignee.login"
            size="22"
            class="assignee-item__avatar"
          />
          <span v-else class="assignee-item__avatar assignee-item__avatar--fallback">
            <UserRoundIcon :size="13" />
          </span>
          <span class="assignee-item__name">{{ assignee.login }}</span>
          <button
            v-if="canEditAssignees"
            class="assignee-item__action"
            type="button"
            :aria-label="t('detailAssignees.removeAssignee', { login: assignee.login })"
            :title="t('detailAssignees.removeAssignee', { login: assignee.login })"
            :disabled="savingAssignees"
            @click="removeAssignee(assignee)"
          >
            <Loader2Icon
              v-if="removingLogin === assignee.login"
              class="spin-animation"
              :size="13"
            />
            <XIcon v-else :size="13" />
          </button>
        </div>
      </div>
      <p v-else class="sidebar-card__empty">{{ t('detailAssignees.empty') }}</p>
      <p v-if="assigneeError" class="sidebar-card__error">
        {{ assigneeError }}
      </p>
    </div>

    <DetailPeoplePickerModal
      :is-visible="isAssigneeEditorVisible"
      :title="t('detailAssignees.edit')"
      :close-label="t('detailAssignees.close')"
      :search-placeholder="t('detailAssignees.placeholder')"
      :search-label="t('detailAssignees.search')"
      :loading-label="t('detailAssignees.loading')"
      :empty-label="t('detailAssignees.noneAvailable')"
      :cancel-label="t('detailAssignees.cancel')"
      :submit-label="t('detailAssignees.save')"
      :candidates="assigneePickerCandidates"
      :initial-selected-keys="selectedAssigneeKeys"
      :group-labels="assigneeGroupLabels"
      :loading="loadingCandidates"
      :submitting="savingAssignees"
      :error="assigneeError"
      allow-empty-selection
      submit-requires-change
      @close="closeAssigneeEditor()"
      @submit="saveAssigneeSelection"
      @clear-error="clearAssigneeError"
    >
      <template #empty-icon>
        <UserRoundIcon :size="24" />
      </template>
    </DetailPeoplePickerModal>
  </div>
</template>

<script setup lang="ts">
import { Loader2Icon, PlusIcon, UserRoundIcon, XIcon } from '@lucide/vue';
import { computed, onUnmounted, ref, shallowRef } from 'vue';
import { useI18n } from 'vue-i18n';

import type {
  IssueAssigneeCandidate,
  IssueAssigneeMutationResponse,
  IssueAssigneeUser,
} from '#shared/types/assignees';
import DetailPeoplePickerModal from '~/components/dashboard/detail/DetailPeoplePickerModal.vue';
import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';
import type {
  DetailPeoplePickerCandidate,
  DetailPeoplePickerSubmitPayload,
} from '~/types/detail-people-picker';
import getFetchErrorMessage from '~/utils/getFetchErrorMessage';

const props = defineProps<{
  assignees: IssueAssigneeUser[];
  canEditAssignees: boolean;
  repoInfo: { owner: string; repo: string } | null;
  issueNumber?: number | null;
}>();

const emit = defineEmits<{
  (
    e: 'update:assignees',
    assignees: IssueAssigneeUser[],
    issue?: IssueAssigneeMutationResponse
  ): void;
  (e: 'update:is-assignee-editor-visible', isVisible: boolean): void;
}>();

const { t } = useI18n();
const { openModal, closeModal } = useModalState();
const { fetchAssigneeCandidates, addAssignees, removeAssignees } = useIssueAssignees();

const isAssigneeEditorVisible = shallowRef(false);
const loadingCandidates = shallowRef(false);
const savingAssignees = shallowRef(false);
const removingLogin = shallowRef<string | null>(null);
const assigneeError = shallowRef('');
const candidates = ref<IssueAssigneeCandidate[]>([]);

let assigneeErrorTimer: ReturnType<typeof setTimeout> | null = null;

const visibleAssignees = computed(() => props.assignees.filter((assignee) => assignee.login));

const currentLoginSet = computed(() => {
  return new Set(visibleAssignees.value.map((assignee) => assignee.login));
});

const selectedAssigneeKeys = computed(() =>
  visibleAssignees.value.map((assignee) => assignee.login)
);

const assigneeGroupLabels = computed(() => ({
  user: t('detailAssignees.title'),
}));

const assigneePickerCandidates = computed<DetailPeoplePickerCandidate[]>(() =>
  candidates.value.map((candidate) => ({
    key: candidate.login,
    kind: 'user',
    name: candidate.login,
    avatarUrl: candidate.avatar_url,
    login: candidate.login,
    badgeLabel: candidate.assigned ? t('detailAssignees.assigned') : '',
    ariaLabel: t('detailAssignees.selectAssignee', { login: candidate.login }),
  }))
);

const clearAssigneeErrorTimer = () => {
  if (assigneeErrorTimer) {
    clearTimeout(assigneeErrorTimer);
    assigneeErrorTimer = null;
  }
};

const clearAssigneeError = () => {
  clearAssigneeErrorTimer();
  assigneeError.value = '';
};

const scheduleAssigneeErrorClear = () => {
  clearAssigneeErrorTimer();
  assigneeErrorTimer = setTimeout(() => {
    assigneeError.value = '';
    assigneeErrorTimer = null;
  }, 5000);
};

const setEditorVisible = (visible: boolean) => {
  isAssigneeEditorVisible.value = visible;
  emit('update:is-assignee-editor-visible', visible);
};

const openAssigneeEditor = async () => {
  if (!props.canEditAssignees || !props.repoInfo || !props.issueNumber) {
    return;
  }

  clearAssigneeError();
  setEditorVisible(true);
  openModal();
  await loadAssigneeCandidates('');
};

const closeAssigneeEditor = (force = false) => {
  if (savingAssignees.value && !force) return;

  setEditorVisible(false);
  closeModal();
};

const loadAssigneeCandidates = async (query = '') => {
  if (!props.repoInfo || !props.issueNumber) return;

  loadingCandidates.value = true;
  clearAssigneeError();

  try {
    const { owner, repo } = props.repoInfo;
    const data = await fetchAssigneeCandidates(owner, repo, props.issueNumber, query.trim());
    candidates.value = data.items ?? [];
  } catch (err: unknown) {
    console.error('Error fetching issue assignee candidates:', err);
    candidates.value = [];
    assigneeError.value = getFetchErrorMessage(err, t('detailAssignees.loadFailed'));
    scheduleAssigneeErrorClear();
  } finally {
    loadingCandidates.value = false;
  }
};

const emitUpdatedAssignees = (issue: IssueAssigneeMutationResponse) => {
  const nextAssignees = Array.isArray(issue.assignees) ? issue.assignees : visibleAssignees.value;
  emit('update:assignees', nextAssignees, issue);
};

const syncCurrentAssignees = async () => {
  if (!props.repoInfo || !props.issueNumber) return;

  const { owner, repo } = props.repoInfo;
  const data = await fetchAssigneeCandidates(owner, repo, props.issueNumber, '');
  emit('update:assignees', data.assignees, { assignees: data.assignees });
  candidates.value = data.items ?? [];
};

const saveAssigneeSelection = async ({ selectedKeys }: DetailPeoplePickerSubmitPayload) => {
  if (!props.repoInfo || !props.issueNumber) return;

  const current = currentLoginSet.value;
  const selected = new Set(selectedKeys);
  const assigneesToAdd = [...selected].filter((login) => !current.has(login));
  const assigneesToRemove = [...current].filter((login) => !selected.has(login));

  if (assigneesToAdd.length === 0 && assigneesToRemove.length === 0) return;

  savingAssignees.value = true;
  clearAssigneeError();

  try {
    const { owner, repo } = props.repoInfo;
    let latestIssue: IssueAssigneeMutationResponse | null = null;

    if (assigneesToAdd.length > 0) {
      latestIssue = await addAssignees(owner, repo, props.issueNumber, {
        assignees: assigneesToAdd,
      });
    }

    if (assigneesToRemove.length > 0) {
      latestIssue = await removeAssignees(owner, repo, props.issueNumber, {
        assignees: assigneesToRemove,
      });
    }

    if (latestIssue) {
      emitUpdatedAssignees(latestIssue);
    }

    closeAssigneeEditor(true);
  } catch (err: unknown) {
    console.error('Error updating issue assignees:', err);
    try {
      await syncCurrentAssignees();
    } catch (syncErr: unknown) {
      console.error('Error syncing issue assignees after failed update:', syncErr);
    }
    assigneeError.value = getFetchErrorMessage(err, t('detailAssignees.updateFailed'));
    scheduleAssigneeErrorClear();
  } finally {
    savingAssignees.value = false;
    removingLogin.value = null;
  }
};

const removeAssignee = async (assignee: IssueAssigneeUser) => {
  if (!props.repoInfo || !props.issueNumber || savingAssignees.value) return;

  savingAssignees.value = true;
  removingLogin.value = assignee.login;
  clearAssigneeError();

  try {
    const { owner, repo } = props.repoInfo;
    const issue = await removeAssignees(owner, repo, props.issueNumber, {
      assignees: [assignee.login],
    });
    emitUpdatedAssignees(issue);
  } catch (err: unknown) {
    console.error('Error removing issue assignee:', err);
    assigneeError.value = getFetchErrorMessage(err, t('detailAssignees.removeFailed'));
    scheduleAssigneeErrorClear();
  } finally {
    savingAssignees.value = false;
    removingLogin.value = null;
  }
};

onUnmounted(() => {
  clearAssigneeErrorTimer();
  if (isAssigneeEditorVisible.value) {
    closeModal();
  }
});
</script>

<style scoped lang="scss">
@use '~/assets/scss/_variables' as *;
@use '~/assets/scss/reviewer-modal';

.sidebar-card {
  background: var(--gitpulse-surface-muted);
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
  overflow: hidden;
}

.sidebar-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--gitpulse-border);
  background: var(--gitpulse-surface);
}

.sidebar-card__header-left,
.sidebar-card__header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sidebar-card__icon {
  color: $brand-primary;
}

.sidebar-card__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  letter-spacing: 0;
}

.sidebar-card__content {
  padding: 12px 16px;
}

.sidebar-card__empty {
  font-size: 12px;
  color: var(--gitpulse-text-subtle);
  margin: 0;
}

.sidebar-card__error {
  margin: 8px 0 0;
  font-size: 11px;
  color: var(--bulma-danger, #cc0f35);
}

.sidebar-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--gitpulse-text-muted);
  background: var(--gitpulse-surface-hover);
  border-radius: 10px;
}

.assignees-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  color: var(--gitpulse-text-muted);
  background: var(--gitpulse-surface);
  border: 1px solid var(--gitpulse-border);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.12s ease;

  &:hover {
    color: var(--bulma-text-strong, var(--gitpulse-text-strong));
    border-color: var(--gitpulse-border-strong);
    background: var(--gitpulse-surface-hover);
  }
}

.assignee-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.assignee-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: var(--gitpulse-surface);
  border: 1px solid var(--gitpulse-border);
  border-radius: 6px;
  transition: border-color 0.12s ease;

  &:hover {
    border-color: var(--gitpulse-border-strong);
  }
}

.assignee-item__avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  flex-shrink: 0;
}

.assignee-item__avatar--fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--gitpulse-text-muted);
  background: var(--gitpulse-surface-hover);
}

.assignee-item__name {
  min-width: 0;
  flex: 1;
  font-size: 12px;
  font-weight: 500;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.assignee-item__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  padding: 0;
  color: var(--gitpulse-text-muted);
  background: transparent;
  border: 0;
  border-radius: 5px;
  cursor: pointer;
  opacity: 0.6;

  &:hover:not(:disabled) {
    color: var(--bulma-text-strong, var(--gitpulse-text-strong));
    background: var(--gitpulse-surface-hover);
    opacity: 1;
  }

  &:disabled {
    cursor: progress;
  }
}
</style>
