import { expect, mock, test } from 'bun:test';

import { defineComponent, h, nextTick, ref, Suspense, type Component } from 'vue';

import useDetailCompactHeader from '../app/composables/useDetailCompactHeader';
import { useModalState } from '../app/composables/useModalState';
import { getFetchErrorMessage } from '../app/utils/getFetchErrorMessage';
import * as tokenizeCodeLine from '../app/utils/tokenizeCodeLine';
import * as contract from '../shared/types/comment-moderation';
import * as prReviewPatch from '../shared/utils/pr-review-patch';
import { commentModerationModules } from './helpers/comment-moderation';
import { commentPresentationModules } from './helpers/comment-presentation';
import { compileVue } from './helpers/compile-vue';
import { ScrollArea } from './helpers/scroll-area';
import { createVueDom } from './helpers/vue-dom';

mock.module(
  '~/utils/parseGitHubMarkdownTarget',
  () => import('../app/utils/parseGitHubMarkdownTarget')
);
mock.module('~/utils/parseGitHubRepoPath', () => import('../app/utils/parseGitHubRepoPath'));
const timelineEvents = await import('../app/composables/usePRTimelineEvents');

const createDom = (extra: Record<string, unknown> = {}) => {
  const nuxtApp = {};
  const dom = createVueDom({
    useNuxtApp: () => nuxtApp,
    useUserSession: () => ({ user: ref(null) }),
    useGitPulseApiFetch: () => async () => ({}),
    ...extra,
  });
  return {
    ...dom,
    mount: (component: Component) =>
      dom.mount(
        defineComponent({
          setup: () => () => h(Suspense, null, { default: () => h(component) }),
        })
      ),
  };
};
const i18n = {
  useI18n: () => ({
    t: (key: string, params?: { count?: number }) =>
      params?.count == null ? key : `${key}:${params.count}`,
    locale: ref('en'),
  }),
};
const empty = defineComponent({ setup: () => () => h('span') });
async function loadComponents() {
  const presentation = await commentPresentationModules();
  const moderation = await commentModerationModules();
  const Header = await compileVue('app/components/dashboard/timeline/TimelineCardHeader.vue', {
    'vue-i18n': i18n,
    ...presentation,
    ...moderation,
    '~/utils/formatDurationFromNow': { formatDurationFromNow: () => 'now' },
  });
  const Card = await compileVue('app/components/dashboard/timeline/TimelineCommentCard.vue', {
    'vue-i18n': i18n,
    '~/components/dashboard/timeline/TimelineCardHeader.vue': { default: Header },
    ...moderation,
    ...presentation,
    '~/components/dashboard/reactions/ReactionBar.vue': { default: empty },
    '#shared/utils/reactions': await import('../shared/utils/reactions'),
  });
  const shared = {
    'vue-i18n': i18n,
    ...moderation,
    ...presentation,
    '~/components/dashboard/pr/PRReviewThreadToggle.vue': { default: empty },
    '~/utils/formatDurationFromNow': { formatDurationFromNow: () => 'now' },
  };
  const Replies = await compileVue(
    'app/components/dashboard/discussion/DiscussionReplyList.vue',
    shared
  );
  const Answer = await compileVue(
    'app/components/dashboard/discussion/DiscussionAnswerCard.vue',
    shared
  );
  const Discussion = await compileVue(
    'app/components/dashboard/discussion/DiscussionCommentCard.vue',
    {
      ...shared,
      '~/components/dashboard/discussion/DiscussionReplyList.vue': { default: Replies },
      '~/components/dashboard/timeline/DeferredFloatingMarkdownEditor.vue': { default: empty },
    }
  );
  const Threads = await compileVue(
    'app/components/dashboard/pr/PRReviewDiffReviewThreads.vue',
    shared,
    { useI18n: 'vue-i18n', formatDurationFromNow: '~/utils/formatDurationFromNow' }
  );
  const Time = await compileVue('app/components/dashboard/timeline/TimelineEventTime.vue', shared);
  const Note = await compileVue('app/components/dashboard/timeline/TimelineEventNote.vue', {
    '~/components/dashboard/timeline/TimelineEventTime.vue': { default: Time },
  });
  const Diff = await compileVue('app/components/dashboard/pr/PRTimelineReviewDiff.vue', {
    '#shared/utils/pr-review-patch': prReviewPatch,
    '~/utils/tokenizeCodeLine': tokenizeCodeLine,
  });
  const Review = await compileVue('app/components/dashboard/pr/PRTimelineReviewCard.vue', {
    ...shared,
    '#shared/utils/pr-review-patch': prReviewPatch,
    '~/components/dashboard/timeline/TimelineCommentCard.vue': { default: Card },
    '~/components/dashboard/timeline/TimelineCardHeader.vue': { default: Header },
    '~/components/dashboard/timeline/TimelineEventTime.vue': { default: Time },
    '~/components/dashboard/timeline/TimelineEventNote.vue': { default: Note },
    '~/components/dashboard/pr/PRTimelineReviewDiff.vue': { default: Diff },
    '~/composables/usePRTimelineEvents': timelineEvents,
  });
  return { ...moderation, Card, Replies, Answer, Discussion, Threads, Review, shared };
}
const target = (): contract.CommentModeration => ({
  resourceType: 'IssueComment',
  nodeId: 'IC_1',
  isMinimized: false,
  minimizedReason: null,
  viewerCanDelete: true,
  viewerCanMinimize: true,
  viewerCanUnminimize: false,
});
const flush = async () => {
  await Bun.sleep(0);
  await nextTick();
};
const button = (root: ParentNode, text: string) =>
  [...root.querySelectorAll<HTMLButtonElement>('button')].find(
    (el) => el.textContent?.trim() === text
  )!;
