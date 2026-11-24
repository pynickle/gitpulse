import { expect, test } from 'bun:test';

import { defineComponent, h, nextTick, ref } from 'vue';

import {
  createEmptyRepoPermissions,
  normalizeRepoPermissions,
} from '../app/utils/createEmptyRepoPermissions';
import { formatPageMetaDescription } from '../app/utils/formatPageMetaDescription';
import { parseGitHubRepoPath } from '../app/utils/parseGitHubRepoPath';
import * as detailOverlayPresentation from '../shared/utils/detail-overlay-presentation';
import * as subIssues from '../shared/utils/sub-issues';
import { compileVue } from './helpers/compile-vue';
import { createVueDom } from './helpers/vue-dom';

const duplicateTarget = {
  resourceType: 'issue',
  number: 42,
  title: 'Original issue',
  url: 'https://github.com/other/lib/issues/42',
  state: 'open',
  repository: { name: 'lib', nameWithOwner: 'other/lib', owner: { login: 'other' } },
};

const emptyStub = defineComponent({ setup: () => () => h('div') });
const ScrollArea = defineComponent({
  setup(_, { slots }) {
    return () => h('div', slots.default?.());
  },
});
const IssueHeader = defineComponent({
  props: { issue: { type: Object, required: true } },
  setup(props, { slots }) {
    return () =>
      h('div', [
        h('output', {
          'data-duplicate-target':
            (props.issue as { duplicate_of?: { number: number } | null }).duplicate_of?.number ??
            null,
        }),
        slots['before-description']?.(),
      ]);
  },
});
const IssueActions = defineComponent({
  emits: ['update:state', 'update:is-locked'],
  setup(_, { emit }) {
    return () =>
      h('div', [
        h(
          'button',
          {
            onClick: () => emit('update:state', 'closed', 'duplicate', duplicateTarget),
          },
          'Close as duplicate'
        ),
        h('button', { onClick: () => emit('update:state', 'open', null, null) }, 'Reopen'),
        h(
          'button',
          { 'data-lock-toggle': 'true', onClick: () => emit('update:is-locked', true) },
          'Lock'
        ),
        h(
          'button',
          { 'data-lock-toggle': 'false', onClick: () => emit('update:is-locked', false) },
          'Unlock'
        ),
      ]);
  },
});

let activeChrome: {
  setComposerAvailability: (value: { available: boolean; locked: boolean }) => void;
  setMetadataCount: (count: number) => void;
} | null = null;

let bandProps: Record<string, unknown> | undefined;
let selectLinkedPullRequest: ((identity: unknown) => void) | undefined;
const LinkedPullRequestList = defineComponent({
  props: {
    owner: { type: String, required: true },
    repo: { type: String, required: true },
    number: { type: Number, required: true },
  },
  emits: ['select'],
  setup(props, { emit }) {
    bandProps = props as unknown as Record<string, unknown>;
    selectLinkedPullRequest = (identity) => emit('select', identity);
    return () => h('div', { class: 'linked-pr-band' });
  },
});

const IssueDetail = await compileVue(
  'app/components/dashboard/detail/IssueDetail.vue',
  {
    '~/components/dashboard/detail/DetailAssignees.vue': { default: emptyStub },
    '~/components/dashboard/detail/DetailLabels.vue': { default: emptyStub },
    '~/components/dashboard/detail/DetailSidebarColumn.vue': { default: ScrollArea },
    '~/components/dashboard/issue/IssueActions.vue': { default: IssueActions },
    '~/components/dashboard/issue/IssueHeader.vue': { default: IssueHeader },
    '#shared/utils/detail-overlay-presentation': detailOverlayPresentation,
    '#shared/utils/sub-issues': subIssues,
    '~/composables/useDetailOverlayChrome': { useDetailOverlayChrome: () => activeChrome },
    '~/components/dashboard/issue/SubIssueList.vue': { default: emptyStub },
    '~/components/dashboard/issue/IssueTimelineEvents.vue': { default: emptyStub },
    '~/components/dashboard/issue/IssueTypeCard.vue': { default: emptyStub },
    '~/components/dashboard/issue/LinkedPullRequestList.vue': { default: LinkedPullRequestList },
    '~/components/ui/ScrollArea.vue': { default: ScrollArea },
    '~/utils/createEmptyRepoPermissions': { createEmptyRepoPermissions, normalizeRepoPermissions },
    '~/utils/formatPageMetaDescription': { formatPageMetaDescription },
    '~/utils/parseGitHubRepoPath': { parseGitHubRepoPath },
    'virtual:auto-imports': {
      createEmptyRepoPermissions,
      useDetailCompactHeader: () => ({
        isCompactHeaderVisible: ref(false),
        onScroll: () => {},
        reset: () => {},
      }),
      useGitPulseApiFetch: () => async () => ({
        timeline: [],
        pageInfo: { hasNextPage: false },
      }),
      usePageMeta: () => {},
      useUserSession: () => ({ user: ref({ login: 'octocat' }) }),
    },
  },
  {
    createEmptyRepoPermissions: 'virtual:auto-imports',
    useDetailCompactHeader: 'virtual:auto-imports',
    useGitPulseApiFetch: 'virtual:auto-imports',
    usePageMeta: 'virtual:auto-imports',
    useUserSession: 'virtual:auto-imports',
  }
);

