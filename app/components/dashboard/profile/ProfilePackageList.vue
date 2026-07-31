<script setup lang="ts">
import { LayoutGridIcon, Loader2Icon, PackageIcon } from '@lucide/vue';
import { computed, ref, toRef, type Component } from 'vue';

import type { PackageSummary, PackageType, PackageTypeFilter } from '#shared/types/packages';
import DashboardPagination from '~/components/dashboard/DashboardPagination.vue';
import { useUserPackages } from '~/composables/useUserPackages';

interface PackageFilterOption {
  value: PackageTypeFilter;
  label: string;
  icon: Component;
}

const props = defineProps<{
  username: string;
  isOrganization: boolean;
  emptyLabel: string;
}>();

const emit = defineEmits<{
  (e: 'select-package', pkg: PackageSummary): void;
}>();

const { locale, t } = useI18n();
const relativeTimeNow = useRelativeTimeNow();

const typeFilter = ref<PackageTypeFilter>('all');

const { items, loading, error, pagination, showPagination, goToPage, refresh } = useUserPackages(
  toRef(props, 'username'),
  typeFilter,
  toRef(props, 'isOrganization')
);

const PACKAGE_TYPE_OPTIONS: PackageType[] = [
  'npm',
  'maven',
  'rubygems',
  'docker',
  'nuget',
  'container',
];

const filterOptions = computed<PackageFilterOption[]>(() => [
  { value: 'all', label: t('dashboard.filters.options.all'), icon: LayoutGridIcon },
  ...PACKAGE_TYPE_OPTIONS.map((type) => ({
    value: type,
    label: t(`packages.types.${type}`),
    icon: packageTypeIcon(type),
  })),
]);

/** Local binding so template typecheck can resolve the auto-imported util. */
function packageTypeIcon(type: PackageType): Component {
  return getPackageTypeIcon(type);
}

const handleFilterKeydown = (event: KeyboardEvent) => {
  handleRovingTablistKeydown(event, {
    itemCount: filterOptions.value.length,
    activeIndex: filterOptions.value.findIndex((option) => option.value === typeFilter.value),
    onSelect: (index) => {
      const option = filterOptions.value[index];
      if (option) typeFilter.value = option.value;
    },
  });
};

const visibilityLabel = (pkg: PackageSummary) => {
  switch (pkg.visibility) {
    case 'private':
      return t('packages.visibility.private');
    case 'internal':
      return t('packages.visibility.internal');
    default:
      return '';
  }
};

const updatedLabel = (pkg: PackageSummary) => {
  const updatedAt = pkg.updatedAt || pkg.createdAt || '';
  return updatedAt
    ? t('packages.updated', {
        time: formatDurationFromNow(updatedAt, locale.value, relativeTimeNow.value),
      })
    : '';
};
</script>

<template>
  <div class="profile-package-list">
    <div
      class="profile-package-list__filters"
      role="tablist"
      :aria-label="t('packages.filterLabel')"
      @keydown="handleFilterKeydown"
    >
      <button
        v-for="option in filterOptions"
        :key="option.value"
        type="button"
        role="tab"
        class="profile-package-list__filter"
        :class="{ 'is-active': typeFilter === option.value }"
        :aria-selected="typeFilter === option.value"
        :tabindex="typeFilter === option.value ? 0 : -1"
        :disabled="loading"
        @click="typeFilter = option.value"
      >
        <component :is="option.icon" :size="13" aria-hidden="true" />
        <span>{{ option.label }}</span>
      </button>
    </div>

    <div v-if="loading" class="profile-package-list__status">
      <Loader2Icon :size="22" class="spin-animation" aria-hidden="true" />
    </div>

    <div v-else-if="error" class="profile-package-list__status profile-package-list__status--error">
      <p>{{ error }}</p>
      <button type="button" class="button is-small is-light" @click="refresh">
        {{ t('profile.retry') }}
      </button>
    </div>

    <template v-else-if="items.length">
      <div class="profile-package-list__items">
        <button
          v-for="pkg in items"
          :key="`${pkg.packageType}:${pkg.id}`"
          type="button"
          class="profile-package-list__item card"
          @click="emit('select-package', pkg)"
        >
          <div class="profile-package-list__item-title-row">
            <component
              :is="packageTypeIcon(pkg.packageType)"
              :size="16"
              class="profile-package-list__item-icon"
              aria-hidden="true"
            />
            <span class="profile-package-list__item-name" :title="pkg.name">{{ pkg.name }}</span>
            <span v-if="visibilityLabel(pkg)" class="tag is-warning is-light">
              {{ visibilityLabel(pkg) }}
            </span>
          </div>

          <p v-if="pkg.repository" class="profile-package-list__item-repo">
            {{ pkg.repository.fullName }}
          </p>

          <div class="profile-package-list__item-meta">
            <span class="tag is-light">{{ t(`packages.types.${pkg.packageType}`) }}</span>
            <span v-if="typeof pkg.versionCount === 'number'">
              {{ t('packages.versionCount', { count: pkg.versionCount }, pkg.versionCount) }}
            </span>
            <span v-if="updatedLabel(pkg)">{{ updatedLabel(pkg) }}</span>
          </div>
        </button>
      </div>

      <DashboardPagination
        v-if="showPagination"
        class="profile-package-list__pagination"
        :pagination="pagination"
        @change="goToPage"
      />
    </template>

    <div v-else class="profile-package-list__status profile-package-list__status--empty">
      <PackageIcon :size="26" aria-hidden="true" />
      <p>{{ emptyLabel }}</p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.profile-package-list {
  display: flex;
  flex-direction: column;
  min-height: 0;
  gap: 1rem;
}

.profile-package-list__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.profile-package-list__filter {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.7rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 999px;
  background: transparent;
  color: var(--gitpulse-text-muted);
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  transition:
    color 0.12s ease,
    border-color 0.12s ease,
    background-color 0.12s ease;

  &:hover:not(:disabled) {
    color: var(--gitpulse-text-strong);
    border-color: var(--gitpulse-text-muted);
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring);
    outline-offset: 1px;
  }

  &:disabled {
    cursor: default;
    opacity: 0.7;
  }

  &.is-active {
    border-color: var(--gitpulse-accent);
    background: var(--gitpulse-surface-active);
    color: var(--gitpulse-text-strong);
    font-weight: 600;
  }
}

.profile-package-list__items {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr));
  gap: 0.75rem;
  align-items: stretch;
}

.profile-package-list__item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.85rem 1rem;
  border: 1px solid var(--gitpulse-border);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.12s ease;

  &:hover {
    border-color: var(--gitpulse-accent);
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring);
    outline-offset: 1px;
  }
}

.profile-package-list__item-title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.profile-package-list__item-icon {
  flex-shrink: 0;
  color: var(--gitpulse-accent);
}

.profile-package-list__item-name {
  overflow: hidden;
  color: var(--gitpulse-text-strong);
  font-size: 0.92rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-package-list__item-repo {
  overflow: hidden;
  color: var(--gitpulse-text-muted);
  font-size: 0.8rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-package-list__item-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.65rem;
  margin-top: auto;
  color: var(--gitpulse-text-muted);
  font-size: 0.78rem;
}

.profile-package-list__pagination {
  margin-top: 0.5rem;
}

.profile-package-list__status {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  min-height: 10rem;
  padding: 2rem;
  color: var(--gitpulse-text-muted);
  font-size: 0.875rem;
  text-align: center;
}

.profile-package-list__status--error {
  color: var(--gitpulse-danger);
}

.spin-animation {
  animation: spin 1s linear infinite;
  color: var(--gitpulse-accent);
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
