import type { ComarkElement, ComarkNode, ComarkTree } from 'comark';

import {
  buildGitHubMentionUrl,
  GITHUB_MENTION_LOGIN_PATTERN,
} from '#shared/utils/markdown-mentions';

interface GitHubAutolinkContext {
  repoOwner?: string;
  repoName?: string;
}

interface GitHubAutolinkTarget {
  owner: string;
  repo: string;
  number: number;
  text: string;
}

interface GitHubAutolinkResolution {
  exists: boolean;
  href?: string;
}

interface GitHubIssueReferencePayload {
  html_url?: string;
}

interface CachedGitHubAutolinkResolution {
  promise: Promise<GitHubAutolinkResolution>;
  expiresAt: number;
}

type GitHubAutolinkMatch =
  | {
      kind: 'reference';
      prefix: string;
      start: number;
      end: number;
      matchedText: string;
      target: GitHubAutolinkTarget;
    }
  | {
      kind: 'mention';
      prefix: string;
      start: number;
      end: number;
      matchedText: string;
      href: string;
    };

const AUTOLINKABLE_TEXT_PARENT_TAGS = new Set([
  'p',
  'li',
  'blockquote',
  'em',
  'strong',
  'del',
  'td',
  'th',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
]);

const SKIPPED_TAGS = new Set(['a', 'code', 'pre']);

