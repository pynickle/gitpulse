import { afterEach, expect, mock, test } from 'bun:test';

import { defineComponent, h } from 'vue';

import english from '../i18n/locales/en.json';
import chinese from '../i18n/locales/zh-cn.json';
import { compileVue } from './helpers/compile-vue';
import { githubProfileLinkModules } from './helpers/github-profile-link';
import { interpolateTranslation } from './helpers/translation';
import { createVueDom } from './helpers/vue-dom';

mock.module(
  '~/composables/usePRTimelineEvents',
  () => import('../app/composables/usePRTimelineEvents')
);

const icon = defineComponent({ render: () => h('svg') });

type LocaleCode = 'en' | 'zh-cn';

const flattenMessages = (source: typeof english): Record<string, string> => ({
  ...Object.fromEntries(
    Object.entries(source.timeline).map(([key, value]) => [`timeline.${key}`, value])
  ),
  ...Object.fromEntries(
    Object.entries(source.prReview.copilot).map(([key, value]) => [
      `prReview.copilot.${key}`,
      value,
    ])
  ),
  ...Object.fromEntries(
    Object.entries(source.prReview.stackDetail.state).map(([key, value]) => [
      `prReview.stackDetail.state.${key}`,
      value,
    ])
  ),
});

const catalogues: Record<LocaleCode, Record<string, string>> = {
  en: flattenMessages(english),
  'zh-cn': flattenMessages(chinese),
};

let activeLocale: LocaleCode = 'en';

const useI18n = () => ({
  t: (key: string, params?: Record<string, unknown>) =>
    interpolateTranslation(catalogues[activeLocale][key] ?? key, params),
});

const I18nT = defineComponent({
  name: 'I18nT',
  props: {
    keypath: { type: String, required: true },
    tag: { type: String, default: 'span' },
  },
  setup(props, { slots }) {
    return () => {
      const template = catalogues[activeLocale][props.keypath] ?? props.keypath;
      const children: Array<string | ReturnType<typeof h>> = [];
      let cursor = 0;
      for (const match of template.matchAll(/\{(\w+)\}/g)) {
        const index = match.index ?? 0;
        if (index > cursor) {
          children.push(template.slice(cursor, index));
        }
        const slotName = match[1]!;
        const slot = slots[slotName];
        if (slot) {
          children.push(...slot());
        }
        cursor = index + match[0].length;
      }
      if (cursor < template.length) {
        children.push(template.slice(cursor));
      }
      return h(props.tag, children);
    };
  },
});

const StateEvents = await compileVue(
  'app/components/dashboard/pr/PRTimelineStateEvents.vue',
  {
    ...githubProfileLinkModules,
    '@lucide/vue': new Proxy({}, { get: () => icon }),
    'vue-i18n': { useI18n, I18nT },
    '~/composables/usePRTimelineEvents': {
      usePRTimelineEvents: () => ({ openPullRequest: () => {} }),
    },
    '~/utils/getTextColorFromBackground': await import('../app/utils/getTextColorFromBackground'),
  },
  { useI18n: 'vue-i18n', I18nT: 'vue-i18n' }
);

let dom: ReturnType<typeof createVueDom> | undefined;
afterEach(async () => {
  activeLocale = 'en';
  await dom?.cleanup();
  dom = undefined;
});

/** One timeline row, exactly as the server normalizer builds a force-pushed event. */
function forcePushItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'HRFPE_one',
    kind: 'event',
    eventType: 'head_ref_force_pushed',
    createdAt: '2026-11-22T05:50:35Z',
    actor: { login: 'pynickle', avatarUrl: 'https://github.com/pynickle.png' },
    ref: { name: 'stack/reb-03' },
    beforeCommit: { oid: 'd116a1d33bc23e3ac3556ea782b714eea075babd' },
    afterCommit: { oid: '06e80370cd900edd211dc580a990e3a6b216b3ab' },
    ...overrides,
  };
}

function mountItem(item: Record<string, unknown>, locale: LocaleCode = 'en') {
  activeLocale = locale;
  dom = createVueDom({ useI18n });
  const Harness = defineComponent({
    setup: () => () => h(StateEvents, { item }),
  });
  return dom.mount(Harness).root;
}

test('a force push names the branch it rewrote and both ends of the rewrite', () => {
  const root = mountItem(forcePushItem());

  // GitHub's own wording: the branch is the subject, not "the head branch".
  expect(root.textContent).toBe('force-pushed the stack/reb-03 branch from d116a1d to 06e8037');
  expect(root.textContent).not.toContain('head branch');
});

test('the force-push sentence comes from the catalogue, in the reader\u2019s language', () => {
  const root = mountItem(forcePushItem(), 'zh-cn');

  expect(root.textContent).not.toContain('timeline.');
  expect(root.textContent).toBe('将 stack/reb-03 分支从 d116a1d 强制推送至 06e8037');
});

test('a force push without a branch falls back to head vs base without double spaces', () => {
  const headItem = forcePushItem({ ref: undefined });
  const headRoot = mountItem(headItem);

  expect(headRoot.textContent).toBe('force-pushed the head branch from d116a1d to 06e8037');
  expect(headRoot.textContent).not.toContain('  ');
  expect(headRoot.textContent).not.toContain('stack/reb-03');

  const baseItem = forcePushItem({
    eventType: 'base_ref_force_pushed',
    ref: undefined,
  });
  const baseRoot = mountItem(baseItem);

  expect(baseRoot.textContent).toBe('force-pushed the base branch from d116a1d to 06e8037');
  expect(baseRoot.textContent).not.toContain('  ');
});
