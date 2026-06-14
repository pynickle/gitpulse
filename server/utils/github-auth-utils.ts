import { createHash } from 'node:crypto';

import { Octokit } from '@octokit/core';
import type { H3Event } from 'h3';

const GITHUB_API_VERSION = '2026-03-10';
const GITHUB_ACCEPT_HEADER = 'application/vnd.github+json';

export function createGitHubClient(accessToken: string): Octokit {
  const octokit = new Octokit({
    auth: accessToken,
    userAgent: 'gitpulse',
  });

  octokit.hook.before('request', (options) => {
    options.headers = {
      ...options.headers,
      accept: GITHUB_ACCEPT_HEADER,
      'x-github-api-version': GITHUB_API_VERSION,
    };
  });

  return octokit;
}

export async function getAccessToken(event: H3Event): Promise<string> {
  const session = await getUserSession(event);
  const accessToken = session.secure?.access_token;

  if (!accessToken) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Access token not found in session',
    });
  }

  return accessToken;
}

export async function getGitHubClient(event: H3Event): Promise<Octokit> {
  const accessToken = await getAccessToken(event);

  return createGitHubClient(accessToken);
}

function getAccessTokenCacheKey(accessToken: string) {
  return createHash('sha256').update(accessToken).digest('hex');
}

export async function getGitHubRequestContext(event: H3Event): Promise<{
  accessTokenCacheKey: string;
  octokit: Octokit;
}> {
  const accessToken = await getAccessToken(event);

  return {
    accessTokenCacheKey: getAccessTokenCacheKey(accessToken),
    octokit: createGitHubClient(accessToken),
  };
}

export async function getGitHubSessionContext(event: H3Event): Promise<{
  accessTokenCacheKey: string;
  octokit: Octokit;
  userLogin: string;
}> {
  const session = await getUserSession(event);
  const accessToken = session.secure?.access_token;
  const userLogin = session.user?.login?.trim();

  if (!accessToken) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Access token not found in session',
    });
  }

  if (!userLogin) {
    throw createError({
      statusCode: 401,
      statusMessage: 'GitHub user login not found in session',
    });
  }

  return {
    accessTokenCacheKey: getAccessTokenCacheKey(accessToken),
    octokit: createGitHubClient(accessToken),
    userLogin,
  };
}

export function hasGitHubErrorStatus(error: unknown, statusCode: number): boolean {
  return getGitHubErrorStatusCode(error) === statusCode;
}

export function getGitHubErrorStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== 'object' || !('status' in error)) {
    return undefined;
  }

  return typeof error.status === 'number' ? error.status : undefined;
}

export function getGitHubErrorMessage(error: unknown, fallbackStatusMessage: string): string {
  if (!error || typeof error !== 'object' || !('message' in error)) {
    return fallbackStatusMessage;
  }

  return typeof error.message === 'string' && error.message ? error.message : fallbackStatusMessage;
}

export function throwGitHubRouteError(error: unknown, fallbackStatusMessage: string): never {
  if (error && typeof error === 'object') {
    const statusCode =
      'statusCode' in error && typeof error.statusCode === 'number'
        ? error.statusCode
        : 'status' in error && typeof error.status === 'number'
          ? error.status
          : null;

    if (statusCode) {
      const statusMessage =
        'statusMessage' in error && typeof error.statusMessage === 'string'
          ? error.statusMessage
          : 'message' in error && typeof error.message === 'string'
            ? error.message
            : fallbackStatusMessage;

      throw createError({
        statusCode,
        statusMessage,
      });
    }
  }

  throw createError({
    statusCode: 500,
    statusMessage: fallbackStatusMessage,
  });
}
