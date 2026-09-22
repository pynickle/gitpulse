import { describe, expect, test } from 'bun:test';

import type { PRReviewDiffRow } from '../shared/utils/pr-review-patch';
import {
  presentReviewBottomBar,
  presentUnifiedDiffLines,
  reduceReviewBottomBar,
  resolvePRReviewWorkspacePresentation,
  resolveReviewFileCount,
  resolveReviewKeyboardFrame,
  resolveReviewKeyboardInset,
  type PRReviewWorkspacePresentation,
  type ReviewBottomBarState,
} from '../shared/utils/pr-review-workspace-presentation';

const narrowWorkspace = {
  mode: 'narrow',
  diffArrangement: 'unified',
  showFileColumn: false,
  showSubmitColumn: false,
  wrapCode: false,
} satisfies PRReviewWorkspacePresentation;

const wideWorkspace = {
  mode: 'wide',
  diffArrangement: 'split',
  showFileColumn: true,
  showSubmitColumn: true,
  wrapCode: true,
} satisfies PRReviewWorkspacePresentation;

const diffRows: PRReviewDiffRow[] = [
  {
    key: 'hunk-1',
    type: 'hunk',
    content: '@@ -4,5 +4,5 @@',
    oldLineNumber: null,
    newLineNumber: null,
    position: null,
    isCommentable: false,
  },
  {
    key: 'kept',
    type: 'context',
    content: 'const kept = true;',
    oldLineNumber: 4,
    newLineNumber: 4,
    position: 1,
    isCommentable: true,
  },
  {
    key: 'added',
    type: 'add',
    content: 'const added = 1;',
    oldLineNumber: null,
    newLineNumber: 5,
    position: 2,
    isCommentable: true,
  },
  {
    key: 'removed',
    type: 'delete',
    content: 'const removed = 2;',
    oldLineNumber: 5,
    newLineNumber: null,
    position: 3,
    isCommentable: false,
  },
  {
    key: 'replaced',
    type: 'replace',
    content: 'const before = 3;',
    oldContent: 'const before = 3;',
    newContent: 'const after = 4;',
    oldLineNumber: 6,
    newLineNumber: 6,
    position: 5,
    isCommentable: true,
  },
  {
    key: 'locked-context',
    type: 'context',
    content: 'const locked = true;',
    oldLineNumber: 7,
    newLineNumber: 7,
    position: 6,
    isCommentable: false,
  },
  {
    key: 'locked-replace',
    type: 'replace',
    content: 'const oldLocked = 8;',
    oldContent: 'const oldLocked = 8;',
    newContent: 'const newLocked = 9;',
    oldLineNumber: 8,
    newLineNumber: 9,
    position: 8,
    isCommentable: false,
  },
];

describe('PR review workspace presentation', () => {
  test.each([
    { name: '1024px', viewportWidth: 1024, presentation: narrowWorkspace },
    { name: 'a 390px phone', viewportWidth: 390, presentation: narrowWorkspace },
    { name: '1025px', viewportWidth: 1025, presentation: wideWorkspace },
    { name: '1100px', viewportWidth: 1100, presentation: wideWorkspace },
    { name: '1101px', viewportWidth: 1101, presentation: wideWorkspace },
  ])('$name is $presentation.mode', ({ viewportWidth, presentation }) => {
    expect(resolvePRReviewWorkspacePresentation({ viewportWidth })).toEqual(presentation);
  });

  test('lays a patch out as one unified column', () => {
    expect(presentUnifiedDiffLines(diffRows)).toEqual([
      {
        key: 'hunk-1',
        sourceRowKey: 'hunk-1',
        kind: 'hunk',
        content: '@@ -4,5 +4,5 @@',
        oldLineNumber: null,
        newLineNumber: null,
        position: null,
        isCommentable: false,
      },
      {
        key: 'kept',
        sourceRowKey: 'kept',
        kind: 'context',
        content: 'const kept = true;',
        oldLineNumber: 4,
        newLineNumber: 4,
        position: 1,
        isCommentable: true,
      },
      {
        key: 'added',
        sourceRowKey: 'added',
        kind: 'add',
        content: 'const added = 1;',
        oldLineNumber: null,
        newLineNumber: 5,
        position: 2,
        isCommentable: true,
      },
      {
        key: 'removed',
        sourceRowKey: 'removed',
        kind: 'delete',
        content: 'const removed = 2;',
        oldLineNumber: 5,
        newLineNumber: null,
        position: 3,
        isCommentable: false,
      },
      {
        key: 'replaced:delete',
        sourceRowKey: 'replaced',
        kind: 'delete',
        content: 'const before = 3;',
        oldLineNumber: 6,
        newLineNumber: null,
        position: null,
        isCommentable: false,
      },
      {
        key: 'replaced:add',
        sourceRowKey: 'replaced',
        kind: 'add',
        content: 'const after = 4;',
        oldLineNumber: null,
        newLineNumber: 6,
        position: 5,
        isCommentable: true,
      },
      {
        key: 'locked-context',
        sourceRowKey: 'locked-context',
        kind: 'context',
        content: 'const locked = true;',
        oldLineNumber: 7,
        newLineNumber: 7,
        position: 6,
        isCommentable: false,
      },
      {
        key: 'locked-replace:delete',
        sourceRowKey: 'locked-replace',
        kind: 'delete',
        content: 'const oldLocked = 8;',
        oldLineNumber: 8,
        newLineNumber: null,
        position: null,
        isCommentable: false,
      },
      {
        key: 'locked-replace:add',
        sourceRowKey: 'locked-replace',
        kind: 'add',
        content: 'const newLocked = 9;',
        oldLineNumber: null,
        newLineNumber: 9,
        position: 8,
        isCommentable: false,
      },
    ]);
  });
});

