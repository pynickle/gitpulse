import { beforeEach, describe, expect, mock, test } from 'bun:test';

/** The commit-message read the defaults fetch may or may not perform. */
const commitRead = {
  calls: 0,
  fail: false,
  messages: [] as unknown[],
};

// Aliases the util's GitHub pagination dependency so a test can count the reads.
mock.module('#server/utils/github-timeline-utils', () => ({
  fetchPaginatedArray: async () => {
    commitRead.calls += 1;
    if (commitRead.fail) throw new Error('commits unavailable');
    return commitRead.messages;
  },
}));

const { mapRepositoryMergeSettings, resolveAllowedMergeMethods } =
  await import('../server/utils/pr-merge-settings-utils');
const { fetchPRCommitDefaults, resolveMergeCommitDefaults, toMergeHeadBranch } =
  await import('../server/utils/pr-commit-defaults-utils');

beforeEach(() => {
  commitRead.calls = 0;
  commitRead.fail = false;
  commitRead.messages = [];
});

/** GitHub's defaults are the "Default message" option of the repository pull request settings. */
const defaultSettings = mapRepositoryMergeSettings({});

const basePull = {
  pullNumber: 4,
  pullTitle: 'Add feature',
  pullBody: 'Why the feature exists.',
  headBranch: 'octo/topic',
};

describe('repository merge settings', () => {
  test('a repository that never changed the settings allows every merge method', () => {
    expect(resolveAllowedMergeMethods(defaultSettings)).toEqual(['merge', 'squash', 'rebase']);
  });

  test('a repository that never changed the settings carries the "Default message" formats', () => {
    expect(defaultSettings).toEqual({
      mergeCommitAllowed: true,
      squashMergeAllowed: true,
      rebaseMergeAllowed: true,
      mergeCommitTitle: 'MERGE_MESSAGE',
      mergeCommitMessage: 'PR_TITLE',
      squashMergeCommitTitle: 'COMMIT_OR_PR_TITLE',
      squashMergeCommitMessage: 'COMMIT_MESSAGES',
    });
  });

  test('a disabled merge method leaves the allowed list, keeping GitHub order', () => {
    const settings = mapRepositoryMergeSettings({
      allow_merge_commit: false,
      allow_rebase_merge: false,
    });

    expect(resolveAllowedMergeMethods(settings)).toEqual(['squash']);
  });

  test('readable settings that disable nothing else are read through', () => {
    const settings = mapRepositoryMergeSettings({
      squash_merge_commit_title: 'PR_TITLE',
      squash_merge_commit_message: 'BLANK',
    });

    expect(settings.squashMergeCommitTitle).toBe('PR_TITLE');
    expect(settings.squashMergeCommitMessage).toBe('BLANK');
  });

  test('unreadable repository settings fall back to offering every method', () => {
    expect(resolveAllowedMergeMethods(null)).toEqual(['merge', 'squash', 'rebase']);
  });
});

describe('merge commit default message', () => {
  test('the default merge message is the pull request number and head branch, then the title', () => {
    expect(
      resolveMergeCommitDefaults({
        settings: defaultSettings,
        ...basePull,
        commitCount: 2,
        commitMessages: ['feat: one', 'fix: two'],
      }).merge
    ).toEqual({
      title: 'Merge pull request #4 from octo/topic',
      message: 'Add feature',
    });
  });

  test('the pull request title format appends the number and drops the message', () => {
    const settings = mapRepositoryMergeSettings({
      merge_commit_title: 'PR_TITLE',
      merge_commit_message: 'BLANK',
    });

    expect(
      resolveMergeCommitDefaults({
        settings,
        ...basePull,
        commitCount: 2,
        commitMessages: ['feat: one', 'fix: two'],
      }).merge
    ).toEqual({ title: 'Add feature (#4)', message: '' });
  });

  test('the pull request title and description format carries the body', () => {
    const settings = mapRepositoryMergeSettings({
      merge_commit_title: 'PR_TITLE',
      merge_commit_message: 'PR_BODY',
    });

    expect(
      resolveMergeCommitDefaults({
        settings,
        ...basePull,
        commitCount: 2,
        commitMessages: ['feat: one', 'fix: two'],
      }).merge
    ).toEqual({ title: 'Add feature (#4)', message: 'Why the feature exists.' });
  });
});

