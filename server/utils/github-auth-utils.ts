import { Octokit } from '@octokit/core';
import type { H3Event } from 'h3';

const GITHUB_API_VERSION = '2026-03-10';
const GITHUB_ACCEPT_HEADER = 'application/vnd.github+json';

export function createGitHubClient(accessToken: string): Octokit {
  return new Octokit({
    auth: accessToken,
    request: {
      headers: {
        'X-GitHub-Api-Version': GITHUB_API_VERSION,
        accept: GITHUB_ACCEPT_HEADER,
        'user-agent': 'gitpulse',
      },
    },
  });
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

export function hasGitHubErrorStatus(error: unknown, statusCode: number): boolean {
  return !!error && typeof error === 'object' && 'status' in error && error.status === statusCode;
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
