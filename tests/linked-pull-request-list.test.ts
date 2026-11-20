import { afterEach, describe, expect, test } from 'bun:test';

import { defineComponent, h, nextTick } from 'vue';

import { getFetchErrorMessage } from '../app/utils/getFetchErrorMessage';
import * as linkedPullRequests from '../shared/utils/linked-pull-requests';
import { compileVue } from './helpers/compile-vue';
import { interpolateTranslation } from './helpers/translation';
import { createVueDom } from './helpers/vue-dom';

const messages: Record<string, string> = {
  'dashboard.linkedPullRequests.showAll': 'Show all {count}',
  'dashboard.linkedPullRequests.loadMore': 'Load more',
  'dashboard.linkedPullRequests.error': 'Could not load linked pull requests.',
  'dashboard.linkedPullRequests.sameRepository': 'This repository',
  'dashboard.linkedPullRequests.otherRepositories': 'Other repositories',
};

const t = (key: string, params?: Record<string, unknown>) =>
  interpolateTranslation(messages[key] ?? key, params);

const Row = defineComponent({
  props: { row: { type: Object, required: true } },
  emits: ['select'],
  setup(props, { emit }) {
    return () =>
      h(
        'button',
        { class: 'row', onClick: () => emit('select') },
        (props.row as { title: string }).title
      );
  },
});

const CollapsibleGroup = defineComponent({
  props: { id: { type: String, required: true }, count: { type: Number, required: false } },
  setup(_, { slots }) {
    return () =>
      h('div', { class: 'group' }, [
        h('span', { class: 'group-header' }, slots.header?.()),
        slots.default?.(),
      ]);
  },
});

const Band = await compileVue('app/components/dashboard/issue/LinkedPullRequestList.vue', {
  '#shared/utils/linked-pull-requests': linkedPullRequests,
  '~/components/dashboard/LinkedPullRequestRow.vue': { default: Row },
  '~/components/ui/CollapsibleGroup.vue': { default: CollapsibleGroup },
});