// A dialog stage replaces the anchored menu once that menu's exit has run; this DOM
// applies no stylesheet, so wait for the element instead of guessing a delay.
const findDialog = async (dom: ReturnType<typeof createDom>) => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const dialog = dom.document.querySelector<HTMLElement>('[role="dialog"]');
    if (dialog) return dialog;
    await Bun.sleep(10);
    await nextTick();
  }
  throw new Error('the comment dialog never opened');
};
const settleMotion = async () => {
  await Bun.sleep(140);
  await nextTick();
};
// A reason is a native radio in a label, so choosing one is a change on the input.
const chooseReason = (dialog: HTMLElement, reason: string) => {
  const input = dialog.querySelector<HTMLInputElement>(`input[type="radio"][value="${reason}"]`)!;
  input.click();
};

test('real comment header opens reasons with no selection and writes only on explicit Hide', async () => {
  const { Card } = await loadComponents();
  const writes: unknown[] = [];
  const dom = createDom({
    useRelativeTimeNow: () => 0,
    useGitPulseApiFetch: () => async (_url: string, options: unknown) => {
      writes.push(options);
      return {
        moderation: {
          ...target(),
          isMinimized: true,
          minimizedReason: 'off-topic',
          viewerCanUnminimize: true,
        },
      };
    },
  });
  try {
    const view = dom.mount(
      defineComponent({
        setup: () => () =>
          h(Card, {
            item: {
              id: '1',
              body: 'Keep the context readable',
              author: { login: 'octo' },
              moderation: target(),
            },
            enableReactions: false,
          }),
      })
    );
    await flush();
    const trigger = view.root.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')!;
    expect(trigger).not.toBeNull();
    trigger.click();
    await flush();
    button(dom.document, 'commentModeration.hide').click();
    const dialog = await findDialog(dom);
    expect(dialog.querySelector('input[type="radio"]:checked')).toBeNull();
    expect(button(dialog, 'commentModeration.hide').disabled).toBe(true);
    chooseReason(dialog, 'OFF_TOPIC');
    await flush();
    expect(writes).toEqual([]);
    button(dialog, 'commentModeration.hide').click();
    await flush();
    expect(writes).toEqual([
      { method: 'POST', body: { nodeId: 'IC_1', action: 'hide', reason: 'OFF_TOPIC' } },
    ]);
    expect(view.root.textContent).not.toContain('Keep the context readable');
    expect(view.root.textContent).toContain('octo');
    const notice = view.root.querySelector('.comment-hidden__state')!;
    expect(notice.textContent).toContain('commentModeration.hidden');
    expect(notice.textContent).toContain('commentModeration.reasons.OFF_TOPIC');
    button(view.root, 'commentModeration.expand').click();
    await flush();
    expect(view.root.textContent).toContain('Keep the context readable');
    expect(writes).toHaveLength(1);
    button(view.root, 'commentModeration.collapse').click();
    await flush();
    // The revealed body leaves the DOM once its fold has closed.
    await Bun.sleep(260);
    expect(view.root.textContent).not.toContain('Keep the context readable');
    expect(writes).toHaveLength(1);
  } finally {
    await dom.cleanup();
  }
});

