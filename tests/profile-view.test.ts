import { expect, mock, test } from 'bun:test';

import * as icons from '@lucide/vue';
import { defineComponent, h, nextTick, type PropType } from 'vue';

import * as fetchError from '../app/utils/getFetchErrorMessage';
import type { UserProfilePayload } from '../shared/types/users';
import { compileVue } from './helpers/compile-vue';
import { createVueDom } from './helpers/vue-dom';

mock.module('~/utils/getFetchErrorMessage', () => fetchError);
const userProfile = await import('../app/composables/useUserProfile');
const empty = { default: defineComponent(() => () => h('div')) };
const profileHeader = defineComponent({
  props: { profile: { type: Object as PropType<UserProfilePayload>, required: true } },
  setup: (props) => () => h('h1', props.profile.login),
});
const ProfileView = await compileVue(
  'app/components/dashboard/profile/ProfileView.vue',
  {
    '@lucide/vue': icons,
    '~/components/dashboard/profile/ContributionGraph.vue': empty,
    '~/components/dashboard/profile/ProfileHeader.vue': { default: profileHeader },
    '~/components/dashboard/profile/ProfilePackageList.vue': empty,
    '~/components/dashboard/profile/ProfilePinnedRepos.vue': empty,
    '~/components/dashboard/profile/ProfileReadme.vue': empty,
    '~/components/dashboard/profile/ProfileRepositoryList.vue': empty,
    '~/components/dashboard/profile/ProfileTabNav.vue': empty,
    '~/components/dashboard/profile/UserConnectionList.vue': empty,
    '~/composables/useUserProfile': userProfile,
    'vue-i18n': {
      useI18n: () => ({ t: (key: string) => (key === 'profile.retry' ? 'Retry' : key) }),
    },
  },
  { useI18n: 'vue-i18n' }
);

test('a failed bot profile stays in the profile view and retries the same login', async () => {
  const login = 'dependabot[bot]';
  const profileUrl = '/api/users/dependabot%5Bbot%5D';
  const requests: string[] = [];
  let unavailable = true;
  const dom = createVueDom({
    useGitPulseApiFetch: () => async (url: string) => {
      requests.push(url);
      if (url === profileUrl) {
        if (unavailable) throw Object.assign(new Error('Profile unavailable'), { status: 404 });
        return { login, type: 'Bot' };
      }
      if (url === `${profileUrl}/orgs`) return { items: [] };
      return null;
    },
  });

  try {
    const { root } = dom.mount(defineComponent(() => () => h(ProfileView, { username: login })));
    await Bun.sleep(0);
    await nextTick();
    expect(root.textContent).toContain('Profile unavailable');
    expect(root.querySelector('h1')).toBeNull();

    unavailable = false;
    root.querySelector<HTMLButtonElement>('button')!.click();
    await Bun.sleep(0);
    await nextTick();

    expect(root.querySelector('h1')?.textContent).toBe(login);
    expect(root.textContent).not.toContain('Profile unavailable');
    expect(requests.filter((url) => url === profileUrl)).toHaveLength(2);
    expect(requests).not.toContain(`${profileUrl}/contributions`);
  } finally {
    await dom.cleanup();
  }
});
