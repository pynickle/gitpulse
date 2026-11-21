import { afterEach, expect, test } from 'bun:test';

import { defineComponent, h, shallowRef } from 'vue';

import * as copilot from '../shared/utils/copilot-review';
import { compileVue } from './helpers/compile-vue';
import { createVueDom } from './helpers/vue-dom';

const icon = defineComponent({ render: () => h('svg') });
const useI18n = () => ({ t: (key: string) => key, locale: shallowRef('en') });
const PRActions = await compileVue(
  'app/components/dashboard/pr/PRActions.vue',
  {
    '@lucide/vue': new Proxy({}, { get: () => icon }),
    'vue-i18n': { useI18n },
    '#shared/utils/copilot-review': copilot,
    '#shared/types/notifications': {},
    '~/components/dashboard/pr/CopilotReviewEffortPicker.vue': {
      default: defineComponent({
        setup: () => () => h('div', { class: 'copilot-effort' }, 'effort'),
      }),
    },
    '~/components/ui/GitHubAvatar.vue': {
      default: defineComponent({ setup: () => () => h('span') }),
    },
    '~/components/ui/GitHubIcon.vue': { default: icon },
    '~/composables/usePRReviewers': {},
    virtual: {
      useCompactCount: () => ({
        compact: (value: number) => String(value),
        exact: (value: number) => String(value),
      }),
      useRelativeTimeNow: () => shallowRef(0),
      useGitPulseApiFetch: () => async () => ({}),
      useNotificationTodos: () => ({
        isNotificationTodo: () => false,
        toggleNotificationTodo: () => undefined,
      }),
      getFetchErrorMessage: (_error: unknown, fallback: string) => fallback,
      formatDurationFromNow: () => '',
    },
  },
  {
    useCompactCount: 'virtual',
    useRelativeTimeNow: 'virtual',
    useGitPulseApiFetch: 'virtual',
    useNotificationTodos: 'virtual',
    getFetchErrorMessage: 'virtual',
    formatDurationFromNow: 'virtual',
  }
);

const baseProps = {
  requestedReviewers: [],
  requestedTeams: [],
  canRequestCopilot: true,
  htmlUrl: 'https://github.com/acme/widgets/pull/1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  commits: 1,
  changedFiles: 1,
  additions: 1,
  deletions: 0,
  prState: 'open',
  merged: false,
  mergedAt: undefined,
  canManageState: false,
  repoInfo: { owner: 'acme', repo: 'widgets' },
  prNumber: 1,
};

let dom: ReturnType<typeof createVueDom> | undefined;
afterEach(async () => {
  await dom?.cleanup();
});

const mountActions = (props: Record<string, unknown>) => {
  dom = createVueDom();
  return dom.mount(
    defineComponent({
      setup: () => () => h(PRActions, { ...baseProps, ...props }),
    })
  ).root;
};

test('hides the standalone Copilot effort row when Copilot is not a reviewer', () => {
  const root = mountActions({ canRequestReviewers: false });

  expect(root.querySelector('.copilot-review-choice')).toBeNull();
  expect(root.querySelector('.reviewers-action-btn')).toBeNull();
});

test('keeps the request button when other people can still be requested', () => {
  const root = mountActions({ canRequestReviewers: true });

  expect(root.querySelector('.copilot-review-choice')).toBeNull();
  expect(root.querySelector('.reviewers-action-btn')).not.toBeNull();
});

test('keeps the Copilot reviewer card and its effort control', () => {
  const root = mountActions({
    canRequestReviewers: false,
    reviewers: {
      items: [
        {
          key: 'user:copilot',
          kind: 'user',
          login: 'Copilot',
          name: 'Copilot',
          status: 'requested',
          reviewCount: 0,
          commentCount: 0,
          requested: true,
          removable: true,
        },
      ],
    },
  });

  expect(root.querySelector('.copilot-review-choice')).toBeNull();
  expect(root.querySelector('.reviewer-item .copilot-effort')).not.toBeNull();
  expect(root.textContent).toContain('Copilot');
});

test('shows the standalone Copilot effort row when the reader turns hiding off', () => {
  const root = mountActions({ canRequestReviewers: false, hideUnrequestedCopilot: false });

  expect(root.querySelector('.copilot-review-choice')).not.toBeNull();
  expect(root.querySelector('.reviewers-action-btn')).not.toBeNull();
});