test.each(['timeline', 'workspace', 'discussion', 'answer', 'review'] as const)(
  '%s uses the shared actions, cancels without writes and syncs hidden state across loaded views',
  async (surface) => {
    const components = await loadComponents();
    const moderation = {
      ...target(),
      resourceType:
        surface === 'review'
          ? 'PullRequestReview'
          : surface === 'workspace'
            ? 'PullRequestReviewComment'
            : surface === 'timeline'
              ? 'IssueComment'
              : 'DiscussionComment',
    };
    const item = {
      state: 'approved',
      id: '1',
      nodeId: 'IC_1',
      body: 'Comment context',
      moderation,
      author: { login: 'octo' },
      isAnswer: true,
      replyToId: null,
      replies: { items: [], totalCount: 0, pageInfo: { hasNextPage: false, endCursor: null } },
    };
    const writes: unknown[] = [];
    const dom = createDom({
      useRelativeTimeNow: () => 0,
      useGitPulseApiFetch: () => async (_url: string, options: unknown) => {
        writes.push(options);
        return { moderation: { ...moderation, isMinimized: true, minimizedReason: 'spam' } };
      },
    });
    try {
      const view = dom.mount(
        defineComponent({
          setup: () => () =>
            h('main', [
              h(
                surface === 'review'
                  ? components.Review
                  : surface === 'timeline'
                    ? components.Card
                    : surface === 'workspace'
                      ? components.Threads
                      : surface === 'answer'
                        ? components.Answer
                        : components.Discussion,
                {
                  item,
                  answer: item,
                  comment: item,
                  repoOwner: 'octo',
                  repoName: 'app',
                  enableReactions: false,
                  threads: [{ id: 'thread', comments: [item] }],
                  submitReply: async () => {},
                  canReply: false,
                  isEditorActive: false,
                  replyDraft: '',
                }
              ),
              h(components.Card, { item, enableReactions: false }),
            ]),
        })
      );
      await flush();
      const triggers = view.root.querySelectorAll<HTMLButtonElement>('[aria-haspopup="menu"]');
      expect(triggers).toHaveLength(2);
      triggers[0]!.focus();
      triggers[0]!.click();
      await flush();
      button(dom.document, 'commentModeration.delete').click();
      const confirmation = await findDialog(dom);
      expect(confirmation.textContent).not.toContain('octo');
      expect(confirmation.textContent).not.toContain('Comment context');
      button(confirmation, 'common.cancel').click();
      await flush();
      expect(writes).toHaveLength(0);
      expect(dom.document.activeElement === triggers[0]).toBe(true);
      triggers[0]!.click();
      await flush();
      button(dom.document, 'commentModeration.hide').click();
      const hideDialog = await findDialog(dom);
      chooseReason(hideDialog, 'SPAM');
      await flush();
      button(hideDialog, 'commentModeration.hide').click();
      await flush();
      expect(view.root.textContent).not.toContain('Comment context');
    } finally {
      await dom.cleanup();
    }
  }
);

test('neither the menu nor a dialog takes the floating composer away', async () => {
  const { Card } = await loadComponents();
  const dom = createDom({ useRelativeTimeNow: () => 0 });
  try {
    // The composer observes this flag: a true hides the reader's open draft.
    const Composer = defineComponent({
      setup() {
        const { isAnyModalOpen } = useModalState();
        return () => h('div', { class: 'composer', 'data-hidden': String(isAnyModalOpen.value) });
      },
    });
    const view = dom.mount(
      defineComponent({
        setup: () => () =>
          h('main', [
            h(Card, { item: { body: 'Context', moderation: target() }, enableReactions: false }),
            h(Composer),
          ]),
      })
    );
    await flush();
    view.root.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')!.click();
    await flush();
    expect(view.root.querySelector('.composer')!.getAttribute('data-hidden')).toBe('false');
    expect(dom.document.querySelector('[role="menu"]')).not.toBeNull();
    button(dom.document, 'commentModeration.delete').click();
    await findDialog(dom);
    expect(view.root.querySelector('.composer')!.getAttribute('data-hidden')).toBe('false');
  } finally {
    await dom.cleanup();
  }
});

