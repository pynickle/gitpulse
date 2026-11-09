import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { defineComponent, h, nextTick, shallowRef } from 'vue';

import { resolvePullRequestBranchRef } from '../app/utils/resolvePullRequestBranchRef';
import { compileVue } from './helpers/compile-vue';
import { createVueDom } from './helpers/vue-dom';

const icon = defineComponent({ setup: () => () => h('svg') });
const stub = defineComponent({ setup: () => () => h('div') });

const PRHeader = await compileVue(
  'app/components/dashboard/pr/PRHeader.vue',
  {
    '@lucide/vue': new Proxy({}, { get: () => icon }),
    'vue-i18n': {
      useI18n: () => ({ t: (key: string) => key, locale: shallowRef('en') }),
    },
    '~/components/dashboard/reactions/ReactionBar.vue': { default: stub },
    '~/components/ui/GitHubAvatar.vue': { default: stub },
    '~/components/ui/MarkdownRenderer.vue': { default: stub },
    '~/utils/getPullRequestStateVisual': {
      getPullRequestStateVisual: () => ({
        state: 'open',
        icon,
        color: 'var(--gitpulse-success)',
      }),
    },
    '~/utils/resolvePullRequestBranchRef': { resolvePullRequestBranchRef },
    'virtual:app-runtime': {
      useDashboardRepositoryNavigation: () => ({ openRepository: () => {} }),
      useRelativeTimeNow: () => shallowRef('2026-11-09T00:00:00.000Z'),
    },
    'virtual:formatters': {
      formatDurationFromNow: () => '3 hours ago',
    },
  },
  {
    useDashboardRepositoryNavigation: 'virtual:app-runtime',
    useRelativeTimeNow: 'virtual:app-runtime',
    formatDurationFromNow: 'virtual:formatters',
  }
);

let dom: ReturnType<typeof createVueDom>;

beforeEach(() => {
  dom = createVueDom();
});

afterEach(async () => {
  await dom.cleanup();
});

const repository = (owner: string, name: string) => ({
  name,
  full_name: `${owner}/${name}`,
  owner: { login: owner },
});

function mountHeader(pullRequest: Record<string, unknown>) {
  return dom.mount(
    defineComponent({
      setup: () => () =>
        h(PRHeader as never, {
          pullRequest,
          repoOwner: 'pynickle',
          repoName: 'gitpulse',
        }),
    })
  );
}

describe('pull request header branch refs', () => {
  test('shows the owner login as text before a branch from another repository', async () => {
    const view = mountHeader({
      title: 'Fix hover',
      number: 12,
      state: 'open',
      head: {
        ref: 'fix/hover',
        label: 'contributor:fix/hover',
        repo: repository('contributor', 'gitpulse'),
      },
      base: {
        ref: 'main',
        label: 'pynickle:main',
        repo: repository('pynickle', 'gitpulse'),
      },
    });
    await nextTick();

    const owners = [...view.root.querySelectorAll('.header-branch__owner')].map(
      (node) => node.textContent
    );
    const refs = [...view.root.querySelectorAll('.header-branch__ref')].map(
      (node) => node.textContent
    );

    expect(owners).toEqual(['contributor']);
    expect(refs).toEqual(['fix/hover', 'main']);
    expect(view.root.querySelector('.header-branch a')).toBeNull();
    expect(view.root.querySelector('.header-branch__owner')?.tagName).toBe('SPAN');
  });

  test('shows both branches as refs alone when they belong to the host repository', async () => {
    const view = mountHeader({
      title: 'Fix hover',
      number: 12,
      state: 'open',
      head: {
        ref: 'fix/hover',
        label: 'pynickle:fix/hover',
        repo: repository('pynickle', 'gitpulse'),
      },
      base: {
        ref: 'main',
        label: 'pynickle:main',
        repo: repository('pynickle', 'gitpulse'),
      },
    });
    await nextTick();

    expect(view.root.querySelector('.header-branch__owner')).toBeNull();
    expect(
      [...view.root.querySelectorAll('.header-branch__ref')].map((node) => node.textContent)
    ).toEqual(['fix/hover', 'main']);
  });
});
