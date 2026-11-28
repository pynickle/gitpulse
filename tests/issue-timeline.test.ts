import { afterEach, beforeEach, expect, test } from 'bun:test';

import { defineComponent, h, nextTick, provide, ref, shallowRef } from 'vue';

import * as timelineEvents from '../app/composables/useIssueTimelineEvents';
import type { IssueTimelineItem } from '../app/composables/useIssueTimelineEvents';
import { buildTimelineCommitPayload } from '../app/utils/buildTimelineCommitPayload';
import { commitVerificationMark } from '../app/utils/commitVerification';
import * as reactions from '../shared/utils/reactions';
import { compileVue } from './helpers/compile-vue';
import { githubProfileLinkModules, opensGitHubLinksKey } from './helpers/github-profile-link';
import { createVueDom } from './helpers/vue-dom';

const i18n = {
  useI18n: () => ({
    t: (key: string, params?: { time?: string }) => (params?.time ? `${key}:${params.time}` : key),
    te: (key: string) => key === 'commitVerification.reasons.bad_email',
    locale: ref('en'),
  }),
};

const empty = defineComponent({ setup: () => () => h('span') });

const avatarStub = defineComponent({
  props: { src: { type: String, default: '' }, alt: { type: String, default: '' } },
  setup: () => () => h('span', { class: 'avatar-stub' }),
});

const actionsStub = defineComponent({
  props: { target: { type: Object, default: null } },
  setup: () => () => h('span', { class: 'comment-actions-stub' }),
});

// The shared card hands the body to CommentBody as a scoped slot; this stub keeps
// that contract so the card's own rendering of the body stays under test.
const bodyStub = defineComponent({
  props: { target: { type: Object, default: null }, body: { type: String, default: '' } },
  setup(props, { slots }) {
    return () =>
      h(
        'div',
        { class: 'comment-body-stub' },
        slots.default?.({ body: props.body, moderation: undefined })
      );
  },
});

const markdownStub = defineComponent({
  props: { value: { type: String, default: '' } },
  setup(props) {
    return () => h('span', { class: 'markdown-stub' }, props.value);
  },
});

const time = { useRelativeTimeNow: () => shallowRef(0) };
const formatTime = { formatDurationFromNow: () => '2 days ago' };

const moderation = {
  useCommentModeration: () => ({
    stateFor: (target: unknown) => ({ deleted: false, moderation: target, body: undefined }),
  }),
};

const CommitListRow = await compileVue(
  'app/components/dashboard/detail/CommitListRow.vue',
  {
    ...githubProfileLinkModules,
    'vue-i18n': i18n,
    '~/components/dashboard/pr/CheckStatusChip.vue': { default: empty },
    '~/components/ui/GitHubAvatar.vue': { default: avatarStub },
    '~/utils/formatDurationFromNow': formatTime,
    'virtual:verification': { commitVerificationMark },
    'virtual:time': time,
    'virtual:modal': { useCheckListModal: () => ({ open: () => {} }) },
  },
  {
    useI18n: 'vue-i18n',
    commitVerificationMark: 'virtual:verification',
    useRelativeTimeNow: 'virtual:time',
    useCheckListModal: 'virtual:modal',
  }
);

const IssueTimelineCommitCard = await compileVue(
  'app/components/dashboard/issue/IssueTimelineCommitCard.vue',
  {
    'vue-i18n': i18n,
    '~/components/dashboard/detail/CommitListRow.vue': { default: CommitListRow },
    'virtual:commit-payload': { buildTimelineCommitPayload },
  },
  { useI18n: 'vue-i18n', buildTimelineCommitPayload: 'virtual:commit-payload' }
);

const TimelineCardHeader = await compileVue(
  'app/components/dashboard/timeline/TimelineCardHeader.vue',
  {
    ...githubProfileLinkModules,
    'vue-i18n': i18n,
    '~/components/ui/GitHubAvatar.vue': { default: avatarStub },
    '~/utils/formatDurationFromNow': formatTime,
    'virtual:time': time,
  },
  { useRelativeTimeNow: 'virtual:time' }
);

const TimelineCommentCard = await compileVue(
  'app/components/dashboard/timeline/TimelineCommentCard.vue',
  {
    'vue-i18n': i18n,
    '~/components/dashboard/timeline/TimelineCardHeader.vue': { default: TimelineCardHeader },
    '~/components/dashboard/comments/CommentActions.vue': { default: actionsStub },
    '~/components/dashboard/comments/CommentBody.vue': { default: bodyStub },
    '~/components/dashboard/reactions/ReactionBar.vue': { default: empty },
    '~/components/ui/MarkdownRenderer.vue': { default: markdownStub },
    '~/composables/useCommentModeration': moderation,
    '#shared/utils/reactions': reactions,
  }
);

