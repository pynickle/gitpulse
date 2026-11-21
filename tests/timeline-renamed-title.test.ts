import { afterEach, beforeEach, expect, mock, test } from 'bun:test';

import { defineComponent, h, ref, shallowRef } from 'vue';

import { compileVue } from './helpers/compile-vue';
import { githubProfileLinkModules } from './helpers/github-profile-link';
import { createVueDom } from './helpers/vue-dom';

mock.module(
  '~/utils/parseGitHubMarkdownTarget',
  () => import('../app/utils/parseGitHubMarkdownTarget')
);
mock.module('~/utils/parseGitHubRepoPath', () => import('../app/utils/parseGitHubRepoPath'));

const issueTimelineEvents = await import('../app/composables/useIssueTimelineEvents');
const prTimelineEvents = await import('../app/composables/usePRTimelineEvents');

const i18n = {
  useI18n: () => ({
    t: (key: string) => key,
    locale: ref('en'),
  }),
};

const empty = defineComponent({ setup: () => () => h('span') });

const avatarStub = defineComponent({
  props: { alt: { type: String, default: '' } },
  setup: (props) => () => h('span', { class: 'avatar-stub', 'data-alt': props.alt }),
});

const eventBodyStub = defineComponent({
  props: { item: { type: Object, default: null } },
  setup: (props) => () =>
    h('span', { class: 'event-body-stub' }, String(props.item?.eventType ?? '')),
});

const time = { useRelativeTimeNow: () => shallowRef(0) };
const formatTime = { formatDurationFromNow: () => '2 hours ago' };

const TimelineRenamedTitleEvent = await compileVue(
  'app/components/dashboard/timeline/TimelineRenamedTitleEvent.vue',
  {
    ...githubProfileLinkModules,
    'vue-i18n': i18n,
    '~/components/ui/GitHubAvatar.vue': { default: avatarStub },
    '~/utils/formatDurationFromNow': formatTime,
    'virtual:time': time,
  },
  { useRelativeTimeNow: 'virtual:time' }
);

const TimelineEventActorRow = await compileVue(
  'app/components/dashboard/timeline/TimelineEventActorRow.vue',
  { '~/components/ui/GitHubAvatar.vue': { default: avatarStub } }
);

const renamedModules = {
  ...githubProfileLinkModules,
  'vue-i18n': i18n,
  '~/components/dashboard/timeline/DeferredFloatingMarkdownEditor.vue': { default: empty },
  '~/components/dashboard/timeline/TimelineEventActorRow.vue': { default: TimelineEventActorRow },
  '~/components/dashboard/timeline/TimelineRenamedTitleEvent.vue': {
    default: TimelineRenamedTitleEvent,
  },
  '~/components/ui/LoadingIcon.vue': { default: empty },
};

const IssueTimelineEvents = await compileVue(
  'app/components/dashboard/issue/IssueTimelineEvents.vue',
  {
    ...renamedModules,
    '~/components/dashboard/issue/IssueTimelineCommitCard.vue': { default: empty },
    '~/components/dashboard/issue/IssueTimelineEventBody.vue': { default: eventBodyStub },
    '~/components/dashboard/issue/IssueTimelineReferencedEventCard.vue': { default: empty },
    '~/components/dashboard/timeline/TimelineCommentCard.vue': { default: empty },
    '~/composables/useIssueTimelineEvents': issueTimelineEvents,
  }
);

const PRTimelineEvents = await compileVue('app/components/dashboard/pr/PRTimelineEvents.vue', {
  ...renamedModules,
  '~/components/dashboard/pr/PRTimelineCommentCard.vue': { default: empty },
  '~/components/dashboard/pr/PRTimelineCommitCard.vue': { default: empty },
  '~/components/dashboard/pr/PRTimelineEventBody.vue': { default: eventBodyStub },
  '~/components/dashboard/pr/PRTimelineMergeCard.vue': { default: empty },
  '~/components/dashboard/pr/PRTimelineReviewCard.vue': { default: empty },
  '~/composables/usePRTimelineEvents': prTimelineEvents,
});

