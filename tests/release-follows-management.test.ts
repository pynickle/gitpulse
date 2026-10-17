import { afterEach, expect, mock, test } from 'bun:test';

import { computed, defineComponent, h, nextTick, ref, shallowRef } from 'vue';

import formatCompactNumber from '../app/utils/formatCompactNumber';
import { getLanguageColor } from '../app/utils/languageColors';
import english from '../i18n/locales/en.json';
import type { FollowedRepositoryMetadataResult } from '../shared/types/release-follows';
import * as tabGroups from '../shared/types/tab-groups';
import type { UserSettings, UserSettingsPatch } from '../shared/types/user-settings';
import * as bundledFonts from '../shared/utils/bundled-fonts';
import * as followUtils from '../shared/utils/release-follows';
import * as userSettingsUtils from '../shared/utils/user-settings';

mock.module('#shared/types/tab-groups', () => tabGroups);
mock.module('#shared/utils/bundled-fonts', () => bundledFonts);
mock.module('#shared/utils/release-follows', () => followUtils);
mock.module('#shared/utils/user-settings', () => userSettingsUtils);

const { createDefaultUserSettings, mergeUserSettingsPatch } = userSettingsUtils;
const { createInitialUserSettingsRequestState, createUserSettingsActions } =
  await import('../app/composables/user-settings/store');
const { useReleaseFollows } = await import('../app/composables/useReleaseFollows');
const { useFollowedRepositoryMetadata } =
  await import('../app/composables/useFollowedRepositoryMetadata');
import { compileVue as compileSfc } from './helpers/compile-vue';
import { ScrollArea } from './helpers/scroll-area';
import { createVueDom } from './helpers/vue-dom';

const compileVue = (path: string, modules: Record<string, unknown> = {}) =>
  compileSfc(path, { '~/components/ui/ScrollArea.vue': { default: ScrollArea }, ...modules });

function translate(key: string, params?: Record<string, unknown>) {
  const value = key.split('.').reduce<unknown>((node, part) => {
    if (!node || typeof node !== 'object') return undefined;
    return (node as Record<string, unknown>)[part];
  }, english);
  if (typeof value !== 'string') return key;
  return value.replace(/\{(\w+)\}/g, (_, name: string) => String(params?.[name] ?? ''));
}

const icon = defineComponent({ setup: () => () => h('span') });
const icons = {
  AlertCircleIcon: icon,
  AlertTriangleIcon: icon,
  ArrowDownIcon: icon,
  ArrowUpIcon: icon,
  ChevronLeftIcon: icon,
  ChevronRightIcon: icon,
  ClockIcon: icon,
  RefreshCwIcon: icon,
  RocketIcon: icon,
  SearchIcon: icon,
  StarIcon: icon,
  Trash2Icon: icon,
  XIcon: icon,
};
const GridStub = defineComponent({
  props: { emptyMessage: { type: String, required: true } },
  setup: (props) => () => h('div', { class: 'release-follows-grid' }, props.emptyMessage),
});
const Pagination = await compileVue('app/components/dashboard/DashboardPagination.vue', {
  '@lucide/vue': icons,
});
const Segmented = await compileVue('app/components/ui/FilterSegmentedControl.vue');
const List = await compileVue(
  'app/components/dashboard/release-follows/FollowedRepositoryList.vue',
  {
    '@lucide/vue': icons,
    '~/utils/languageColors': { getLanguageColor },
  }
);
const Panel = await compileVue(
  'app/components/dashboard/release-follows/FollowedRepositoriesPanel.vue',
  {
    '@lucide/vue': icons,
    '~/components/dashboard/release-follows/FollowedRepositoryList.vue': { default: List },
  }
);
const Page = await compileVue(
  'app/components/dashboard/release-follows/ReleaseFollowsConfigPage.vue',
  {
    '@lucide/vue': icons,
    '~/components/dashboard/DashboardPagination.vue': { default: Pagination },
    '~/components/dashboard/release-follows/FollowedRepositoriesPanel.vue': { default: Panel },
    '~/components/dashboard/release-follows/ReleaseFollowsRepoGrid.vue': { default: GridStub },
    '~/components/ui/FilterSegmentedControl.vue': { default: Segmented },
  }
);

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

