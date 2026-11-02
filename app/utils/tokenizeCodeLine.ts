export type CodeTokenKind =
  | 'plain'
  | 'keyword'
  | 'string'
  | 'number'
  | 'comment'
  | 'operator'
  | 'function'
  | 'property';

export interface CodeToken {
  key: string;
  text: string;
  kind: CodeTokenKind;
}

const languageByExtension: Record<string, string> = {
  bash: 'bash',
  cjs: 'javascript',
  css: 'css',
  go: 'go',
  h: 'c',
  html: 'html',
  java: 'java',
  js: 'javascript',
  json: 'json',
  jsx: 'javascript',
  kt: 'kotlin',
  md: 'markdown',
  mjs: 'javascript',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  scss: 'scss',
  sh: 'bash',
  sql: 'sql',
  ts: 'typescript',
  tsx: 'typescript',
  vue: 'vue',
  yaml: 'yaml',
  yml: 'yaml',
};

const keywordSet = new Set([
  'and',
  'as',
  'async',
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'def',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'from',
  'func',
  'function',
  'if',
  'import',
  'in',
  'interface',
  'is',
  'let',
  'match',
  'new',
  'nil',
  'not',
  'null',
  'or',
  'package',
  'private',
  'protected',
  'public',
  'return',
  'select',
  'static',
  'struct',
  'switch',
  'throw',
  'true',
  'try',
  'type',
  'undefined',
  'var',
  'where',
  'while',
  'with',
]);

const hashCommentLanguages = new Set(['bash', 'python', 'ruby', 'yaml']);
const tokenPattern =
  /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$-]*\b|[{}()[\].,;:+\-*/%=&|!<>?]+)/g;

const getFileLanguage = (filename: string) => {
  const extension = filename.split('.').pop()?.toLowerCase() ?? '';
  return languageByExtension[extension] ?? 'text';
};

const isInsideQuote = (content: string, targetIndex: number) => {
  let quote: '"' | "'" | '`' | null = null;
  let escaped = false;

  for (let index = 0; index < targetIndex; index += 1) {
    const character = content[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (character === '\\') {
      escaped = true;
      continue;
    }

    if (quote) {
      if (character === quote) {
        quote = null;
      }
      continue;
    }

    if (character === '"' || character === "'" || character === '`') {
      quote = character;
    }
  }

  return Boolean(quote);
};

const findCommentStart = (content: string, language: string) => {
  const trimmedContent = content.trimStart();

  if (
    trimmedContent.startsWith('/*') ||
    trimmedContent.startsWith('*') ||
    trimmedContent.startsWith('<!--')
  ) {
    return content.length - trimmedContent.length;
  }

  const slashCommentIndex = content.indexOf('//');
  if (slashCommentIndex >= 0 && !isInsideQuote(content, slashCommentIndex)) {
    return slashCommentIndex;
  }

  const hashCommentIndex = content.indexOf('#');
  if (
    hashCommentLanguages.has(language) &&
    hashCommentIndex >= 0 &&
    !isInsideQuote(content, hashCommentIndex)
  ) {
    return hashCommentIndex;
  }

  return -1;
};

const getTokenKind = (content: string, match: string, index: number): CodeTokenKind => {
  if (/^["'`]/.test(match)) return 'string';
  if (/^\d/.test(match)) return 'number';
  if (/^[{}()[\].,;:+\-*/%=&|!<>?]+$/.test(match)) return 'operator';
  if (keywordSet.has(match)) return 'keyword';

  const nextCharacter = content.slice(index + match.length).trimStart()[0];
  if (nextCharacter === '(') return 'function';
  if (content[index - 1] === '.') return 'property';

  return 'plain';
};

export function tokenizeCodeLine(content: string, filename: string): CodeToken[] {
  const language = getFileLanguage(filename);
  const commentStart = findCommentStart(content, language);
  const codeContent = commentStart >= 0 ? content.slice(0, commentStart) : content;
  const commentContent = commentStart >= 0 ? content.slice(commentStart) : '';
  const tokens: CodeToken[] = [];
  let cursor = 0;

  for (const match of codeContent.matchAll(tokenPattern)) {
    const index = match.index ?? 0;
    const text = match[0];

    if (index > cursor) {
      tokens.push({
        key: `plain-${cursor}`,
        text: codeContent.slice(cursor, index),
        kind: 'plain',
      });
    }

    const kind = getTokenKind(codeContent, text, index);
    tokens.push({ key: `${kind}-${index}`, text, kind });
    cursor = index + text.length;
  }

  if (cursor < codeContent.length) {
    tokens.push({ key: `plain-${cursor}`, text: codeContent.slice(cursor), kind: 'plain' });
  }

  if (commentContent) {
    tokens.push({ key: `comment-${commentStart}`, text: commentContent, kind: 'comment' });
  }

  return tokens.length ? tokens : [{ key: 'plain-0', text: content, kind: 'plain' }];
}
