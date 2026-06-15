import { describe, expect, mock, test } from 'bun:test';

type CreateErrorInput = {
  statusCode: number;
  statusMessage: string;
  data?: unknown;
};

(
  globalThis as typeof globalThis & {
    createError: (input: CreateErrorInput) => Error & CreateErrorInput;
  }
).createError = (input) => Object.assign(new Error(input.statusMessage), input);

const reactions = await import('../shared/utils/reactions');
const customSearchTypes = await import('../shared/types/custom-search');
const tabGroupTypes = await import('../shared/types/tab-groups');
const userSettingsTypes = await import('../shared/types/user-settings');
const userSettingsUtils = await import('../shared/utils/user-settings');
const githubPagination = await import('../server/utils/github-pagination');
const zodValidationUtils = await import('../server/utils/zod-validation-utils');

mock.module('#shared/utils/reactions', () => reactions);
mock.module('#shared/types/custom-search', () => customSearchTypes);
mock.module('#shared/types/tab-groups', () => tabGroupTypes);
mock.module('#shared/types/user-settings', () => userSettingsTypes);
mock.module('#shared/utils/user-settings', () => userSettingsUtils);
mock.module('#server/utils/github-pagination', () => githubPagination);
mock.module('#server/utils/github-timeline-utils', () => ({
  fetchPaginatedArray: async () => [],
}));
mock.module('#server/utils/zod-validation-utils', () => zodValidationUtils);

const { normalizeReactionMutationBody } = await import('../server/utils/github-reaction-utils');
const { normalizeMergePullRequestBody } = await import('../server/utils/pr-merge-status-utils');
const { normalizeReviewerRequestBody } = await import('../server/utils/pr-reviewers-utils');
const { parsePersonalUnlockBody, parseTokenAuthBody } =
  await import('../server/utils/auth-request-validation-utils');
const { parseNotificationSubjectTargetsBody } =
  await import('../server/utils/notification-subject-state-validation-utils');
const {
  parseIssueLabelsBody,
  parseIssueLockBody,
  parseRequiredBodyText,
  parseRepoSubscriptionBody,
  parseReviewThreadResolveBody,
} = await import('../server/utils/repo-request-validation-utils');
const { parseUserSettingsPatchBody } =
  await import('../server/utils/user-settings-validation-utils');

