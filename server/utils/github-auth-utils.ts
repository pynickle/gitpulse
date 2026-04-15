import { Octokit } from '@octokit/core';
import { paginateGraphQL, type paginateGraphQLInterface } from '@octokit/plugin-paginate-graphql';
import type { H3Event } from 'h3';

const GITHUB_API_VERSION = '2026-03-10';
const GITHUB_ACCEPT_HEADER = 'application/vnd.github+json';

export function createGitHubClient(accessToken: string): Octokit & paginateGraphQLInterface {
  const MyOctokit = Octokit.plugin(paginateGraphQL);

  return new MyOctokit({
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

export async function getGitHubClient(event: H3Event): Promise<Octokit & paginateGraphQLInterface> {
  const accessToken = await getAccessToken(event);

  return createGitHubClient(accessToken);
}
