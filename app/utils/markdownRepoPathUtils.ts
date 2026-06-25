import type { ComputedRef, InjectionKey } from 'vue';
import type { LocationQueryRaw } from 'vue-router';

import { isGitHubRawHost, isGitHubWebHost } from './githubUrlUtils';

export interface MarkdownRepoContext {
  owner?: string;
  repo?: string;
  basePath?: string;
  branch?: string;
}

export interface MarkdownRepoResource {
  owner: string;
  repo: string;
  path: string;
  branch?: string;
  hash?: string;
  view?: 'blob' | 'tree';
}

const PATH_SUFFIX_PATTERN = /[?#]/;
const GITHUB_FILE_KINDS = new Set(['blob', 'tree', 'raw']);
const SAFE_RESOURCE_PROTOCOLS = new Set(['http:', 'https:']);

export const markdownRepoContextKey: InjectionKey<ComputedRef<MarkdownRepoContext>> =
  Symbol('markdown-repo-context');

function decodePathSegment(segment: string) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function getPathSegments(path?: string | null) {
  return (path || '').split('/').filter(Boolean).map(decodePathSegment);
}

function normalizeSegments(segments: string[]) {
  const resolvedSegments: string[] = [];

  for (const segment of segments) {
    if (!segment || segment === '.') {
      continue;
    }

    if (segment === '..') {
      resolvedSegments.pop();
      continue;
    }

    resolvedSegments.push(segment);
  }

  return resolvedSegments.join('/');
}

function normalizePath(path?: string | null) {
  return normalizeSegments(getPathSegments(path));
}

function normalizeBranch(branch?: string | null) {
  const trimmed = branch?.trim();
  return trimmed || undefined;
}

function getDirectoryPath(path?: string | null) {
  const normalizedPath = normalizePath(path);
  const segments = normalizedPath.split('/').filter(Boolean);

  if (segments.length <= 1) {
    return '';
  }

  segments.pop();
  return segments.join('/');
}

function resolveRelativePath(path: string, basePath?: string) {
  if (path.startsWith('/')) {
    return normalizePath(path);
  }

  return normalizeSegments([
    ...getPathSegments(getDirectoryPath(basePath)),
    ...getPathSegments(path),
  ]);
}

function trimResourceSuffix(value: string) {
  const suffixIndex = value.search(PATH_SUFFIX_PATTERN);

  if (suffixIndex === -1) {
    return { path: value, hash: undefined };
  }

  const suffix = value.slice(suffixIndex);
  const hashIndex = suffix.indexOf('#');

  return {
    path: value.slice(0, suffixIndex),
    hash: hashIndex >= 0 ? suffix.slice(hashIndex) : undefined,
  };
}

function isUnsafePath(value: string) {
  return !value || value.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(value);
}

function getContextBranchMatch(
  segments: string[],
  owner: string,
  repo: string,
  context: MarkdownRepoContext
) {
  const contextBranchSegments = getPathSegments(context.branch);

  if (
    !context.owner ||
    !context.repo ||
    !context.branch ||
    context.owner.toLowerCase() !== owner.toLowerCase() ||
    context.repo.toLowerCase() !== repo.toLowerCase() ||
    contextBranchSegments.length === 0 ||
    contextBranchSegments.length >= segments.length
  ) {
    return null;
  }

  const matchesContextBranch = contextBranchSegments.every(
    (segment, index) => segments[index] === segment
  );

  if (!matchesContextBranch) {
    return null;
  }

  return {
    branch: context.branch,
    pathSegments: segments.slice(contextBranchSegments.length),
  };
}

function splitGitHubRefAndPath(
  segments: string[],
  owner: string,
  repo: string,
  context: MarkdownRepoContext
) {
  const contextMatch = getContextBranchMatch(segments, owner, repo, context);
  if (contextMatch) return contextMatch;

  const [branch, ...pathSegments] = segments;
  if (!branch || pathSegments.length === 0) return null;

  return { branch, pathSegments };
}

function createGitHubResource(
  owner: string | undefined,
  repo: string | undefined,
  segments: string[],
  hash: string | undefined,
  context: MarkdownRepoContext,
  view?: MarkdownRepoResource['view']
): MarkdownRepoResource | null {
  if (!owner || !repo) {
    return null;
  }

  const refAndPath = splitGitHubRefAndPath(segments, owner, repo, context);
  if (!refAndPath) return null;

  const resource: MarkdownRepoResource = {
    owner,
    repo,
    branch: refAndPath.branch,
    hash,
    path: normalizeSegments(refAndPath.pathSegments),
  };

  if (view) {
    resource.view = view;
  }

  return resource;
}

function parseGitHubWebPath(url: URL, context: MarkdownRepoContext): MarkdownRepoResource | null {
  if (!isGitHubWebHost(url.hostname)) {
    return null;
  }

  const segments = getPathSegments(url.pathname);
  const [owner, repo, kind, ...refAndPathSegments] = segments;

  if (!owner || !repo || !kind || !GITHUB_FILE_KINDS.has(kind) || refAndPathSegments.length < 2) {
    return null;
  }

  return createGitHubResource(
    owner,
    repo,
    refAndPathSegments,
    url.hash || undefined,
    context,
    kind === 'tree' ? 'tree' : undefined
  );
}

function parseGitHubRawPath(url: URL, context: MarkdownRepoContext): MarkdownRepoResource | null {
  if (!isGitHubRawHost(url.hostname)) {
    return null;
  }

  const segments = getPathSegments(url.pathname);
  const [owner, repo, ...refAndPathSegments] = segments;

  if (!owner || !repo || refAndPathSegments.length < 2) {
    return null;
  }

  return createGitHubResource(owner, repo, refAndPathSegments, url.hash || undefined, context);
}

function resolveContextPath(path: string, context: MarkdownRepoContext) {
  if (path.startsWith('/')) {
    return normalizePath(path);
  }

  return resolveRelativePath(path, context.basePath);
}

function parseRelativeGitHubPath(
  path: string,
  hash: string | undefined,
  context: MarkdownRepoContext
): MarkdownRepoResource | null {
  const segments = getPathSegments(path);
  const kindIndex = segments.findIndex((segment) => GITHUB_FILE_KINDS.has(segment));

  if (kindIndex > 0) {
    const prefixSegments = segments.slice(0, kindIndex);
    const parentTraversalCount = prefixSegments.filter((segment) => segment === '..').length;
    const repoSegments = prefixSegments.filter((segment) => segment !== '..' && segment !== '.');
    const refAndPathSegments = segments.slice(kindIndex + 1);

    if (parentTraversalCount === 1 && repoSegments.length === 0 && refAndPathSegments.length >= 2) {
      return createGitHubResource(
        context.owner,
        context.repo,
        refAndPathSegments,
        hash,
        context,
        segments[kindIndex] === 'tree' ? 'tree' : undefined
      );
    }

    if (parentTraversalCount >= 3 && repoSegments.length >= 2 && refAndPathSegments.length >= 2) {
      const owner = repoSegments[repoSegments.length - 2];
      const repo = repoSegments[repoSegments.length - 1];

      return createGitHubResource(
        owner,
        repo,
        refAndPathSegments,
        hash,
        context,
        segments[kindIndex] === 'tree' ? 'tree' : undefined
      );
    }
  }

  if (path.startsWith('/../') && context.owner && context.repo && segments.length >= 3) {
    const [, branch, ...pathSegments] = segments;

    return {
      owner: context.owner,
      repo: context.repo,
      branch,
      hash,
      path: normalizeSegments(pathSegments),
    };
  }

  return null;
}

export function isSafeMarkdownResourceUrl(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return false;
  }

  if (trimmedValue.startsWith('//')) {
    return true;
  }

  try {
    const url = new URL(trimmedValue);
    return SAFE_RESOURCE_PROTOCOLS.has(url.protocol);
  } catch {
    return !/^[a-z][a-z\d+.-]*:/i.test(trimmedValue);
  }
}

