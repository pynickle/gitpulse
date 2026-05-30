<template>
  <nav
    class="pagination is-centered is-rounded dashboard-pagination"
    role="navigation"
    aria-label="pagination"
  >
    <button
      class="pagination-previous pagination-control"
      :aria-label="t('dashboard.pagination.previous')"
      :disabled="!canGoPrev"
      @click="emit('change', pagination.page - 1)"
    >
      <ChevronLeftIcon :size="18" aria-hidden="true" />
      <span class="pagination-control-text">{{ t('dashboard.pagination.previous') }}</span>
    </button>

    <button
      class="pagination-next pagination-control"
      :aria-label="t('dashboard.pagination.next')"
      :disabled="!canGoNext"
      @click="emit('change', pagination.page + 1)"
    >
      <span class="pagination-control-text">{{ t('dashboard.pagination.next') }}</span>
      <ChevronRightIcon :size="18" aria-hidden="true" />
    </button>

    <ul class="pagination-list">
      <li v-for="item in pageItems" :key="item.key">
        <span v-if="item.type === 'ellipsis'" class="pagination-ellipsis">&hellip;</span>
        <button
          v-else
          :class="['pagination-link', { 'is-current': item.page === pagination.page }]"
          :aria-current="item.page === pagination.page ? 'page' : undefined"
          @click="emit('change', item.page)"
        >
          {{ item.page }}
        </button>
      </li>
    </ul>
  </nav>
</template>

<script setup lang="ts">
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-vue-next';
import { computed } from 'vue';

interface PaginationMeta {
  page: number;
  perPage: number;
  hasPrev: boolean;
  hasNext: boolean;
  totalCount: number | null;
  totalPages: number | null;
}

interface PaginationPageItem {
  key: string;
  type: 'page' | 'ellipsis';
  page: number;
}

const props = defineProps<{
  pagination: PaginationMeta;
}>();

const emit = defineEmits<{
  (e: 'change', page: number): void;
}>();

const { t } = useI18n();

const canGoPrev = computed(() => props.pagination.hasPrev);
const canGoNext = computed(() => props.pagination.hasNext);

const buildKnownPageItems = (totalPages: number, currentPage: number) => {
  const pages = new Set<number>([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
  const sortedPages = [...pages]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((left, right) => left - right);

  const items: PaginationPageItem[] = [];

  for (const page of sortedPages) {
    const previousPage = items[items.length - 1]?.page;

    if (previousPage && page - previousPage > 1) {
      items.push({
        key: `ellipsis-${previousPage}-${page}`,
        type: 'ellipsis',
        page,
      });
    }

    items.push({
      key: `page-${page}`,
      type: 'page',
      page,
    });
  }

  return items;
};

const pageItems = computed(() => {
  const { page, totalPages, hasNext } = props.pagination;

  if (!totalPages) {
    return [
      { key: `page-${page}`, type: 'page' as const, page },
      ...(hasNext ? [{ key: `page-${page + 1}`, type: 'page' as const, page: page + 1 }] : []),
    ];
  }

  return buildKnownPageItems(totalPages, page);
});
</script>

<style scoped lang="scss">
.dashboard-pagination {
  margin: 0;
}

.pagination-link,
.pagination-previous,
.pagination-next {
  border-color: var(--gitpulse-border);
  background: var(--gitpulse-surface);
  color: var(--bulma-text, var(--gitpulse-text));

  &:hover:not([disabled]),
  &:focus:not([disabled]) {
    border-color: var(--gitpulse-border-strong);
    background: var(--gitpulse-surface-hover);
    color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  }
}

.pagination-link.is-current {
  background: var(--gitpulse-info);
  border-color: transparent;
  color: #ffffff;
  font-weight: 600;
}

html.dark .pagination-link.is-current {
  background: var(--gitpulse-info-soft);
  color: var(--gitpulse-info);
}

.pagination-link.is-current:hover,
.pagination-link.is-current:focus {
  background: var(--gitpulse-link);
  color: #ffffff;
}

html.dark .pagination-link.is-current:hover,
html.dark .pagination-link.is-current:focus {
  background: color-mix(in srgb, var(--gitpulse-info) 20%, transparent);
  color: var(--gitpulse-info);
}

.pagination-link[disabled],
.pagination-previous[disabled],
.pagination-next[disabled] {
  background: var(--gitpulse-surface-muted);
  color: var(--gitpulse-text-subtle);
  opacity: 0.58;
}

.pagination-link,
.pagination-previous,
.pagination-next,
.pagination-ellipsis {
  min-height: 2rem;
}

.dashboard-pagination {
  gap: 0.25rem;
}

/* Override Bulma's .pagination.is-rounded padding (1em) — need equal specificity */
.pagination.is-rounded .pagination-previous.pagination-control,
.pagination.is-rounded .pagination-next.pagination-control {
  flex: 0 0 2rem;
  padding-left: 0;
  padding-right: 0;
  width: 2rem;
}

.pagination-control svg {
  width: 1.25rem;
  height: 1.25rem;
}

.pagination-control-text {
  border: 0;
  clip: rect(0 0 0 0);
  height: 1px;
  margin: -1px;
  overflow: hidden;
  padding: 0;
  position: absolute;
  white-space: nowrap;
  width: 1px;
}
</style>
