import { afterEach, expect, mock, test } from 'bun:test';

import { defineComponent, h } from 'vue';

import english from '../i18n/locales/en.json';
import { compileVue } from './helpers/compile-vue';
import { githubProfileLinkModules } from './helpers/github-profile-link';
import { interpolateTranslation } from './helpers/translation';
import { createVueDom } from './helpers/vue-dom';

mock.module(
  '~/composables/usePRTimelineEvents',
  () => import('../app/composables/usePRTimelineEvents')
);

const icon = defineComponent({ render: () => h('svg') });

const messages: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(english.timeline).map(([key, value]) => [`timeline.${key}`, value])
  ),
  ...Object.fromEntries(
    Object.entries(english.prReview.copilot).map(([key, value]) => [
      `prReview.copilot.${key}`,
      value,
    ])
  ),
  ...Object.fromEntries(
    Object.entries(english.prReview.stackDetail.state).map(([key, value]) => [
      `prReview.stackDetail.state.${key}`,
      value,
    ])
  ),
};

const useI18n = () => ({
  t: (key: string, params?: Record<string, unknown>) =>
    interpolateTranslation(messages[key] ?? key, params),
});

const StateEvents = await compileVue(
  'app/components/dashboard/pr/PRTimelineStateEvents.vue',
  {
    ...githubProfileLinkModules,
    '@lucide/vue': new Proxy({}, { get: () => icon }),
    'vue-i18n': { useI18n },
    '~/composables/usePRTimelineEvents': {
      usePRTimelineEvents: () => ({ openPullRequest: () => {} }),
    },
    '~/utils/getTextColorFromBackground': await import('../app/utils/getTextColorFromBackground'),
  },
  { useI18n: 'vue-i18n' }
);

let dom: ReturnType<typeof createVueDom> | undefined;
afterEach(async () => {
  await dom?.cleanup();
  dom = undefined;
});

/** One timeline row, exactly as the server normalizer builds a force-pushed event. */
function forcePushItem() {
  return {
    id: 'HRFPE_one',
    kind: 'event',
    eventType: 'head_ref_force_pushed',
    createdAt: '2026-11-22T05:50:35Z',
    actor: { login: 'pynickle', avatarUrl: 'https://github.com/pynickle.png' },
    ref: { name: 'stack/reb-03' },
    beforeCommit: { oid: 'd116a1d33bc23e3ac3556ea782b714eea075babd' },
    afterCommit: { oid: '06e80370cd900edd211dc580a990e3a6b216b3ab' },
  };
}

function mountItem(item: Record<string, unknown>) {
  dom = createVueDom({ useI18n });
  const Harness = defineComponent({
    setup: () => () => h(StateEvents, { item }),
  });
  return dom.mount(Harness).root;
}

test('a force push names the branch it rewrote and both ends of the rewrite', () => {
  const root = mountItem(forcePushItem());

  // GitHub's own wording: the branch is the subject, not "the head branch".
  expect(root.textContent).toContain('force-pushed the stack/reb-03 branch');
  expect(root.textContent).not.toContain('head branch');
  expect(root.textContent).toContain('d116a1d');
  expect(root.textContent).toContain('06e8037');
});

test('the force-push sentence comes from the catalogue, in the reader\u2019s language', () => {
  const root = mountItem(forcePushItem());

  // A missing key would render the catalogue path instead of the sentence.
  expect(root.textContent).not.toContain('timeline.');
});

test('a force push without a branch names only what the payload has', () => {
  const item = forcePushItem();
  delete (item as Record<string, unknown>).ref;

  const root = mountItem(item);

  expect(root.textContent).toContain('force-pushed');
  expect(root.textContent).not.toContain('stack/reb-03');
});
