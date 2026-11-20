import { afterEach, expect, test } from 'bun:test';

import { defineComponent, h, nextTick, shallowRef } from 'vue';

import type { TimelineRelease } from '#shared/types/release-follows';

import { compileVue } from './helpers/compile-vue';
import { createVueDom } from './helpers/vue-dom';

const icon = defineComponent({ setup: () => () => h('svg') });
const reactionBar = defineComponent({ setup: () => () => h('div') });
const settings = shallowRef({ releaseTimeline: { showAssetsCount: false } });
const Card = await compileVue(
  'app/components/dashboard/release-timeline/ReleaseTimelineCard.vue',
  {
    '@lucide/vue': { FlaskConicalIcon: icon, PackageIcon: icon },
    '#shared/types/release-follows': {},
    '~/components/dashboard/release-timeline/ReleaseTimelineReactionBar.vue': {
      default: reactionBar,
    },
    'virtual:card-settings': {
      useI18n: () => ({ locale: shallowRef('en'), t: (key: string) => key }),
      useUserSettings: () => ({ settings }),
      useRelativeTimeNow: () => shallowRef(0),
      useDashboardRepositoryNavigation: () => ({ openRepository: async () => {} }),
      formatDurationFromNow: () => 'now',
      shouldOpenReleaseDrawer: () => false,
    },
  },
  {
    useI18n: 'virtual:card-settings',
    useUserSettings: 'virtual:card-settings',
    useRelativeTimeNow: 'virtual:card-settings',
    useDashboardRepositoryNavigation: 'virtual:card-settings',
    formatDurationFromNow: 'virtual:card-settings',
    shouldOpenReleaseDrawer: 'virtual:card-settings',
  }
);

const release: TimelineRelease = {
  repository: { id: 'R_widgets', owner: 'octo', name: 'widgets' },
  id: 1,
  title: 'v1',
  tagName: 'v1',
  publishedAt: '2026-10-02T00:00:00Z',
  changelog: '',
  changelogTruncated: false,
  assetCount: 4,
  isPrerelease: false,
  isOldestShown: false,
  htmlUrl: null,
  reactions: [],
};

const dom = createVueDom();
afterEach(async () => {
  settings.value = { releaseTimeline: { showAssetsCount: false } };
  await dom.cleanup();
});

test('release timeline cards hide asset counts by default and show them when enabled', async () => {
  let mounted = dom.mount(defineComponent({ setup: () => () => h(Card, { item: release }) }));
  await nextTick();
  expect(dom.document.querySelector('.release-timeline-card__assets')).toBeNull();
  mounted.unmount();
  await dom.cleanup();

  settings.value = { releaseTimeline: { showAssetsCount: true } };
  mounted = dom.mount(defineComponent({ setup: () => () => h(Card, { item: release }) }));
  await nextTick();
  expect(dom.document.querySelector('.release-timeline-card__assets')?.textContent).toBe(
    'releaseDetail.assetCount'
  );
  mounted.unmount();
});