test('read-only and unknown capabilities produce no empty menu', async () => {
  const { Card } = await loadComponents();
  const dom = createDom({ useRelativeTimeNow: () => 0 });
  try {
    const view = dom.mount(
      defineComponent({
        setup: () => () =>
          h('main', [
            h(Card, {
              item: {
                body: 'Read-only',
                moderation: { ...target(), viewerCanDelete: false, viewerCanMinimize: false },
              },
              enableReactions: false,
            }),
            h(Card, { item: { body: 'Unknown' }, enableReactions: false }),
          ]),
      })
    );
    await flush();
    expect(view.root.querySelector('[aria-haspopup]')).toBeNull();
    expect(view.root.textContent).toContain('Read-only');
    expect(view.root.textContent).toContain('Unknown');
  } finally {
    await dom.cleanup();
  }
});

test('a hidden Discussion parent leaves open replies readable and each reply respects its own hidden state', async () => {
  const { Discussion } = await loadComponents();
  const parent = {
    id: '1',
    nodeId: 'IC_1',
    body: 'Hidden parent',
    author: null,
    moderation: {
      ...target(),
      resourceType: 'DiscussionComment',
      isMinimized: true,
      minimizedReason: 'low-quality',
      viewerCanUnminimize: true,
    },
    replies: {
      totalCount: 2,
      pageInfo: { hasNextPage: false, endCursor: null },
      items: [
        { id: '2', nodeId: 'DC_2', body: 'Readable reply', author: null },
        {
          id: '3',
          nodeId: 'DC_3',
          body: 'Hidden reply',
          author: null,
          moderation: {
            ...target(),
            nodeId: 'DC_3',
            isMinimized: true,
            minimizedReason: 'outdated',
          },
        },
      ],
    },
  };
  const writes: unknown[] = [];
  const dom = createDom({
    useRelativeTimeNow: () => 0,
    useGitPulseApiFetch: () => async (_url: string, options: unknown) => {
      writes.push(options);
      return { moderation: { ...parent.moderation, isMinimized: false, minimizedReason: null } };
    },
  });
  try {
    const view = dom.mount(
      defineComponent({
        setup: () => () =>
          h(Discussion, {
            comment: parent,
            repoOwner: 'octo',
            repoName: 'app',
            canReply: false,
            replyDraft: '',
            isEditorActive: false,
            submitReply: async () => {},
          }),
      })
    );
    await flush();
    view.root.querySelector<HTMLButtonElement>('.discussion-comment__reply-toggle')!.click();
    await flush();
    expect(view.root.textContent).toContain('Readable reply');
    expect(view.root.textContent).not.toContain('Hidden parent');
    expect(view.root.textContent).not.toContain('Hidden reply');
    expect(view.root.textContent).toContain('commentModeration.reasons.LOW_QUALITY');
    view.root.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')!.click();
    await flush();
    button(dom.document, 'commentModeration.unhide').click();
    await flush();
    expect(dom.document.querySelector('[role="dialog"]')).toBeNull();
    expect(writes).toEqual([{ method: 'POST', body: { nodeId: 'IC_1', action: 'unhide' } }]);
    expect(view.root.textContent).toContain('Hidden parent');
    expect(view.root.textContent).toContain('Readable reply');
    expect(view.root.textContent).not.toContain('Hidden reply');
  } finally {
    await dom.cleanup();
  }
});

test('cancel and Escape do not write; each reason dialog reopens without a selection', async () => {
  const { Card } = await loadComponents();
  const writes: unknown[] = [];
  const dom = createDom({
    useRelativeTimeNow: () => 0,
    useGitPulseApiFetch: () => async (_url: string, options: unknown) => {
      writes.push(options);
    },
  });
  try {
    const view = dom.mount(
      defineComponent({
        setup: () => () =>
          h(Card, { item: { body: 'Context', moderation: target() }, enableReactions: false }),
      })
    );
    await flush();
    const trigger = view.root.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')!;
    trigger.click();
    await flush();
    const menu = dom.document.querySelector('[role="menu"]')!;
    menu.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(dom.document.activeElement?.textContent).toBe('commentModeration.delete');
    menu.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(dom.document.activeElement?.textContent).toBe('commentModeration.hide');
    button(menu, 'commentModeration.hide').click();
    const firstDialog = await findDialog(dom);
    chooseReason(firstDialog, 'ABUSE');
    await flush();
    button(firstDialog, 'common.cancel').click();
    await settleMotion();
    trigger.click();
    await flush();
    button(dom.document, 'commentModeration.hide').click();
    const dialog = await findDialog(dom);
    expect(dialog.querySelector('input[type="radio"]:checked')).toBeNull();
    dialog.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settleMotion();
    expect(dom.document.querySelector('[role="dialog"]')).toBeNull();
    expect(writes).toEqual([]);
  } finally {
    await dom.cleanup();
  }
});

