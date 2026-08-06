import { computed, ref, shallowRef, watch, type Ref } from 'vue';

import type {
  RepoCommitListItemPayload,
  RepoCommitListPaginationMeta,
  RepoCommitListResponse,
} from '#shared/types/repos';
import getFetchErrorMessage from '~/utils/getFetchErrorMessage';

const DEFAULT_PER_PAGE = 30;

const createEmptyPagination = (page = 1): RepoCommitListPaginationMeta => ({
  page,
  perPage: DEFAULT_PER_PAGE,
  hasPrev: false,
  hasNext: false,
  totalCount: null,
  totalPages: null,
});

export interface UsePRCommitListOptions {
  /** When false, no network traffic (panel inactive). Defaults to true. */
  enabled?: Ref<boolean> | (() => boolean);
}

/**
 * Paginated commit list for a single pull request.
 * Fetches only while enabled (e.g. commits panel active).
 */
export function usePRCommitList(
  owner: Ref<string> | (() => string),
  repo: Ref<string> | (() => string),
  pullNumber: Ref<number> | (() => number),
  options: UsePRCommitListOptions = {}
) {
  const apiFetch = useGitPulseApiFetch();

  const resolveOwner = () => (typeof owner === 'function' ? owner() : owner.value);
  const resolveRepo = () => (typeof repo === 'function' ? repo() : repo.value);
  const resolvePullNumber = () =>
    typeof pullNumber === 'function' ? pullNumber() : pullNumber.value;
  const resolveEnabled = () => {
    if (options.enabled === undefined) return true;
    return typeof options.enabled === 'function' ? options.enabled() : options.enabled.value;
  };

  const items = shallowRef<RepoCommitListItemPayload[]>([]);
  const loading = ref(false);
  const error = ref('');
  const pagination = ref<RepoCommitListPaginationMeta>(createEmptyPagination());
  let requestId = 0;

  const hasItems = computed(() => items.value.length > 0);

  const showPagination = computed(() => {
    return (
      !loading.value &&
      !error.value &&
      (pagination.value.hasPrev ||
        pagination.value.hasNext ||
        (pagination.value.totalPages ?? 1) > 1)
    );
  });

  const fetchPage = async (page = 1) => {
    const currentOwner = resolveOwner().trim();
    const currentRepo = resolveRepo().trim();
    const currentPull = resolvePullNumber();

    if (!resolveEnabled() || !currentOwner || !currentRepo || currentPull < 1) {
      return;
    }

    const nextRequestId = requestId + 1;
    requestId = nextRequestId;
    loading.value = true;
    error.value = '';

    const searchParams = new URLSearchParams({
      page: String(page),
      per_page: String(DEFAULT_PER_PAGE),
    });

    try {
      const data = await apiFetch<RepoCommitListResponse>(
        `/api/pulls/${currentOwner}/${currentRepo}/${currentPull}/commits?${searchParams.toString()}`
      );

      if (nextRequestId !== requestId) return;

      items.value = Array.isArray(data.items) ? data.items : [];
      pagination.value = {
        page: data.pagination?.page ?? page,
        perPage: data.pagination?.perPage ?? DEFAULT_PER_PAGE,
        hasPrev: Boolean(data.pagination?.hasPrev),
        hasNext: Boolean(data.pagination?.hasNext),
        totalCount: data.pagination?.totalCount ?? null,
        totalPages: data.pagination?.totalPages ?? null,
      };
    } catch (fetchError) {
      if (nextRequestId !== requestId) return;

      items.value = [];
      pagination.value = createEmptyPagination(page);
      error.value = getFetchErrorMessage(fetchError, 'Failed to load pull request commits.');
    } finally {
      if (nextRequestId === requestId) {
        loading.value = false;
      }
    }
  };

  const goToPage = async (page: number) => {
    if (page < 1 || page === pagination.value.page || loading.value) return;
    await fetchPage(page);
  };

  const refresh = async () => {
    await fetchPage(pagination.value.page || 1);
  };

  const reset = () => {
    requestId += 1;
    items.value = [];
    pagination.value = createEmptyPagination();
    error.value = '';
    loading.value = false;
  };

  watch(
    () => [resolveEnabled(), resolveOwner(), resolveRepo(), resolvePullNumber()] as const,
    ([enabled, nextOwner, nextRepo, nextPull], previous) => {
      if (!enabled || !nextOwner || !nextRepo || nextPull < 1) {
        // Keep last snapshot while closed so reopening does not flash empty;
        // still drop in-flight work.
        requestId += 1;
        loading.value = false;
        return;
      }

      const wasDisabled = previous !== undefined && !previous[0];
      const identityChanged =
        previous !== undefined &&
        (previous[1] !== nextOwner || previous[2] !== nextRepo || previous[3] !== nextPull);

      // Fresh open or different PR → page 1; stay on current page only if already active.
      const page =
        wasDisabled || identityChanged || previous === undefined ? 1 : pagination.value.page;
      void fetchPage(page);
    },
    { immediate: true }
  );

  return {
    items,
    loading,
    error,
    pagination,
    hasItems,
    showPagination,
    fetchPage,
    goToPage,
    refresh,
    reset,
  };
}
