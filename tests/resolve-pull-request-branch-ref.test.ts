import { describe, expect, test } from 'bun:test';

import { resolvePullRequestBranchRef } from '../app/utils/resolvePullRequestBranchRef';

const repository = (owner: string, name: string) => ({
  name,
  full_name: `${owner}/${name}`,
  owner: { login: owner },
});

describe('resolvePullRequestBranchRef', () => {
  test('leaves a branch in the host repository as the ref alone', () => {
    expect(
      resolvePullRequestBranchRef('pynickle', 'gitpulse', {
        ref: 'main',
        label: 'pynickle:main',
        repo: repository('pynickle', 'gitpulse'),
      })
    ).toEqual({ ownerLogin: null, ref: 'main' });
  });

  test('treats a differently capitalized host repository as the same repository', () => {
    expect(
      resolvePullRequestBranchRef('PyNickle', 'GitPulse', {
        ref: 'main',
        label: 'pynickle:main',
        repo: repository('pynickle', 'gitpulse'),
      })
    ).toEqual({ ownerLogin: null, ref: 'main' });
  });

  test('prefixes a branch from another repository with that repository owner', () => {
    expect(
      resolvePullRequestBranchRef('pynickle', 'gitpulse', {
        ref: 'fix/hover',
        label: 'someone-else:fix/hover',
        repo: repository('contributor', 'gitpulse'),
      })
    ).toEqual({ ownerLogin: 'contributor', ref: 'fix/hover' });
  });

  test('still prefixes the owner when only the repository name differs', () => {
    expect(
      resolvePullRequestBranchRef('acme', 'web', {
        ref: 'main',
        label: 'Acme:main',
        repo: repository('Acme', 'api'),
      })
    ).toEqual({ ownerLogin: 'Acme', ref: 'main' });
  });

  test('reads a missing login from the repository full name', () => {
    expect(
      resolvePullRequestBranchRef('pynickle', 'gitpulse', {
        ref: ' fix/hover ',
        repo: { full_name: 'contributor/gitpulse' },
      })
    ).toEqual({ ownerLogin: 'contributor', ref: 'fix/hover' });
  });

  test('reads the owner from the label when the repository is gone', () => {
    expect(
      resolvePullRequestBranchRef('pynickle', 'gitpulse', {
        ref: 'fix/hover',
        label: 'contributor:fix/hover',
        repo: null,
      })
    ).toEqual({ ownerLogin: 'contributor', ref: 'fix/hover' });
  });

  test('keeps the ref alone when a missing repository has no owner in its label', () => {
    expect(
      resolvePullRequestBranchRef('pynickle', 'gitpulse', {
        ref: 'fix/hover',
        label: 'fix/hover',
        repo: null,
      })
    ).toEqual({ ownerLogin: null, ref: 'fix/hover' });

    expect(
      resolvePullRequestBranchRef('pynickle', 'gitpulse', {
        ref: 'fix/hover',
        label: ':fix/hover',
        repo: null,
      })
    ).toEqual({ ownerLogin: null, ref: 'fix/hover' });
  });
});
