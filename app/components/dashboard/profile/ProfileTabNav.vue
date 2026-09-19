<script setup lang="ts">
import { computed } from 'vue';

import FilterDropdown, { type FilterOption } from '~/components/ui/FilterDropdown.vue';

export type ProfileTab = 'overview' | 'repositories' | 'packages' | 'followers' | 'following';

export type ProfileTabItem = {
  id: ProfileTab;
  label: string;
  count?: number;
};

const props = defineProps<{
  tabs: ProfileTabItem[];
}>();

const tab = defineModel<ProfileTab>({ required: true });

const { t } = useI18n();

const dropdownOptions = computed<FilterOption[]>(() =>
  props.tabs.map((item) => ({
    value: item.id,
    label: typeof item.count === 'number' ? `${item.label} (${item.count})` : item.label,
  }))
);

const onSelectTab = (value: string) => {
  const next = props.tabs.find((item) => item.id === value);
  if (next) {
    tab.value = next.id;
  }
};
</script>

<template>
  <div class="profile-tab-nav">
    <nav class="profile-tab-nav__tabs" role="tablist">
      <button
        v-for="item in tabs"
        :key="item.id"
        type="button"
        role="tab"
        class="profile-tab-nav__tab"
        :class="{ 'profile-tab-nav__tab--active': tab === item.id }"
        :aria-selected="tab === item.id"
        @click="tab = item.id"
      >
        <span>{{ item.label }}</span>
        <span v-if="typeof item.count === 'number'" class="profile-tab-nav__count">
          {{ item.count }}
        </span>
      </button>
    </nav>

    <div class="profile-tab-nav__select">
      <FilterDropdown
        :model-value="tab"
        :options="dropdownOptions"
        :aria-label="t('profile.tabs.selectLabel')"
        @update:model-value="onSelectTab"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.profile-tab-nav {
  min-width: 0;
}

.profile-tab-nav__tabs {
  display: flex;
  gap: 0.35rem;
  border-bottom: 1px solid var(--gitpulse-border);
}

.profile-tab-nav__tab {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.55rem 0.85rem;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--gitpulse-text-muted);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition:
    color 0.12s ease,
    border-color 0.12s ease;

  &:hover {
    color: var(--gitpulse-text-strong);
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring);
    outline-offset: -2px;
  }
}

.profile-tab-nav__tab--active {
  border-bottom-color: var(--gitpulse-accent);
  color: var(--gitpulse-text-strong);
  font-weight: 600;
}

.profile-tab-nav__count {
  padding: 0.05rem 0.45rem;
  border-radius: 999px;
  background: var(--gitpulse-surface-active);
  color: var(--gitpulse-text-muted);
  font-size: 0.72rem;
  font-weight: 600;
}

.profile-tab-nav__select {
  display: none;
}

@media (max-width: 1023px) {
  .profile-tab-nav__tabs {
    display: none;
  }

  .profile-tab-nav__select {
    display: block;
  }

  .profile-tab-nav__select :deep(.filter-dropdown),
  .profile-tab-nav__select :deep(.filter-dropdown-trigger) {
    width: 100%;
  }

  .profile-tab-nav__select :deep(.filter-dropdown-trigger) {
    justify-content: space-between;
    height: 2.75rem;
  }

  .profile-tab-nav__select :deep(.filter-dropdown-trigger-content) {
    flex: 1;
    min-width: 0;
  }
}
</style>
