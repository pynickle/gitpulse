<template>
  <section v-if="isVisible" class="linked-pr-list" :aria-busy="loading || undefined">
    <hr class="linked-pr-list__rule" />

    <div
      v-if="loading && nodes.length === 0"
      class="linked-pr-list__skeleton"
      aria-hidden="true"
      data-linked-pr-skeleton
    >
      <div v-for="index in 3" :key="index" class="linked-pr-list__skeleton-row">
        <span class="linked-pr-list__skeleton-icon" />
        <span class="linked-pr-list__skeleton-line linked-pr-list__skeleton-line--title" />
        <span class="linked-pr-list__skeleton-line linked-pr-list__skeleton-line--meta" />
      </div>
    </div>

    <p v-if="error" class="linked-pr-list__error" role="alert">{{ error }}</p>

    <div v-if="model.groups.length > 0" class="linked-pr-list__groups">
      <div v-for="group in model.groups" :key="group.kind" class="linked-pr-list__group">
        <CollapsibleGroup
          v-if="group.showHeader"
          :id="`linked-pr-list-${group.kind}`"
          :count="group.rows.length"
        >
          <template #header>{{ linkedPullRequestGroupLabel(group.kind) }}</template>
          <LinkedPullRequestRow
            v-for="row in group.rows"
            :key="`${row.owner}/${row.repo}#${row.number}`"
            :row="row"
            compact
            @select="selectRow(row)"
          />
        </CollapsibleGroup>

        <template v-else>
          <LinkedPullRequestRow
            v-for="row in group.rows"
            :key="`${row.owner}/${row.repo}#${row.number}`"
            :row="row"
            compact
            @select="selectRow(row)"
          />
        </template>
      </div>
    </div>

    <button
      v-if="!expanded && model.hiddenCount > 0"
      class="gp-btn gp-btn--light gp-btn--small linked-pr-list__toggle"
      type="button"
      @click="expanded = true"
    >
      {{ t('dashboard.linkedPullRequests.showAll', { count: totalCount }) }}
    </button>
    <button
      v-else-if="expanded && hasNextPage"
      class="gp-btn gp-btn--light gp-btn--small linked-pr-list__toggle"
      type="button"
      :disabled="loading"
      :class="{ 'gp-btn--loading': loading }"
      :aria-busy="loading || undefined"
      @click="loadMore"
    >
      {{ t('dashboard.linkedPullRequests.loadMore') }}
    </button>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import type {
  LinkedPullRequestConnection,
  LinkedPullRequestConnectionPageInfo,
  LinkedPullRequestIdentity,
  LinkedPullRequestListModel,
  LinkedPullRequestRow as LinkedPullRequestRowModel,
  LinkedPullRequestRowGroupKind,
} from '#shared/types/linked-pull-requests';
import { toLinkedPullRequestListModel } from '#shared/utils/linked-pull-requests';
import LinkedPullRequestRow from '~/components/dashboard/LinkedPullRequestRow.vue';
import CollapsibleGroup from '~/components/ui/CollapsibleGroup.vue';

const { owner, repo, number } = defineProps<{
  owner: string;
  repo: string;
  number: number;
}>();

const emit = defineEmits<{
  select: [identity: LinkedPullRequestIdentity];
}>();

/** The route's response, plus the cursor state the band keeps across pages. */
interface LinkedPullRequestPage {
  totalCount?: number;
  nodes?: LinkedPullRequestConnection['nodes'];
  pageInfo?: Pick<LinkedPullRequestConnectionPageInfo, 'hasNextPage' | 'endCursor'>;
}

const { t } = useI18n();
const apiFetch = useGitPulseApiFetch();

const loading = ref(false);
const error = ref('');
const nodes = ref<LinkedPullRequestConnection['nodes']>([]);
const totalCount = ref(0);
const hasNextPage = ref(false);
const endCursor = ref<string | null>(null);
const expanded = ref(false);
let requestId = 0;

const model = computed<LinkedPullRequestListModel>(() =>
  toLinkedPullRequestListModel(
    { totalCount: totalCount.value, nodes: nodes.value },
    { owner, repo },
    expanded.value
  )
);

const isVisible = computed(
  () => loading.value || Boolean(error.value) || nodes.value.length > 0 || totalCount.value > 0
);

const endpoint = () => `/api/issues/${owner}/${repo}/${number}/linked-pull-requests`;

const linkedPullRequestGroupLabel = (kind: LinkedPullRequestRowGroupKind) =>
  kind === 'same-repository'
    ? t('dashboard.linkedPullRequests.sameRepository')
    : t('dashboard.linkedPullRequests.otherRepositories');

