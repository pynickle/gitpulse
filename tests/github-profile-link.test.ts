import { afterEach, expect, mock, test } from 'bun:test';

import * as icons from '@lucide/vue';
import { defineComponent, h, nextTick, provide, shallowRef } from 'vue';
import { createMemoryHistory, createRouter, routeLocationKey, routerKey } from 'vue-router';

import * as dashboardUrlNavigation from '../app/utils/dashboardUrlNavigationUtils';
import { compileVue } from './helpers/compile-vue';
import { compileGitHubProfileLinkModules } from './helpers/github-profile-link';
import { createVueDom } from './helpers/vue-dom';

mock.module('~/utils/dashboardUrlNavigationUtils', () => dashboardUrlNavigation);
const { useGitHubLinkRouting } = await import('../app/composables/useGitHubLinkRouting');
const profileLinkModules = await compileGitHubProfileLinkModules(useGitHubLinkRouting);
const ProfileLink = profileLinkModules['~/components/ui/GitHubProfileLink.vue'].default;
const SearchItem = await compileVue(
  'app/components/dashboard/GenericSearchItem.vue',
  {
    ...profileLinkModules,
    '@lucide/vue': icons,
    'virtual:search': {
      useI18n: () => ({ locale: shallowRef('en') }),
      useRelativeTimeNow: () => shallowRef(0),
    },
  },
  { useI18n: 'virtual:search', useRelativeTimeNow: 'virtual:search' }
);

let dom: ReturnType<typeof createVueDom> | undefined;
afterEach(async () => {
  await dom?.cleanup();
});

test('a user search card follows the saved link destination while a code result stays external', async () => {
  const settings = shallowRef<{ navigation: { linkTarget: 'gitpulse' | 'github' } }>({
    navigation: { linkTarget: 'gitpulse' },
  });
  dom = createVueDom({ useUserSettings: () => ({ settings }) });
  const botUrl = 'https://github.com/apps/dependabot';
  const fileUrl = 'https://github.com/acme/widget/blob/main/README.md';
  const { root } = dom.mount(
    defineComponent({
      setup: () => () => [
        h(SearchItem, { endpoint: 'users', item: { login: 'dependabot[bot]', html_url: botUrl } }),
        h(SearchItem, { endpoint: 'code', item: { name: 'README.md', html_url: fileUrl } }),
      ],
    })
  );

  const anchors = () => root.querySelectorAll('a');
  const profile = new URL(anchors()[0]!.getAttribute('href')!, 'https://gitpulse.test');
  expect(profile.pathname).toBe('/dashboard/profile');
  expect(profile.searchParams.get('user')).toBe('dependabot[bot]');
  expect(anchors()[0]!.getAttribute('target')).toBeNull();
  expect(anchors()[1]!.getAttribute('href')).toBe(fileUrl);

  settings.value = { navigation: { linkTarget: 'github' } };
  await nextTick();

  expect(anchors()[0]!.getAttribute('href')).toBe(botUrl);
  expect(anchors()[0]!.getAttribute('target')).toBe('_blank');
  expect(anchors()[1]!.getAttribute('href')).toBe(fileUrl);
});

test('a profile link does not open the currently displayed account again', () => {
  dom = createVueDom({
    useUserSettings: () => ({ settings: shallowRef({ navigation: { linkTarget: 'gitpulse' } }) }),
  });
  const { root } = dom.mount(
    defineComponent({
      setup: () => () =>
        h(ProfileLink, { login: 'Octocat', currentLogin: 'octocat' }, () => 'Octocat'),
    })
  );

  expect(root.textContent).toBe('Octocat');
  expect(root.querySelector('a')).toBeNull();
});

test('a bot with no supplied web URL links to its GitHub App in GitHub mode', () => {
  dom = createVueDom({
    useUserSettings: () => ({ settings: shallowRef({ navigation: { linkTarget: 'github' } }) }),
  });
  const { root } = dom.mount(
    defineComponent({
      setup: () => () => h(ProfileLink, { login: 'dependabot[bot]' }, () => 'dependabot[bot]'),
    })
  );

  expect(root.querySelector('a')?.getAttribute('href')).toBe('https://github.com/apps/dependabot');
});

test('an app identified only by its display name opens the supplied app page', () => {
  dom = createVueDom({
    useUserSettings: () => ({ settings: shallowRef({ navigation: { linkTarget: 'gitpulse' } }) }),
  });
  const githubHref = 'https://github.com/apps/copilot-pull-request-reviewer';
  const { root } = dom.mount(
    defineComponent(() => () => h(ProfileLink, { login: 'Copilot', githubHref }, () => 'Copilot'))
  );

  expect(root.querySelector('a')?.getAttribute('href')).toBe(githubHref);
});

test('a different account profile is not announced as the current page', async () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/dashboard/profile', component: {} }],
  });
  await router.push('/dashboard/profile?user=alice');
  dom = createVueDom({
    useUserSettings: () => ({ settings: shallowRef({ navigation: { linkTarget: 'gitpulse' } }) }),
  });
  const { root } = dom.mount(
    defineComponent({
      setup() {
        provide(routerKey, router);
        provide(routeLocationKey, router.currentRoute.value);
        return () => h(ProfileLink, { login: 'bob', currentLogin: 'alice' }, () => 'bob');
      },
    })
  );

  const link = root.querySelector('a');
  expect(link?.getAttribute('href')).toBe('/dashboard/profile?user=bob');
  expect(link?.getAttribute('aria-current')).toBe('false');
});
