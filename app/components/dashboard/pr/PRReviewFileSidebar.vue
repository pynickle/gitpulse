<script setup lang="ts">
import {
  ChevronRightIcon,
  FileIcon,
  FilesIcon,
  FolderIcon,
  ListIcon,
  NetworkIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
} from 'lucide-vue-next';
import { computed, ref } from 'vue';

import type { PRReviewDraftComment, PRReviewFile } from '~/composables/usePRReview';

type FileViewMode = 'list' | 'tree';

interface FileTreeNode {
  name: string;
  path: string;
  type: 'directory' | 'file';
  children: FileTreeNode[];
  file?: PRReviewFile;
}

interface VisibleTreeRow {
  node: FileTreeNode;
  depth: number;
  label: string;
  collapsePath: string;
}

const props = defineProps<{
  files: PRReviewFile[];
  activeFilename: string;
  draftComments: PRReviewDraftComment[];
  loadingMore: boolean;
  hasMoreFiles: boolean;
  viewMode: FileViewMode;
  collapsed: boolean;
}>();

const emit = defineEmits<{
  (e: 'select-file', filename: string): void;
  (e: 'load-more'): void;
  (e: 'update:view-mode', viewMode: FileViewMode): void;
  (e: 'update:collapsed', collapsed: boolean): void;
}>();

const { t } = useI18n();
const collapsedDirectories = ref(new Set<string>());

const draftCountsByFile = computed(() => {
  const counts = new Map<string, number>();

  for (const comment of props.draftComments) {
    counts.set(comment.path, (counts.get(comment.path) ?? 0) + 1);
  }

  return counts;
});

const getDraftCount = (filename: string) => draftCountsByFile.value.get(filename) ?? 0;

const sortedFiles = computed(() =>
  [...props.files].sort((first, second) => first.filename.localeCompare(second.filename))
);

/** Files in the same depth-first tree-traversal order as the tree view.
 *  Directories come before files within each level, then alphabetical.
 *  This keeps list-view and tree-view top-to-bottom order consistent. */
const treeOrderedFiles = computed(() => {
  const result: PRReviewFile[] = [];

  const visit = (nodes: FileTreeNode[]) => {
    for (const node of nodes) {
      if (node.type === 'file' && node.file) {
        result.push(node.file);
      } else {
        visit(node.children);
      }
    }
  };

  visit(treeNodes.value);
  return result;
});

const treeNodes = computed(() => {
  const root: FileTreeNode[] = [];
  const directories = new Map<string, FileTreeNode>();

  for (const file of sortedFiles.value) {
    const parts = file.filename.split('/');
    let children = root;
    let path = '';

    for (const [index, part] of parts.entries()) {
      path = path ? `${path}/${part}` : part;
      const isFile = index === parts.length - 1;

      if (isFile) {
        children.push({ name: part, path, type: 'file', children: [], file });
        continue;
      }

      let directory = directories.get(path);

      if (!directory) {
        directory = { name: part, path, type: 'directory', children: [] };
        directories.set(path, directory);
        children.push(directory);
      }

      children = directory.children;
    }
  }

  const sortNodes = (nodes: FileTreeNode[]) => {
    nodes.sort((first, second) => {
      if (first.type !== second.type) return first.type === 'directory' ? -1 : 1;
      return first.name.localeCompare(second.name);
    });

    for (const node of nodes) {
      sortNodes(node.children);
    }
  };

  sortNodes(root);
  return root;
});

const countFiles = (node: FileTreeNode): number =>
  node.type === 'file' ? 1 : node.children.reduce((total, child) => total + countFiles(child), 0);

const visibleTreeRows = computed(() => {
  const rows: VisibleTreeRow[] = [];

  const visit = (nodes: FileTreeNode[], depth: number) => {
    for (const node of nodes) {
      let visibleNode = node;
      const labelParts = [node.name];

      while (
        visibleNode.type === 'directory' &&
        visibleNode.children.length === 1 &&
        visibleNode.children[0]?.type === 'directory'
      ) {
        visibleNode = visibleNode.children[0];
        labelParts.push(visibleNode.name);
      }

      const collapsePath = visibleNode.path;
      rows.push({ node: visibleNode, depth, label: labelParts.join('/'), collapsePath });

      if (visibleNode.type === 'directory' && !isDirectoryCollapsed(collapsePath)) {
        visit(visibleNode.children, depth + 1);
      }
    }
  };

  visit(treeNodes.value, 0);
  return rows;
});