const TimelineEventActorRow = await compileVue(
  'app/components/dashboard/timeline/TimelineEventActorRow.vue',
  { '~/components/ui/GitHubAvatar.vue': { default: avatarStub } }
);

const ReferenceSubject = await compileVue(
  'app/components/dashboard/timeline/ReferenceSubject.vue',
  {
    'vue-i18n': {
      useI18n: () => ({ t: (key: string) => (key === 'timeline.issueType' ? 'Issue' : key) }),
    },
  },
  { computed: 'vue' }
);

const IssueTimelineReferenceEvents = await compileVue(
  'app/components/dashboard/issue/IssueTimelineReferenceEvents.vue',
  { '~/components/dashboard/timeline/ReferenceSubject.vue': { default: ReferenceSubject } }
);

const IssueTimelineEventBody = await compileVue(
  'app/components/dashboard/issue/IssueTimelineEventBody.vue',
  {
    ...githubProfileLinkModules,
    'vue-i18n': i18n,
    '~/components/dashboard/issue/IssueTimelineReferenceEvents.vue': {
      default: IssueTimelineReferenceEvents,
    },
    '~/components/dashboard/issue/IssueTimelineStateEvents.vue': { default: empty },
    '~/components/dashboard/timeline/TimelineUnavailableEvent.vue': { default: empty },
    '~/utils/formatDurationFromNow': { formatDurationFromNow: (date: string) => date },
    'virtual:time': time,
  },
  { useRelativeTimeNow: 'virtual:time' }
);

const IssueTimelineEvents = await compileVue(
  'app/components/dashboard/issue/IssueTimelineEvents.vue',
  {
    ...githubProfileLinkModules,
    'vue-i18n': i18n,
    '~/components/dashboard/timeline/TimelineCommentCard.vue': { default: TimelineCommentCard },
    '~/components/dashboard/issue/IssueTimelineCommitCard.vue': {
      default: IssueTimelineCommitCard,
    },
    '~/components/dashboard/issue/IssueTimelineEventBody.vue': { default: IssueTimelineEventBody },
    '~/components/dashboard/issue/IssueTimelineReferencedEventCard.vue': { default: empty },
    '~/components/dashboard/timeline/DeferredFloatingMarkdownEditor.vue': { default: empty },
    '~/components/dashboard/timeline/TimelineEventActorRow.vue': { default: TimelineEventActorRow },
    '~/components/dashboard/timeline/TimelineRenamedTitleEvent.vue': { default: empty },
    '~/components/ui/LoadingIcon.vue': { default: empty },
    '~/composables/useIssueTimelineEvents': timelineEvents,
  }
);

const comment: IssueTimelineItem = {
  kind: 'comment',
  eventType: 'commented',
  id: '4242',
  url: 'https://github.com/acme/widgets/issues/7#issuecomment-4242',
  body: 'The login screen flickers on load.',
  createdAt: '2024-01-01T12:00:00Z',
  author: { login: 'octocat', url: 'https://github.com/octocat' },
  moderation: {
    resourceType: 'IssueComment',
    nodeId: 'IC_1',
    isMinimized: false,
    minimizedReason: null,
    viewerCanDelete: true,
    viewerCanMinimize: true,
    viewerCanUnminimize: false,
  },
};

const commit: IssueTimelineItem = {
  kind: 'commit',
  commit: {
    oid: 'abcdef0123456789',
    message: 'feat: sign the release\n\nbody text',
    committedDate: '2024-01-01T12:00:00Z',
    author: {
      name: 'Dependabot',
      user: { login: 'dependabot[bot]', url: 'https://github.com/apps/dependabot' },
    },
    commitUrl: 'https://github.com/acme/widgets/commit/abcdef0123456789',
    verification: null,
    checkRollup: null,
  },
};

let dom: ReturnType<typeof createVueDom>;

beforeEach(() => {
  dom = createVueDom();
});

afterEach(async () => {
  await dom.cleanup();
});