const actor = {
  login: 'Chiloven945',
  name: 'ChilovenBustiang',
  url: 'https://github.com/Chiloven945',
  avatarUrl: 'https://example.test/avatar.png',
};

let dom: ReturnType<typeof createVueDom>;

beforeEach(() => {
  dom = createVueDom();
});

afterEach(async () => {
  await dom.cleanup();
});

function renderRenamed(root: ParentNode) {
  const event = root.querySelector('.timeline-renamed');
  expect(event).not.toBeNull();
  const action = event?.querySelector(':scope > .timeline-renamed__action');
  const titles = event?.querySelector(':scope > .timeline-renamed__titles');
  const avatar = event?.querySelector(':scope > .avatar-stub');
  expect(action).not.toBeNull();
  expect(titles).not.toBeNull();
  expect(avatar).not.toBeNull();
  expect(titles?.contains(avatar ?? null)).toBe(false);
  expect(action?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
    'Chiloven945 (ChilovenBustiang) changed the title 2 hours ago'
  );
  expect(action?.querySelector('a')?.getAttribute('href')).toBe(
    '/dashboard/profile?user=Chiloven945'
  );
  expect(titles?.querySelector('del')?.textContent?.trim()).toBe('old title');
  expect(
    Array.from(titles?.querySelectorAll('.timeline-renamed__title') ?? [], (node) =>
      node.textContent?.trim()
    )
  ).toEqual(['old title', 'new title']);
  expect(titles?.querySelector('p')?.textContent?.trim()).toBe('new title');
}

test('a renamed title puts the avatar on the first line and strikes the previous title', () => {
  const view = dom.mount(
    defineComponent({
      setup: () => () =>
        h(TimelineRenamedTitleEvent, {
          actor,
          previousTitle: 'old title',
          currentTitle: 'new title',
          createdAt: '2026-11-22T00:00:00Z',
        }),
    })
  );

  renderRenamed(view.root);
});

test('a renamed title omits a repeated display name and a missing previous title', () => {
  const view = dom.mount(
    defineComponent({
      setup: () => () =>
        h(TimelineRenamedTitleEvent, {
          actor: { login: 'octocat', name: 'Octocat' },
          currentTitle: 'only the new title',
          createdAt: '2026-11-22T00:00:00Z',
        }),
    })
  );

  const event = view.root.querySelector('.timeline-renamed');
  expect(
    event?.querySelector('.timeline-renamed__action')?.textContent?.replace(/\s+/g, ' ').trim()
  ).toBe('octocat changed the title 2 hours ago');
  expect(event?.querySelector('del')).toBeNull();
  expect(event?.querySelector('.timeline-renamed__title')?.textContent?.trim()).toBe(
    'only the new title'
  );
});

test('issue and pull request timelines share the renamed title layout', () => {
  const timeline = [
    {
      kind: 'event' as const,
      eventType: 'renamed',
      actor,
      previousTitle: 'old title',
      currentTitle: 'new title',
      createdAt: '2026-11-22T00:00:00Z',
    },
    {
      kind: 'event' as const,
      eventType: 'labeled',
      actor: { login: 'octocat' },
      createdAt: '2026-11-22T01:00:00Z',
    },
  ];

  for (const List of [IssueTimelineEvents, PRTimelineEvents]) {
    const view = dom.mount(
      defineComponent({
        setup: () => () =>
          h(List as never, {
            timeline,
            loading: false,
            repoOwner: 'acme',
            repoName: 'widgets',
            issueNumber: 7,
            pullNumber: 7,
          }),
      })
    );

    renderRenamed(view.root);
    expect(view.root.querySelectorAll('.timeline-renamed')).toHaveLength(1);
    expect(view.root.querySelector('.event-body-stub')?.textContent).toBe('labeled');
    expect(view.root.querySelectorAll('.avatar-stub')).toHaveLength(2);
    view.unmount();
  }
});