const closedSheet: ReviewBottomBarState = { openSheet: null };

describe('Review Bottom Bar presentation', () => {
  test('toggling Files opens the Review File Sheet and toggling it again closes the sheet', () => {
    const opened = reduceReviewBottomBar(closedSheet, { type: 'toggle-files' });

    expect(opened).toEqual({ openSheet: 'files' });
    expect(reduceReviewBottomBar(opened, { type: 'toggle-files' })).toEqual(closedSheet);
  });

  test('toggling Review opens the Review Submit Sheet and closes the file sheet', () => {
    const filesOpen = reduceReviewBottomBar(closedSheet, { type: 'toggle-files' });
    const reviewOpen = reduceReviewBottomBar(filesOpen, { type: 'toggle-review' });

    expect(reviewOpen).toEqual({ openSheet: 'review' });
    expect(reduceReviewBottomBar(reviewOpen, { type: 'toggle-review' })).toEqual(closedSheet);
  });

  test('choosing a file closes the Review File Sheet', () => {
    const filesOpen = reduceReviewBottomBar(closedSheet, { type: 'toggle-files' });

    expect(reduceReviewBottomBar(filesOpen, { type: 'choose-file' })).toEqual(closedSheet);
  });

  test('the scrim closes the open sheet', () => {
    const reviewOpen = reduceReviewBottomBar(closedSheet, { type: 'toggle-review' });

    expect(reduceReviewBottomBar(reviewOpen, { type: 'scrim' })).toEqual(closedSheet);
  });

  test('crossing above 1024px closes the open sheet and hides the bar', () => {
    const filesOpen = reduceReviewBottomBar(closedSheet, { type: 'toggle-files' });

    expect(reduceReviewBottomBar(filesOpen, { type: 'enter-wide' })).toEqual(closedSheet);
    expect(
      presentReviewBottomBar({
        mode: 'wide',
        openSheet: 'files',
        keyboardOpen: false,
        inlineComposerOpen: false,
      })
    ).toEqual({
      openSheet: null,
      showBottomBar: false,
    });
  });

  test('the keyboard hides the bar and leaves the Review Submit Sheet open above it', () => {
    expect(
      presentReviewBottomBar({
        mode: 'narrow',
        openSheet: 'review',
        keyboardOpen: true,
        inlineComposerOpen: false,
      })
    ).toEqual({
      openSheet: 'review',
      showBottomBar: false,
    });
    expect(
      resolveReviewKeyboardInset({
        innerHeight: 800,
        visualViewportHeight: 430,
        visualViewportOffsetTop: 0,
        visualViewportScale: 1,
      })
    ).toBe(370);
    expect(
      resolveReviewKeyboardInset({
        innerHeight: 800,
        visualViewportHeight: 430,
        visualViewportOffsetTop: 20,
        visualViewportScale: 1,
      })
    ).toBe(350);
    expect(
      resolveReviewKeyboardFrame({
        innerHeight: 800,
        visualViewportHeight: 430,
        visualViewportOffsetTop: 20,
        visualViewportScale: 1,
      })
    ).toEqual({ insetPx: 350, visibleHeightPx: 430 });
    expect(
      resolveReviewKeyboardInset({
        innerHeight: 800,
        visualViewportHeight: 760,
        visualViewportOffsetTop: 0,
        visualViewportScale: 1,
      })
    ).toBe(0);
    expect(
      resolveReviewKeyboardInset({
        innerHeight: 800,
        visualViewportHeight: 400,
        visualViewportOffsetTop: 0,
        visualViewportScale: 2,
      })
    ).toBe(0);
  });

  test('an open Review Inline Composer hides the bar', () => {
    expect(
      presentReviewBottomBar({
        mode: 'narrow',
        openSheet: null,
        keyboardOpen: false,
        inlineComposerOpen: true,
      })
    ).toEqual({
      openSheet: null,
      showBottomBar: false,
    });
  });

  test('Files uses the pull request file count when more files exist than are loaded', () => {
    expect(resolveReviewFileCount({ loadedCount: 100, changedFiles: 150 })).toBe(150);
    expect(resolveReviewFileCount({ loadedCount: 12, changedFiles: null })).toBe(12);
    expect(resolveReviewFileCount({ loadedCount: 12, changedFiles: 8 })).toBe(12);
  });

  test('a narrow workspace with nothing else open shows the bar and no sheet', () => {
    expect(
      presentReviewBottomBar({
        mode: 'narrow',
        openSheet: null,
        keyboardOpen: false,
        inlineComposerOpen: false,
      })
    ).toEqual({
      openSheet: null,
      showBottomBar: true,
    });
  });
});