/** Emits the routing identity alone; a Row carries more fields than the event does. */
const selectRow = (row: LinkedPullRequestRowModel) => {
  emit('select', { owner: row.owner, repo: row.repo, number: row.number });
};

const reset = () => {
  requestId += 1;
  loading.value = false;
  error.value = '';
  nodes.value = [];
  totalCount.value = 0;
  hasNextPage.value = false;
  endCursor.value = null;
  expanded.value = false;
};

/** Folds one fetched page into the rows already on screen. */
const applyPage = (page: LinkedPullRequestPage | null | undefined) => {
  const pageNodes = Array.isArray(page?.nodes) ? page.nodes : [];
  nodes.value = [...nodes.value, ...pageNodes];
  totalCount.value = Math.max(
    totalCount.value,
    typeof page?.totalCount === 'number' && page.totalCount >= 0
      ? page.totalCount
      : nodes.value.length
  );
  hasNextPage.value = Boolean(page?.pageInfo?.hasNextPage);
  endCursor.value = page?.pageInfo?.endCursor ?? null;
};

const fetchPage = async (after: string | null) => {
  const nextRequestId = requestId + 1;
  requestId = nextRequestId;
  loading.value = true;
  error.value = '';

  try {
    const page = await apiFetch<LinkedPullRequestPage>(
      endpoint(),
      after ? { method: 'GET', query: { after } } : { method: 'GET' }
    );
    if (nextRequestId !== requestId) return;
    applyPage(page);
  } catch (fetchError) {
    if (nextRequestId !== requestId) return;
    error.value = getFetchErrorMessage(fetchError, t('dashboard.linkedPullRequests.error'));
  } finally {
    if (nextRequestId === requestId) {
      loading.value = false;
    }
  }
};

const loadFirstPage = async () => {
  reset();
  if (!owner || !repo || number < 1) return;
  await fetchPage(null);
};

const loadMore = async () => {
  const cursor = endCursor.value;
  if (loading.value || !hasNextPage.value || !cursor) return;
  await fetchPage(cursor);
};

watch(
  () => [owner, repo, number] as const,
  () => {
    void loadFirstPage();
  },
  { immediate: true }
);
</script>

<style scoped lang="scss">
.linked-pr-list {
  margin-bottom: 0;
}

/*
 * The band's own rule, mirroring `.header-rule` below it: both gaps to the rows
 * are 0.75rem, so the block reads as one strip between two identical rules.
 */
.linked-pr-list__rule {
  margin-top: 0.5rem;
  margin-right: 1rem;
  margin-bottom: 0.75rem;
}

.linked-pr-list__groups {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.linked-pr-list__group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.linked-pr-list__skeleton {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/*
 * A placeholder row carries the same parts as a compact Linked Pull Request
 * Row (state icon, title, trailing meta) at the same rhythm, so the list does
 * not jump when the rows arrive.
 */
.linked-pr-list__skeleton-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 22px;
  padding: 3px 6px;
}

.linked-pr-list__skeleton-icon,
.linked-pr-list__skeleton-line {
  display: block;
  background: var(--gitpulse-skeleton-shimmer);
  background-size: 200% 100%;
  animation: linked-pr-list-shimmer 1.4s ease-in-out infinite;
}

.linked-pr-list__skeleton-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  border-radius: 50%;
}

.linked-pr-list__skeleton-line {
  height: 0.65rem;
  border-radius: 4px;
}

.linked-pr-list__skeleton-line--title {
  flex: 1 1 auto;
  min-width: 0;
  max-width: 24rem;
}

/* Uneven titles, the way three real rows would render. */
.linked-pr-list__skeleton-row:nth-child(2) .linked-pr-list__skeleton-line--title {
  max-width: 15rem;
}

.linked-pr-list__skeleton-row:nth-child(3) .linked-pr-list__skeleton-line--title {
  max-width: 19rem;
}

.linked-pr-list__skeleton-line--meta {
  width: 4.5rem;
  flex-shrink: 0;
}

@keyframes linked-pr-list-shimmer {
  from {
    background-position: 200% 0;
  }

  to {
    background-position: -200% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .linked-pr-list__skeleton-icon,
  .linked-pr-list__skeleton-line {
    animation: none;
  }
}

.linked-pr-list__error {
  margin: 0.25rem 0.375rem 0.5rem;
  font-size: 12px;
  font-weight: 500;
  color: var(--gitpulse-danger);
}

.linked-pr-list__toggle {
  margin: 0.25rem 0 0 0.25rem;
}
</style>
