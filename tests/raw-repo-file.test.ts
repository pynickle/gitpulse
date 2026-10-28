import { describe, expect, mock, test } from 'bun:test';
import { Buffer } from 'node:buffer';

import {
  createApp,
  createError,
  createRouter,
  defineEventHandler,
  getQuery,
  setHeader,
  toWebHandler,
} from 'h3';

import * as repoContentsUtils from '../server/utils/repo-contents-utils';
import * as repoRouteUtils from '../server/utils/repo-route-utils';

const autoImports = globalThis as unknown as {
  defineEventHandler: typeof defineEventHandler;
  getQuery: typeof getQuery;
  createError: typeof createError;
  setHeader: typeof setHeader;
};
autoImports.defineEventHandler = defineEventHandler;
autoImports.getQuery = getQuery;
autoImports.createError = createError;
autoImports.setHeader = setHeader;

const fileBytes = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
  'utf8'
);

let requested: { owner: string; repo: string; path: string; ref?: string } | undefined;

mock.module('#server/utils/repo-contents-utils', () => repoContentsUtils);
mock.module('#server/utils/repo-route-utils', () => repoRouteUtils);
mock.module('#server/utils/github-auth-utils', () => ({
  getGitHubClient: async () => ({
    request: async (
      _route: string,
      parameters: { owner: string; repo: string; path: string; ref?: string }
    ) => {
      requested = parameters;
      return {
        data: {
          type: 'file',
          encoding: 'base64',
          content: fileBytes.toString('base64'),
        },
      };
    },
  }),
  throwGitHubRouteError: (error: unknown) => {
    throw error;
  },
}));

const handler = (await import('../server/api/repos/[owner]/[repo]/raw/[...path].get')).default;
const router = createRouter();
router.get('/api/repos/:owner/:repo/raw/**:path', handler);
const fetchRaw = toWebHandler(createApp().use(router.handler));

async function fetchFile(path: string) {
  requested = undefined;
  return fetchRaw(
    new Request(`https://gitpulse.test/api/repos/octocat/hello/raw/${path}?ref=main`)
  );
}

describe('raw repository file', () => {
  test.each(['assets/logo.svg', 'assets/logo.SVG'])(
    'serves %s as an unsanitized SVG document without same-origin script access',
    async (path) => {
      const response = await fetchFile(path);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('image/svg+xml');
      expect(response.headers.get('content-security-policy')).toBe(
        "default-src 'none'; style-src 'unsafe-inline'; sandbox"
      );
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(Buffer.from(await response.arrayBuffer())).toEqual(fileBytes);
      expect(requested).toEqual({
        owner: 'octocat',
        repo: 'hello',
        path,
        ref: 'main',
      });
    }
  );

  test('serves a PNG without a document content security policy', async () => {
    const response = await fetchFile('assets/logo.png');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('content-security-policy')).toBeNull();
    expect(Buffer.from(await response.arrayBuffer())).toEqual(fileBytes);
  });
});
