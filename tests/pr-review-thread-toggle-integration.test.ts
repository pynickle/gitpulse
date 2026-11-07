import { describe, expect, test } from 'bun:test';

import { defineComponent, h, nextTick, reactive, ref } from 'vue';

import * as prReviewPatch from '../shared/utils/pr-review-patch';
import { compileVue } from './helpers/compile-vue';
import { createVueDom } from './helpers/vue-dom';

const empty = defineComponent({ setup: () => () => h('span') });

const i18n = {
  useI18n: () => ({ t: (key: string) => key, locale: ref('en') }),
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
  return compileVue(
    'app/components/dashboard/pr/PRTimelineReviewCard.vue',
    {
      '@lucide/vue': {
        CheckIcon: empty,
        ChevronRightIcon: empty,
        ClockIcon: empty,
        MessageSquareIcon: empty,
        SlashIcon: empty,
        XIcon: empty,
      },
      'vue-i18n': i18n,
      '#shared/utils/pr-review-patch': prReviewPatch,
      '~/components/dashboard/pr/PRReviewThreadToggle.vue': { default: Toggle },
      '~/components/dashboard/pr/PRTimelineReviewDiff.vue': { default: empty },
      '~/components/dashboard/timeline/TimelineCommentCard.vue': { default: empty },
      '~/components/ui/GitHubAvatar.vue': { default: empty },
      '~/components/ui/LoadingIcon.vue': { default: empty },
      '~/components/ui/MarkdownRenderer.vue': { default: empty },
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
