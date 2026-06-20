export type GitHubSearchSyntaxNodeType =
  | 'term'
  | 'phrase'
  | 'regex'
  | 'qualifier'
  | 'operator'
  | 'group';

export interface GitHubSearchSyntaxDiagnostic {
  code:
    | 'unknown-qualifier'
    | 'unsupported-operator'
    | 'unclosed-quote'
    | 'unclosed-regex'
    | 'unmatched-close-paren'
    | 'unclosed-open-paren';
  message: string;
  start: number;
  end: number;
}

export interface GitHubSearchSyntaxHighlight {
  type:
    | 'term'
    | 'phrase'
    | 'regex'
    | 'qualifier'
    | 'qualifier-name'
    | 'qualifier-colon'
    | 'qualifier-value'
    | 'operator'
    | 'paren'
    | 'negation'
    | 'error';
  start: number;
  end: number;
}

export interface GitHubSearchSyntaxNode {
  type: GitHubSearchSyntaxNodeType;
  raw: string;
  value: string;
  start: number;
  end: number;
  name?: string;
  negated?: boolean;
  children?: GitHubSearchSyntaxNode[];
}

export interface GitHubSearchSyntaxAst {
  type: 'query';
  source: string;
  nodes: GitHubSearchSyntaxNode[];
  qualifiers: GitHubSearchSyntaxNode[];
  terms: GitHubSearchSyntaxNode[];
  diagnostics: GitHubSearchSyntaxDiagnostic[];
  highlights: GitHubSearchSyntaxHighlight[];
}

export const GITHUB_SEARCH_QUALIFIERS = [
  'archived',
  'assignee',
  'author',
  'author-date',
  'author-email',
  'author-name',
  'base',
  'closed',
  'color',
  'commenter',
  'comments',
  'committer',
  'committer-date',
  'committer-email',
  'committer-name',
  'content',
  'created',
  'description',
  'draft',
  'extension',
  'filename',
  'followers',
  'fork',
  'forks',
  'fullname',
  'good-first-issues',
  'hash',
  'head',
  'help-wanted-issues',
  'in',
  'interactions',
  'involves',
  'is',
  'label',
  'labels',
  'language',
  'linked',
  'license',
  'location',
  'merge',
  'mentions',
  'mirror',
  'merged',
  'milestone',
  'name',
  'no',
  'org',
  'parent',
  'path',
  'project',
  'pushed',
  'reactions',
  'reason',
  'repo',
  'repos',
  'repositories',
  'repository',
  'repository_id',
  'review',
  'review-requested',
  'reviewed-by',
  'size',
  'sort',
  'stars',
  'state',
  'status',
  'symbol',
  'team',
  'team-review-requested',
  'template',
  'topic',
  'topics',
  'tree',
  'type',
  'updated',
  'user',
  'user-review-requested',
] as const;

const QUALIFIERS = new Set<string>(GITHUB_SEARCH_QUALIFIERS);
const OPERATORS = new Set(['AND', 'OR', 'NOT']);

export interface ParseGitHubSearchSyntaxOptions {
  allowOperators?: boolean;
}

const isWhitespace = (char: string | undefined) => {
  return char === ' ' || char === '\n' || char === '\r' || char === '\t';
};

const isDelimiter = (char: string | undefined) => {
  return char === undefined || isWhitespace(char) || char === '(' || char === ')';
};

const pushErrorHighlight = (
  highlights: GitHubSearchSyntaxHighlight[],
  start: number,
  end: number
) => {
  highlights.push({ type: 'error', start, end: Math.max(start + 1, end) });
};

function readQuotedValue(source: string, start: number) {
  let index = start + 1;
  while (index < source.length) {
    if (source[index] === '\\') {
      index += 2;
      continue;
    }
    if (source[index] === '"') {
      return { value: source.slice(start + 1, index), end: index + 1, closed: true };
    }
    index++;
  }

  return { value: source.slice(start + 1), end: source.length, closed: false };
}

function readRegexValue(source: string, start: number) {
  let index = start + 1;
  while (index < source.length) {
    if (source[index] === '\\') {
      index += 2;
      continue;
    }
    if (source[index] === '/') {
      return { value: source.slice(start + 1, index), end: index + 1, closed: true };
    }
    index++;
  }

  return { value: source.slice(start + 1), end: source.length, closed: false };
}