test('a pending delete disables duplicates; refusal keeps content and refreshes permissions', async () => {
  const { Card } = await loadComponents();
  let reject!: (error: unknown) => void;
  const request = new Promise((_resolve, fail) => {
    reject = fail;
  });
  const calls: Array<{ method?: string; query?: unknown }> = [];
  const dom = createDom({
    useRelativeTimeNow: () => 0,
    getFetchErrorMessage,
    useGitPulseApiFetch: () => async (_url: string, options: { method?: string }) => {
      calls.push(options);
      if (options.method === 'POST') return request;
      return { moderation: { ...target(), viewerCanDelete: false, viewerCanMinimize: false } };
    },
  });
  try {
    const view = dom.mount(
      defineComponent({
        setup: () => () =>
          h(Card, {
            item: { body: 'Still readable', moderation: target() },
            enableReactions: false,
          }),
      })
    );
    await flush();
    view.root.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')!.click();
    await flush();
    button(dom.document, 'commentModeration.delete').click();
    const dialog = await findDialog(dom);
    const submit = button(dialog, 'commentModeration.delete');
    submit.click();
    await flush();
    expect(submit.disabled).toBe(true);
    submit.click();
    await flush();
    expect(calls).toHaveLength(1);
    reject(Object.assign(new Error('Permission denied'), { statusCode: 403 }));
    await flush();
    expect(view.root.textContent).toContain('Still readable');
    expect(dom.document.querySelector('[role="alert"]')?.textContent).toContain(
      'Permission denied'
    );
    expect(calls).toHaveLength(2);
    button(dom.document, 'common.cancel').click();
    await flush();
    expect(view.root.querySelector('[aria-haspopup]')).toBeNull();
  } finally {
    await dom.cleanup();
  }
});

test('a refused Unhide keeps the comment hidden and shows the error beside the menu', async () => {
  const { Card } = await loadComponents();
  const hidden = {
    ...target(),
    isMinimized: true,
    minimizedReason: 'spam',
    viewerCanMinimize: false,
    viewerCanUnminimize: true,
  };
  const dom = createDom({
    useRelativeTimeNow: () => 0,
    getFetchErrorMessage,
    useGitPulseApiFetch: () => async (_url: string, options: { method?: string }) => {
      if (options.method === 'POST')
        throw Object.assign(new Error('Permission denied'), { statusCode: 403 });
      return { moderation: hidden };
    },
  });
  try {
    const view = dom.mount(
      defineComponent({
        setup: () => () =>
          h(Card, { item: { body: 'Masked body', moderation: hidden }, enableReactions: false }),
      })
    );
    await flush();
    view.root.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')!.click();
    await flush();
    button(dom.document, 'commentModeration.unhide').click();
    await flush();
    expect(dom.document.querySelector('[role="alert"]')?.textContent).toContain(
      'Permission denied'
    );
    expect(view.root.textContent).not.toContain('Masked body');
    expect(button(dom.document, 'commentModeration.unhide').disabled).toBe(false);
  } finally {
    await dom.cleanup();
  }
});