const isDirectoryCollapsed = (path: string) => collapsedDirectories.value.has(path);

const toggleDirectory = (path: string) => {
  const nextCollapsed = new Set(collapsedDirectories.value);

  if (nextCollapsed.has(path)) {
    nextCollapsed.delete(path);
  } else {
    nextCollapsed.add(path);
  }

  collapsedDirectories.value = nextCollapsed;
};

const statusClass = (status: string) => `pr-review-file-sidebar__status--${status}`;

const statusLabel = (status: string) => status.slice(0, 1).toUpperCase();
</script>

<template>
  <aside :class="['pr-review-file-sidebar', { 'pr-review-file-sidebar--collapsed': collapsed }]">
    <button
      v-if="collapsed"
      type="button"
      class="pr-review-file-sidebar__collapsed-handle"
      :aria-label="t('prReview.expandFileSidebar')"
      :title="t('prReview.expandFileSidebar')"
      @click="emit('update:collapsed', false)"
    >
      <PanelLeftOpenIcon :size="16" aria-hidden="true" />
      <strong>{{ files.length }}</strong>
    </button>

    <template v-else>
      <div class="pr-review-file-sidebar__header">
        <h2 class="title is-6 mb-1">{{ t('prReview.files') }}</h2>
        <div class="pr-review-file-sidebar__header-actions">
          <div
            class="pr-review-file-sidebar__view-toggle"
            role="group"
            :aria-label="t('prReview.fileViewMode')"
          >
            <button
              type="button"
              :class="[
                'pr-review-file-sidebar__toggle-button',
                { 'pr-review-file-sidebar__toggle-button--active': viewMode === 'tree' },
              ]"
              :aria-pressed="viewMode === 'tree'"
              :aria-label="t('prReview.treeView')"
              :title="t('prReview.treeView')"
              @click="emit('update:view-mode', 'tree')"
            >
              <NetworkIcon :size="14" aria-hidden="true" />
            </button>
            <button
              type="button"
              :class="[
                'pr-review-file-sidebar__toggle-button',
                { 'pr-review-file-sidebar__toggle-button--active': viewMode === 'list' },
              ]"
              :aria-pressed="viewMode === 'list'"
              :aria-label="t('prReview.listView')"
              :title="t('prReview.listView')"
              @click="emit('update:view-mode', 'list')"
            >
              <ListIcon :size="14" aria-hidden="true" />
            </button>
          </div>
          <button
            type="button"
            class="pr-review-file-sidebar__collapse-button"
            :aria-label="t('prReview.collapseFileSidebar')"
            :title="t('prReview.collapseFileSidebar')"
            @click="emit('update:collapsed', true)"
          >
            <PanelLeftCloseIcon :size="14" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div class="pr-review-file-sidebar__subheader">
        <FilesIcon :size="13" aria-hidden="true" />
        <span>{{ t('prReview.filesCount', { count: files.length }) }}</span>
      </div>

      <div v-if="files.length && viewMode === 'list'" class="pr-review-file-sidebar__list">
        <button
          v-for="file in treeOrderedFiles"
          :key="file.filename"
          type="button"
          :class="[
            'pr-review-file-sidebar__item',
            { 'pr-review-file-sidebar__item--active': file.filename === activeFilename },
          ]"
          @click="emit('select-file', file.filename)"
        >
          <span :class="['pr-review-file-sidebar__status', statusClass(file.status)]">
            {{ statusLabel(file.status) }}
          </span>
          <span class="pr-review-file-sidebar__name">{{ file.filename }}</span>
          <span class="pr-review-file-sidebar__meta">
            <span class="has-text-success">+{{ file.additions }}</span>
            <span class="has-text-danger">-{{ file.deletions }}</span>
            <span v-if="getDraftCount(file.filename)" class="tag is-warning is-light">
              {{ getDraftCount(file.filename) }}
            </span>
          </span>
        </button>
      </div>

      <div v-else-if="files.length" class="pr-review-file-sidebar__tree">
        <template v-for="row in visibleTreeRows" :key="row.node.path">
          <div v-if="row.node.type === 'directory'" class="pr-review-file-sidebar__tree-group">
            <button
              type="button"
              class="pr-review-file-sidebar__tree-directory"
              :style="{ paddingLeft: `${0.45 + row.depth * 0.9}rem` }"
              :aria-expanded="!isDirectoryCollapsed(row.collapsePath)"
              :aria-label="
                isDirectoryCollapsed(row.collapsePath)
                  ? t('prReview.expandDirectory', { name: row.label })
                  : t('prReview.collapseDirectory', { name: row.label })
              "
              :title="row.label"
              @click="toggleDirectory(row.collapsePath)"
            >
              <ChevronRightIcon
                :size="14"
                :class="[
                  'pr-review-file-sidebar__tree-chevron',
                  {
                    'pr-review-file-sidebar__tree-chevron--expanded': !isDirectoryCollapsed(
                      row.collapsePath
                    ),
                  },
                ]"
                aria-hidden="true"
              />
              <FolderIcon :size="14" aria-hidden="true" />
              <span class="pr-review-file-sidebar__tree-label">{{ row.label }}</span>
              <span class="pr-review-file-sidebar__tree-count">{{ countFiles(row.node) }}</span>
            </button>
          </div>

          <button
            v-else-if="row.node.file"
            type="button"
            :class="[
              'pr-review-file-sidebar__tree-file',
              {
                'pr-review-file-sidebar__tree-file--active':
                  row.node.file.filename === activeFilename,
              },
            ]"
            :style="{ paddingLeft: `${1.2 + row.depth * 0.9}rem` }"
            :aria-current="row.node.file.filename === activeFilename ? 'true' : undefined"
            @click="emit('select-file', row.node.file.filename)"
          >
            <FileIcon :size="14" aria-hidden="true" />
            <span class="pr-review-file-sidebar__tree-label">{{ row.node.name }}</span>
            <span :class="['pr-review-file-sidebar__status', statusClass(row.node.file.status)]">
              {{ statusLabel(row.node.file.status) }}
            </span>
            <span
              v-if="getDraftCount(row.node.file.filename)"
              class="pr-review-file-sidebar__draft-dot"
            ></span>
          </button>
        </template>
      </div>

      <button
        v-if="hasMoreFiles"
        type="button"
        class="button is-small is-fullwidth is-light mt-3"
        :class="{ 'is-loading': loadingMore }"
        :disabled="loadingMore"
        @click="emit('load-more')"
      >
        {{ t('prReview.loadMoreFiles') }}
      </button>
    </template>
  </aside>
