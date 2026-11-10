<template>
  <nav
    class="pagination is-centered dashboard-pagination"
    :class="{ 'dashboard-pagination--comfortable': comfortableHitTargets }"
    role="navigation"
    aria-label="pagination"
  >
    <button
      type="button"
      class="pagination-previous pagination-control"
      :aria-label="t('dashboard.pagination.previous')"
      :disabled="!pagination.hasPrev"
      @click="emit('change', pagination.page - 1)"
    >
      <ChevronLeftIcon :size="18" aria-hidden="true" />
      <span class="pagination-control-text">{{ t('dashboard.pagination.previous') }}</span>
    </button>

    <button
      type="button"
      class="pagination-next pagination-control"
      :aria-label="t('dashboard.pagination.next')"
      :disabled="!pagination.hasNext"
      @click="emit('change', pagination.page + 1)"
    >
      <span class="pagination-control-text">{{ t('dashboard.pagination.next') }}</span>
      <ChevronRightIcon :size="18" aria-hidden="true" />
    </button>

    <ul class="pagination-list">
      <li v-for="item in pageItems" :key="item.key">
        <span v-if="item.type === 'ellipsis'" class="pagination-ellipsis">&hellip;</span>
        <button
          type="button"
          v-else
          :class="['pagination-link', { 'is-current': item.page === pagination.page }]"
          :aria-current="item.page === pagination.page ? 'page' : undefined"
          @click="emit('change', item.page)"
        >
          {{ item.page }}
        </button>
      </li>
    </ul>

    <div class="dashboard-pagination__compact">
      <button
        type="button"
        class="dashboard-pagination__step dashboard-pagination__step--first"
        :aria-label="t('dashboard.pagination.first')"
        :disabled="!pagination.hasPrev"
        @click="emit('change', 1)"
      >
        <ChevronsLeftIcon :size="16" aria-hidden="true" />
      </button>

      <button
        type="button"
        class="dashboard-pagination__step dashboard-pagination__step--prev"
        :aria-label="t('dashboard.pagination.previous')"
        :disabled="!pagination.hasPrev"
        @click="emit('change', pagination.page - 1)"
      >
        <ChevronLeftIcon :size="16" aria-hidden="true" />
      </button>

      <div class="dashboard-pagination__page" @click="focusPageField">
        <input
          ref="pageField"
          class="dashboard-pagination__page-input"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          spellcheck="false"
          :value="pageDraft"
          :aria-label="pageFieldLabel"
          :style="{ width: pageFieldWidth }"
          @input="handlePageInput"
          @focus="beginPageEdit"
          @blur="commitPageEdit"
          @keydown="handlePageKeydown"
        />
        <template v-if="pageMax">
          <span class="dashboard-pagination__page-divider" aria-hidden="true">/</span>
          <span class="dashboard-pagination__page-total" aria-hidden="true">{{ pageMax }}</span>
        </template>
      </div>

      <button
        type="button"
        class="dashboard-pagination__step dashboard-pagination__step--next"
        :aria-label="t('dashboard.pagination.next')"
        :disabled="!pagination.hasNext"
        @click="emit('change', pagination.page + 1)"
      >
        <ChevronRightIcon :size="16" aria-hidden="true" />
      </button>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { ChevronLeftIcon, ChevronRightIcon, ChevronsLeftIcon } from '@lucide/vue';
import { computed, ref, useTemplateRef, watch } from 'vue';

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

const {
  pagination,
  currentPageOnly = false,
  comfortableHitTargets = false,
} = defineProps<{
  pagination: PaginationMeta;
  currentPageOnly?: boolean;
  comfortableHitTargets?: boolean;
}>();

const emit = defineEmits<{
  (e: 'change', page: number): void;
}>();

const { t } = useI18n();

const pageMax = computed(() =>
  pagination.totalPages && pagination.totalPages > 0 ? pagination.totalPages : null
);