async function flush() {
  for (let step = 0; step < 8; step += 1) {
    await Promise.resolve();
    await nextTick();
  }
}

const repo = (
  id: string,
  owner: string,
  name: string
): { id: string; owner: string; name: string } => ({ id, owner, name });

function harness(options?: {
  view?: 'compact' | 'detailed';
  follows?: { id: string; owner: string; name: string }[];
  unavailable?: string[];
}) {
  const follows = options?.follows ?? [
    repo('R_alpha', 'alpha', 'widgets'),
    repo('R_beta', 'beta', 'widgets'),
    repo('R_gamma', 'gamma', 'tools'),
  ];
  const user = ref<{ login: string } | null>({ login: 'octocat' });
  const unavailableIds = ref([...(options?.unavailable ?? [])]);
  const opened: Array<{ owner: string; repo: string }> = [];
  const metadataRequests: Array<
    Deferred<FollowedRepositoryMetadataResult> & {
      repositories: Array<{ id: string; owner: string; name: string }>;
    }
  > = [];
  const loadRequests: Deferred<UserSettings>[] = [];
  const saveRequests: Array<{ patch: UserSettingsPatch; deferred: Deferred<UserSettings> }> = [];
  const starredFetches: Array<Record<string, unknown>> = [];
  const sort = ref<'created' | 'updated'>('created');
  const direction = ref<'desc' | 'asc'>('desc');
  const starredPagination = ref({
    page: 1,
    perPage: 30,
    hasPrev: false,
    hasNext: true,
    totalCount: 60,
    totalPages: 2,
  });
  const searchQuery = ref('');
  const settings = ref(createDefaultUserSettings());
  const confirmedSettings = ref(createDefaultUserSettings());
  const requestState = ref(createInitialUserSettingsRequestState());
  const store = createUserSettingsActions({
    activeLogin: computed(() => user.value?.login ?? null),
    settings,
    confirmedSettings,
    requestState,
    api: {
      load: () => {
        const request = deferred<UserSettings>();
        loadRequests.push(request);
        return request.promise;
      },
      save: (patch) => {
        const request = deferred<UserSettings>();
        saveRequests.push({ patch, deferred: request });
        return request.promise;
      },
    },
  });
  const loaded = mergeUserSettingsPatch(createDefaultUserSettings(), {
    releaseFollows: { view: options?.view ?? 'compact' },
    followedRepositories: follows,
  });
  settings.value = loaded;
  confirmedSettings.value = loaded;
  requestState.value = {
    ...requestState.value,
    status: 'loaded',
    activeLogin: 'octocat',
    loadedLogin: 'octocat',
    confirmedLogin: 'octocat',
    loginRevision: 1,
  };

  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }

  const dom = createVueDom({
    formatCompactNumber,
    useI18n: () => ({ locale: shallowRef('en'), t: translate }),
    useUserSession: () => ({ user }),
    useUserSettings: () => store,
    useReleaseFollows,
    useFollowedRepositoryMetadata,
    useFollowedRepositoryLookups: () => ({
      unavailableIds,
      unavailableIdSet: computed(() => new Set(unavailableIds.value)),
      fetchIdentities: async () => undefined,
      transientIds: ref<string[]>([]),
    }),
    useStarredRepos: () => ({
      items: ref([]),
      pagination: starredPagination,
      sort,
      direction,
      loading: ref(false),
      error: ref<string | null>(null),
      fetchPage: async (request: Record<string, unknown>) => {
        starredFetches.push(request);
        if (typeof request.page === 'number') {
          starredPagination.value = {
            ...starredPagination.value,
            page: request.page,
            hasPrev: request.page > 1,
          };
        }
      },
    }),
    useRepositorySearch: () => ({
      query: searchQuery,
      items: ref([]),
      pagination: ref({
        page: 1,
        perPage: 30,
        hasPrev: false,
        hasNext: false,
        totalCount: null,
        totalPages: null,
      }),
      loading: ref(false),
      error: ref<string | null>(null),
      hasQuery: computed(() => searchQuery.value.trim().length > 0),
      fetchPage: async () => undefined,
    }),
    useDashboardRepositoryNavigation: () => ({
      openRepository: async (owner: string, repoName: string) => {
        opened.push({ owner, repo: repoName });
      },
    }),
    useGitPulseApiFetch:
      () =>
      (
        path: string,
        options?: { body?: { repositories?: Array<{ id: string; owner: string; name: string }> } }
      ) => {
        if (path !== '/api/release-follows/metadata') {
          return Promise.reject(new Error(String(path)));
        }
        const request = Object.assign(deferred<FollowedRepositoryMetadataResult>(), {
          repositories: options?.body?.repositories ?? [],
        });
        metadataRequests.push(request);
        return request.promise;
      },
  });
  cleanups.push(dom.cleanup);
  const mounted = dom.mount(Page);

  const desktop = () => {
    const panel = dom.document.querySelector('.followed-panel--desktop');
    if (!panel) throw new Error('missing desktop followed list');
    return panel;
  };
  const buttonIn = (root: ParentNode, text: string) => {
    const found = [...root.querySelectorAll('button')].find((element) => {
      const visible = element.textContent?.replace(/\s+/g, '').trim();
      const label = element.getAttribute('aria-label')?.trim();
      return visible === text.replace(/\s+/g, '') || label === text;
    });
    if (!found) throw new Error(`missing button ${text}`);
    return found;
  };
  const acceptSave = async () => {
    await flush();
    const request = saveRequests.at(-1);
    if (!request) throw new Error('missing settings save');
    request.deferred.resolve(mergeUserSettingsPatch(settings.value, request.patch));
    await flush();
  };

  return {
    dom,
    mounted,
    user,
    store,
    settings,
    opened,
    metadataRequests,
    loadRequests,
    saveRequests,
    starredFetches,
    sort,
    direction,
    starredPagination,
    searchQuery,
    desktop,
    buttonIn,
    acceptSave,
    text: (selector: string, root: ParentNode = desktop()) =>
      root.querySelector(selector)?.textContent?.trim() ?? '',
  };
}

