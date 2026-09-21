import type { PRReviewDiffRow } from './pr-review-patch';

/** Shared cutoff for the PR Review Workspace presentation and its layout. */
export const PR_REVIEW_WORKSPACE_NARROW_MAX_WIDTH = 1024;

export type PRReviewWorkspaceMode = 'narrow' | 'wide';
export type PRReviewDiffArrangement = 'unified' | 'split';

export interface PRReviewWorkspacePresentationInput {
  viewportWidth: number;
}

export interface PRReviewWorkspacePresentation {
  mode: PRReviewWorkspaceMode;
  diffArrangement: PRReviewDiffArrangement;
  showFileColumn: boolean;
  showSubmitColumn: boolean;
  wrapCode: boolean;
}

export interface UnifiedDiffLine {
  key: string;
  sourceRowKey: string;
  kind: 'hunk' | 'context' | 'add' | 'delete';
  content: string;
  oldLineNumber: number | null;
  newLineNumber: number | null;
  position: number | null;
  isCommentable: boolean;
}

const widePresentation = {
  mode: 'wide',
  diffArrangement: 'split',
  showFileColumn: true,
  showSubmitColumn: true,
  wrapCode: true,
} satisfies PRReviewWorkspacePresentation;

const narrowPresentation = {
  mode: 'narrow',
  diffArrangement: 'unified',
  showFileColumn: false,
  showSubmitColumn: false,
  wrapCode: false,
} satisfies PRReviewWorkspacePresentation;

export function resolvePRReviewWorkspacePresentation(
  input: PRReviewWorkspacePresentationInput
): PRReviewWorkspacePresentation {
  if (input.viewportWidth <= PR_REVIEW_WORKSPACE_NARROW_MAX_WIDTH) {
    return narrowPresentation;
  }

  return widePresentation;
}

const commentableUnifiedLine = (row: PRReviewDiffRow, newLineNumber: number | null) =>
  row.isCommentable && newLineNumber != null;

const unifiedLine = (
  row: PRReviewDiffRow,
  line: Omit<UnifiedDiffLine, 'sourceRowKey' | 'isCommentable'> & { newLineNumber: number | null }
): UnifiedDiffLine => ({
  ...line,
  sourceRowKey: row.key,
  isCommentable: commentableUnifiedLine(row, line.newLineNumber),
});

export function presentUnifiedDiffLines(rows: PRReviewDiffRow[]): UnifiedDiffLine[] {
  const lines: UnifiedDiffLine[] = [];

  for (const row of rows) {
    if (row.type === 'replace') {
      lines.push(
        unifiedLine(row, {
          key: `${row.key}:delete`,
          kind: 'delete',
          content: row.oldContent ?? row.content,
          oldLineNumber: row.oldLineNumber,
          newLineNumber: null,
          position: null,
        }),
        unifiedLine(row, {
          key: `${row.key}:add`,
          kind: 'add',
          content: row.newContent ?? row.content,
          oldLineNumber: null,
          newLineNumber: row.newLineNumber,
          position: row.position,
        })
      );
      continue;
    }

    if (row.type === 'delete') {
      lines.push(
        unifiedLine(row, {
          key: row.key,
          kind: 'delete',
          content: row.content,
          oldLineNumber: row.oldLineNumber,
          newLineNumber: null,
          position: row.position,
        })
      );
      continue;
    }

    if (row.type === 'add') {
      lines.push(
        unifiedLine(row, {
          key: row.key,
          kind: 'add',
          content: row.content,
          oldLineNumber: null,
          newLineNumber: row.newLineNumber,
          position: row.position,
        })
      );
      continue;
    }

    if (row.type === 'hunk') {
      lines.push(
        unifiedLine(row, {
          key: row.key,
          kind: 'hunk',
          content: row.content,
          oldLineNumber: null,
          newLineNumber: null,
          position: row.position,
        })
      );
      continue;
    }

    lines.push(
      unifiedLine(row, {
        key: row.key,
        kind: 'context',
        content: row.content,
        oldLineNumber: row.oldLineNumber,
        newLineNumber: row.newLineNumber,
        position: row.position,
      })
    );
  }

  return lines;
}

