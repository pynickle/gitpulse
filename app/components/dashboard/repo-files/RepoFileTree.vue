<script setup lang="ts">
import { FileIcon, FolderIcon, Loader2Icon } from 'lucide-vue-next';
import { computed } from 'vue';
import type { LocationQueryRaw } from 'vue-router';

import type { RepoContentItem } from '~/composables/useRepoFiles';

const props = defineProps<{
  owner: string;
  repo: string;
  items: RepoContentItem[];
  loading: boolean;
  error: string;
  currentBranch: string;
  defaultBranch: string;
}>();

const { t } = useI18n();
const localePath = useLocalePath();
const router = useRouter();
const { navigateToFile } = useNavigationHistory();

const sortedItems = computed(() => {
  const dirs = props.items
    .filter((item) => item.type === 'dir')
    .sort((a, b) => a.name.localeCompare(b.name));

  const files = props.items
    .filter((item) => item.type === 'file')
    .sort((a, b) => a.name.localeCompare(b.name));

  return [...dirs, ...files];
});

const currentBranchQueryValue = computed(() => {
  return props.currentBranch && props.currentBranch !== props.defaultBranch
    ? props.currentBranch
    : undefined;
});
const canonicalBranch = computed(() => props.currentBranch || props.defaultBranch || undefined);

const navigateToItem = async (item: RepoContentItem) => {
  navigateToFile(props.owner, props.repo, item.path, canonicalBranch.value);

  const query: LocationQueryRaw = {
    repo: `${props.owner}/${props.repo}`,
    path: item.path,
    branch: currentBranchQueryValue.value,
  };

  await router.push({ path: localePath('/dashboard'), query });
};
</script>

<template>
  <div class="repo-file-tree">
    <h2 class="title is-5 repo-file-tree__title">
      <FolderIcon :size="18" />
      <span>{{ t('repoDetail.files') }}</span>
    </h2>
    <div v-if="loading" class="repo-file-tree__loading">
      <Loader2Icon :size="20" class="spin-animation" />
    </div>
    <div v-else-if="error" class="repo-file-tree__error">
      {{ error }}
    </div>
    <div v-else-if="sortedItems.length" class="repo-file-tree__list">
      <button
        v-for="item in sortedItems"
        :key="item.path"
        type="button"
        class="repo-file-tree__item"
        @click="navigateToItem(item)"
      >
        <FolderIcon
          v-if="item.type === 'dir'"
          :size="14"
          class="repo-file-tree__item-icon repo-file-tree__item-icon--dir"
        />
        <FileIcon
          v-else
          :size="14"
          class="repo-file-tree__item-icon repo-file-tree__item-icon--file"
        />
        <span class="repo-file-tree__item-name">{{ item.name }}</span>
      </button>
    </div>
    <div v-else class="repo-file-tree__empty">
      {{ t('repoDetail.filesEmpty') }}
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '~/assets/scss/_variables' as *;

.repo-file-tree {
  margin-top: 1.5rem;
}

.repo-file-tree__title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 1rem;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  font-size: 1.125rem;
}

.repo-file-tree__loading {
  display: flex;
  justify-content: center;
  padding: 2rem;
  color: var(--gitpulse-text-muted);
}

.repo-file-tree__error {
  padding: 1.5rem;
  color: var(--gitpulse-danger);
  font-size: 13px;
  text-align: center;
}

.repo-file-tree__empty {
  padding: 2rem;
  color: var(--gitpulse-text-muted);
  font-size: 13px;
  text-align: center;
}

.repo-file-tree__list {
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
  overflow: hidden;
}

.repo-file-tree__item {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 0;
  border-bottom: 1px solid var(--gitpulse-border);
  background: transparent;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background 0.1s ease;

  &:last-child {
    border-bottom: 0;
  }

  &:hover {
    background: var(--gitpulse-surface-hover);
  }
}

.repo-file-tree__item-icon {
  flex-shrink: 0;
}

.repo-file-tree__item-icon--dir {
  color: $brand-primary;
}

.repo-file-tree__item-icon--file {
  color: var(--gitpulse-text-muted);
}

.repo-file-tree__item-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
</style>