test('updates and clears the duplicate target in the issue header with state changes', async () => {
  const dom = createVueDom();
  try {
    const issue = {
      id: 7,
      number: 7,
      title: 'Duplicate issue',
      state: 'open',
      repository_url: 'https://api.github.com/repos/acme/widgets',
    };
    const { root } = dom.mount(defineComponent(() => () => h(IssueDetail, { issue })));
    await nextTick();

    const targetDisplay = () => root.querySelector('output')?.getAttribute('data-duplicate-target');
    expect(targetDisplay()).toBeNull();

    root.querySelectorAll('button')[0]?.click();
    await nextTick();
    expect(targetDisplay()).toBe('42');

    root.querySelectorAll('button')[1]?.click();
    await nextTick();
    expect(targetDisplay()).toBeNull();
  } finally {
    await dom.cleanup();
  }
});

test('lists the linked pull requests of the issue it shows and opens the chosen one', async () => {
  const dom = createVueDom();
  try {
    const issue = {
      id: 7,
      number: 7,
      title: 'Issue with linked pull requests',
      state: 'open',
      repository_url: 'https://api.github.com/repos/acme/widgets',
    };
    const switched: unknown[] = [];

    dom.mount(
      defineComponent(() => () => {
        return h(IssueDetail, {
          issue,
          onSwitchPullRequest: (owner: string, repo: string, pullNumber: number) => {
            switched.push({ owner, repo, number: pullNumber });
          },
        });
      })
    );
    await nextTick();

    expect(bandProps).toMatchObject({ owner: 'acme', repo: 'widgets', number: 7 });

    selectLinkedPullRequest?.({ owner: 'acme', repo: 'widgets', number: 22 });
    await nextTick();

    expect(switched).toEqual([{ owner: 'acme', repo: 'widgets', number: 22 }]);
  } finally {
    await dom.cleanup();
  }
});

test('propagates initial and toggled issue lock state to detail overlay chrome', async () => {
  const availabilityUpdates: Array<{ available: boolean; locked: boolean }> = [];
  activeChrome = {
    setComposerAvailability: (value) => {
      availabilityUpdates.push(value);
    },
    setMetadataCount: () => {},
  };
  const dom = createVueDom();
  try {
    const issue = {
      id: 7,
      number: 7,
      title: 'Locked issue',
      state: 'open',
      locked: true,
      repository_url: 'https://api.github.com/repos/acme/widgets',
    };
    const { root } = dom.mount(defineComponent(() => () => h(IssueDetail, { issue })));
    await nextTick();

    expect(availabilityUpdates.at(-1)).toEqual({ available: true, locked: true });

    root.querySelector<HTMLButtonElement>('[data-lock-toggle="false"]')!.click();
    await nextTick();
    expect(availabilityUpdates.at(-1)).toEqual({ available: true, locked: false });

    root.querySelector<HTMLButtonElement>('[data-lock-toggle="true"]')!.click();
    await nextTick();
    expect(availabilityUpdates.at(-1)).toEqual({ available: true, locked: true });
  } finally {
    activeChrome = null;
    await dom.cleanup();
  }
});