/**
 * Narrow layout rules for the PR Review Workspace.
 * `!important` wins over the scoped wide-layout display and code wrapping.
 */
export function buildPRReviewWorkspaceNarrowLayoutCss() {
  const maxWidth = PR_REVIEW_WORKSPACE_NARROW_MAX_WIDTH;

  return `
.pr-review-workspace .pr-review-diff-viewer__unified-line {
  display: none;
}

@media (max-width: ${maxWidth}px) {
  .pr-review-workspace .pr-review-workspace__grid {
    grid-template-columns: minmax(0, 1fr) !important;
  }

  .pr-review-workspace .pr-review-file-sidebar,
  .pr-review-workspace .pr-review-submit-bar {
    display: none !important;
  }

  .pr-review-workspace .pr-review-diff-viewer__split-row {
    display: none !important;
  }

  .pr-review-workspace .pr-review-diff-viewer__unified-line {
    display: flex !important;
  }

  .pr-review-workspace .pr-review-diff-viewer__body {
    overflow-x: hidden;
  }

  .pr-review-workspace .pr-review-diff-viewer__file-section {
    width: 100%;
    max-width: 100%;
  }

  .pr-review-workspace .pr-review-diff-viewer__rows {
    container-type: inline-size;
    width: 100%;
    max-width: 100%;
    overflow-x: auto;
    overflow-y: clip;
    scrollbar-width: thin;
  }

  /* One track per File Card, as wide as its longest line, so a short
     row still spans the scroll width. Sticky line numbers and the Hunk
     Header then stay in the visible column. */
  .pr-review-workspace .pr-review-diff-viewer__rows-track {
    width: max-content;
    min-width: 100%;
  }

  .pr-review-workspace .pr-review-diff-viewer__virtual-row,
  .pr-review-workspace .pr-review-diff-viewer__hunk-line,
  .pr-review-workspace .pr-review-diff-viewer__unified-line {
    width: auto !important;
    min-width: 100%;
    max-width: none;
  }

  .pr-review-workspace .pr-review-diff-viewer__hunk {
    position: sticky;
    left: 0;
    z-index: 1;
    box-sizing: border-box;
    width: 100cqi;
    min-width: 100cqi !important;
    max-width: 100cqi;
  }

  .pr-review-workspace .pr-review-diff-viewer__code {
    white-space: pre !important;
    overflow-wrap: normal !important;
    overflow: visible !important;
  }

  .pr-review-workspace .pr-review-inline-comment {
    position: sticky;
    left: 0;
    z-index: 1;
    width: 100cqi;
    max-width: 100cqi;
    box-sizing: border-box;
  }

  .pr-review-workspace .pr-review-diff-viewer__header {
    flex-wrap: nowrap;
    overflow: hidden;
  }

  .pr-review-workspace .pr-review-diff-viewer__header-info,
  .pr-review-workspace .pr-review-diff-viewer__file-title,
  .pr-review-workspace .pr-review-diff-viewer__file-link,
  .pr-review-workspace .pr-review-diff-viewer__file-label,
  .pr-review-workspace .pr-review-file-path {
    min-width: 0;
    max-width: 100%;
  }

  .pr-review-workspace .pr-review-diff-viewer__file-title,
  .pr-review-workspace .pr-review-diff-viewer__file-link,
  .pr-review-workspace .pr-review-diff-viewer__file-label,
  .pr-review-workspace .pr-review-file-path {
    display: flex;
    overflow: hidden;
  }

  .pr-review-workspace .pr-review-file-path__directory {
    flex: 0 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    direction: rtl;
  }

  .pr-review-workspace .pr-review-file-path__name,
  .pr-review-workspace .pr-review-diff-viewer__header-meta {
    flex: none;
    white-space: nowrap;
  }

  .pr-review-workspace .pr-review-diff-viewer__header-info p {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
`;
}
