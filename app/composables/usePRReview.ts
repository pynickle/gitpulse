import { computed, ref, shallowRef, watch } from 'vue';

import getFetchErrorMessage from '~/utils/getFetchErrorMessage';

/** Temporary tree node used for computing the depth-first tree ordering. */
interface SortTreeNode {
  name: string;
  path: string;
  type: 'directory' | 'file';
  children: SortTreeNode[];
  file?: PRReviewFile;
}

/**
 * Returns files in depth-first tree order (directories first, alphabetical within
 * each group). This matches the sidebar's tree/list view ordering so that the
 * diff viewer (middle section) stays consistent with the sidebar.
 */
function sortFilesByTreeOrder(files: PRReviewFile[]): PRReviewFile[] {
  const sorted = [...files].sort((a, b) => a.filename.localeCompare(b.filename));
  const root: SortTreeNode[] = [];
  const directories = new Map<string, SortTreeNode>();

  for (const file of sorted) {
    const parts = file.filename.split('/');
    let children = root;
    let path = '';

    for (const [index, part] of parts.entries()) {
      path = path ? `${path}/${part}` : part;
      const isFile = index === parts.length - 1;

      if (isFile) {
        children.push({ name: part, path, type: 'file', children: [], file });
        break;
      }

      let dir = directories.get(path);
      if (!dir) {
        dir = { name: part, path, type: 'directory', children: [] };
        directories.set(path, dir);
        children.push(dir);
      }
      children = dir.children;
    }
  }

  const sortNodes = (nodes: SortTreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const n of nodes) sortNodes(n.children);
  };

  sortNodes(root);

  const result: PRReviewFile[] = [];
  const visit = (nodes: SortTreeNode[]) => {
    for (const n of nodes) {
      if (n.type === 'file' && n.file) result.push(n.file);
      else visit(n.children);
    }
  };
  visit(root);
  return result;
}

export type PRReviewEvent = 'APPROVE' | 'COMMENT' | 'REQUEST_CHANGES';

export interface PRReviewFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  sha?: string;
  blob_url?: string;
  raw_url?: string;
  contents_url?: string;
  previous_filename?: string;
}

export interface PRReviewPagination {
  page: number;
  perPage: number;
  hasPrev: boolean;
  hasNext: boolean;
  totalCount: number | null;
  totalPages: number | null;
}

export interface PRReviewDiffRow {
  key: string;
  type: 'hunk' | 'context' | 'add' | 'delete' | 'replace';
  content: string;
  oldContent?: string;
  newContent?: string;
  oldLineNumber: number | null;
  newLineNumber: number | null;
  position: number | null;
  isCommentable: boolean;
}

export interface PRReviewDraftComment {
  id: string;
  path: string;
  line: number;
  position: number;
  body: string;
}

export interface PRReviewCommentAuthor {
  login?: string;
  avatarUrl?: string;
  url?: string;
}

export interface PRReviewComment {
  id: string;
  pullRequestReviewId?: string;
  inReplyToId?: string;
  body: string;
  path: string;
  url?: string;
  diffHunk?: string;
  position?: number | null;
  originalPosition?: number | null;
  startLine?: number | null;
  originalStartLine?: number | null;
  line?: number | null;
  originalLine?: number | null;
  startSide?: string | null;
  side?: string | null;
  createdAt?: string;
  updatedAt?: string;
  author?: PRReviewCommentAuthor;
}

interface PRReviewThreadBuildIndex {
  validLines: Set<number>;
  lineByPosition: Map<number, number>;
}

export interface PRReviewDiffSection {
  file: PRReviewFile;
  rows: PRReviewDiffRow[];
}

export interface PRReviewCommentThread {
  id: string;
  path: string;
  lineKey: string;
  line: number;
  comments: PRReviewComment[];
}

interface PullFilesResponse {
  items?: PRReviewFile[];
  pagination?: PRReviewPagination;
}

interface PullReviewCommentsResponse {
  items?: PRReviewComment[];
}

interface UsePRReviewOptions {
  owner: () => string;
  repo: () => string;
  pullNumber: () => number;
  commitId: () => string;
  messages: {
    loadFailed: string;
    submitFailed: string;
  };
  onSubmitted?: () => void;
}

const defaultPagination = (): PRReviewPagination => ({
  page: 1,
  perPage: 100,
  hasPrev: false,
  hasNext: false,
  totalCount: null,
  totalPages: null,
});

const hunkHeaderPattern = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

const isPositiveLine = (line: number | null | undefined): line is number =>
  typeof line === 'number' && line > 0;

const getReviewCommentPreferredLine = (comment: PRReviewComment) => {
  if (isPositiveLine(comment.originalStartLine) && isPositiveLine(comment.originalLine)) {
    return comment.originalLine;
  }

  return comment.originalLine ?? comment.line ?? null;
};

