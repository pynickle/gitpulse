import { afterEach, beforeEach, expect, test } from 'bun:test';

import { computed, defineComponent, h, nextTick, ref, shallowRef } from 'vue';

import type { IssueTimelineItem } from '../app/composables/useIssueTimelineEvents';
import { buildTimelineCommitPayload } from '../app/utils/buildTimelineCommitPayload';
import { commitVerificationMark } from '../app/utils/commitVerification';
import * as reactions from '../shared/utils/reactions';
import { compileVue } from './helpers/compile-vue';
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

const timelineEvents = {
  useIssueTimelineEvents: (items: () => IssueTimelineItem[]) => ({
    processedTimeline: computed(() =>
      items().map((item, index) => ({ ...item, renderKey: `timeline-${index}` }))
    ),
  }),
};

const CommitListRow = await compileVue(
  'app/components/dashboard/detail/CommitListRow.vue',
  {
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

const IssueTimelineEvents = await compileVue(
  'app/components/dashboard/issue/IssueTimelineEvents.vue',
  {
    'vue-i18n': i18n,
    '~/components/dashboard/timeline/TimelineCommentCard.vue': { default: TimelineCommentCard },
    '~/components/dashboard/issue/IssueTimelineCommitCard.vue': {
      default: IssueTimelineCommitCard,
    },
    '~/components/dashboard/issue/IssueTimelineEventBody.vue': { default: empty },
    '~/components/dashboard/issue/IssueTimelineReferencedEventCard.vue': { default: empty },
    '~/components/dashboard/timeline/DeferredFloatingMarkdownEditor.vue': { default: empty },
    '~/components/dashboard/timeline/TimelineEventActorRow.vue': { default: empty },
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
    author: { name: 'Local Dev', user: { login: 'octocat' } },
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

test('the issue timeline shows its comment and commit through the shared cards', async () => {
  const view = dom.mount(
    defineComponent({
      setup: () => () =>
        h(IssueTimelineEvents as never, {
          timeline: [comment, commit],
          loading: false,
          repoOwner: 'acme',
          repoName: 'widgets',
          issueNumber: 7,
        }),
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
  expect(commitCard?.querySelector('.commit-list-row__author')?.getAttribute('href')).toBe(
    'https://github.com/octocat'
  );
});
