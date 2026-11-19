import { expect, test } from 'bun:test';

import { defineComponent, h, nextTick, ref } from 'vue';

import {
  createEmptyRepoPermissions,
  normalizeRepoPermissions,
} from '../app/utils/createEmptyRepoPermissions';
import { formatPageMetaDescription } from '../app/utils/formatPageMetaDescription';
import { parseGitHubRepoPath } from '../app/utils/parseGitHubRepoPath';
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
  setup(props) {
    return () =>
      h('output', {
        'data-duplicate-target':
          (props.issue as { duplicate_of?: { number: number } | null }).duplicate_of?.number ??
          null,
      });
  },
});
const IssueActions = defineComponent({
  emits: ['update:state'],
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
      ]);
  },
});

const IssueDetail = await compileVue(
  'app/components/dashboard/detail/IssueDetail.vue',
  {
    '~/components/dashboard/detail/DetailAssignees.vue': { default: emptyStub },
    '~/components/dashboard/detail/DetailLabels.vue': { default: emptyStub },
    '~/components/dashboard/issue/IssueActions.vue': { default: IssueActions },
    '~/components/dashboard/issue/IssueHeader.vue': { default: IssueHeader },
    '~/components/dashboard/issue/IssueTimelineEvents.vue': { default: emptyStub },
    '~/components/dashboard/issue/IssueTypeCard.vue': { default: emptyStub },
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
