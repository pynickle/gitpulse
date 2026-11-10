import { describe, expect, mock, test } from 'bun:test';

import { defineComponent, h, nextTick, reactive, ref } from 'vue';

import * as prReviewPatch from '../shared/utils/pr-review-patch';
import { commentModerationModules } from './helpers/comment-moderation';
import { compileVue } from './helpers/compile-vue';
import { createVueDom } from './helpers/vue-dom';

mock.module('~/utils/parseGitHubMarkdownTarget', () => ({
  parseGitHubMarkdownTarget: () => null,
}));
mock.module('~/utils/parseGitHubRepoPath', () => ({
  parseGitHubRepoPath: () => null,
}));

const timelineEvents = await import('../app/composables/usePRTimelineEvents');

const empty = defineComponent({ setup: () => () => h('span') });

const lucideIcon = (name: string) =>
  defineComponent({
    name,
    setup: () => () => h('span', { class: `lucide-${name}` }),
  });

const icons = {
  BanIcon: lucideIcon('Ban'),
  CheckIcon: lucideIcon('Check'),
  ChevronRightIcon: lucideIcon('ChevronRight'),
  ClockIcon: lucideIcon('Clock'),
  MessageSquareIcon: lucideIcon('MessageSquare'),
  UsersIcon: lucideIcon('Users'),
  XIcon: lucideIcon('X'),
};

const i18n = {
  useI18n: () => ({ t: (key: string) => key, locale: ref('en') }),
};

const loadTimelineTime = async () =>
  compileVue(
    'app/components/dashboard/timeline/TimelineEventTime.vue',
    {
      '@lucide/vue': { ClockIcon: icons.ClockIcon },
      'vue-i18n': i18n,
      '~/utils/formatDurationFromNow': { formatDurationFromNow: () => 'now' },
      '~/composables/useRelativeTimeNow': { useRelativeTimeNow: () => 0 },
    },
    { useRelativeTimeNow: '~/composables/useRelativeTimeNow' }
  );

const loadTimelineNote = async () => {
  const Time = await loadTimelineTime();
  return compileVue('app/components/dashboard/timeline/TimelineEventNote.vue', {
    '~/components/dashboard/timeline/TimelineEventTime.vue': { default: Time },
  });
};

const loadToggle = () =>
  compileVue(
    'app/components/dashboard/pr/PRReviewThreadToggle.vue',
    {
      '@lucide/vue': { CheckIcon: empty, CircleIcon: empty },
      '~/components/ui/LoadingIcon.vue': { default: empty },
      'vue-i18n': i18n,
    },
    { useI18n: 'vue-i18n' }
  );

const loadTimelineCard = async () => {
  const Toggle = await loadToggle();
  const Time = await loadTimelineTime();
  const Note = await loadTimelineNote();
  return compileVue(
    'app/components/dashboard/pr/PRTimelineReviewCard.vue',
    {
      ...(await commentModerationModules()),
      '@lucide/vue': icons,
      'vue-i18n': i18n,
      '#shared/utils/pr-review-patch': prReviewPatch,
      '~/components/dashboard/pr/PRReviewThreadToggle.vue': { default: Toggle },
      '~/components/dashboard/pr/PRTimelineReviewDiff.vue': { default: empty },
      '~/components/dashboard/timeline/TimelineCommentCard.vue': { default: empty },
      '~/components/dashboard/timeline/TimelineCardHeader.vue': { default: empty },
      '~/components/dashboard/timeline/TimelineEventNote.vue': { default: Note },
      '~/components/dashboard/timeline/TimelineEventTime.vue': { default: Time },
      '~/components/ui/GitHubAvatar.vue': { default: empty },
      '~/components/ui/LoadingIcon.vue': { default: empty },
      '~/components/ui/MarkdownRenderer.vue': { default: empty },
      '~/composables/usePRTimelineEvents': timelineEvents,
      '~/utils/formatDurationFromNow': { formatDurationFromNow: () => 'now' },
      '~/composables/useRelativeTimeNow': { useRelativeTimeNow: () => 0 },
    },
    { useRelativeTimeNow: '~/composables/useRelativeTimeNow' }
  );
};