const available = (
  owner: string,
  name: string,
  description: string | null,
  primaryLanguage: string | null,
  starCount: number,
  extra?: Record<string, unknown>
) => ({
  status: 'available' as const,
  owner,
  name,
  description,
  primaryLanguage,
  starCount,
  ...extra,
});

test('Compact View is the default and Detailed View switches the whole collection', async () => {
  const page = harness();
  await flush();
  const desktop = page.desktop();

  expect(page.buttonIn(desktop, 'Compact').getAttribute('aria-checked')).toBe('true');
  expect(desktop.textContent).toContain('alpha/widgets');
  expect(desktop.textContent).toContain('beta/widgets');
  expect(desktop.querySelector('.followed-list__description')).toBeNull();
  expect(page.metadataRequests).toHaveLength(0);
  expect(page.text('.followed-list__count')).toBe('3');

  page.buttonIn(desktop, 'Detailed').click();
  await flush();

  expect(page.buttonIn(page.desktop(), 'Detailed').getAttribute('aria-checked')).toBe('true');
  expect(page.saveRequests.at(-1)?.patch).toEqual({ releaseFollows: { view: 'detailed' } });
  expect(page.desktop().querySelector('.followed-list__description')).toBeNull();
  expect(page.buttonIn(page.desktop(), 'Remove alpha/widgets')).toBeTruthy();
  expect(page.metadataRequests).toHaveLength(1);

  const description = `${'A dashboard for review. '.repeat(12)}UNIQUE-TAIL`;
  page.metadataRequests[0]!.resolve({
    renamed: false,
    repositories: {
      R_alpha: available('alpha', 'widgets', description, 'TypeScript', 12, {
        repositoryTopics: [{ name: 'zyx-topic' }],
      }),
      R_beta: available('beta', 'widgets', null, null, 0),
      R_gamma: { status: 'transient' },
    },
  });
  await flush();

  const alpha = page.desktop().querySelector('[data-followed-id="R_alpha"]')!;
  const beta = page.desktop().querySelector('[data-followed-id="R_beta"]')!;
  const gamma = page.desktop().querySelector('[data-followed-id="R_gamma"]')!;
  const alphaDescription = alpha.querySelector('.followed-list__description') as HTMLElement;
  expect(alphaDescription.textContent).toContain('UNIQUE-TAIL');
  expect(alphaDescription.textContent?.trim()).toBe(description);
  expect(alphaDescription.style.userSelect).toBe('text');
  expect((alpha.querySelector('.followed-list__meta') as HTMLElement).style.userSelect).toBe(
    'text'
  );
  expect(alpha.textContent).toContain('TypeScript');
  expect(alpha.textContent).toContain('12');
  expect(alpha.textContent).not.toContain('zyx-topic');
  expect(beta.querySelector('.followed-list__description')).toBeNull();
  expect(beta.querySelector('.followed-list__language')).toBeNull();
  expect(beta.textContent).toContain('0');
  expect(gamma.querySelector('.followed-list__stars')).toBeNull();
  const retry = gamma.querySelector('.followed-list__retry');
  expect(retry?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Retry');
  expect(retry?.getAttribute('aria-label')).toBe('Retry details for gamma/tools');
  expect(page.desktop().querySelectorAll('.followed-list__badge')).toHaveLength(0);
  expect(page.dom.document.body.textContent).not.toContain(
    'You can follow at most 100 repositories.'
  );
});

test('restores a saved Detailed View, keeps identities usable, and reuses metadata for the visit', async () => {
  const page = harness({
    view: 'detailed',
    follows: [repo('R_alpha', 'alpha', 'widgets'), repo('R_gamma', 'gamma', 'tools')],
  });
  await flush();

  expect(page.buttonIn(page.desktop(), 'Detailed').getAttribute('aria-checked')).toBe('true');
  expect(page.desktop().textContent).toContain('alpha/widgets');
  expect(page.metadataRequests).toHaveLength(1);
  expect(page.desktop().querySelector('.followed-list__description')).toBeNull();

  page.buttonIn(page.desktop(), 'Compact').click();
  await flush();
  expect(page.metadataRequests).toHaveLength(1);

  page.metadataRequests[0]!.resolve({
    renamed: false,
    repositories: {
      R_alpha: available('alpha', 'widgets', 'Alpha tools', 'Go', 4),
      R_gamma: { status: 'transient' },
    },
  });
  await page.acceptSave();
  page.buttonIn(page.desktop(), 'Detailed').click();
  await flush();

  expect(page.metadataRequests).toHaveLength(1);
  expect(page.desktop().textContent).toContain('Alpha tools');
  page.dom.document
    .querySelector<HTMLButtonElement>('.release-follows-page__followed-trigger')!
    .click();
  await flush();
  const sheet = page.dom.document.querySelector('.followed-sheet')!;
  expect(sheet.textContent).toContain('Alpha tools');
  expect(page.buttonIn(sheet, 'Detailed').getAttribute('aria-checked')).toBe('true');
  sheet.querySelector<HTMLButtonElement>('.followed-sheet__close')!.click();
  await flush();
  expect(page.metadataRequests).toHaveLength(1);

  page.mounted.unmount();
  const again = harness({
    view: 'detailed',
    follows: [repo('R_alpha', 'alpha', 'widgets')],
  });
  await flush();
  expect(again.metadataRequests).toHaveLength(1);
  expect(again.desktop().textContent).not.toContain('Alpha tools');
  again.metadataRequests[0]!.resolve({
    renamed: false,
    repositories: {
      R_alpha: available('alpha', 'widgets', 'Fresh alpha', 'Go', 9),
    },
  });
  await flush();
  expect(again.desktop().textContent).toContain('Fresh alpha');
});

test('retries a failed repository without discarding successful metadata or follows', async () => {
  const page = harness({
    view: 'detailed',
    follows: [repo('R_alpha', 'alpha', 'widgets'), repo('R_gamma', 'gamma', 'tools')],
    unavailable: ['R_alpha'],
  });
  await flush();
  page.metadataRequests[0]!.resolve({
    renamed: false,
    repositories: {
      R_alpha: available('alpha', 'widgets', 'Alpha tools', 'Go', 4),
      R_gamma: { status: 'transient' },
    },
  });
  await flush();

  expect(page.desktop().querySelectorAll('.followed-list__badge')).toHaveLength(1);
  page.buttonIn(page.desktop(), 'Retry details for gamma/tools').click();
  await flush();
  expect(page.metadataRequests).toHaveLength(2);
  const pendingRetry = page.desktop().querySelector<HTMLButtonElement>('.followed-list__retry');
  expect(pendingRetry?.disabled).toBe(true);
  expect(pendingRetry?.getAttribute('aria-busy')).toBe('true');
  expect(pendingRetry?.querySelector('.is-spinning')).not.toBeNull();
  page.metadataRequests[1]!.resolve({
    renamed: false,
    repositories: {
      R_alpha: { status: 'transient' },
      R_gamma: available('gamma', 'tools', 'Gamma recovered', null, 3),
    },
  });
  await flush();

  const desktop = page.desktop();
  expect(desktop.textContent).toContain('Alpha tools');
  expect(desktop.textContent).toContain('Gamma recovered');
  expect(
    desktop.querySelector('[data-followed-id="R_gamma"] .followed-list__stars')?.textContent
  ).toContain('3');
  expect(page.opened).toEqual([]);
  page.buttonIn(desktop, 'alpha/widgets').click();
  expect(page.opened).toEqual([{ owner: 'alpha', repo: 'widgets' }]);
  page.buttonIn(desktop, 'Remove gamma/tools').click();
  await flush();
  expect(page.opened).toEqual([{ owner: 'alpha', repo: 'widgets' }]);
  expect(desktop.textContent).not.toContain('gamma/tools');
  expect(page.settings.value.followedRepositories.map((item) => item.id)).toEqual(['R_alpha']);
});

test('loads metadata for a repository added while its settings save is still in flight', async () => {
  const page = harness({
    view: 'detailed',
    follows: [repo('R_alpha', 'alpha', 'widgets')],
  });
  await flush();
  page.metadataRequests[0]!.resolve({
    renamed: false,
    repositories: {
      R_alpha: available('alpha', 'widgets', 'Alpha tools', 'Go', 4),
    },
  });
  await flush();

  const added = page.store.updateSettings({
    followedRepositories: [
      repo('R_new', 'new', 'lib'),
      ...page.settings.value.followedRepositories,
    ],
  });
  await flush();

  expect(page.saveRequests).toHaveLength(1);
  expect(page.metadataRequests).toHaveLength(2);
  expect(page.metadataRequests[1]!.repositories).toEqual([repo('R_new', 'new', 'lib')]);

  page.metadataRequests[1]!.resolve({
    renamed: false,
    repositories: {
      R_new: available('new', 'lib', 'Brand new', 'Rust', 1),
    },
  });
  await flush();

  const row = page.desktop().querySelector('[data-followed-id="R_new"]');
  expect(row?.textContent).toContain('Brand new');
  expect(row?.querySelector('.followed-list__retry')).toBeNull();
  expect(page.desktop().textContent).toContain('Alpha tools');

  page.saveRequests[0]!.deferred.resolve(
    mergeUserSettingsPatch(page.settings.value, page.saveRequests[0]!.patch)
  );
  await added;
  await flush();
  expect(page.metadataRequests).toHaveLength(2);
});

test('drops late metadata after a follow is removed or the account changes', async () => {
  const removed = harness({
    view: 'detailed',
    follows: [repo('R_alpha', 'alpha', 'widgets'), repo('R_gamma', 'gamma', 'tools')],
  });
  await flush();
  removed.buttonIn(removed.desktop(), 'Remove gamma/tools').click();
  await flush();
  removed.metadataRequests[0]!.resolve({
    renamed: false,
    repositories: {
      R_alpha: available('alpha', 'widgets', 'Alpha tools', 'Go', 4),
      R_gamma: available('gamma', 'tools', 'Should stay gone', 'Go', 1),
    },
  });
  await flush();
  expect(removed.desktop().textContent).toContain('Alpha tools');
  expect(removed.desktop().textContent).not.toContain('Should stay gone');
  expect(removed.desktop().textContent).not.toContain('gamma/tools');

  const page = harness({
    view: 'detailed',
    follows: [repo('R_alpha', 'alpha', 'widgets')],
  });
  await flush();
  page.user.value = { login: 'hubot' };
  await flush();
  expect(page.metadataRequests).toHaveLength(2);
  page.metadataRequests[0]!.resolve({
    renamed: false,
    repositories: {
      R_alpha: available('alpha', 'widgets', 'SECRET octocat', 'Go', 4),
    },
  });
  await flush();
  expect(page.desktop().textContent).not.toContain('SECRET octocat');
  page.metadataRequests[1]!.resolve({
    renamed: false,
    repositories: {
      R_alpha: available('alpha', 'widgets', 'Hubot copy', 'Rust', 8),
    },
  });
  await flush();
  expect(page.desktop().textContent).toContain('Hubot copy');
  expect(page.desktop().textContent).not.toContain('SECRET octocat');
});

test('reloads renamed repository names and rolls back a failed view save', async () => {
  const page = harness({
    view: 'detailed',
    follows: [repo('R_alpha', 'old-owner', 'widgets')],
  });
  await flush();
  page.metadataRequests[0]!.resolve({
    renamed: true,
    repositories: {
      R_alpha: available('new-owner', 'widgets', 'Renamed project', 'Go', 2),
    },
  });
  await flush();
  expect(page.loadRequests).toHaveLength(1);
  page.loadRequests[0]!.resolve(
    mergeUserSettingsPatch(page.settings.value, {
      followedRepositories: [repo('R_alpha', 'new-owner', 'widgets')],
    })
  );
  await flush();
  expect(page.desktop().textContent).toContain('new-owner/widgets');
  expect(page.desktop().textContent).toContain('Renamed project');

  page.buttonIn(page.desktop(), 'Compact').click();
  await flush();
  page.saveRequests.at(-1)!.deferred.reject(new Error('offline'));
  await flush();
  expect(page.buttonIn(page.desktop(), 'Detailed').getAttribute('aria-checked')).toBe('true');
  expect(page.desktop().textContent).toContain('Renamed project');
});

test('preserves source, search, sort, and page while switching the followed view', async () => {
  const page = harness({ follows: [repo('R_alpha', 'alpha', 'widgets')] });
  await flush();
  const initialFetches = page.starredFetches.length;

  page.buttonIn(page.dom.document.body, 'Updated').click();
  await flush();
  page.dom.document.querySelector<HTMLButtonElement>('.pagination-link:not(.is-current)')!.click();
  await flush();
  expect(page.starredPagination.value.page).toBe(2);
  expect(page.sort.value).toBe('updated');

  page.buttonIn(page.dom.document.body, 'GitHub repository search').click();
  await flush();
  const input = page.dom.document.querySelector<HTMLInputElement>('input[type="search"]')!;
  input.value = 'widgets';
  input.dispatchEvent(new page.dom.window.Event('input', { bubbles: true }));
  await flush();

  page.buttonIn(page.desktop(), 'Detailed').click();
  await flush();
  expect(input.value).toBe('widgets');
  expect(
    page.buttonIn(page.dom.document.body, 'GitHub repository search').getAttribute('aria-selected')
  ).toBe('true');
  expect(page.starredFetches).toHaveLength(initialFetches + 2);
  expect(page.dom.document.querySelector('.release-follows-grid')?.textContent).toContain(
    'No repositories match this search.'
  );

  page.buttonIn(page.dom.document.body, 'Starred').click();
  await flush();
  expect(page.buttonIn(page.dom.document.body, 'Updated').getAttribute('aria-selected')).toBe(
    'true'
  );
  expect(page.dom.document.querySelector('.pagination-link.is-current')?.textContent?.trim()).toBe(
    '2'
  );
});

test.each([
  { view: 'compact' as const, offset: 0 },
  { view: 'compact' as const, offset: 15 },
  { view: 'detailed' as const, offset: 80 },
])(
  'keeps the viewed repository when switching from $view at offset $offset',
  async ({ view, offset }) => {
    const follows = Array.from({ length: 12 }, (_, index) =>
      repo(`R_${index}`, 'octo', `repo-${index}`)
    );
    const page = harness({ follows, view });
    await flush();
    const compactHeight = 40;
    const scroller = page.desktop().querySelector<HTMLElement>('.simplebar-content-wrapper');
    expect(scroller).not.toBeNull();
    const rect = (top: number, height: number) => ({
      top,
      bottom: top + height,
      left: 0,
      right: 200,
      width: 200,
      height,
      x: 0,
      y: top,
      toJSON: () => ({}),
    });
    Object.defineProperty(page.dom.window.HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value(this: HTMLElement) {
        if (this.classList.contains('simplebar-content-wrapper')) return rect(0, 160);
        if (this.classList.contains('followed-list__item')) {
          const port = this.closest('.simplebar-content-wrapper') as HTMLElement | null;
          let top = -(port?.scrollTop ?? 0);
          for (const sibling of [...(this.parentElement?.children ?? [])]) {
            if (sibling === this) break;
            if (!(sibling as HTMLElement).classList.contains('followed-list__item')) continue;
            top += (sibling as HTMLElement).classList.contains('followed-list__item--detailed')
              ? 120
              : compactHeight;
          }
          const height = this.classList.contains('followed-list__item--detailed')
            ? 120
            : compactHeight;
          return rect(top, height);
        }
        return rect(0, 0);
      },
    });
    const initialScrollTop = (view === 'detailed' ? 120 : compactHeight) * 4 + offset;
    scroller!.scrollTop = initialScrollTop;
    const viewed = [...scroller!.querySelectorAll<HTMLElement>('[data-followed-id]')].find(
      (item) => {
        const box = item.getBoundingClientRect();
        return box.bottom > 0 && box.top < 160;
      }
    );
    expect(viewed?.dataset.followedId).toBe('R_4');

    page.buttonIn(page.desktop(), view === 'compact' ? 'Detailed' : 'Compact').click();
    await flush();

    const stillViewed = [...scroller!.querySelectorAll<HTMLElement>('[data-followed-id]')].find(
      (item) => {
        const box = item.getBoundingClientRect();
        return box.bottom > 0 && box.top < 160;
      }
    );
    expect(stillViewed?.dataset.followedId).toBe('R_4');
    expect(scroller!.scrollTop).not.toBe(initialScrollTop);
  }
);

test('keeps empty, count, and clear behavior in Detailed View', async () => {
  const page = harness({
    view: 'detailed',
    follows: [repo('R_alpha', 'alpha', 'widgets')],
  });
  await flush();
  expect(page.text('.followed-list__count')).toBe('1');
  page.buttonIn(page.desktop(), 'Clear').click();
  await flush();
  expect(page.desktop().textContent).toContain('Clear all followed repositories?');
  page.buttonIn(page.desktop(), 'Clear all').click();
  await page.acceptSave();
  expect(page.desktop().textContent).toContain(
    'No Followed Repositories yet. Toggle a badge on a repository to add one.'
  );
  expect(page.text('.followed-list__count')).toBe('0');
  expect(page.buttonIn(page.desktop(), 'Detailed').getAttribute('aria-checked')).toBe('true');
});