interface Page {
  totalCount: number;
  nodes: unknown[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
}

const localNode = (number: number, title = `PR ${number}`) => ({
  owner: 'acme',
  repo: 'widgets',
  number,
  title,
  authorLogin: 'octocat',
  updatedAt: `2026-08-${String(number).padStart(2, '0')}T00:00:00.000Z`,
  state: 'open',
});

let pages: Record<string, Page> = {};
let requestedCursors: Array<string | null> = [];

const apiFetch = async (url: string, options?: { query?: { after?: string } }) => {
  if (!url.endsWith('/linked-pull-requests')) {
    throw new Error(`unexpected URL ${url}`);
  }

  const cursor = options?.query?.after ?? null;
  requestedCursors.push(cursor);

  const page = pages[cursor ?? ''];
  if (!page) {
    throw new Error(`unexpected cursor ${cursor}`);
  }

  return page;
};

let dom: ReturnType<typeof createVueDom>;

const mountBand = (extraProps: Record<string, unknown> = {}, fetch = apiFetch) => {
  dom = createVueDom({
    useI18n: () => ({ t }),
    useGitPulseApiFetch: () => fetch,
    getFetchErrorMessage,
  });
  const Host = defineComponent({
    setup: () => () =>
      h(Band as never, { owner: 'acme', repo: 'widgets', number: 7, ...extraProps }),
  });
  return dom.mount(Host).root;
};

async function flush() {
  for (let index = 0; index < 4; index += 1) {
    await Promise.resolve();
    await nextTick();
  }
}

const rows = (root: Element) => Array.from(root.querySelectorAll('.row'));
const toggle = (root: Element) => root.querySelector<HTMLButtonElement>('.linked-pr-list__toggle');

afterEach(async () => {
  pages = {};
  requestedCursors = [];
  await dom.cleanup();
});

describe('Linked Pull Request List', () => {
  test('renders nothing when the issue has no Linked Pull Requests', async () => {
    pages[''] = { totalCount: 0, nodes: [], pageInfo: { hasNextPage: false, endCursor: null } };
    const root = mountBand();
    await flush();

    expect(root.querySelector('.linked-pr-list')).toBeNull();
  });

  test('shows placeholder rows while the first page is in flight', async () => {
    let resolvePage: ((page: Page) => void) | null = null;
    const root = mountBand(
      {},
      () =>
        new Promise<Page>((resolve) => {
          resolvePage = resolve;
        })
    );
    await flush();

    const skeleton = root.querySelector('[data-linked-pr-skeleton]');
    expect(skeleton).not.toBeNull();
    expect(skeleton?.querySelectorAll('.linked-pr-list__skeleton-line--title')).toHaveLength(3);
    expect(skeleton?.querySelectorAll('.linked-pr-list__skeleton-icon')).toHaveLength(3);
    expect(rows(root)).toHaveLength(0);

    resolvePage?.({
      totalCount: 1,
      nodes: [localNode(3, 'Fix login')],
      pageInfo: { hasNextPage: false, endCursor: null },
    });
    await flush();

    expect(root.querySelector('[data-linked-pr-skeleton]')).toBeNull();
    expect(rows(root)).toHaveLength(1);
  });

  test('shows five rows and the total that stays behind them', async () => {
    pages[''] = {
      totalCount: 7,
      nodes: Array.from({ length: 7 }, (_, index) => localNode(index + 1)),
      pageInfo: { hasNextPage: false, endCursor: null },
    };
    const root = mountBand();
    await flush();

    expect(rows(root)).toHaveLength(5);
    expect(toggle(root)?.textContent?.trim()).toBe('Show all 7');
  });

  test('reveals the remaining rows and the other-repository header when asked', async () => {
    pages[''] = {
      totalCount: 7,
      nodes: [
        ...Array.from({ length: 5 }, (_, index) => localNode(index + 1)),
        {
          owner: 'foreign',
          repo: 'lib',
          number: 20,
          title: 'Foreign 20',
          state: 'open',
        },
        {
          owner: 'foreign',
          repo: 'lib',
          number: 21,
          title: 'Foreign 21',
          state: 'closed',
        },
      ],
      pageInfo: { hasNextPage: false, endCursor: null },
    };
    const root = mountBand();
    await flush();

    expect(root.textContent).not.toContain('Other repositories');

    toggle(root)?.click();
    await flush();

    expect(rows(root)).toHaveLength(7);
    expect(root.textContent).toContain('Other repositories');
    expect(toggle(root)).toBeNull();
  });

  test('loads the next page from the cursor the first page returned', async () => {
    pages[''] = {
      totalCount: 25,
      nodes: Array.from({ length: 20 }, (_, index) => localNode(index + 1)),
      pageInfo: { hasNextPage: true, endCursor: 'CURSOR-1' },
    };
    pages['CURSOR-1'] = {
      totalCount: 25,
      nodes: Array.from({ length: 5 }, (_, index) => localNode(index + 21)),
      pageInfo: { hasNextPage: false, endCursor: null },
    };
    const root = mountBand();
    await flush();

    toggle(root)?.click();
    await flush();
    expect(rows(root)).toHaveLength(20);

    toggle(root)?.click();
    await flush();

    expect(rows(root)).toHaveLength(25);
    expect(requestedCursors).toEqual([null, 'CURSOR-1']);
    expect(toggle(root)).toBeNull();
  });

  test('opens the pull request the reader picks', async () => {
    pages[''] = {
      totalCount: 1,
      nodes: [localNode(3, 'Fix login')],
      pageInfo: { hasNextPage: false, endCursor: null },
    };
    let selected: unknown;
    const root = mountBand({
      onSelect: (identity: unknown) => {
        selected = identity;
      },
    });
    await flush();

    rows(root)[0]?.click();
    await flush();

    expect(selected).toEqual({ owner: 'acme', repo: 'widgets', number: 3 });
  });

  test('reports a failure when the list cannot be loaded', async () => {
    const root = mountBand({}, async () => {
      throw new Error('GraphQL 502');
    });
    await flush();

    expect(root.textContent).toContain('GraphQL 502');
  });
});