test('Discussion detail reconciles a wiped accepted parent, keeping replies and clearing its Answer badge', async () => {
  const components = await loadComponents();
  const Comments = await compileVue(
    'app/components/dashboard/discussion/DiscussionComments.vue',
    {
      ...components.shared,
      '~/components/dashboard/discussion/DiscussionCommentCard.vue': {
        default: components.Discussion,
      },
    },
    { useI18n: 'vue-i18n' }
  );
  const Detail = await compileVue('app/components/dashboard/detail/DiscussionDetail.vue', {
    ...components.shared,
    '~/components/dashboard/discussion/DiscussionComments.vue': { default: Comments },
    '~/components/dashboard/discussion/DiscussionAnswerCard.vue': { default: components.Answer },
    '~/components/dashboard/discussion/DiscussionHeader.vue': { default: empty },
    '~/components/dashboard/discussion/DiscussionActions.vue': { default: empty },
    '~/components/dashboard/timeline/DeferredFloatingMarkdownEditor.vue': { default: empty },
    '~/components/ui/ScrollArea.vue': { default: ScrollArea },
    '~/utils/getFetchErrorMessage': { getFetchErrorMessage },
  });
  const pageInfo = { hasNextPage: false, endCursor: null };
  const parent = {
    id: 'IC_1',
    nodeId: 'IC_1',
    body: 'Accepted parent',
    author: null,
    isAnswer: true,
    replyToId: null,
    moderation: { ...target(), resourceType: 'DiscussionComment' },
    replies: {
      items: [
        {
          id: 'DC_2',
          nodeId: 'DC_2',
          body: 'Reply survives',
          author: null,
          isAnswer: false,
          replyToId: 'IC_1',
        },
      ],
      totalCount: 1,
      pageInfo,
    },
  };
  const dom = createDom({
    useDetailCompactHeader,
    useRelativeTimeNow: () => 0,
    useGitPulseApiFetch: () => async () => ({
      deleted: false,
      body: '',
      moderation: parent.moderation,
      discussion: { id: 'D_1', totalCount: 1, answerId: null, isAnswered: false },
    }),
  });
  try {
    const view = dom.mount(
      defineComponent({
        setup: () => () =>
          h(Detail, {
            discussion: {
              id: 'D_1',
              nodeId: 'D_1',
              number: 1,
              title: 'Discussion',
              body: '',
              owner: 'octo',
              repo: 'app',
              locked: true,
              author: null,
              category: null,
              answer: parent,
              isAnswered: true,
              comments: { items: [parent], totalCount: 1, pageInfo },
            },
          }),
      })
    );
    await flush();
    button(view.root, 'discussionDetail.replyCount:1').click();
    await flush();
    expect(view.root.querySelector('.tag.is-success')).not.toBeNull();
    view.root.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')!.click();
    await flush();
    button(dom.document, 'commentModeration.delete').click();
    const confirm = await findDialog(dom);
    button(confirm, 'commentModeration.delete').click();
    await flush();
    expect(view.root.textContent).toContain('Reply survives');
    expect(view.root.textContent).not.toContain('Accepted parent');
    expect(view.root.querySelector('.tag.is-success') === null).toBe(true);
    expect(view.root.textContent).toContain('discussionDetail.commentCount:1');
  } finally {
    await dom.cleanup();
  }
});