function readBareValue(source: string, start: number) {
  let index = start;
  while (index < source.length && !isDelimiter(source[index])) {
    index++;
  }

  return { value: source.slice(start, index), end: index };
}

function readSearchValue(source: string, start: number) {
  if (source[start] === '"') {
    return { ...readQuotedValue(source, start), kind: 'phrase' as const };
  }
  if (source[start] === '/') {
    return { ...readRegexValue(source, start), kind: 'regex' as const };
  }
  return { ...readBareValue(source, start), kind: 'term' as const, closed: true };
}

function parseToken(source: string, start: number) {
  const tokenStart = start;
  const negated = source[start] === '-';
  let index = negated ? start + 1 : start;
  const nameStart = index;

  while (/[A-Za-z0-9_-]/.test(source[index] ?? '')) {
    index++;
  }

  const hasQualifierName = index > nameStart && source[index] === ':';
  if (hasQualifierName) {
    const name = source.slice(nameStart, index);
    const valueStart = index + 1;
    const parsedValue = readSearchValue(source, valueStart);
    const end = parsedValue.end;
    const raw = source.slice(tokenStart, end);
    const node: GitHubSearchSyntaxNode = {
      type: 'qualifier',
      raw,
      value: parsedValue.value,
      start: tokenStart,
      end,
      name,
      negated,
    };

    return { node, valueKind: parsedValue.kind, closed: parsedValue.closed };
  }

  const valueStart = tokenStart;
  const parsedValue = readSearchValue(source, valueStart);
  const raw = source.slice(valueStart, parsedValue.end);
  const operator = raw.toUpperCase();
  const node: GitHubSearchSyntaxNode = OPERATORS.has(operator)
    ? {
        type: 'operator',
        raw,
        value: operator,
        start: valueStart,
        end: parsedValue.end,
      }
    : {
        type: parsedValue.kind,
        raw,
        value: parsedValue.value,
        start: valueStart,
        end: parsedValue.end,
        negated,
      };

  return { node, valueKind: parsedValue.kind, closed: parsedValue.closed };
}

function createDiagnostic(
  code: GitHubSearchSyntaxDiagnostic['code'],
  start: number,
  end: number,
  message: string
): GitHubSearchSyntaxDiagnostic {
  return { code, start, end: Math.max(start + 1, end), message };
}

