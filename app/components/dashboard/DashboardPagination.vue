<template>
  <nav
    class="pagination is-centered dashboard-pagination"
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
  gap: 0.125rem;
}

.pagination-link,
.pagination-previous,
.pagination-next {
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--bulma-text, var(--gitpulse-text));
  padding: 0.25rem 0.5rem;
  min-height: 1.5rem;
  font-size: 0.75rem;

  &:hover:not([disabled]),
  &:focus:not([disabled]) {
    background: var(--gitpulse-surface-hover);
    color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  }
}

.pagination-link.is-current {
  background: var(--gitpulse-info-soft);
  border: none;
  color: var(--gitpulse-info);
  font-weight: 600;
}

html.dark .pagination-link.is-current {
  background: color-mix(in srgb, var(--gitpulse-info) 15%, transparent);
  color: var(--gitpulse-info);
}

.pagination-link.is-current:hover,
.pagination-link.is-current:focus {
  background: color-mix(in srgb, var(--gitpulse-info) 25%, transparent);
  color: var(--gitpulse-info);
}

html.dark .pagination-link.is-current:hover,
html.dark .pagination-link.is-current:focus {
  background: color-mix(in srgb, var(--gitpulse-info) 20%, transparent);
  color: var(--gitpulse-info);
}

.pagination-link[disabled],
.pagination-previous[disabled],
.pagination-next[disabled] {
  background: transparent;
  color: var(--gitpulse-text-subtle);
  opacity: 0.45;
}

.pagination-ellipsis {
  min-height: 1.5rem;
  font-size: 0.75rem;
}

.pagination-previous.pagination-control,
.pagination-next.pagination-control {
  flex: 0 0 auto;
  padding: 0.25rem;
  width: auto;
}

.pagination-control svg {
  width: 1rem;
  height: 1rem;
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
