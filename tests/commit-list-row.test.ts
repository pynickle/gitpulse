import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { defineComponent, h, nextTick, shallowRef } from 'vue';

import { commitVerificationMark } from '../app/utils/commitVerification';
import type { RepoCommitListItemPayload } from '../shared/types/repos';
import { compileVue } from './helpers/compile-vue';
import { createVueDom } from './helpers/vue-dom';

const opened: unknown[] = [];

const CheckStatusChip = defineComponent({
  name: 'CheckStatusChip',
  props: { rollup: { type: Object, default: null } },
  emits: ['open'],
  setup(props, { emit }) {
    return () =>
      props.rollup
        ? h(
            'button',
            {
              class: 'check-stub',
              type: 'button',
              onClick: () => emit('open', props.rollup),
            },
            'checks'
          )
        : null;
  },
});

const rowModules = {
  'vue-i18n': {
    useI18n: () => ({
      t: (key: string, params?: Record<string, string>) =>
        params?.time ? `${key}:${params.time}` : key,
      te: (key: string) => key === 'commitVerification.reasons.bad_email',
      locale: shallowRef('en'),
    }),
  },
  '~/components/dashboard/pr/CheckStatusChip.vue': { default: CheckStatusChip },
  '~/components/ui/GitHubAvatar.vue': {
    default: defineComponent({ setup: () => () => h('span', { class: 'avatar-stub' }) }),
  },
  '~/utils/formatDurationFromNow': {
    formatDurationFromNow: () => '2 hours ago',
  },
  'virtual:verification': { commitVerificationMark },
  'virtual:time': {
    useRelativeTimeNow: () => shallowRef('2026-11-10T00:00:00.000Z'),
  },
  'virtual:modal': {
    useCheckListModal: () => ({
      open: (rollup: unknown) => {
        opened.push(rollup);
      },
    }),
  },
};

const rowAutoImports = {
  useI18n: 'vue-i18n',
  commitVerificationMark: 'virtual:verification',
  useRelativeTimeNow: 'virtual:time',
  useCheckListModal: 'virtual:modal',
};

const CommitListRow = await compileVue(
  'app/components/dashboard/detail/CommitListRow.vue',
  rowModules,
  rowAutoImports
);

const PRTimelineCommitCard = await compileVue(
  'app/components/dashboard/pr/PRTimelineCommitCard.vue',
  {
    ...rowModules,
    '~/components/dashboard/detail/CommitListRow.vue': { default: CommitListRow },
  },
  { useI18n: 'vue-i18n' }
);

const commit = (overrides: Partial<RepoCommitListItemPayload> = {}): RepoCommitListItemPayload => ({
  sha: 'abcdef0123456789',
  shortSha: 'abcdef0',
  message: 'feat: sign',
  committedAt: '2024-01-01T12:00:00Z',
  author: { login: 'octocat', name: 'The Octocat', avatarUrl: null },
  htmlUrl: 'https://github.com/acme/widgets/commit/abcdef0123456789',
  verification: null,
  checkRollup: null,
  ...overrides,
});

let dom: ReturnType<typeof createVueDom>;

beforeEach(() => {
  opened.length = 0;
  dom = createVueDom();
});

afterEach(async () => {
  await dom.cleanup();
});

function mountRow(item: RepoCommitListItemPayload) {
  return dom.mount(
    defineComponent({
      setup: () => () => h(CommitListRow as never, { commit: item }),
    })
  );
}

describe('commit list row', () => {
  test('puts a verified mark beside the short SHA and the checks chip on the second line', async () => {
    const rollup = { state: 'SUCCESS', contexts: { totalCount: 1, nodes: [] } };
    const view = mountRow(
      commit({
        verification: { verified: true, reason: 'valid', verifiedAt: '2024-01-02T00:00:00Z' },
        checkRollup: rollup,
      })
    );
    await nextTick();

    const mark = view.root.querySelector('.commit-list-row__verification');
    const sha = view.root.querySelector('.commit-list-row__sha');
    const meta = view.root.querySelector('.commit-list-row__meta');

    expect(mark?.textContent).toBe('commitVerification.verified');
    expect(mark?.getAttribute('title')).toContain('commitVerification.verifiedAt');
    expect(sha?.textContent?.trim()).toBe('abcdef0');
    expect(sha?.querySelector('.commit-list-row__verification')).toBeNull();
    expect(mark?.closest('.commit-list-row__trailing')?.contains(sha as Node)).toBe(true);
    expect(meta?.querySelector('.check-stub')).not.toBeNull();

    view.root.querySelector<HTMLButtonElement>('.check-stub')?.click();
    expect(opened).toEqual([rollup]);
  });

  test('paints nothing for an unsigned commit and no chip when the rollup is absent', async () => {
    const view = mountRow(
      commit({
        verification: { verified: false, reason: 'unsigned', verifiedAt: null },
      })
    );
    await nextTick();

    expect(view.root.querySelector('.commit-list-row__verification')).toBeNull();
    expect(view.root.querySelector('.check-stub')).toBeNull();
    expect(view.root.querySelector('.commit-list-row__sha')?.textContent?.trim()).toBe('abcdef0');
  });

  test('shows an unverified mark with the translated reason and does not make the mark a control', async () => {
    const view = mountRow(
      commit({
        verification: { verified: false, reason: 'bad_email', verifiedAt: null },
      })
    );
    await nextTick();

    const mark = view.root.querySelector('.commit-list-row__verification');
    expect(mark?.textContent).toBe('commitVerification.unverified');
    expect(mark?.getAttribute('title')).toBe('commitVerification.reasons.bad_email');
    expect(mark?.tagName).toBe('SPAN');
  });
});

describe('pull request timeline commit card', () => {
  test('keeps the card shell and reuses the commit row, including verification', async () => {
    const view = dom.mount(
      defineComponent({
        setup: () => () =>
          h(PRTimelineCommitCard as never, {
            item: {
              kind: 'commit',
              commit: {
                oid: 'abcdef0123456789',
                message: 'feat: sign\n\nbody',
                committedDate: '2024-01-01T12:00:00Z',
                author: { name: 'Local Dev', user: { login: 'octocat' } },
                verification: {
                  verified: true,
                  reason: 'valid',
                  verifiedAt: '2024-01-02T00:00:00Z',
                },
                checkRollup: { state: 'SUCCESS', contexts: { totalCount: 1, nodes: [] } },
              },
            },
            repoOwner: 'acme',
            repoName: 'widgets',
            pullNumber: 12,
          }),
      })
    );
    await nextTick();

    const card = view.root.querySelector('.commit-item');
    const sha = card?.querySelector('.commit-list-row__sha');

    expect(card).not.toBeNull();
    expect(card?.querySelector('.commit-list-row__verification')?.textContent).toBe(
      'commitVerification.verified'
    );
    expect(card?.querySelector('.check-stub')).not.toBeNull();
    expect(sha?.getAttribute('href')).toBe(
      'https://github.com/acme/widgets/pull/12/commits/abcdef0123456789'
    );
    expect(card?.querySelector('.commit-list-row__message')?.textContent?.trim()).toBe(
      'feat: sign'
    );
  });
});