const resolveReviewCommentLine = (
  comment: PRReviewComment,
  buildIndex: PRReviewThreadBuildIndex
) => {
  const preferredLine = getReviewCommentPreferredLine(comment);

  if (isPositiveLine(preferredLine) && buildIndex.validLines.has(preferredLine)) {
    return preferredLine;
  }

  if (isPositiveLine(comment.line) && buildIndex.validLines.has(comment.line)) {
    return comment.line;
  }

  return isPositiveLine(comment.position)
    ? (buildIndex.lineByPosition.get(comment.position) ?? null)
    : null;
};

export function parsePRReviewPatch(patch?: string): PRReviewDiffRow[] {
  if (!patch) {
    return [];
  }

  const rows: PRReviewDiffRow[] = [];
  const pendingDeletes: Array<{
    content: string;
    lineNumber: number;
    position: number;
  }> = [];
  const pendingAdds: Array<{
    content: string;
    lineNumber: number;
    position: number;
  }> = [];
  let oldLine = 0;
  let newLine = 0;
  let position = 0;

  const lines = patch.split('\n');

  const flushPendingChanges = () => {
    while (pendingDeletes.length > 0 && pendingAdds.length > 0) {
      const removed = pendingDeletes.shift();
      const added = pendingAdds.shift();

      if (!removed || !added) {
        break;
      }

      rows.push({
        key: `replace-${removed.lineNumber}-${added.lineNumber}-${added.position}`,
        type: 'replace',
        content: removed.content,
        oldContent: removed.content,
        newContent: added.content,
        oldLineNumber: removed.lineNumber,
        newLineNumber: added.lineNumber,
        position: added.position,
        isCommentable: true,
      });
    }

    for (const removed of pendingDeletes) {
      rows.push({
        key: `old-${removed.lineNumber}-${removed.position}`,
        type: 'delete',
        content: removed.content,
        oldLineNumber: removed.lineNumber,
        newLineNumber: null,
        position: removed.position,
        isCommentable: false,
      });
    }

    for (const added of pendingAdds) {
      rows.push({
        key: `new-${added.lineNumber}-${added.position}`,
        type: 'add',
        content: added.content,
        oldLineNumber: null,
        newLineNumber: added.lineNumber,
        position: added.position,
        isCommentable: true,
      });
    }

    pendingDeletes.length = 0;
    pendingAdds.length = 0;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index] ?? '';
    const hunkMatch = rawLine.match(hunkHeaderPattern);

    if (hunkMatch) {
      flushPendingChanges();

      if (rows.length > 0) {
        position += 1;
      }

      oldLine = Number.parseInt(hunkMatch[1] ?? '0', 10);
      newLine = Number.parseInt(hunkMatch[2] ?? '0', 10);
      rows.push({
        key: `hunk-${rows.length}-${rawLine}`,
        type: 'hunk',
        content: rawLine,
        oldLineNumber: null,
        newLineNumber: null,
        position: rows.length > 0 ? position : null,
        isCommentable: false,
      });
      continue;
    }

    if (rawLine.startsWith('-')) {
      position += 1;
      pendingDeletes.push({
        content: rawLine.slice(1),
        lineNumber: oldLine,
        position,
      });
      oldLine += 1;
      continue;
    }

    if (rawLine.startsWith('+')) {
      position += 1;
      pendingAdds.push({
        content: rawLine.slice(1),
        lineNumber: newLine,
        position,
      });
      newLine += 1;
      continue;
    }

    flushPendingChanges();

    position += 1;
    rows.push({
      key: `context-${newLine}-${position}`,
      type: 'context',
      content: rawLine.startsWith(' ') ? rawLine.slice(1) : rawLine,
      oldLineNumber: oldLine,
      newLineNumber: newLine,
      position,
      isCommentable: true,
    });
    oldLine += 1;
    newLine += 1;
  }

  flushPendingChanges();

  return rows;
}

