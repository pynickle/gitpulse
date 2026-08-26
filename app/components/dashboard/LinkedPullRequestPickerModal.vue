<script setup lang="ts">
import { AlertCircleIcon, GitPullRequestIcon, Loader2Icon, XIcon } from '@lucide/vue';
import { computed, nextTick, shallowRef, watch } from 'vue';

import type {
  LinkedPullRequestConnection,
  LinkedPullRequestIdentity,
} from '#shared/types/linked-pull-requests';
import { toLinkedPullRequestPickerModel } from '#shared/utils/linked-pull-requests';
import LinkedPullRequestPickerRow from '~/components/dashboard/LinkedPullRequestPickerRow.vue';
import CollapsibleGroup from '~/components/ui/CollapsibleGroup.vue';

interface PickerResponse {
  owner: string;
  repo: string;
  number: number;
  totalCount: number;
  nodes: LinkedPullRequestConnection['nodes'];
}

const props = defineProps<{
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
const panelRef = shallowRef<HTMLElement | null>(null);
const listRef = shallowRef<HTMLElement | null>(null);
const focusTrap = createFocusTrapController();
let requestId = 0;

const pickerModel = computed(() => {
  if (!connection.value) return null;
  return toLinkedPullRequestPickerModel(connection.value, {
    owner: props.owner,
    repo: props.repo,
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
      `/api/issues/${props.owner}/${props.repo}/${props.number}/linked-pull-requests`
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
  () => [props.isVisible, props.owner, props.repo, props.number] as const,
  async ([isVisible]) => {
    if (!isVisible) {
      reset();
      if (import.meta.client) {
        await nextTick();
        focusTrap.restorePreviousFocus();
      }
      return;
    }

    if (import.meta.client) focusTrap.capturePreviousFocus();
    await load();
    await nextTick();
    if (panelRef.value) focusTrap.focusInitialElement(panelRef.value);
  }
);

const handleOverlayKeydown = (event: KeyboardEvent) => {
  if (panelRef.value) focusTrap.trapTabKey(event, panelRef.value);
};

const handleListKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  const list = listRef.value;
  if (!list) return;

  const rows = Array.from(list.querySelectorAll<HTMLButtonElement>('.linked-pr-picker-row'));
  if (rows.length === 0) return;

  const currentIndex = rows.findIndex((row) => row === document.activeElement);
  const delta = event.key === 'ArrowDown' ? 1 : -1;
  const nextIndex = currentIndex < 0 ? 0 : (currentIndex + delta + rows.length) % rows.length;
  const nextRow = rows[nextIndex];
  if (!nextRow) return;

  event.preventDefault();
  nextRow.focus();
};

const selectRow = (row: LinkedPullRequestIdentity) => {
  emit('select', { owner: row.owner, repo: row.repo, number: row.number });
};
</script>

<template>
  <Teleport to="body">
    <Transition name="linked-pr-picker">
      <div
        v-if="isVisible"
        class="linked-pr-picker-overlay"
        @click.self="emit('close')"
        @keydown.escape="emit('close')"
        @keydown="handleOverlayKeydown"
      >
        <div
          ref="panelRef"
          class="linked-pr-picker-panel"
          role="dialog"
          aria-modal="true"
          :aria-label="t('dashboard.linkedPullRequests.pickerTitle')"
          tabindex="-1"
        >
          <div class="linked-pr-picker-header">
            <h3 class="linked-pr-picker-title">
              {{ t('dashboard.linkedPullRequests.pickerTitle') }}
            </h3>
            <button
              class="linked-pr-picker-close"
              type="button"
              :aria-label="t('dashboard.linkedPullRequests.closeAriaLabel')"
              @click="emit('close')"
            >
              <XIcon :size="16" />
            </button>
          </div>

          <div class="linked-pr-picker-content">
            <div v-if="loading" class="linked-pr-picker-status">
              <Loader2Icon class="spin-animation" :size="18" />
              <span>{{ t('dashboard.linkedPullRequests.loading') }}</span>
            </div>

            <div v-else-if="error" class="linked-pr-picker-error" role="alert">
              <AlertCircleIcon :size="14" />
              <span>{{ error }}</span>
            </div>

            <div
              v-else-if="!pickerModel || pickerModel.groups.length === 0"
              class="linked-pr-picker-empty"
            >
              <GitPullRequestIcon :size="24" />
              <p>{{ t('dashboard.linkedPullRequests.empty') }}</p>
            </div>

            <div v-else ref="listRef" class="linked-pr-picker-list" @keydown="handleListKeydown">
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
                  <LinkedPullRequestPickerRow
                    v-for="row in group.rows"
                    :key="`${row.owner}/${row.repo}#${row.number}`"
                    :row="row"
                    @select="selectRow(row)"
                  />
                </CollapsibleGroup>

                <template v-else>
                  <LinkedPullRequestPickerRow
                    v-for="row in group.rows"
                    :key="`${row.owner}/${row.repo}#${row.number}`"
                    :row="row"
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
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.linked-pr-picker-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gitpulse-overlay-bg);
  backdrop-filter: blur(6px);
}

.linked-pr-picker-panel {
  width: 100%;
  max-width: 420px;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  background: var(--gitpulse-surface);
  border-radius: 8px;
  box-shadow: var(--gitpulse-shadow-raised);
  overflow: hidden;
}

.linked-pr-picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 8px;
}

.linked-pr-picker-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  margin: 0;
  letter-spacing: -0.01em;
}

.linked-pr-picker-close {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: transparent;
  border-radius: 6px;
  color: var(--gitpulse-text-subtle);
  cursor: pointer;
  transition: all 0.12s ease;

  &:hover {
    background: var(--gitpulse-surface-hover);
    color: var(--gitpulse-text);
  }
}

.linked-pr-picker-content {
  flex: 1;
  overflow-y: auto;
  padding: 0 12px 12px;
  min-height: 0;
}

.linked-pr-picker-status,
.linked-pr-picker-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 36px 0;
  color: var(--gitpulse-text-muted);
  font-size: 13px;
  text-align: center;

  p {
    margin: 0;
  }
}

.linked-pr-picker-status {
  flex-direction: row;
}

.linked-pr-picker-error {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 12px 4px;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--gitpulse-danger-soft);
  color: var(--gitpulse-danger);
  font-size: 12px;
  font-weight: 500;
  text-align: center;
}

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

.spin-animation {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.linked-pr-picker-enter-active,
.linked-pr-picker-leave-active {
  transition: opacity 0.18s ease;

  .linked-pr-picker-panel {
    transition: transform 0.22s cubic-bezier(0.32, 0.72, 0, 1);
  }
}

.linked-pr-picker-enter-from,
.linked-pr-picker-leave-to {
  opacity: 0;

  .linked-pr-picker-panel {
    transform: scale(0.96) translateY(8px);
  }
}

.linked-pr-picker-enter-to,
.linked-pr-picker-leave-from {
  opacity: 1;

  .linked-pr-picker-panel {
    transform: scale(1) translateY(0);
  }
}
</style>
