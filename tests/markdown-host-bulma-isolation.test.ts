import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import * as icons from '@lucide/vue';
import { defineComponent, h, nextTick, shallowRef, Suspense, type Component } from 'vue';

import {
  getIssueStatePillClass,
  getIssueStateVisual,
} from '../app/utils/getDashboardSubjectStateVisual';
import { resolvePullRequestBranchRef } from '../app/utils/resolvePullRequestBranchRef';
import * as reactions from '../shared/utils/reactions';
import { commentModerationModules } from './helpers/comment-moderation';
import { commentPresentationModules } from './helpers/comment-presentation';
import { compileVue } from './helpers/compile-vue';
import { githubProfileLinkModules } from './helpers/github-profile-link';
import { ScrollArea } from './helpers/scroll-area';
import { createVueDom } from './helpers/vue-dom';

const empty = defineComponent({ setup: () => () => h('span') });
const markdownStub = defineComponent({
  props: { value: { type: String, required: true } },
  setup: (props) => () => h('div', { 'data-markdown-renderer': '' }, props.value),
});

const i18n = {
  useI18n: () => ({ t: (key: string) => key, locale: shallowRef('en') }),
};

const runtimeStubs = {
  useDashboardRepositoryNavigation: () => ({ openRepository: async () => {} }),
  useRelativeTimeNow: () => shallowRef('2026-11-23T00:00:00.000Z'),
  formatDurationFromNow: () => 'now',
  getDashboardDiscussionStateVisual: () => ({
    icon: empty,
    label: 'Discussion',
    state: 'discussion-unanswered',
    color: 'var(--gitpulse-text-strong)',
  }),
};

const moderation = await commentModerationModules();
const presentation = await commentPresentationModules();

const headerSharedModules = {
  ...githubProfileLinkModules,
  '@lucide/vue': icons,
  'vue-i18n': i18n,
  '~/components/dashboard/reactions/ReactionBar.vue': { default: empty },
  '~/components/dashboard/timeline/ReferenceSubject.vue': { default: empty },
  '~/components/ui/GitHubAvatar.vue': { default: empty },
  '~/components/ui/MarkdownRenderer.vue': { default: markdownStub },
  'virtual:runtime': runtimeStubs,
};

const PRHeader = await compileVue(
  'app/components/dashboard/pr/PRHeader.vue',
  {
    ...headerSharedModules,
    '~/utils/getPullRequestStateVisual': {
      getPullRequestStateVisual: () => ({
        state: 'open',
        icon: empty,
        color: 'var(--gitpulse-success)',
      }),
    },
    '~/utils/resolvePullRequestBranchRef': { resolvePullRequestBranchRef },
  },
  {
    useDashboardRepositoryNavigation: 'virtual:runtime',
    useRelativeTimeNow: 'virtual:runtime',
    formatDurationFromNow: 'virtual:runtime',
  }
);

const IssueHeader = await compileVue(
  'app/components/dashboard/issue/IssueHeader.vue',
  {
    ...headerSharedModules,
    '~/utils/getDashboardSubjectStateVisual': {
      getIssueStatePillClass,
      getIssueStateVisual,
    },
  },
  {
    useDashboardRepositoryNavigation: 'virtual:runtime',
    useRelativeTimeNow: 'virtual:runtime',
    formatDurationFromNow: 'virtual:runtime',
  }
);

const DiscussionHeader = await compileVue(
  'app/components/dashboard/discussion/DiscussionHeader.vue',
  headerSharedModules,
  {
    useDashboardRepositoryNavigation: 'virtual:runtime',
    useRelativeTimeNow: 'virtual:runtime',
    formatDurationFromNow: 'virtual:runtime',
    getDashboardDiscussionStateVisual: 'virtual:runtime',
  }
);

const TimelineCardHeader = await compileVue(
  'app/components/dashboard/timeline/TimelineCardHeader.vue',
  {
    ...githubProfileLinkModules,
    'vue-i18n': i18n,
    '~/components/ui/GitHubAvatar.vue': { default: empty },
    '~/utils/formatDurationFromNow': { formatDurationFromNow: () => 'now' },
    'virtual:runtime': runtimeStubs,
  },
  {
    useRelativeTimeNow: 'virtual:runtime',
  }
);