test('a parent issue and a blocked-by issue render as links when the timeline includes them', () => {
  const targets: Array<[string, string, number]> = [];
  const parent = {
    number: 1,
    title: 'Spec',
    resourceType: 'issue',
    repository: { owner: { login: 'pynickle' }, name: 'trial-contracts' },
  };
  const blockedIssue = {
    number: 17,
    title: 'Settings',
    resourceType: 'issue',
    repository: { owner: { login: 'pynickle' }, name: 'trial-contracts' },
  };
  const view = dom.mount(
    defineComponent({
      setup: () => () =>
        h(IssueTimelineEvents as never, {
          timeline: [
            {
              kind: 'event',
              eventType: 'parent_issue_added',
              actor: { login: 'octocat' },
              parent,
              createdAt: '2026-10-16T08:01:30Z',
            },
            {
              kind: 'event',
              eventType: 'blocked_by_added',
              actor: { login: 'octocat' },
              blockedIssue,
              createdAt: '2026-10-16T08:01:31Z',
            },
          ],
          loading: false,
          repoOwner: 'pynickle',
          repoName: 'trial-contracts',
          issueNumber: 29,
          onSwitchIssue: (owner: string, repo: string, number: number) => {
            targets.push([owner, repo, number]);
          },
        }),
    })
  );

  const links = Array.from(view.root.querySelectorAll<HTMLAnchorElement>('a.gp-tags'));
  expect(
    links.map((link) =>
      Array.from(link.querySelectorAll('.gp-tag'), (tag) =>
        tag.textContent?.replace(/\s+/g, ' ').trim()
      )
    )
  ).toEqual([
    ['Issue #1', 'Spec'],
    ['Issue #17', 'Settings'],
  ]);
  expect(view.root.textContent).toContain('added a parent issue');
  expect(view.root.textContent).toContain('marked this as blocked by');
  links[0]?.click();
  links[1]?.click();
  expect(targets).toEqual([
    ['pynickle', 'trial-contracts', 1],
    ['pynickle', 'trial-contracts', 17],
  ]);
});

test('adjacent blocked-by marks collapse under one actor and action', () => {
  const view = dom.mount(
    defineComponent({
      setup: () => () =>
        h(IssueTimelineEvents as never, {
          timeline: [
            {
              kind: 'event',
              eventType: 'blocked_by_added',
              actor: { login: 'octocat' },
              blockedIssue: {
                number: 17,
                title: 'Settings',
                resourceType: 'issue',
                repository: { owner: { login: 'pynickle' }, name: 'trial-contracts' },
              },
              createdAt: '2026-10-16T08:01:31Z',
            },
            {
              kind: 'event',
              eventType: 'blocked_by_added',
              actor: { login: 'octocat' },
              blockedIssue: {
                number: 18,
                title: 'Loot',
                resourceType: 'issue',
                repository: { owner: { login: 'pynickle' }, name: 'trial-contracts' },
              },
              createdAt: '2026-10-16T08:01:32Z',
            },
          ],
          loading: false,
          repoOwner: 'pynickle',
          repoName: 'trial-contracts',
          issueNumber: 29,
        }),
    })
  );

  const group = view.root.querySelector('.issue-timeline-events__list');
  expect(group?.querySelectorAll('.avatar-stub')).toHaveLength(1);
  expect(group?.textContent?.replace(/\s+/g, ' ').trim()).toMatch(
    /octocat marked this as blocked by Issue #17\s*Settings\s*2026-10-16T08:01:31Z Issue #18\s*Loot\s*2026-10-16T08:01:32Z/
  );
  expect(group?.textContent?.match(/marked this as blocked by/g)).toHaveLength(1);
});

test('a parent issue event without a target explains itself with the unavailable mark', async () => {
  const Unavailable = await compileVue(
    'app/components/dashboard/timeline/TimelineUnavailableEvent.vue',
    {
      'vue-i18n': i18n,
      '@lucide/vue': {
        InfoIcon: defineComponent({ setup: () => () => h('span', { class: 'info-icon' }) }),
      },
    }
  );
  const view = dom.mount(
    defineComponent({
      setup: () => () =>
        h(Unavailable, {
          eventType: 'parent_issue_added',
          reasonCode: 'parent',
        }),
    })
  );

  expect(view.root.textContent).toContain('added a parent issue');
  expect(view.root.querySelector('.timeline-unavailable__tooltip')?.textContent).toBe(
    'timeline.unavailableReason_parent'
  );
  expect(view.root.querySelector('.info-icon')).not.toBeNull();
});