describe('squash commit default message', () => {
  test('several commits squashed to the default title list each full commit message', () => {
    expect(
      resolveMergeCommitDefaults({
        settings: defaultSettings,
        ...basePull,
        commitCount: 2,
        commitMessages: ['feat: one', 'fix: two'],
      }).squash
    ).toEqual({
      title: 'Add feature (#4)',
      message: '* feat: one\n\n* fix: two',
    });
  });

  test('a single commit keeps its own title and message instead of the pull request title', () => {
    expect(
      resolveMergeCommitDefaults({
        settings: defaultSettings,
        ...basePull,
        commitCount: 1,
        commitMessages: ['feat: only\n\nWhy the commit exists.'],
      }).squash
    ).toEqual({
      title: 'feat: only',
      message: 'feat: only\n\nWhy the commit exists.',
    });
  });

  test('the pull request title format squashes without a message', () => {
    const settings = mapRepositoryMergeSettings({
      squash_merge_commit_title: 'PR_TITLE',
      squash_merge_commit_message: 'BLANK',
    });

    expect(
      resolveMergeCommitDefaults({
        settings,
        ...basePull,
        commitCount: 1,
        commitMessages: ['feat: only'],
      }).squash
    ).toEqual({ title: 'Add feature (#4)', message: '' });
  });

  test('commit details for a single commit is that commit message, not a one item list', () => {
    const settings = mapRepositoryMergeSettings({
      squash_merge_commit_title: 'PR_TITLE',
      squash_merge_commit_message: 'COMMIT_MESSAGES',
    });

    expect(
      resolveMergeCommitDefaults({
        settings,
        ...basePull,
        commitCount: 1,
        commitMessages: ['feat: only\n\nWhy the commit exists.'],
      }).squash
    ).toEqual({ title: 'Add feature (#4)', message: 'feat: only\n\nWhy the commit exists.' });
  });

  test('the pull request title and description format carries the body', () => {
    const settings = mapRepositoryMergeSettings({
      squash_merge_commit_title: 'PR_TITLE',
      squash_merge_commit_message: 'PR_BODY',
    });

    expect(
      resolveMergeCommitDefaults({
        settings,
        ...basePull,
        commitCount: 3,
        commitMessages: ['feat: one', 'fix: two', 'chore: three'],
      }).squash
    ).toEqual({ title: 'Add feature (#4)', message: 'Why the feature exists.' });
  });

  test('commit messages that could not be read leave their cell empty rather than guessed', () => {
    expect(
      resolveMergeCommitDefaults({
        settings: defaultSettings,
        ...basePull,
        commitCount: 2,
        commitMessages: null,
      }).squash
    ).toEqual({ title: 'Add feature (#4)', message: '' });
  });

  test('a single unreadable commit leaves both cells empty, because its title is the commit title', () => {
    expect(
      resolveMergeCommitDefaults({
        settings: defaultSettings,
        ...basePull,
        commitCount: 1,
        commitMessages: null,
      }).squash
    ).toEqual({ title: '', message: '' });
  });

  test('an unknown commit count leaves the title empty instead of assuming several commits', () => {
    expect(
      resolveMergeCommitDefaults({
        settings: defaultSettings,
        ...basePull,
        commitCount: null,
        commitMessages: null,
      }).squash
    ).toEqual({ title: '', message: '' });
  });
});

describe('merge message head branch', () => {
  test('a fork head label names the fork, as GitHub writes it', () => {
    expect(toMergeHeadBranch('octo:topic')).toBe('octo/topic');
  });

  test('a same repository head label is already just the branch', () => {
    expect(toMergeHeadBranch('topic')).toBe('topic');
  });

  test('a missing head label drops the "from" clause instead of trailing it', () => {
    expect(
      resolveMergeCommitDefaults({
        settings: defaultSettings,
        ...basePull,
        headBranch: '',
        commitCount: 2,
        commitMessages: ['feat: one', 'fix: two'],
      }).merge.title
    ).toBe('Merge pull request #4');
  });
});

describe('reading the defaults for one pull request', () => {
  const pullRequest = (overrides: Record<string, unknown> = {}) => ({
    title: 'Add feature',
    body: 'Why the feature exists.',
    commits: 2,
    head: { label: 'octo:topic' },
    ...overrides,
  });

  function fakeOctokit(
    repository: Record<string, unknown>,
    pull: Record<string, unknown>
  ): unknown {
    return {
      request: async (route: string) => {
        if (route === 'GET /repos/{owner}/{repo}') return { data: repository };
        if (route === 'GET /repos/{owner}/{repo}/pulls/{pull_number}') {
          return { data: pull };
        }
        throw new Error(`unexpected route ${route}`);
      },
    };
  }

  const readDefaults = (repository: Record<string, unknown>, pull: Record<string, unknown>) =>
    fetchPRCommitDefaults(
      fakeOctokit(repository, pull) as Parameters<typeof fetchPRCommitDefaults>[0],
      'octo',
      'app',
      4
    );

  test('a message style that needs no commit text reads no commits', async () => {
    const defaults = await readDefaults(
      { squash_merge_commit_title: 'PR_TITLE', squash_merge_commit_message: 'BLANK' },
      pullRequest()
    );

    expect(defaults.squash).toEqual({ title: 'Add feature (#4)', message: '' });
    expect(commitRead.calls).toBe(0);
  });

  test('the default squash message lists the commit messages it read', async () => {
    commitRead.messages = [
      { commit: { message: 'feat: one' } },
      { commit: { message: 'fix: two\n\nWhy the fix.' } },
    ];

    const defaults = await readDefaults({}, pullRequest());

    expect(commitRead.calls).toBe(1);
    expect(defaults.squash).toEqual({
      title: 'Add feature (#4)',
      // Only each commit's first line takes the bullet; its body follows unbulleted.
      message: '* feat: one\n\n* fix: two\n\nWhy the fix.',
    });
  });

  test('a single commit reads its title even when no body style needs it', async () => {
    commitRead.messages = [{ commit: { message: 'feat: only\n\nWhy the commit.' } }];

    const defaults = await readDefaults(
      { squash_merge_commit_message: 'BLANK' },
      pullRequest({ commits: 1 })
    );

    expect(commitRead.calls).toBe(1);
    expect(defaults.squash).toEqual({
      title: 'feat: only',
      message: '',
    });
  });

  test('an unreadable commit list leaves the cells that need it empty', async () => {
    commitRead.fail = true;

    const defaults = await readDefaults({}, pullRequest());

    expect(defaults.squash).toEqual({ title: 'Add feature (#4)', message: '' });
  });

  test('the merge message names a fork head with a slash', async () => {
    const defaults = await readDefaults({}, pullRequest());

    expect(defaults.merge.title).toBe('Merge pull request #4 from octo/topic');
  });
});