test('deleting a review preserves all loaded timeline pages and the existing scroll container', async () => {
  const components = await loadComponents();
  const TimelineCard = await compileVue('app/components/dashboard/pr/PRTimelineCommentCard.vue', {
    ...components.shared,
    '~/components/dashboard/timeline/TimelineCommentCard.vue': { default: components.Card },
  });
  const Timeline = await compileVue('app/components/dashboard/pr/PRTimelineEvents.vue', {
    ...components.shared,
    '~/composables/usePRTimelineEvents': timelineEvents,
    '~/components/dashboard/pr/PRTimelineCommentCard.vue': { default: TimelineCard },
    '~/components/dashboard/pr/PRTimelineReviewCard.vue': { default: components.Review },
    '~/components/dashboard/pr/PRTimelineCommitCard.vue': { default: empty },
    '~/components/dashboard/pr/PRTimelineEventBody.vue': { default: empty },
    '~/components/dashboard/pr/PRTimelineMergeCard.vue': { default: empty },
    '~/components/dashboard/timeline/DeferredFloatingMarkdownEditor.vue': { default: empty },
    '~/components/dashboard/timeline/TimelineEventActorRow.vue': { default: empty },
    '~/components/ui/LoadingIcon.vue': { default: empty },
  });
  mock.module('~/utils/getFetchErrorMessage', () => import('../app/utils/getFetchErrorMessage'));
  mock.module(
    '~/utils/withPendingPaginationPage',
    () => import('../app/utils/withPendingPaginationPage')
  );
  const commitList = await import('../app/composables/usePRCommitList');
  const reviewers = await import('../app/composables/usePRReviewers');
  const permissions = await import('../app/utils/createEmptyRepoPermissions');
  const Detail = await compileVue(
    'app/components/dashboard/detail/PRDetail.vue',
    {
      ...components.shared,
      '~/components/dashboard/pr/PRTimelineEvents.vue': { default: Timeline },
      '~/components/ui/ScrollArea.vue': { default: ScrollArea },
      '~/components/dashboard/DashboardPagination.vue': { default: empty },
      '~/components/dashboard/detail/DetailAssignees.vue': { default: empty },
      '~/components/dashboard/detail/DetailLabels.vue': { default: empty },
      '~/components/dashboard/detail/RepoCommitList.vue': { default: empty },
      '~/components/dashboard/pr/PRActions.vue': { default: empty },
      '~/components/dashboard/pr/PRHeader.vue': { default: empty },
      '~/components/dashboard/pr/PRMergeBox.vue': { default: empty },
      '~/composables/usePRCommitList': commitList,
      '~/composables/usePRReviewers': reviewers,
      '~/utils/createEmptyRepoPermissions': permissions,
      '~/utils/createPullRequestDetailViewModel':
        await import('../app/utils/createPullRequestDetailViewModel'),
      '~/utils/formatPageMetaDescription': await import('../app/utils/formatPageMetaDescription'),
      '~/utils/getFetchErrorMessage': { getFetchErrorMessage },
      '~/utils/handleRovingTablistKeydown': await import('../app/utils/handleRovingTablistKeydown'),
      '~/utils/parseGitHubRepoPath': await import('../app/utils/parseGitHubRepoPath'),
    },
    { useI18n: 'vue-i18n' }
  );
  const pullRequest = {
    number: 1,
    title: 'PR',
    repository_url: 'https://api.github.com/repos/octo/app',
    head: { sha: 'sha' },
    state: 'open',
  };
  const review = {
    kind: 'review',
    id: 'review-1',
    state: 'approved',
    body: 'Review summary',
    moderation: { ...target(), resourceType: 'PullRequestReview' },
  };
  const pages: number[] = [];
  let deleted = false;
  const dom = createDom({
    useDetailCompactHeader,
    useRelativeTimeNow: () => 0,
    usePageMeta: () => {},
    usePRReviewers: reviewers.usePRReviewers,
    createEmptyRepoPermissions: permissions.createEmptyRepoPermissions,
    useGitPulseApiFetch:
      () => async (url: string, options?: { method?: string; query?: { page?: number } }) => {
        if (options?.method === 'POST') {
          deleted = true;
          return { moderation: null, deleted: true };
        }
        if (url.endsWith('/timeline')) {
          const page = options?.query?.page ?? 1;
          pages.push(page);
          return {
            timeline:
              page === 1
                ? [
                    ...(deleted ? [] : [review]),
                    { kind: 'comment', id: 'first', body: 'First page context' },
                  ]
                : [{ kind: 'comment', id: 'later', body: 'Second page context' }],
            pageInfo: { hasNextPage: page === 1 },
          };
        }
        if (url.endsWith('/reviewers')) return reviewers.createEmptyPRReviewersSummary();
        if (url.endsWith('/permissions')) return {};
        return pullRequest;
      },
  });
  try {
    const view = dom.mount(defineComponent({ setup: () => () => h(Detail, { pullRequest }) }));
    await flush();
    button(view.root, 'detailTimeline.loadMore').click();
    await flush();
    expect(view.root.textContent).toContain('Second page context');
    const scroll = view.root.querySelector<HTMLElement>('.detail-main-column')!;
    scroll.scrollTop = 240;
    view.root.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')!.click();
    await flush();
    button(dom.document, 'commentModeration.delete').click();
    const confirm = await findDialog(dom);
    expect(confirm.getAttribute('aria-label')).toBe('commentModeration.deleteReview');
    button(confirm, 'commentModeration.delete').click();
    await flush();
    expect(view.root.textContent).toContain('First page context');
    expect(view.root.textContent).toContain('Second page context');
    expect(view.root.textContent).not.toContain('Review summary');
    expect(pages).toEqual([1, 2, 1, 2]);
    expect(view.root.querySelector('.detail-main-column') === scroll).toBe(true);
    expect(scroll.scrollTop).toBe(240);
  } finally {
    await dom.cleanup();
  }
});