const commentSharedModules = {
  ...githubProfileLinkModules,
  ...moderation,
  'vue-i18n': i18n,
  '~/components/ui/GitHubAvatar.vue': { default: empty },
  '~/components/ui/MarkdownRenderer.vue': { default: markdownStub },
  '~/components/dashboard/pr/PRReviewThreadToggle.vue': { default: empty },
  '~/utils/formatDurationFromNow': { formatDurationFromNow: () => 'now' },
  'virtual:runtime': runtimeStubs,
};

const TimelineCommentCard = await compileVue(
  'app/components/dashboard/timeline/TimelineCommentCard.vue',
  {
    ...commentSharedModules,
    '~/components/dashboard/timeline/TimelineCardHeader.vue': { default: TimelineCardHeader },
    '~/components/dashboard/reactions/ReactionBar.vue': { default: empty },
    '#shared/utils/reactions': reactions,
  }
);

const DiscussionAnswerCard = await compileVue(
  'app/components/dashboard/discussion/DiscussionAnswerCard.vue',
  commentSharedModules,
  {
    useRelativeTimeNow: 'virtual:runtime',
  }
);

const DiscussionReplyList = await compileVue(
  'app/components/dashboard/discussion/DiscussionReplyList.vue',
  commentSharedModules,
  {
    useRelativeTimeNow: 'virtual:runtime',
  }
);

const PRReviewDiffReviewThreads = await compileVue(
  'app/components/dashboard/pr/PRReviewDiffReviewThreads.vue',
  commentSharedModules,
  {
    useI18n: 'vue-i18n',
    formatDurationFromNow: '~/utils/formatDurationFromNow',
    useRelativeTimeNow: 'virtual:runtime',
  }
);

const ProfileReadme = await compileVue(
  'app/components/dashboard/profile/ProfileReadme.vue',
  {
    '@lucide/vue': icons,
    'vue-i18n': i18n,
    '~/components/ui/MarkdownRenderer.vue': { default: markdownStub },
    '~/components/ui/ScrollArea.vue': { default: ScrollArea },
  },
  {
    useI18n: 'vue-i18n',
  }
);

const RealMarkdownRenderer = presentation['~/components/ui/MarkdownRenderer.vue']
  .default as Component;

let dom: ReturnType<typeof createVueDom>;

beforeEach(() => {
  dom = createVueDom({
    useNuxtApp: () => ({}),
    useUserSession: () => ({ user: shallowRef(null) }),
    useGitPulseApiFetch: () => async () => ({}),
    useRelativeTimeNow: runtimeStubs.useRelativeTimeNow,
  });
});

afterEach(async () => {
  await dom.cleanup();
});

function mountIsolated(render: () => ReturnType<typeof h>) {
  return dom.mount(
    defineComponent({
      setup: () => () => h(Suspense, null, { default: render }),
    })
  );
}