export function parseMarkdownRepoResource(
  value: string | null | undefined,
  context: MarkdownRepoContext = {}
): MarkdownRepoResource | null {
  const rawValue = value?.trim();

  if (!rawValue || rawValue.startsWith('#')) {
    return null;
  }

  try {
    const url = new URL(rawValue);
    return parseGitHubWebPath(url, context) ?? parseGitHubRawPath(url, context);
  } catch {
    // Continue with repository-local path parsing below.
  }

  const { path, hash } = trimResourceSuffix(rawValue);
  const githubResource = parseRelativeGitHubPath(path, hash, context);
  if (githubResource) return githubResource;

  if (isUnsafePath(path)) {
    return null;
  }

  const branch = normalizeBranch(context.branch);

  if (context.owner && context.repo) {
    return {
      owner: context.owner,
      repo: context.repo,
      branch,
      hash,
      path: resolveContextPath(path, context),
    };
  }

  return null;
}

export function buildRepoFileDashboardQuery(resource: MarkdownRepoResource): LocationQueryRaw {
  return {
    repo: `${resource.owner}/${resource.repo}`,
    path: resource.path,
    branch: resource.branch,
  };
}

export function buildRepoRawFileUrl(resource: MarkdownRepoResource) {
  const encodedPath = resource.path.split('/').map(encodeURIComponent).join('/');
  const searchParams = new URLSearchParams();

  if (resource.branch) {
    searchParams.set('ref', resource.branch);
  }

  const query = searchParams.toString();

  return `/api/repos/${encodeURIComponent(resource.owner)}/${encodeURIComponent(
    resource.repo
  )}/raw/${encodedPath}${query ? `?${query}` : ''}`;
}

export function resolveMarkdownRepoSrcset(
  value: string | null | undefined,
  context: MarkdownRepoContext,
  resolveResourceUrl: (resource: MarkdownRepoResource) => string
) {
  if (!value) {
    return undefined;
  }

  return value
    .split(',')
    .flatMap((candidate) => {
      const trimmedCandidate = candidate.trim();
      const [candidateUrl, ...descriptorParts] = trimmedCandidate.split(/\s+/);

      if (!candidateUrl) {
        return [];
      }

      const resource = parseMarkdownRepoResource(candidateUrl, context);
      const resolvedUrl = resource
        ? resolveResourceUrl(resource)
        : isSafeMarkdownResourceUrl(candidateUrl)
          ? candidateUrl
          : '';

      if (!resolvedUrl) {
        return [];
      }

      return [resolvedUrl, ...descriptorParts].filter(Boolean).join(' ');
    })
    .join(', ');
}