const REFERENCE_PATTERN =
  /(^|[^\w/])(?:(?<qualified>[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+#(?<qualifiedNumber>\d+))|(?<gh>GH-(?<ghNumber>\d+))|(?<short>#(?<shortNumber>\d+)))/g;

const MENTION_PATTERN = new RegExp(
  `(^|[^\\w/@])@(?<login>${GITHUB_MENTION_LOGIN_PATTERN})(?![A-Za-z0-9_-])`,
  'g'
);

const REFERENCE_CACHE_MAX_ENTRIES = 500;
const REFERENCE_CACHE_SUCCESS_TTL_MS = 30 * 60 * 1000;
const REFERENCE_CACHE_FAILURE_TTL_MS = 5 * 60 * 1000;

const referenceCache = new Map<string, CachedGitHubAutolinkResolution>();

function isTextNode(node: ComarkNode): node is string {
  return typeof node === 'string';
}

function isElementNode(node: ComarkNode): node is ComarkElement {
  return Array.isArray(node) && typeof node[0] === 'string';
}

function createLinkNode(href: string, text: string): ComarkElement {
  return ['a', { href }, text];
}

function shouldAutolinkInParent(parentTag?: string) {
  return !parentTag || AUTOLINKABLE_TEXT_PARENT_TAGS.has(parentTag);
}

function parseReferenceTarget(
  matchedText: string,
  context: GitHubAutolinkContext
): GitHubAutolinkTarget | null {
  const qualifiedMatch = matchedText.match(
    /^(?<owner>[A-Za-z0-9_.-]+)\/(?<repo>[A-Za-z0-9_.-]+)#(?<number>\d+)$/
  );

  if (qualifiedMatch?.groups?.owner && qualifiedMatch.groups.repo && qualifiedMatch.groups.number) {
    const number = Number.parseInt(qualifiedMatch.groups.number, 10);

    if (!Number.isSafeInteger(number) || number < 1) {
      return null;
    }

    return {
      owner: qualifiedMatch.groups.owner,
      repo: qualifiedMatch.groups.repo,
      number,
      text: matchedText,
    };
  }

  const shortMatch = matchedText.match(/^(?:GH-|#)(?<number>\d+)$/);
  if (!shortMatch?.groups?.number || !context.repoOwner || !context.repoName) {
    return null;
  }

  const number = Number.parseInt(shortMatch.groups.number, 10);
  if (!Number.isSafeInteger(number) || number < 1) {
    return null;
  }

  return {
    owner: context.repoOwner,
    repo: context.repoName,
    number,
    text: matchedText,
  };
}

function pruneExpiredReferenceCache(now = Date.now()) {
  for (const [cacheKey, cachedResolution] of referenceCache) {
    if (cachedResolution.expiresAt <= now) {
      referenceCache.delete(cacheKey);
    }
  }
}

function enforceReferenceCacheLimit() {
  while (referenceCache.size > REFERENCE_CACHE_MAX_ENTRIES) {
    const oldestCacheKey = referenceCache.keys().next().value;
    if (!oldestCacheKey) {
      return;
    }

    referenceCache.delete(oldestCacheKey);
  }
}

async function resolveReference(target: GitHubAutolinkTarget): Promise<GitHubAutolinkResolution> {
  const cacheKey = `${target.owner}/${target.repo}#${target.number}`;
  pruneExpiredReferenceCache();

  const cachedResolution = referenceCache.get(cacheKey);

  if (cachedResolution) {
    referenceCache.delete(cacheKey);
    referenceCache.set(cacheKey, cachedResolution);
    return cachedResolution.promise;
  }

  let resolvePending!: (value: GitHubAutolinkResolution) => void;
  const resolutionPromise = new Promise<GitHubAutolinkResolution>((resolve) => {
    resolvePending = resolve;
  });

  referenceCache.set(cacheKey, {
    promise: resolutionPromise,
    expiresAt: Date.now() + REFERENCE_CACHE_SUCCESS_TTL_MS,
  });
  enforceReferenceCacheLimit();

  const settleResolution = (resolution: GitHubAutolinkResolution, ttlMs: number) => {
    const cachedEntry = referenceCache.get(cacheKey);

    if (cachedEntry?.promise === resolutionPromise) {
      referenceCache.set(cacheKey, {
        promise: Promise.resolve(resolution),
        expiresAt: Date.now() + ttlMs,
      });
      enforceReferenceCacheLimit();
    }

    resolvePending(resolution);
  };

  void (async () => {
    try {
      const issue = await $fetch<GitHubIssueReferencePayload>(
        `/api/issues/${target.owner}/${target.repo}/${target.number}`,
        {
          method: 'GET',
        }
      );

      if (!issue?.html_url) {
        settleResolution({ exists: false }, REFERENCE_CACHE_FAILURE_TTL_MS);
        return;
      }

      settleResolution(
        {
          exists: true,
          href: issue.html_url,
        },
        REFERENCE_CACHE_SUCCESS_TTL_MS
      );
    } catch {
      settleResolution({ exists: false }, REFERENCE_CACHE_FAILURE_TTL_MS);
    }
  })();

  return resolutionPromise;
}

async function transformTextNode(
  node: string,
  context: GitHubAutolinkContext,
  parentTag?: string
): Promise<ComarkNode[]> {
  if (!node || !shouldAutolinkInParent(parentTag)) {
    return [node];
  }

  const matches: GitHubAutolinkMatch[] = [];

  REFERENCE_PATTERN.lastIndex = 0;
  MENTION_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null = null;
  while ((match = REFERENCE_PATTERN.exec(node)) !== null) {
    const prefix = match[1] ?? '';
    const matchedText = match[0].slice(prefix.length);
    const target = parseReferenceTarget(matchedText, context);

    if (!target) {
      continue;
    }

    const start = match.index + prefix.length;
    const end = match.index + match[0].length;

    matches.push({
      kind: 'reference',
      prefix,
      start,
      end,
      matchedText,
      target,
    });
  }

  while ((match = MENTION_PATTERN.exec(node)) !== null) {
    const prefix = match[1] ?? '';
    const login = match.groups?.login;

    if (!login) {
      continue;
    }

    const start = match.index + prefix.length;
    const end = match.index + match[0].length;

    matches.push({
      kind: 'mention',
      prefix,
      start,
      end,
      matchedText: `@${login}`,
      href: buildGitHubMentionUrl(login),
    });
  }

  if (matches.length === 0) {
    return [node];
  }

  const sortedMatches = matches.sort((first, second) => first.start - second.start);
  const resolutions = await Promise.all(
    sortedMatches.map((item) =>
      item.kind === 'reference'
        ? resolveReference(item.target)
        : Promise.resolve({ exists: true, href: item.href })
    )
  );
  const transformedNodes: ComarkNode[] = [];
  let cursor = 0;

  for (const [index, item] of sortedMatches.entries()) {
    if (item.start < cursor) {
      continue;
    }

    const resolution = resolutions[index];
    const prefixStart = item.start - item.prefix.length;

    if (prefixStart > cursor) {
      transformedNodes.push(node.slice(cursor, prefixStart));
    }

    if (item.prefix) {
      transformedNodes.push(item.prefix);
    }

    if (resolution?.exists && resolution.href) {
      transformedNodes.push(createLinkNode(resolution.href, item.matchedText));
    } else {
      transformedNodes.push(item.matchedText);
    }

    cursor = item.end;
  }

  if (cursor < node.length) {
    transformedNodes.push(node.slice(cursor));
  }

  return transformedNodes;
}

async function transformChildren(
  children: ComarkNode[],
  context: GitHubAutolinkContext,
  parentTag?: string
): Promise<ComarkNode[]> {
  const transformedChildren: ComarkNode[] = [];

  for (const child of children) {
    if (isTextNode(child)) {
      transformedChildren.push(...(await transformTextNode(child, context, parentTag)));
      continue;
    }

    if (!isElementNode(child)) {
      transformedChildren.push(child);
      continue;
    }

    const [tag, props, ...childNodes] = child;

    if (SKIPPED_TAGS.has(tag)) {
      transformedChildren.push(child);
      continue;
    }

    transformedChildren.push([tag, props, ...(await transformChildren(childNodes, context, tag))]);
  }

  return transformedChildren;
}

export default function useGitHubAutolinks() {
  const applyGitHubAutolinks = async (tree: ComarkTree, context: GitHubAutolinkContext) => {
    tree.nodes = await transformChildren(tree.nodes, context);
    return tree;
  };

  return {
    applyGitHubAutolinks,
  };
}