export function parseGitHubSearchSyntax(
  source: string,
  options: ParseGitHubSearchSyntaxOptions = {}
): GitHubSearchSyntaxAst {
  const nodes: GitHubSearchSyntaxNode[] = [];
  const groupStack: GitHubSearchSyntaxNode[] = [];
  const qualifiers: GitHubSearchSyntaxNode[] = [];
  const terms: GitHubSearchSyntaxNode[] = [];
  const diagnostics: GitHubSearchSyntaxDiagnostic[] = [];
  const highlights: GitHubSearchSyntaxHighlight[] = [];
  let index = 0;

  const appendNode = (node: GitHubSearchSyntaxNode) => {
    const parent = groupStack.at(-1);
    if (parent) {
      parent.children = [...(parent.children ?? []), node];
    } else {
      nodes.push(node);
    }
  };

  while (index < source.length) {
    const char = source[index];
    if (isWhitespace(char)) {
      index++;
      continue;
    }

    if (char === '(') {
      const group: GitHubSearchSyntaxNode = {
        type: 'group',
        raw: '(',
        value: '',
        start: index,
        end: index + 1,
        children: [],
      };
      appendNode(group);
      groupStack.push(group);
      highlights.push({ type: 'paren', start: index, end: index + 1 });
      if (!options.allowOperators) {
        diagnostics.push(
          createDiagnostic('unsupported-operator', index, index + 1, 'Unsupported operator: (')
        );
        pushErrorHighlight(highlights, index, index + 1);
      }
      index++;
      continue;
    }

    if (char === ')') {
      const group = groupStack.pop();
      highlights.push({ type: 'paren', start: index, end: index + 1 });
      if (!options.allowOperators) {
        diagnostics.push(
          createDiagnostic('unsupported-operator', index, index + 1, 'Unsupported operator: )')
        );
        pushErrorHighlight(highlights, index, index + 1);
      }
      if (group) {
        group.end = index + 1;
        group.raw = source.slice(group.start, group.end);
      } else {
        diagnostics.push(
          createDiagnostic(
            'unmatched-close-paren',
            index,
            index + 1,
            'Unmatched closing parenthesis'
          )
        );
        pushErrorHighlight(highlights, index, index + 1);
      }
      index++;
      continue;
    }

    const { node, valueKind, closed } = parseToken(source, index);
    appendNode(node);

    if (node.negated) {
      highlights.push({ type: 'negation', start: node.start, end: node.start + 1 });
    }

    if (node.type === 'qualifier') {
      qualifiers.push(node);
      const nameStart = node.negated ? node.start + 1 : node.start;
      const nameEnd = nameStart + (node.name?.length ?? 0);
      highlights.push({
        type: 'qualifier-name',
        start: nameStart,
        end: nameEnd,
      });
      highlights.push({
        type: 'qualifier-colon',
        start: nameEnd,
        end: nameEnd + 1,
      });
      highlights.push({
        type: 'qualifier-value',
        start: nameEnd + 1,
        end: node.end,
      });

      if (node.name && !QUALIFIERS.has(node.name)) {
        diagnostics.push(
          createDiagnostic(
            'unknown-qualifier',
            nameStart,
            nameEnd,
            `Unknown qualifier: ${node.name}`
          )
        );
        pushErrorHighlight(highlights, nameStart, nameEnd);
      }
    } else if (node.type === 'operator') {
      highlights.push({ type: 'operator', start: node.start, end: node.end });
      if (!options.allowOperators) {
        diagnostics.push(
          createDiagnostic(
            'unsupported-operator',
            node.start,
            node.end,
            `Unsupported operator: ${node.raw}`
          )
        );
        pushErrorHighlight(highlights, node.start, node.end);
      }
    } else if (node.type === 'term' || node.type === 'phrase' || node.type === 'regex') {
      terms.push(node);
      highlights.push({ type: node.type, start: node.start, end: node.end });
    }

    if (!closed) {
      const code = valueKind === 'regex' ? 'unclosed-regex' : 'unclosed-quote';
      diagnostics.push(
        createDiagnostic(
          code,
          node.start,
          node.end,
          code === 'unclosed-regex' ? 'Unclosed regular expression' : 'Unclosed quoted string'
        )
      );
      pushErrorHighlight(highlights, node.start, node.end);
    }

    index = Math.max(node.end, index + 1);
  }

  for (const group of groupStack) {
    diagnostics.push(
      createDiagnostic(
        'unclosed-open-paren',
        group.start,
        group.start + 1,
        'Unclosed opening parenthesis'
      )
    );
    pushErrorHighlight(highlights, group.start, group.start + 1);
  }

  return {
    type: 'query',
    source,
    nodes,
    qualifiers,
    terms,
    diagnostics,
    highlights,
  };
}

export const isKnownGitHubSearchQualifier = (value: string) => {
  return QUALIFIERS.has(value);
};

export const getFirstGitHubSearchQualifierValue = (
  ast: GitHubSearchSyntaxAst,
  qualifierName: string
) => {
  return ast.qualifiers.find((qualifier) => qualifier.name === qualifierName)?.value.trim() ?? '';
};

export const removeGitHubSearchQualifiers = (source: string, qualifierNames: string[]) => {
  const names = new Set(qualifierNames);
  const ranges = parseGitHubSearchSyntax(source)
    .qualifiers.filter((qualifier) => qualifier.name && names.has(qualifier.name))
    .map((qualifier) => ({ start: qualifier.start, end: qualifier.end }))
    .sort((left, right) => left.start - right.start);

  if (ranges.length === 0) {
    return source.trim();
  }

  let cursor = 0;
  let result = '';
  for (const range of ranges) {
    if (range.start < cursor) {
      continue;
    }
    result += source.slice(cursor, range.start);
    cursor = range.end;
  }

  result += source.slice(cursor);

  return result.trim().replace(/\s{2,}/g, ' ');
};

export const hasGitHubSearchSyntaxErrors = (
  source: string,
  options: ParseGitHubSearchSyntaxOptions = {}
) => {
  return parseGitHubSearchSyntax(source, options).diagnostics.length > 0;
};