test('a grouped issue activity displays one actor and action before its individually timed targets', () => {
  const targets: Array<[string, string, number]> = [];
  const view = dom.mount(
    defineComponent({
      setup: () => () =>
        h(IssueTimelineEvents as never, {
          timeline: [
            {
              kind: 'event',
              eventType: 'sub_issue_added',
              actor: { login: 'octocat' },
              subIssue: {
                number: 27,
                title: 'Build setup',
                repository: { owner: { login: 'acme' }, name: 'build' },
              },
              createdAt: '2026-09-27T06:42:13Z',
            },
            {
              kind: 'event',
              eventType: 'sub_issue_added',
              actor: { login: 'octocat' },
              displayText: 'target issue details are unavailable',
              createdAt: '2026-09-27T06:42:17Z',
            },
          ],
          loading: false,
          repoOwner: 'acme',
          repoName: 'widgets',
          issueNumber: 26,
          onSwitchIssue: (owner: string, repo: string, number: number) => {
            targets.push([owner, repo, number]);
          },
        }),
    })
  );

  const group = view.root.querySelector('.issue-timeline-events__list');
  expect(group?.querySelectorAll('.avatar-stub')).toHaveLength(1);
  expect(group?.querySelector('a')?.getAttribute('href')).toBe('/dashboard/profile?user=octocat');
  const target = group?.querySelector<HTMLAnchorElement>('a.gp-tags');
  const tags = Array.from(target?.querySelectorAll('.gp-tag') ?? [], (tag) =>
    tag.textContent?.replace(/\s+/g, ' ').trim()
  );
  expect(tags).toEqual(['Issue #27', 'Build setup']);
  target?.click();
  expect(targets).toEqual([['acme', 'build', 27]]);
  expect(group?.textContent?.trim()).toMatch(
    /^octocat\s+added sub-issues\s*Issue\s+#27\s*Build setup\s*2026-09-27T06:42:13Z\s*target issue details are unavailable\s*2026-09-27T06:42:17Z$/
  );
});

test('the issue timeline shows its comment and commit through the shared cards', async () => {
  const opensGitHubLinks = shallowRef(false);
  const view = dom.mount(
    defineComponent({
      setup() {
        provide(opensGitHubLinksKey, opensGitHubLinks);
        return () =>
          h(IssueTimelineEvents as never, {
            timeline: [comment, commit],
            loading: false,
            repoOwner: 'acme',
            repoName: 'widgets',
            issueNumber: 7,
          });
      },
    })
  );
  await nextTick();

  const commentCard = view.root.querySelector('.comment-item');
  expect(commentCard?.textContent).toContain('The login screen flickers on load.');
  expect(commentCard?.textContent).toContain('octocat');
  expect(commentCard?.textContent).toContain('2 days ago');
  expect(commentCard?.querySelector('.comment-actions-stub')).not.toBeNull();

  const commitCard = view.root.querySelector('.commit-item');
  const sha = commitCard?.querySelector('.commit-list-row__sha');
  expect(sha?.textContent?.trim()).toBe('abcdef0');
  expect(sha?.getAttribute('href')).toBe('https://github.com/acme/widgets/commit/abcdef0123456789');
  expect(commitCard?.querySelector('.commit-list-row__message')?.textContent?.trim()).toBe(
    'feat: sign the release'
  );
  const commentAuthor = () => commentCard?.querySelector('a.timeline-card-header__author');
  const commitAuthor = () => commitCard?.querySelector('a.commit-list-row__author');
  const authorLinks = [
    {
      author: commentAuthor,
      internal: '/dashboard/profile?user=octocat',
      external: 'https://github.com/octocat',
    },
    {
      author: commitAuthor,
      internal: '/dashboard/profile?user=dependabot[bot]',
      external: 'https://github.com/apps/dependabot',
    },
  ];
  for (const { author, internal } of authorLinks) {
    expect(author()?.getAttribute('href')).toBe(internal);
    expect(author()?.getAttribute('target')).toBeNull();
  }

  opensGitHubLinks.value = true;
  await nextTick();

  for (const { author, external } of authorLinks) {
    expect(author()?.getAttribute('href')).toBe(external);
    expect(author()?.getAttribute('target')).toBe('_blank');
  }
});

test('getStateReasonClass maps issue state reasons onto semantic gp-tag tone modifiers', () => {
  expect(timelineEvents.getStateReasonClass('COMPLETED')).toBe('gp-tag--success');
  expect(timelineEvents.getStateReasonClass('completed')).toBe('gp-tag--success');
  expect(timelineEvents.getStateReasonClass('DUPLICATE')).toBe('gp-tag--link');
  expect(timelineEvents.getStateReasonClass('NOT_PLANNED')).toBe('gp-tag--warning');
  expect(timelineEvents.getStateReasonClass('REOPENED')).toBe('gp-tag--primary');
  expect(timelineEvents.getStateReasonClass(undefined)).toBe('gp-tag--info');
  expect(timelineEvents.getStateReasonClass('unknown')).toBe('gp-tag--info');
});