describe('server Zod request validation', () => {
  test('normalizes reaction mutation bodies with target-specific content rules', () => {
    expect(normalizeReactionMutationBody({ content: ' rocket ' }, 'release')).toEqual({
      content: 'rocket',
    });

    expect(() => normalizeReactionMutationBody({}, 'issue')).toThrow(
      'Invalid reaction request body'
    );
    expect(() => normalizeReactionMutationBody('rocket', 'issue')).toThrow(
      'Invalid reaction request body'
    );
    expect(() => normalizeReactionMutationBody({ content: '-1' }, 'release')).toThrow(
      'Invalid reaction request body'
    );
    expect(() =>
      normalizeReactionMutationBody({ content: 'rocket', extra: true }, 'release')
    ).toThrow('Invalid reaction request body');
  });

  test('normalizes pull request merge bodies with typed method and optional text', () => {
    expect(
      normalizeMergePullRequestBody({
        method: 'squash',
        commitTitle: '  Ship Zod validation ',
        commitMessage: ' Trim me ',
      })
    ).toEqual({
      method: 'squash',
      commitTitle: 'Ship Zod validation',
      commitMessage: 'Trim me',
    });

    expect(() => normalizeMergePullRequestBody({ method: 'fast-forward' })).toThrow(
      'Invalid pull request merge request body'
    );
    expect(() => normalizeMergePullRequestBody({ method: 'squash', commitMessage: 42 })).toThrow(
      'Invalid pull request merge request body'
    );
    expect(() => normalizeMergePullRequestBody({ method: 'squash', extra: true })).toThrow(
      'Invalid pull request merge request body'
    );
  });

  test('normalizes reviewer request bodies with strict Zod errors', () => {
    expect(
      normalizeReviewerRequestBody({
        reviewers: [' Alice ', 'alice', 'Bob'],
        teamReviewers: ['Core'],
      })
    ).toEqual({
      reviewers: ['Alice', 'Bob'],
      teamReviewers: ['Core'],
    });

    expect(() => normalizeReviewerRequestBody({ reviewers: 'alice' })).toThrow(
      'Invalid reviewer request body'
    );
    expect(() => normalizeReviewerRequestBody({ reviewers: [42] })).toThrow(
      'Invalid reviewer request body'
    );
    expect(() => normalizeReviewerRequestBody({ reviewers: [' '] })).toThrow(
      'Invalid reviewer request body'
    );
    expect(() => normalizeReviewerRequestBody({})).toThrow('Invalid reviewer request body');
    expect(() => normalizeReviewerRequestBody({ reviewers: ['alice'], extra: true })).toThrow(
      'Invalid reviewer request body'
    );
  });

  test('validates settings patches with concrete strict schemas', () => {
    const validPatch = {
      fonts: {
        appFont: 'system',
        codeFont: 'maple-mono',
        appSystemFont: '  Inter  ',
      },
      tabGroups: [
        {
          id: 'default',
          name: 'General',
          parentId: null,
          collapsed: false,
          source: 'github-search',
        },
      ],
      customTabs: [
        {
          id: 'tab-1',
          groupId: 'default',
          name: 'My PRs',
          subtitle: ' Needs review ',
          subtitleMode: 'custom',
          source: 'github-search',
          query: {
            type: 'pulls',
            state: 'open',
            labels: [' review '],
            scopes: ['title', 'body'],
            archived: 'exclude',
            sort: 'updated',
            order: 'desc',
            perPage: 20,
            draft: 'ready',
            review: 'required',
            base: ' main ',
          },
        },
      ],
    };

    expect(parseUserSettingsPatchBody(validPatch)).toEqual({
      fonts: {
        appFont: 'system',
        codeFont: 'maple-mono',
        appSystemFont: 'Inter',
      },
      tabGroups: [
        {
          id: 'default',
          name: 'General',
          parentId: null,
          collapsed: false,
          source: 'github-search',
        },
      ],
      customTabs: [
        {
          id: 'tab-1',
          groupId: 'default',
          name: 'My PRs',
          subtitle: 'Needs review',
          subtitleMode: 'custom',
          source: 'github-search',
          query: {
            type: 'pulls',
            state: 'open',
            labels: ['review'],
            scopes: ['title', 'body'],
            archived: 'exclude',
            sort: 'updated',
            order: 'desc',
            perPage: 20,
            draft: 'ready',
            review: 'required',
            base: 'main',
          },
        },
      ],
    });

    expect(() => parseUserSettingsPatchBody({ fonts: { appFont: 'invalid' } })).toThrow(
      'Invalid settings request body'
    );
    expect(() =>
      parseUserSettingsPatchBody({
        tabGroups: [{ id: 'default', name: 'General', extra: true }],
      })
    ).toThrow('Invalid settings request body');
    expect(() =>
      parseUserSettingsPatchBody({
        customTabs: [
          {
            id: 'tab-1',
            groupId: 'default',
            name: 'My PRs',
            subtitle: 'Should not be here',
            subtitleMode: 'auto',
            source: 'github-search',
            query: { type: 'issues', state: 'open' },
          },
        ],
      })
    ).toThrow('Invalid settings request body');
  });

  test('validates repository mutation bodies with strict schemas', () => {
    expect(parseRequiredBodyText({ body: '  Looks good  ' }, 'Invalid comment request body')).toBe(
      'Looks good'
    );
    expect(parseIssueLabelsBody({ labels: [' bug ', 'needs triage'] })).toEqual([
      'bug',
      'needs triage',
    ]);
    expect(parseIssueLabelsBody({ labels: [] })).toEqual([]);
    expect(parseIssueLockBody({ lock_reason: 'resolved' })).toBe('resolved');
    expect(parseIssueLockBody({})).toBeUndefined();
    expect(parseReviewThreadResolveBody({ resolved: false })).toBe(false);

    expect(() => parseRequiredBodyText({ body: '' }, 'Invalid comment request body')).toThrow(
      'Invalid comment request body'
    );
    expect(() =>
      parseRequiredBodyText({ body: 'ok', extra: true }, 'Invalid comment request body')
    ).toThrow('Invalid comment request body');
    expect(() => parseIssueLabelsBody({ labels: 'bug' })).toThrow(
      'Invalid issue labels request body'
    );
    expect(() => parseIssueLabelsBody({ labels: [' '] })).toThrow(
      'Invalid issue labels request body'
    );
    expect(() => parseIssueLockBody({ lock_reason: 'invalid' })).toThrow(
      'Invalid issue lock request body'
    );
    expect(() => parseReviewThreadResolveBody({ resolved: 'true' })).toThrow(
      'Invalid review thread resolve request body'
    );
  });

  test('validates route request body parsers that feed server handlers', () => {
    expect(parseTokenAuthBody({ token: '  ghp_test  ' })).toBe('ghp_test');
    expect(parsePersonalUnlockBody({ password: ' secret ', remember: true })).toEqual({
      password: 'secret',
      remember: true,
    });
    expect(parsePersonalUnlockBody({})).toEqual({ password: '', remember: false });
    expect(parseRepoSubscriptionBody({ subscribed: true, ignored: false })).toEqual({
      subscribed: true,
      ignored: false,
    });
    expect(
      parseNotificationSubjectTargetsBody({
        targets: [
          {
            key: ' issue:octocat/hello/1 ',
            owner: ' octocat ',
            repo: ' hello ',
            type: 'issues',
            number: 1,
          },
        ],
      })
    ).toEqual([
      {
        key: 'issue:octocat/hello/1',
        owner: 'octocat',
        repo: 'hello',
        type: 'issues',
        number: 1,
      },
    ]);

    expect(() => parseTokenAuthBody({ token: '' })).toThrow('Invalid token request body');
    expect(() => parsePersonalUnlockBody({ password: '', remember: false })).toThrow(
      'Invalid request body'
    );
    expect(() => parsePersonalUnlockBody({ remember: 'yes' })).toThrow('Invalid request body');
    expect(() => parseRepoSubscriptionBody({ subscribed: true })).toThrow(
      'Invalid subscription request body'
    );
    expect(() =>
      parseNotificationSubjectTargetsBody({
        targets: Array.from({ length: 51 }, (_, index) => ({
          key: `issue:${index}`,
          owner: 'octocat',
          repo: 'hello',
          type: 'issues',
          number: index + 1,
        })),
      })
    ).toThrow('Invalid notification subject state request body');
    expect(() =>
      parseNotificationSubjectTargetsBody({
        targets: [
          {
            key: 'issue:octocat/hello/1',
            owner: 'octocat',
            repo: 'hello',
            type: 'issues',
            number: 0,
          },
        ],
      })
    ).toThrow('Invalid notification subject state request body');
  });
});