describe('markdown host isolation from Bulma .content', () => {
  const hostCases: Array<{ name: string; render: () => ReturnType<typeof h> }> = [
    {
      name: 'PRHeader',
      render: () =>
        h(PRHeader as never, {
          pullRequest: {
            title: 'PR',
            number: 165,
            state: 'open',
            body: '| A | B |\n|---|---|\n| 1 | 2 |',
          },
          repoOwner: 'pynickle',
          repoName: 'gitpulse',
        }),
    },
    {
      name: 'IssueHeader',
      render: () =>
        h(IssueHeader as never, {
          issue: {
            title: 'Issue',
            number: 1,
            state: 'open',
            body: 'Details',
          },
          repoOwner: 'pynickle',
          repoName: 'gitpulse',
        }),
    },
    {
      name: 'DiscussionHeader',
      render: () =>
        h(DiscussionHeader as never, {
          discussion: {
            id: 'd1',
            nodeId: 'D_1',
            number: 1,
            title: 'Disc',
            body: 'Details',
            author: null,
            category: null,
            isAnswered: false,
            answer: null,
            locked: false,
            comments: {
              items: [],
              totalCount: 0,
              pageInfo: { hasNextPage: false, endCursor: null },
            },
            owner: 'pynickle',
            repo: 'gitpulse',
            repository_url: 'https://github.com/pynickle/gitpulse',
          },
          repoOwner: 'pynickle',
          repoName: 'gitpulse',
        }),
    },
    {
      name: 'TimelineCommentCard',
      render: () =>
        h(TimelineCommentCard as never, {
          item: { id: 1, body: 'Comment' },
          repoOwner: 'pynickle',
          repoName: 'gitpulse',
        }),
    },
    {
      name: 'DiscussionAnswerCard',
      render: () =>
        h(DiscussionAnswerCard as never, {
          answer: {
            id: 'a1',
            nodeId: 'DC_a1',
            body: 'Answer',
            author: null,
            isAnswer: true,
            replyToId: null,
          },
          repoOwner: 'pynickle',
          repoName: 'gitpulse',
        }),
    },
    {
      name: 'DiscussionReplyList',
      render: () =>
        h(DiscussionReplyList as never, {
          replies: {
            items: [
              {
                id: 'r1',
                nodeId: 'DC_r1',
                body: 'Reply',
                author: null,
                isAnswer: false,
                replyToId: 'c1',
              },
            ],
            totalCount: 1,
            pageInfo: { hasNextPage: false, endCursor: null },
          },
          repoOwner: 'pynickle',
          repoName: 'gitpulse',
        }),
    },
    {
      name: 'PRReviewDiffReviewThreads',
      render: () =>
        h(PRReviewDiffReviewThreads as never, {
          threads: [
            {
              id: 't1',
              path: 'src/index.ts',
              lineKey: 'new:1',
              line: 1,
              comments: [
                {
                  id: 'c1',
                  body: 'Review note',
                  path: 'src/index.ts',
                },
              ],
            },
          ],
          repoOwner: 'pynickle',
          repoName: 'gitpulse',
        }),
    },
    {
      name: 'ProfileReadme',
      render: () =>
        h(ProfileReadme as never, {
          login: 'pynickle',
          readme: {
            content: '# Hello',
            htmlUrl: null,
            repo: 'pynickle/pynickle',
            branch: 'main',
            path: 'README.md',
          },
        }),
    },
  ];

  for (const hostCase of hostCases) {
    test(`${hostCase.name} renders MarkdownRenderer outside any Bulma .content ancestor`, async () => {
      const { root } = mountIsolated(hostCase.render);
      await Bun.sleep(0);
      await nextTick();

      const markdownHost = root.querySelector('[data-markdown-renderer]');
      expect(markdownHost).not.toBeNull();
      expect(markdownHost?.closest('.content')?.className ?? null).toBeNull();
    });
  }

  test('MarkdownRenderer renders a GFM table inside .markdown-body without a .content ancestor', async () => {
    const { root } = mountIsolated(() =>
      h(RealMarkdownRenderer, {
        value: '| Package | Change |\n|---|---|\n| vue | 3.5 |',
        repoOwner: 'pynickle',
        repoName: 'gitpulse',
      })
    );

    for (let attempt = 0; attempt < 30; attempt += 1) {
      if (root.querySelector('.markdown-body table')) break;
      await Bun.sleep(10);
      await nextTick();
    }

    const table = root.querySelector('.markdown-body table');
    expect(table).not.toBeNull();
    expect(table?.closest('.content')?.className ?? null).toBeNull();
    expect(
      [...root.querySelectorAll('.markdown-body table thead th')].map((el) =>
        el.textContent?.trim()
      )
    ).toEqual(['Package', 'Change']);
    expect(
      [...root.querySelectorAll('.markdown-body table tbody td')].map((el) =>
        el.textContent?.trim()
      )
    ).toEqual(['vue', '3.5']);
  });
});