export function usePRReview(options: UsePRReviewOptions) {
  const files = ref<PRReviewFile[]>([]);
  const activeFilename = shallowRef('');
  const pagination = ref(defaultPagination());
  const loading = shallowRef(false);
  const loadingMore = shallowRef(false);
  const submitting = shallowRef(false);
  const errorMessage = shallowRef('');
  const submitError = shallowRef('');
  const draftBody = shallowRef('');
  const selectedEvent = shallowRef<PRReviewEvent>('COMMENT');
  const draftComments = ref<PRReviewDraftComment[]>([]);
  const reviewComments = ref<PRReviewComment[]>([]);
  const activeDraftTarget = ref<{ path: string; line: number } | null>(null);
  const requestId = shallowRef(0);

  const identity = computed(() => ({
    owner: options.owner(),
    repo: options.repo(),
    pullNumber: options.pullNumber(),
    commitId: options.commitId(),
  }));

  const selectedFile = computed(
    () =>
      files.value.find((file) => file.filename === activeFilename.value) ?? files.value[0] ?? null
  );

  const selectedDiffRows = computed(() => parsePRReviewPatch(selectedFile.value?.patch));

  const allDiffSections = computed<PRReviewDiffSection[]>(() =>
    sortFilesByTreeOrder(files.value).map((file) => ({
      file,
      rows: parsePRReviewPatch(file.patch),
    }))
  );

  const reviewCommentThreads = computed<PRReviewCommentThread[]>(() => {
    const threads: PRReviewCommentThread[] = [];
    const commentsByFile = new Map<string, PRReviewComment[]>();

    for (const comment of reviewComments.value) {
      if (!comment.path) {
        continue;
      }

      const nextComments = commentsByFile.get(comment.path) ?? [];
      nextComments.push(comment);
      commentsByFile.set(comment.path, nextComments);
    }

    const compareComments = (first: PRReviewComment, second: PRReviewComment) => {
      const firstDate = Date.parse(first.createdAt ?? '') || 0;
      const secondDate = Date.parse(second.createdAt ?? '') || 0;
      if (firstDate !== secondDate) {
        return firstDate - secondDate;
      }

      return (first.id ?? '').localeCompare(second.id ?? '');
    };

    const sortedFiles = sortFilesByTreeOrder(files.value).map((file) => file.filename);

    const fileBuildIndexes = new Map<string, PRReviewThreadBuildIndex>();

    for (const section of allDiffSections.value) {
      const validLines = new Set<number>();
      const lineByPosition = new Map<number, number>();

      for (const row of section.rows) {
        if (isPositiveLine(row.newLineNumber)) {
          validLines.add(row.newLineNumber);
        }

        if (isPositiveLine(row.position) && isPositiveLine(row.newLineNumber)) {
          lineByPosition.set(row.position, row.newLineNumber);
        }
      }

      fileBuildIndexes.set(section.file.filename, { validLines, lineByPosition });
    }

    for (const path of sortedFiles) {
      const comments = (commentsByFile.get(path) ?? []).sort(compareComments);
      const buildIndex = fileBuildIndexes.get(path) ?? {
        validLines: new Set<number>(),
        lineByPosition: new Map<number, number>(),
      };
      const threadsById = new Map<string, PRReviewCommentThread>();
      const threadByCommentId = new Map<string, PRReviewCommentThread>();

      for (const comment of comments) {
        const line = resolveReviewCommentLine(comment, buildIndex);
        if (!line) {
          continue;
        }

        const lineKey = `${path}:${line}`;
        const isRightSide = comment.side !== 'LEFT' && comment.startSide !== 'LEFT';
        const parentThread = comment.inReplyToId
          ? threadByCommentId.get(comment.inReplyToId)
          : undefined;

        if (parentThread) {
          parentThread.comments.push(comment);
          threadByCommentId.set(comment.id, parentThread);
          continue;
        }

        if (!isRightSide) {
          continue;
        }

        const thread: PRReviewCommentThread = {
          id: comment.id,
          path,
          lineKey,
          line,
          comments: [comment],
        };

        threadsById.set(comment.id, thread);
        threadByCommentId.set(comment.id, thread);
      }

      for (const thread of threadsById.values()) {
        threads.push(thread);
      }
    }

    return threads.sort((first, second) => {
      if (first.path !== second.path) {
        return first.path.localeCompare(second.path);
      }

      if (first.line !== second.line) {
        return first.line - second.line;
      }

      const firstDate = Date.parse(first.comments[0]?.createdAt ?? '') || 0;
      const secondDate = Date.parse(second.comments[0]?.createdAt ?? '') || 0;
      return firstDate - secondDate;
    });
  });

  const pendingCommentCount = computed(() => draftComments.value.length);

  const canLoad = computed(() =>
    Boolean(identity.value.owner && identity.value.repo && identity.value.pullNumber)
  );

  const canSubmit = computed(() => {
    if (!identity.value.commitId || submitting.value) {
      return false;
    }

    if (selectedEvent.value === 'REQUEST_CHANGES') {
      return Boolean(draftBody.value.trim());
    }

    if (selectedEvent.value === 'COMMENT') {
      return Boolean(draftBody.value.trim());
    }

    return true;
  });

  const resetDrafts = () => {
    draftBody.value = '';
    selectedEvent.value = 'COMMENT';
    draftComments.value = [];
    activeDraftTarget.value = null;
    submitError.value = '';
  };

  const resetFiles = () => {
    files.value = [];
    activeFilename.value = '';
    pagination.value = defaultPagination();
    errorMessage.value = '';
  };

  const loadFiles = async (page = 1) => {
    if (!canLoad.value) {
      resetFiles();
      return;
    }

    const currentRequestId = requestId.value + 1;
    requestId.value = currentRequestId;
    const isFirstPage = page === 1;

    if (isFirstPage) {
      loading.value = true;
      errorMessage.value = '';
    } else {
      loadingMore.value = true;
    }

    try {
      const { owner, repo, pullNumber } = identity.value;
      const response = await $fetch<PullFilesResponse>(
        `/api/pulls/${owner}/${repo}/${pullNumber}/files`,
        {
          method: 'GET',
          query: { page, per_page: 100 },
        }
      );
      const reviewCommentResponse = isFirstPage
        ? await $fetch<PullReviewCommentsResponse>(
            `/api/pulls/${owner}/${repo}/${pullNumber}/comments`,
            {
              method: 'GET',
            }
          )
        : null;

      if (currentRequestId !== requestId.value) {
        return;
      }

      const nextFiles = response.items ?? [];
      files.value = isFirstPage ? nextFiles : [...files.value, ...nextFiles];
      reviewComments.value = isFirstPage
        ? (reviewCommentResponse?.items ?? [])
        : reviewComments.value;
      pagination.value = response.pagination ?? defaultPagination();

      if (!activeFilename.value && files.value[0]) {
        activeFilename.value = files.value[0].filename;
      }
    } catch (error: unknown) {
      if (currentRequestId === requestId.value) {
        errorMessage.value = getFetchErrorMessage(error, options.messages.loadFailed);
        if (isFirstPage) {
          files.value = [];
        }
      }
    } finally {
      if (currentRequestId === requestId.value) {
        loading.value = false;
        loadingMore.value = false;
      }
    }
  };

  const retryLoad = () => loadFiles(1);

  const loadMoreFiles = () => {
    if (!pagination.value.hasNext || loadingMore.value) {
      return;
    }

    loadFiles(pagination.value.page + 1);
  };

  const selectFile = (filename: string) => {
    if (activeFilename.value === filename) {
      return;
    }

    activeFilename.value = filename;
    activeDraftTarget.value = null;
  };

  const syncVisibleFile = (filename: string) => {
    if (activeFilename.value === filename) {
      return;
    }

    activeFilename.value = filename;
  };

  const openDraftEditor = (path: string, line: number) => {
    activeDraftTarget.value = { path, line };
  };

  const closeDraftEditor = () => {
    activeDraftTarget.value = null;
  };

  const saveDraftComment = (path: string, line: number, position: number, body: string) => {
    const trimmedBody = body.trim();

    if (!trimmedBody || position < 1) {
      return;
    }

    const existingIndex = draftComments.value.findIndex(
      (comment) => comment.path === path && comment.line === line
    );

    const nextDraft = {
      id: `${path}:${line}`,
      path,
      line,
      position,
      body: trimmedBody,
    };

    if (existingIndex >= 0) {
      draftComments.value.splice(existingIndex, 1, nextDraft);
    } else {
      draftComments.value.push(nextDraft);
    }

    activeDraftTarget.value = null;
  };

  const removeDraftComment = (id: string) => {
    draftComments.value = draftComments.value.filter((comment) => comment.id !== id);
  };

  const submitReview = async () => {
    submitError.value = '';

    if (!canSubmit.value) {
      return;
    }

    submitting.value = true;

    try {
      const { owner, repo, pullNumber, commitId } = identity.value;
      await $fetch(`/api/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`, {
        method: 'POST',
        body: {
          commitId,
          event: selectedEvent.value,
          body: draftBody.value.trim(),
          comments: draftComments.value.map((comment) => ({
            path: comment.path,
            position: comment.position,
            body: comment.body,
          })),
        },
      });

      resetDrafts();
      options.onSubmitted?.();
    } catch (error: unknown) {
      submitError.value = getFetchErrorMessage(error, options.messages.submitFailed);
    } finally {
      submitting.value = false;
    }
  };

  watch(
    () => [
      identity.value.owner,
      identity.value.repo,
      identity.value.pullNumber,
      identity.value.commitId,
    ],
    () => {
      requestId.value += 1;
      resetFiles();
      resetDrafts();
      loadFiles(1);
    },
    { immediate: true }
  );

  return {
    files,
    reviewComments,
    activeFilename,
    pagination,
    loading,
    loadingMore,
    submitting,
    errorMessage,
    submitError,
    draftBody,
    selectedEvent,
    draftComments,
    activeDraftTarget,
    selectedFile,
    selectedDiffRows,
    allDiffSections,
    reviewCommentThreads,
    pendingCommentCount,
    canSubmit,
    loadMoreFiles,
    retryLoad,
    selectFile,
    syncVisibleFile,
    openDraftEditor,
    closeDraftEditor,
    saveDraftComment,
    removeDraftComment,
    submitReview,
  };
}