</template>

<style scoped lang="scss">
.pr-review-file-sidebar {
  height: 100%;
  min-width: 0;
  border-right: 1px solid var(--gitpulse-border);
  background: var(--gitpulse-surface-muted);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.pr-review-file-sidebar--collapsed {
  background: var(--gitpulse-surface);
}

.pr-review-file-sidebar__collapsed-handle {
  width: 100%;
  height: 100%;
  border: 0;
  background: transparent;
  color: var(--gitpulse-text-muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  cursor: pointer;
}

.pr-review-file-sidebar__collapsed-handle:hover {
  background: var(--gitpulse-info-soft);
  color: var(--gitpulse-info);
}

.pr-review-file-sidebar__collapsed-handle strong {
  width: 1.45rem;
  height: 1.45rem;
  border-radius: 50%;
  background: var(--gitpulse-surface-muted);
  color: var(--gitpulse-text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.72rem;
}

.pr-review-file-sidebar__header {
  min-height: 2.5rem;
  padding: 0.45rem 0.6rem;
  border-bottom: 1px solid var(--gitpulse-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.pr-review-file-sidebar__header .title {
  font-size: 0.82rem;
}

.pr-review-file-sidebar__subheader {
  min-height: 2rem;
  padding: 0 0.7rem;
  border-bottom: 1px solid var(--gitpulse-border);
  color: var(--gitpulse-text-muted);
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.72rem;
  font-weight: 700;
}

.pr-review-file-sidebar__view-toggle {
  padding: 0.12rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 999px;
  background: var(--gitpulse-surface);
  display: flex;
}

.pr-review-file-sidebar__header-actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.pr-review-file-sidebar__collapse-button {
  width: 1.75rem;
  height: 1.75rem;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--gitpulse-text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.pr-review-file-sidebar__collapse-button:hover {
  background: var(--gitpulse-surface-hover);
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
}

.pr-review-file-sidebar__toggle-button {
  width: 1.75rem;
  height: 1.45rem;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--gitpulse-text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.pr-review-file-sidebar__toggle-button--active {
  background: var(--gitpulse-info);
  color: #ffffff;
}

.pr-review-file-sidebar__list,
.pr-review-file-sidebar__tree {
  overflow-y: auto;
  flex: 1;
  padding: 0.35rem;
}

.pr-review-file-sidebar__item {
  width: 100%;
  min-height: 2.5rem;
  border: 0;
  border-left: 3px solid transparent;
  border-radius: 5px;
  background: transparent;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0 0.45rem;
  text-align: left;
}

.pr-review-file-sidebar__item:hover,
.pr-review-file-sidebar__item--active {
  background: var(--gitpulse-info-soft);
  border-left-color: var(--gitpulse-info);
}

.pr-review-file-sidebar__name {
  min-width: 0;
  flex: 1;
  font-family:
    ui-monospace,
    SFMono-Regular,
    SF Mono,
    Consolas,
    Liberation Mono,
    Menlo,
    monospace;
  font-size: 0.75rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pr-review-file-sidebar__meta {
  flex: none;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem;
  font-size: 0.75rem;
}

.pr-review-file-sidebar__status {
  width: 1.15rem;
  height: 1.15rem;
  border-radius: 50%;
  background: var(--gitpulse-text-subtle);
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  font-size: 0.58rem;
  font-weight: 800;
}

.pr-review-file-sidebar__status--added {
  background: var(--gitpulse-success-soft);
  color: var(--gitpulse-success);
}

.pr-review-file-sidebar__status--removed {
  background: var(--gitpulse-danger-soft);
  color: var(--gitpulse-danger);
}

.pr-review-file-sidebar__status--modified,
.pr-review-file-sidebar__status--changed {
  background: var(--gitpulse-warning-soft);
  color: var(--gitpulse-warning);
}

.pr-review-file-sidebar__status--renamed {
  background: var(--gitpulse-purple);
}

.pr-review-file-sidebar__tree-directory,
.pr-review-file-sidebar__tree-file {
  width: 100%;
  min-height: 2rem;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0 0.45rem;
  text-align: left;
  cursor: pointer;
}

.pr-review-file-sidebar__tree-file {
  min-height: 2.15rem;
  margin-top: 0.08rem;
  border-left: 3px solid transparent;
}

.pr-review-file-sidebar__tree-group + .pr-review-file-sidebar__tree-group,
.pr-review-file-sidebar__tree-file + .pr-review-file-sidebar__tree-group {
  margin-top: 0.15rem;
}

.pr-review-file-sidebar__tree-chevron {
  transition: transform 0.15s ease;
}

.pr-review-file-sidebar__tree-directory:hover,
.pr-review-file-sidebar__tree-file:hover,
.pr-review-file-sidebar__tree-file--active {
  background: var(--gitpulse-info-soft);
}

.pr-review-file-sidebar__tree-file--active {
  border-left-color: var(--gitpulse-info);
  font-weight: 700;
}

.pr-review-file-sidebar__tree-chevron--expanded {
  transform: rotate(90deg);
}

.pr-review-file-sidebar__tree-label {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.75rem;
}

.pr-review-file-sidebar__tree-count {
  color: var(--gitpulse-text-muted);
  font-size: 0.68rem;
  font-weight: 700;
}

.pr-review-file-sidebar__draft-dot {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
  background: var(--gitpulse-warning);
  flex: none;
}
</style>
