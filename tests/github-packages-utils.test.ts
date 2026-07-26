import { describe, expect, mock, test } from 'bun:test';

// Register the alias with the real module (all exports intact) — a partial
// mock here would shadow the module for every later test file in the run.
const githubAuthUtils = await import('../server/utils/github-auth-utils');

mock.module('#server/utils/github-auth-utils', () => ({ ...githubAuthUtils }));

const {
  isPackageType,
  listAccountPackages,
  listPackagesAcrossTypes,
  mapGitHubPackageToSummary,
  mapGitHubPackageVersionToSummary,
  PACKAGE_TYPES,
  requestPackagesWithScopeFallback,
  resolvePackagesAccountScope,
  sortPackagesByUpdatedAt,
} = await import('../server/utils/github-packages-utils');

describe('isPackageType', () => {
  test('accepts every supported registry type', () => {
    for (const type of PACKAGE_TYPES) {
      expect(isPackageType(type)).toBe(true);
    }
  });

  test('rejects unknown values', () => {
    expect(isPackageType('all')).toBe(false);
    expect(isPackageType('')).toBe(false);
    expect(isPackageType(undefined)).toBe(false);
    expect(isPackageType(['npm'])).toBe(false);
  });
});

describe('resolvePackagesAccountScope', () => {
  test('matches the session login case-insensitively as self', () => {
    expect(resolvePackagesAccountScope('OctoCat', 'octocat', undefined)).toBe('self');
  });

  test('uses the organization hint for other accounts', () => {
    expect(resolvePackagesAccountScope('my-org', 'octocat', 'organization')).toBe('org');
    expect(resolvePackagesAccountScope('my-org', 'octocat', ['organization'])).toBe('org');
  });

  test('defaults to the user namespace', () => {
    expect(resolvePackagesAccountScope('hubot', 'octocat', undefined)).toBe('user');
    expect(resolvePackagesAccountScope('hubot', 'octocat', 'user')).toBe('user');
  });
});

describe('requestPackagesWithScopeFallback', () => {
  test('retries a user-namespace 404 against the org namespace', async () => {
    const scopes: string[] = [];
    const result = await requestPackagesWithScopeFallback('user', async (scope) => {
      scopes.push(scope);
      if (scope === 'user') {
        throw Object.assign(new Error('Not Found'), { status: 404 });
      }
      return 'org-data';
    });

    expect(result).toBe('org-data');
    expect(scopes).toEqual(['user', 'org']);
  });

  test('does not retry non-404 errors or non-user scopes', async () => {
    const forbidden = Object.assign(new Error('Forbidden'), { status: 403 });
    await expect(
      requestPackagesWithScopeFallback('user', async () => {
        throw forbidden;
      })
    ).rejects.toBe(forbidden);

    const notFound = Object.assign(new Error('Not Found'), { status: 404 });
    await expect(
      requestPackagesWithScopeFallback('org', async () => {
        throw notFound;
      })
    ).rejects.toBe(notFound);
  });
});

describe('listAccountPackages', () => {
  test('picks the endpoint for each namespace scope', async () => {
    const calls: Array<{ route: string; params: Record<string, unknown> }> = [];
    const octokit = {
      request: async (route: string, params: Record<string, unknown>) => {
        calls.push({ route, params });
        return { data: [], headers: { link: '<next>; rel="next"' } };
      },
    } as never;

    const { linkHeader } = await listAccountPackages(octokit, 'self', 'octocat', 'npm', {
      page: 2,
      perPage: 50,
    });
    await listAccountPackages(octokit, 'user', 'octocat', 'npm', { page: 1, perPage: 30 });
    await listAccountPackages(octokit, 'org', 'my-org', 'container', { page: 1, perPage: 30 });

    expect(linkHeader).toBe('<next>; rel="next"');
    expect(calls[0]?.route).toBe('GET /user/packages');
    expect(calls[0]?.params).toMatchObject({ package_type: 'npm', page: 2, per_page: 50 });
    expect(calls[1]?.route).toBe('GET /users/{username}/packages');
    expect(calls[1]?.params).toMatchObject({ username: 'octocat' });
    expect(calls[2]?.route).toBe('GET /orgs/{org}/packages');
    expect(calls[2]?.params).toMatchObject({ org: 'my-org', package_type: 'container' });
  });
});

