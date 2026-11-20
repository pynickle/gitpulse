<script setup lang="ts">
import { GitPullRequestIcon } from '@lucide/vue';
import { computed, shallowRef, watch } from 'vue';

import type {
  LinkedPullRequestConnection,
  LinkedPullRequestIdentity,
} from '#shared/types/linked-pull-requests';
import { toLinkedPullRequestPickerModel } from '#shared/utils/linked-pull-requests';
import LinkedPullRequestRow from '~/components/dashboard/LinkedPullRequestRow.vue';
import PickerModal from '~/components/dashboard/PickerModal.vue';
import CollapsibleGroup from '~/components/ui/CollapsibleGroup.vue';

interface PickerResponse {
  owner: string;
  repo: string;
  number: number;
  totalCount: number;
  nodes: LinkedPullRequestConnection['nodes'];
}

const { isVisible, owner, repo, number } = defineProps<{
  isVisible: boolean;
  owner: string;
  repo: string;
  number: number;
}>();

const emit = defineEmits<{
  close: [];
  select: [identity: LinkedPullRequestIdentity];
}>();

const { t } = useI18n();
const apiFetch = useGitPulseApiFetch();

const loading = shallowRef(false);
const error = shallowRef('');
const connection = shallowRef<LinkedPullRequestConnection | null>(null);
let requestId = 0;

const pickerModel = computed(() => {
  if (!connection.value) return null;
  return toLinkedPullRequestPickerModel(connection.value, {
    owner: owner,
    repo: repo,
  });
});

const reset = () => {
  requestId += 1;
  loading.value = false;
  error.value = '';
  connection.value = null;
};

const load = async () => {
  const nextRequestId = requestId + 1;
  requestId = nextRequestId;
  loading.value = true;
  error.value = '';
  connection.value = null;

  try {
    const response = await apiFetch<PickerResponse>(
      `/api/issues/${owner}/${repo}/${number}/linked-pull-requests`
    );

    if (nextRequestId !== requestId) return;

    connection.value = {
      totalCount: response.totalCount,
      nodes: Array.isArray(response.nodes) ? response.nodes : [],
    };
  } catch (fetchError) {
    if (nextRequestId !== requestId) return;
    error.value = getFetchErrorMessage(fetchError, t('dashboard.linkedPullRequests.error'));
  } finally {
    if (nextRequestId === requestId) {
      loading.value = false;
    }
  }
};

watch(
  () => [isVisible, owner, repo, number] as const,
  ([visible]) => {
    if (visible) void load();
    else reset();
  }
);

const selectRow = (row: LinkedPullRequestIdentity) => {
  emit('select', { owner: row.owner, repo: row.repo, number: row.number });
};
</script>

<template>
  <PickerModal
    :is-visible="isVisible"
    :title="t('dashboard.linkedPullRequests.pickerTitle')"
    :close-label="t('dashboard.linkedPullRequests.closeAriaLabel')"
    :loading-label="loading ? t('dashboard.linkedPullRequests.loading') : ''"
    :error="error"
    :empty-label="!pickerModel?.groups.length ? t('dashboard.linkedPullRequests.empty') : ''"
    @close="emit('close')"
  >
    <template #empty-icon><GitPullRequestIcon :size="24" aria-hidden="true" /></template>
    <div
      v-if="pickerModel?.groups.length && !loading && !error"
      class="linked-pr-picker-list"
      data-picker-list
    >
      <template v-for="group in pickerModel.groups" :key="group.kind">
        <CollapsibleGroup
          v-if="group.showHeader"
          :id="`linked-pr-${group.kind}`"
          :count="group.rows.length"
        >
          <template #header>
            {{
              group.kind === 'same-repository'
                ? t('dashboard.linkedPullRequests.sameRepository')
                : t('dashboard.linkedPullRequests.otherRepositories')
            }}
          </template>
          <LinkedPullRequestRow
            v-for="row in group.rows"
            :key="`${row.owner}/${row.repo}#${row.number}`"
            :row="row"
            data-picker-row
            @select="selectRow(row)"
          />
        </CollapsibleGroup>

        <template v-else>
          <LinkedPullRequestRow
            v-for="row in group.rows"
            :key="`${row.owner}/${row.repo}#${row.number}`"
            :row="row"
            data-picker-row
            @select="selectRow(row)"
          />
        </template>
      </template>

      <p v-if="pickerModel.remainder > 0" class="linked-pr-picker-remainder">
        {{
          t('dashboard.linkedPullRequests.remainder', {
            count: pickerModel.remainder,
          })
        }}
      </p>
    </div>
  </PickerModal>
</template>

<style scoped lang="scss">
.linked-pr-picker-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.linked-pr-picker-remainder {
  margin: 8px 8px 4px;
  font-size: 12px;
  color: var(--gitpulse-text-muted);
}
</style>
