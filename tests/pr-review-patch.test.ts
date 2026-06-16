import { describe, expect, test } from 'bun:test';

import { parsePRReviewPatch } from '../shared/utils/pr-review-patch';

describe('PR review patch parser', () => {
  test('parses hunk headers, replacements, additions, deletions, and context lines', () => {
    const rows = parsePRReviewPatch(
      [
        '@@ -10,4 +10,5 @@',
        ' const kept = true;',
        '-const oldName = 1;',
        '+const newName = 2;',
        '+const added = 3;',
        '-const removed = 4;',
        ' return kept;',
      ].join('\n')
    );

    expect(rows).toEqual([
      {
        key: 'hunk-0-@@ -10,4 +10,5 @@',
        type: 'hunk',
        content: '@@ -10,4 +10,5 @@',
        oldLineNumber: null,
        newLineNumber: null,
        position: null,
        isCommentable: false,
      },
      {
        key: 'context-10-1',
        type: 'context',
        content: 'const kept = true;',
        oldLineNumber: 10,
        newLineNumber: 10,
        position: 1,
        isCommentable: true,
      },
      {
        key: 'replace-11-11-3',
        type: 'replace',
        content: 'const oldName = 1;',
        oldContent: 'const oldName = 1;',
        newContent: 'const newName = 2;',
        oldLineNumber: 11,
        newLineNumber: 11,
        position: 3,
        isCommentable: true,
      },
      {
        key: 'replace-12-12-4',
        type: 'replace',
        content: 'const removed = 4;',
        oldContent: 'const removed = 4;',
        newContent: 'const added = 3;',
        oldLineNumber: 12,
        newLineNumber: 12,
        position: 4,
        isCommentable: true,
      },
      {
        key: 'context-13-6',
        type: 'context',
        content: 'return kept;',
        oldLineNumber: 13,
        newLineNumber: 13,
        position: 6,
        isCommentable: true,
      },
    ]);
  });

  test('returns no rows for missing patches', () => {
    expect(parsePRReviewPatch()).toEqual([]);
    expect(parsePRReviewPatch('')).toEqual([]);
  });
});
