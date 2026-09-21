import { describe, expect, test } from 'bun:test';

import type { PRReviewDiffRow } from '../shared/utils/pr-review-patch';
import {
  presentUnifiedDiffLines,
  resolvePRReviewWorkspacePresentation,
  type PRReviewWorkspacePresentation,
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
