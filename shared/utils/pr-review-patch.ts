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

const hunkHeaderPattern = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

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
