import { afterAll, afterEach, expect, test } from 'bun:test';

import { defineComponent, h, nextTick, shallowRef } from 'vue';

import type { TimelineRelease } from '#shared/types/release-follows';

import english from '../i18n/locales/en.json';
import chinese from '../i18n/locales/zh-cn.json';
import { compileVue } from './helpers/compile-vue';
import { createVueDom } from './helpers/vue-dom';

const catalogs = { en: english, 'zh-cn': chinese };
const locale = shallowRef<keyof typeof catalogs>('en');

function translate(
  catalog: (typeof catalogs)[keyof typeof catalogs],
  key: string,
  params?: Record<string, unknown>
) {
  const value = key.split('.').reduce<unknown>((node, part) => {
    if (node && typeof node === 'object' && part in node) {
      return (node as Record<string, unknown>)[part];
    }
    return undefined;
  }, catalog);
  if (typeof value !== 'string') {
    throw new Error(`Missing translation ${key}`);
  }
  return value.replace(/\{(\w+)\}/g, (_, name: string) => String(params?.[name] ?? ''));
}

const empty = defineComponent({ setup: () => () => h('span') });
const icons = {
  FileTextIcon: empty,
  FunnelIcon: empty,
  RotateCcwClockIcon: empty,
  RefreshCwIcon: empty,
  SearchIcon: empty,
  SlidersHorizontalIcon: empty,
};
const release: TimelineRelease = {
  repository: { id: 'R_widgets', owner: 'octo', name: 'widgets' },
  id: 1,
  title: 'v1',
  tagName: 'v1',
  publishedAt: '2026-10-02T00:00:00Z',
  changelog: '',
  changelogTruncated: false,
  assetCount: 0,
  isPrerelease: false,
  isOldestShown: false,
  htmlUrl: null,
  reactions: [],
};

const ReactionBar = await compileVue(
  'app/components/dashboard/release-timeline/ReleaseTimelineReactionBar.vue',
  {
    '~/components/dashboard/reactions/ReactionBar.vue': { default: empty },
  }
);
const Header = await compileVue(
  'app/components/dashboard/release-timeline/ReleaseTimelineHeader.vue',
  {
    '@lucide/vue': icons,
    '~/components/dashboard/release-timeline/ReleaseTimelineBaselineChip.vue': { default: empty },
  }
);

const dom = createVueDom({
  useI18n: () => ({
    locale,
    t: (key: string, params?: Record<string, unknown>) =>
      translate(catalogs[locale.value], key, params),
  }),
  useUserSettings: () => ({
    settings: shallowRef({ releaseTimeline: { showReactions: true } }),
  }),
  useReleaseReactionSummaries: () => ({
    itemsFor: () => release.reactions,
    setItems: () => {},
  }),
});

afterEach(() => {
  locale.value = 'en';
});

afterAll(() => dom.cleanup());

test('the release reaction group uses the translated reactions label', async () => {
  const mounted = dom.mount(
    defineComponent({
      setup: () => () => h(ReactionBar, { item: release }),
    })
  );
  await nextTick();
  const group = dom.document.querySelector('.release-timeline-reaction-bar');
  expect(group?.getAttribute('aria-label')).toBe('Reactions');

  locale.value = 'zh-cn';
  await nextTick();
  expect(group?.getAttribute('aria-label')).toBe('反应');
  mounted.unmount();
});

test('the release timeline search field has an id and name', async () => {
  const mounted = dom.mount(
    defineComponent({
      setup: () => () =>
        h(Header, {
          loading: false,
          modelValue: '',
          includeReleaseNotes: false,
        }),
    })
  );
  await nextTick();
  const search = dom.document.querySelector<HTMLInputElement>('input[type="search"]');
  expect(search?.id).toBe('release-timeline-search');
  expect(search?.getAttribute('name')).toBe('release-timeline-search');
  mounted.unmount();
});