// The field is exactly as wide as the number it shows, so the digits sit against the slash
// instead of leaving a hole in the pill. Focusing never changes the width — only a longer
// number does — which is what keeps the row from jumping when the field opens.
const pageField = useTemplateRef<HTMLInputElement>('pageField');
const pageDraft = ref(String(pagination.page));
const isEditingPage = ref(false);

const pageFieldWidth = computed(() => `${Math.max(1, pageDraft.value.length)}ch`);

// Without a known total there is no page count to bound the entry by, so cap it at a length
// no GitHub list reaches rather than letting a stray keypress stretch the field.
const UNKNOWN_TOTAL_PAGE_DIGITS = 6;
const maxPageLength = computed(() =>
  pageMax.value ? String(pageMax.value).length : UNKNOWN_TOTAL_PAGE_DIGITS
);

const pageFieldLabel = computed(() =>
  pageMax.value
    ? t('dashboard.pagination.pageOfTotal', { page: pagination.page, total: pageMax.value })
    : t('dashboard.pagination.pageNumber')
);

watch(
  () => pagination.page,
  (page) => {
    if (!isEditingPage.value) pageDraft.value = String(page);
  }
);

const handlePageInput = (event: Event) => {
  const field = event.target as HTMLInputElement;
  const digits = field.value.replace(/\D/g, '').slice(0, maxPageLength.value);
  pageDraft.value = digits;
  // Rejected characters usually leave the sanitized draft unchanged, so Vue would skip the
  // patch and the field would keep them. Write the sanitized text back explicitly.
  if (field.value !== digits) field.value = digits;
};

const beginPageEdit = () => {
  isEditingPage.value = true;
  pageField.value?.select();
};

// The bordered pill is the hit area, so the divider and the total open the field too — and
// re-open it for editing when the field already has focus. A click straight into the field is
// left alone so the browser can place the caret where the user aimed.
const focusPageField = (event: MouseEvent) => {
  if ((event.target as HTMLElement | null)?.closest('.dashboard-pagination__page-input')) return;
  const field = pageField.value;
  if (!field) return;
  field.focus();
  field.select();
};

const commitPageEdit = (event?: FocusEvent) => {
  if (!isEditingPage.value) return;

  // Moving focus to another pagination control means the user picked a different way to
  // navigate, so the half-typed page is abandoned: committing it and then also stepping from
  // the page still on screen would fire two page changes for one gesture.
  const nextFocus = event?.relatedTarget;
  if (nextFocus instanceof Element && nextFocus.closest('.dashboard-pagination')) {
    cancelPageEdit();
    return;
  }

  isEditingPage.value = false;

  const typed = Number.parseInt(pageDraft.value, 10);
  const target =
    Number.isSafeInteger(typed) && typed >= 1 ? Math.min(typed, pageMax.value ?? typed) : null;

  // Optimistic, like the list meta: show the page the user asked for and let the next
  // response correct it, rather than snapping back while the request is in flight.
  pageDraft.value = String(target ?? pagination.page);
  if (target !== null && target !== pagination.page) emit('change', target);
};

const cancelPageEdit = () => {
  isEditingPage.value = false;
  pageDraft.value = String(pagination.page);
};

const handlePageKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Enter' && event.key !== 'Escape') return;
  event.preventDefault();

  if (event.key === 'Enter') commitPageEdit();
  else cancelPageEdit();

  pageField.value?.blur();
};

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
  const { page, totalPages, hasNext } = pagination;

  if (!totalPages) {
    return [
      { key: `page-${page}`, type: 'page' as const, page },
      ...(hasNext && !currentPageOnly
        ? [{ key: `page-${page + 1}`, type: 'page' as const, page: page + 1 }]
        : []),
    ];
  }

  return buildKnownPageItems(totalPages, page);
});
</script>