describe('listPackagesAcrossTypes', () => {
  const makePackage = (name: string, packageType: string) => ({
    id: name,
    name,
    package_type: packageType,
  });

  test('merges every registry type and tolerates single-type failures', async () => {
    const octokit = {
      request: async (_route: string, params: { package_type: string }) => {
        if (params.package_type === 'docker') {
          throw Object.assign(new Error('Bad Request'), { status: 400 });
        }
        return {
          data:
            params.package_type === 'npm'
              ? [makePackage('pkg-a', 'npm')]
              : params.package_type === 'container'
                ? [makePackage('img-b', 'container')]
                : [],
          headers: {},
        };
      },
    } as never;

    const { items, truncated } = await listPackagesAcrossTypes(octokit, 'user', 'octocat');

    expect(truncated).toBe(false);
    expect(items.map((item) => item.name).sort()).toEqual(['img-b', 'pkg-a']);
  });

  test('rethrows the first error when every type fails', async () => {
    const octokit = {
      request: async () => {
        throw Object.assign(new Error('Forbidden'), { status: 403 });
      },
    } as never;

    await expect(listPackagesAcrossTypes(octokit, 'user', 'octocat')).rejects.toMatchObject({
      status: 403,
    });
  });

  test('flags truncation when a type keeps returning full pages', async () => {
    const fullPage = Array.from({ length: 100 }, (_, index) => makePackage(`npm-${index}`, 'npm'));
    const octokit = {
      request: async (_route: string, params: { package_type: string }) => ({
        data: params.package_type === 'npm' ? fullPage : [],
        headers: {},
      }),
    } as never;

    const { items, truncated } = await listPackagesAcrossTypes(octokit, 'user', 'octocat');

    expect(truncated).toBe(true);
    // Three capped pages of the same full response.
    expect(items).toHaveLength(300);
  });
});

describe('mapGitHubPackageToSummary', () => {
  test('maps a full payload', () => {
    const summary = mapGitHubPackageToSummary({
      id: 42,
      name: 'hello',
      package_type: 'container',
      visibility: 'private',
      version_count: 7,
      html_url: 'https://github.com/users/octocat/packages/container/package/hello',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-02-01T00:00:00Z',
      owner: { login: 'octocat' },
      repository: { full_name: 'octocat/hello', description: 'Demo', private: false },
    });

    expect(summary).toEqual({
      id: 42,
      name: 'hello',
      packageType: 'container',
      visibility: 'private',
      versionCount: 7,
      htmlUrl: 'https://github.com/users/octocat/packages/container/package/hello',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-02-01T00:00:00Z',
      ownerLogin: 'octocat',
      repository: { fullName: 'octocat/hello', description: 'Demo', private: false },
    });
  });

  test('defaults visibility and omits repository without a full name', () => {
    const summary = mapGitHubPackageToSummary({ id: 1, name: 'x', package_type: 'npm' });

    expect(summary?.visibility).toBe('public');
    expect(summary?.repository).toBeNull();
    expect(summary?.versionCount).toBeNull();
  });

  test('rejects payloads without a name or supported type', () => {
    expect(mapGitHubPackageToSummary(null)).toBeNull();
    expect(mapGitHubPackageToSummary({ id: 1, name: '  ', package_type: 'npm' })).toBeNull();
    expect(mapGitHubPackageToSummary({ id: 1, name: 'x', package_type: 'cargo' })).toBeNull();
  });
});

describe('mapGitHubPackageVersionToSummary', () => {
  test('collects container tags and legacy docker tags', () => {
    const version = mapGitHubPackageVersionToSummary({
      id: 'v1',
      name: 'sha256:abc',
      metadata: {
        container: { tags: ['latest', 1, ''] },
        docker: { tag: ['legacy'] },
      },
    });

    expect(version?.tags).toEqual(['latest', 'legacy']);
  });

  test('rejects payloads without a name', () => {
    expect(mapGitHubPackageVersionToSummary({ id: 'v1', name: '' })).toBeNull();
    expect(mapGitHubPackageVersionToSummary(undefined)).toBeNull();
  });
});

describe('sortPackagesByUpdatedAt', () => {
  const summary = (name: string, updatedAt: string | null) => ({
    id: name,
    name,
    packageType: 'npm' as const,
    visibility: 'public',
    versionCount: null,
    htmlUrl: null,
    createdAt: null,
    updatedAt,
    ownerLogin: null,
    repository: null,
  });

  test('orders newest first with undated entries last by name', () => {
    const sorted = sortPackagesByUpdatedAt([
      summary('b-undated', null),
      summary('old', '2025-01-01T00:00:00Z'),
      summary('a-undated', null),
      summary('new', '2026-01-01T00:00:00Z'),
    ]);

    expect(sorted.map((item) => item.name)).toEqual(['new', 'old', 'a-undated', 'b-undated']);
  });

  test('does not mutate the input array', () => {
    const input = [summary('old', '2025-01-01T00:00:00Z'), summary('new', '2026-01-01T00:00:00Z')];
    sortPackagesByUpdatedAt(input);
    expect(input[0]?.name).toBe('old');
  });
});
