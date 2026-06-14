import type { H3Event } from 'h3';

import {
  throwGitHubRouteError,
  getGitHubClient,
  getGitHubRequestContext,
} from './github-auth-utils';
import { parsePaginationNumber } from './github-pagination';

/**
 * Extract and validate repository owner and repo name from route params.
 */
export function extractRepoParams(event: H3Event): { owner: string; repo: string } {
  const { owner, repo } = event.context.params as { owner?: string; repo?: string };

  if (!owner || !repo) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required parameters: owner and repo',
    });
  }

  return { owner, repo };
}

/**
 * Extract and validate issue number from route params.
 */
export function extractIssueNumber(event: H3Event): number {
  const { issue_number } = event.context.params as { issue_number?: string };
  const issueNumber = parsePaginationNumber(issue_number, 0);

  if (issueNumber < 1) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid issue number',
    });
  }

  return issueNumber;
}

/**
 * Extract and validate pull request number from route params.
 */
export function extractPullNumber(event: H3Event): number {
  const { pull_number } = event.context.params as { pull_number?: string };
  const pullNumber = parsePaginationNumber(pull_number, 0);

  if (pullNumber < 1) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid pull request number',
    });
  }

  return pullNumber;
}

/**
 * Extract and validate discussion number from route params.
 */
export function extractDiscussionNumber(event: H3Event): number {
  const { discussion_number } = event.context.params as { discussion_number?: string };
  const discussionNumber = parsePaginationNumber(discussion_number, 0);

  if (discussionNumber < 1) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid discussion number',
    });
  }

  return discussionNumber;
}

/**
 * Extract repo params + issue number together.
 */
export function extractIssueRouteParams(event: H3Event) {
  return {
    ...extractRepoParams(event),
    issueNumber: extractIssueNumber(event),
  };
}

/**
 * Extract repo params + pull number together.
 */
export function extractPullRouteParams(event: H3Event) {
  return {
    ...extractRepoParams(event),
    pullNumber: extractPullNumber(event),
  };
}

/**
 * Extract repo params + discussion number together.
 */
export function extractDiscussionRouteParams(event: H3Event) {
  return {
    ...extractRepoParams(event),
    discussionNumber: extractDiscussionNumber(event),
  };
}

export function getStringQueryParam(value: unknown) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return typeof rawValue === 'string' && rawValue ? rawValue : undefined;
}

/**
 * Normalize and validate a request body as JSON object.
 * Returns null if body is missing/null, throws if invalid type.
 */
export function normalizeRequestBody<T>(body: unknown, requiredKeys?: (keyof T)[]): T | null {
  if (body === undefined || body === null) {
    if (requiredKeys?.length) {
      throw createError({
        statusCode: 400,
        statusMessage: `Missing required body field: ${requiredKeys[0] as string}`,
      });
    }
    return null;
  }

  if (typeof body !== 'object' || Array.isArray(body)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request body: expected object',
    });
  }

  return body as T;
}

/**
 * Validate string field is non-empty after trim.
 */
export function validateRequiredString(value: unknown, fieldName: string): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';

  if (!trimmed) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldName} is required`,
    });
  }

  return trimmed;
}

/**
 * Execute a GitHub API request with error handling.
 * Wraps the request in a try-catch and translates GitHub errors.
 */
export async function executeGitHubRequest<T>(
  event: H3Event,
  requestFn: (octokit: Awaited<ReturnType<typeof getGitHubClient>>) => Promise<T>,
  errorMessage: string
): Promise<T> {
  try {
    const octokit = await getGitHubClient(event);
    return await requestFn(octokit);
  } catch (error: unknown) {
    console.error(errorMessage, error);
    throwGitHubRouteError(error, errorMessage);
  }
}

/**
 * Execute a GitHub API request that needs the opaque token-derived cache scope.
 */
export async function executeGitHubRequestWithContext<T>(
  event: H3Event,
  requestFn: (
    octokit: Awaited<ReturnType<typeof getGitHubRequestContext>>['octokit'],
    context: Awaited<ReturnType<typeof getGitHubRequestContext>>
  ) => Promise<T>,
  errorMessage: string
): Promise<T> {
  try {
    const context = await getGitHubRequestContext(event);
    return await requestFn(context.octokit, context);
  } catch (error: unknown) {
    console.error(errorMessage, error);
    throwGitHubRouteError(error, errorMessage);
  }
}