const loadThreadPills = async () => {
  const Toggle = await loadToggle();
  return compileVue(
    'app/components/dashboard/pr/PRReviewDiffReviewThreads.vue',
    {
      ...(await commentModerationModules()),
      'vue-i18n': i18n,
      '~/components/dashboard/pr/PRReviewThreadToggle.vue': { default: Toggle },
      '~/components/ui/GitHubAvatar.vue': { default: empty },
      '~/components/ui/LoadingIcon.vue': { default: empty },
      '~/components/ui/MarkdownRenderer.vue': { default: empty },
      '~/utils/formatDurationFromNow': { formatDurationFromNow: () => 'now' },
      '~/composables/useRelativeTimeNow': { useRelativeTimeNow: () => 0 },
    },
    {
      formatDurationFromNow: '~/utils/formatDurationFromNow',
      useI18n: 'vue-i18n',
      useRelativeTimeNow: '~/composables/useRelativeTimeNow',
    }
  );
};

const reviewItem = () => ({
  id: 'review-1',
  state: 'commented',
  createdAt: '2026-11-07T00:00:00Z',
  author: { login: 'octo', url: 'https://github.com/octo', avatarUrl: '' },
  body: '',
  reviewComments: [
    {
      id: 'comment-1',
      path: 'src/app.ts',
      threadId: 'thread-1',
      isResolved: false,
      body: 'Please fix this.',
      createdAt: '2026-11-07T00:00:00Z',
      author: { login: 'octo', url: 'https://github.com/octo', avatarUrl: '' },
      line: 2,
      side: 'RIGHT',
      diffHunk: '@@ -1,2 +1,2 @@\n-const a = 1;\n+const a = 2;\n',
    },
  ],
});

describe('timeline review card thread toggle', () => {
  test('the time-line card toggles its review thread through the shared button', async () => {
    const Card = await loadTimelineCard();
    const props = reactive({
      item: reviewItem(),
      repoOwner: 'octo',
      repoName: 'app',
      resolvingReviewThreadId: null as string | null,
    });
    const toggles: Array<{ threadId: string; resolved: boolean }> = [];
    const dom = createVueDom();
    const view = dom.mount(
      defineComponent({
        setup: () => () =>
          h(Card, {
            ...props,
            // Stands in for PRDetail: the click starts the request; the new state lands later.
            'onToggle-review-thread': (payload: { threadId: string; resolved: boolean }) => {
              toggles.push(payload);
              props.resolvingReviewThreadId = payload.threadId;
            },
          }),
      })
    );
    try {
      await nextTick();
      expect(view.root.querySelector('.pr-review-thread-toggle')).toBeNull();

      view.root.querySelector<HTMLElement>('.review-item__file-toggle')!.click();
      await nextTick();

      const toggle = view.root.querySelector<HTMLButtonElement>('.pr-review-thread-toggle')!;
      expect(toggle.getAttribute('aria-pressed')).toBe('false');
      toggle.click();
      await nextTick();
      expect(toggles).toEqual([{ threadId: 'thread-1', resolved: true }]);
      expect(toggle.getAttribute('aria-pressed')).toBe('false');
      expect(toggle.getAttribute('aria-disabled')).toBe('true');
      expect(toggle.querySelector('.pr-review-thread-toggle__spinner.is-active')).not.toBeNull();
      expect(toggle.disabled).toBe(false);

      props.item.reviewComments[0]!.isResolved = true;
      props.resolvingReviewThreadId = null;
      await nextTick();
      expect(toggle.getAttribute('aria-pressed')).toBe('true');
      expect(toggle.querySelector('.pr-review-thread-toggle__spinner.is-active')).toBeNull();
    } finally {
      await dom.cleanup();
    }
  });
});

describe('timeline review card header', () => {
  const renderFor = async (state: 'approved' | 'commented') => {
    const Card = await loadTimelineCard();
    const dom = createVueDom();
    const view = dom.mount(
      defineComponent({
        setup: () => () =>
          h(Card, {
            item: { ...reviewItem(), state },
            repoOwner: 'octo',
            repoName: 'app',
          }),
      })
    );
    await nextTick();
    return { dom, text: view.root.textContent ?? '' };
  };

  test('a verdict keeps its label in the review header', async () => {
    const { dom, text } = await renderFor('approved');
    try {
      expect(text).toContain('prReview.timelineApprovedChanges');
    } finally {
      await dom.cleanup();
    }
  });

  test('a review that only comments reads without a verdict label', async () => {
    const { dom, text } = await renderFor('commented');
    try {
      expect(text).not.toContain('prReview.timelineCommented');
    } finally {
      await dom.cleanup();
    }
  });
});