<style scoped lang="scss">
@use '~/assets/scss/pointer' as *;

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

  @include hover-only {
    &:hover:not([disabled]) {
      background: var(--gitpulse-surface-hover);
      color: var(--bulma-text-strong, var(--gitpulse-text-strong));
    }
  }

  &:focus-visible:not([disabled]) {
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

@include hover-only {
  .pagination-link.is-current:hover {
    background: color-mix(in srgb, var(--gitpulse-info) 25%, transparent);
    color: var(--gitpulse-info);
  }
}

.pagination-link.is-current:focus-visible {
  background: color-mix(in srgb, var(--gitpulse-info) 25%, transparent);
  color: var(--gitpulse-info);
}

@include hover-only {
  html.dark .pagination-link.is-current:hover {
    background: color-mix(in srgb, var(--gitpulse-info) 20%, transparent);
    color: var(--gitpulse-info);
  }
}

html.dark .pagination-link.is-current:focus-visible {
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

.dashboard-pagination--comfortable .pagination-link,
.dashboard-pagination--comfortable .pagination-previous,
.dashboard-pagination--comfortable .pagination-next {
  min-width: 2.75rem;
  min-height: 2.75rem;
}

// Narrow screens swap the page list for one compact row. It borrows the sizing and colour
// tokens of the app's other small controls (FilterMultiSelect) so the pagination
// reads as part of the same toolbar rather than as a form dropped into the footer.
.dashboard-pagination__compact {
  --dashboard-pagination-control-size: 2rem;

  display: none;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
}

.dashboard-pagination--comfortable .dashboard-pagination__compact {
  --dashboard-pagination-control-size: 2.25rem;
}

.dashboard-pagination__step {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: var(--dashboard-pagination-control-size);
  height: var(--dashboard-pagination-control-size);
  padding: 0;
  border: none;
  border-radius: var(--gitpulse-radius-md);
  background: transparent;
  color: var(--bulma-text, var(--gitpulse-text));
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;

  @include hover-only {
    &:hover:not(:disabled) {
      background: var(--gitpulse-surface-hover);
      color: var(--bulma-text-strong, var(--gitpulse-text-strong));
    }
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-accent);
    outline-offset: -1px;
  }

  &:disabled {
    color: var(--gitpulse-text-subtle);
    opacity: 0.45;
    cursor: default;
  }
}

.dashboard-pagination__step svg {
  width: 1rem;
  height: 1rem;
}

.dashboard-pagination__page {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 1px;
  height: var(--dashboard-pagination-control-size);
  padding: 0 0.5rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: var(--gitpulse-radius-md);
  background: var(--gitpulse-input-bg);
  color: var(--gitpulse-text-muted);
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
  cursor: text;
  transition:
    border-color 0.12s ease,
    box-shadow 0.12s ease;

  @include hover-only {
    &:hover {
      border-color: var(--gitpulse-border-strong);
    }
  }

  &:focus-within {
    border-color: var(--gitpulse-accent);
    box-shadow: 0 0 0 2px var(--gitpulse-accent-soft);
  }
}

// The digit hugs the slash, and the slash carries the same breathing room on both sides, so
// the number, the slash and the total read as one line instead of leaving a hole after the
// number. The line height stays `normal` here and on the pill: a text input's line box is
// already that height, so a smaller one on the siblings lifts them off the digit's baseline.
.dashboard-pagination__page-input {
  min-width: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  font: inherit;
  font-weight: 600;
  text-align: right;
  font-variant-numeric: tabular-nums;
  cursor: text;

  &:focus {
    outline: none;
  }
}

.dashboard-pagination__page-divider,
.dashboard-pagination__page-total {
  flex: 0 0 auto;
}

.dashboard-pagination__page-divider {
  padding: 0 0.125rem;
  color: var(--gitpulse-text-subtle);
}

.dashboard-pagination__page-total {
  font-weight: 500;
}

@media (max-width: 860px) {
  .dashboard-pagination > .pagination-previous,
  .dashboard-pagination > .pagination-next,
  .dashboard-pagination > .pagination-list {
    display: none;
  }

  .dashboard-pagination__compact {
    display: flex;
  }
}
</style>