describe('timeline review card verdict details', () => {
  const render = async (item: Record<string, unknown>) => {
    const Card = await loadTimelineCard();
    const dom = createVueDom();
    const view = dom.mount(
      defineComponent({
        setup: () => () => h(Card, { item, repoOwner: 'octo', repoName: 'app' }),
      })
    );
    await nextTick();
    return { dom, root: view.root };
  };

  test('a dismissed verdict keeps its approval badge, pill and dismissal note', async () => {
    const { dom, root } = await render({
      ...reviewItem(),
      state: 'approved',
      dismissal: {
        actor: { login: 'dragon', url: 'https://github.com/dragon' },
        createdAt: '2026-11-08T00:00:00Z',
      },
    });
    try {
      const heading = root.querySelector('.review-item__heading')!;
      const children = Array.from(heading.children);
      const pillIndex = children.findIndex((child) =>
        child.classList.contains('review-item__dismissed-note')
      );
      const timeIndex = children.findIndex((child) =>
        child.classList.contains('timeline-event-time')
      );
      expect(pillIndex).toBeGreaterThanOrEqual(0);
      expect(timeIndex).toBeGreaterThan(pillIndex);
      expect(heading.querySelector('.review-item__badge .lucide-Check')).not.toBeNull();

      const note = root.querySelector('.review-item__dismissal')!;
      expect(note.querySelector('.lucide-Ban')).not.toBeNull();
      expect(note.querySelector('.timeline-event-time .lucide-Clock')).not.toBeNull();
      expect(note.textContent).toContain('prReview.timelineDismissed');
      expect(note.querySelector('a')?.getAttribute('href')).toBe('https://github.com/dragon');
    } finally {
      await dom.cleanup();
    }
  });

  test('a verdict submitted on behalf of a team shows the team row', async () => {
    const { dom, root } = await render({
      ...reviewItem(),
      state: 'approved',
      onBehalfOf: [
        {
          name: 'Reviewers',
          slug: 'reviewers',
          url: 'https://github.com/orgs/octo/teams/reviewers',
          organizationLogin: 'octo',
        },
      ],
    });
    try {
      const note = root.querySelector('.review-item__on-behalf-of')!;
      expect(note.textContent).toContain('prReview.timelineOnBehalfOf');
      expect(note.textContent).toContain('octo/Reviewers');
      expect(note.querySelector('a')?.getAttribute('href')).toBe(
        'https://github.com/orgs/octo/teams/reviewers'
      );
      expect(note.querySelector('.lucide-Users')).not.toBeNull();
    } finally {
      await dom.cleanup();
    }
  });

  test('a verdict header shows a clock before its timestamp', async () => {
    const { dom, root } = await render({ ...reviewItem(), state: 'approved' });
    try {
      expect(
        root.querySelector('.review-item__heading .timeline-event-time .lucide-Clock')
      ).not.toBeNull();
    } finally {
      await dom.cleanup();
    }
  });
});

describe('diff viewer thread toggle', () => {
  test('the diff viewer places the shared button in the comment top-right and forwards its toggle', async () => {
    const Threads = await loadThreadPills();
    const props = reactive({
      threads: [
        {
          id: 'thread-1',
          threadId: 'thread-1',
          isResolved: true,
          comments: [
            {
              id: 'comment-1',
              author: { login: 'octo', url: '', avatarUrl: '' },
              body: 'Nice.',
              createdAt: '2026-11-07T00:00:00Z',
            },
          ],
        },
      ],
      repoOwner: 'octo',
      repoName: 'app',
      resolvingReviewThreadId: null as string | null,
    });
    const toggles: Array<{ threadId: string; resolved: boolean }> = [];
    const dom = createVueDom();
    const view = dom.mount(
      defineComponent({
        setup: () => () =>
          h(Threads, {
            ...props,
            'onToggle-review-thread': (payload: { threadId: string; resolved: boolean }) =>
              toggles.push(payload),
          }),
      })
    );
    try {
      await nextTick();

      const toggle = view.root.querySelector<HTMLButtonElement>('.pr-review-thread-toggle')!;
      expect(toggle.classList.contains('pr-review-diff-viewer__thread-action')).toBe(true);
      expect(toggle.getAttribute('aria-pressed')).toBe('true');
      toggle.click();
      await nextTick();
      expect(toggles).toEqual([{ threadId: 'thread-1', resolved: false }]);
    } finally {
      await dom.cleanup();
    }
  });
});
