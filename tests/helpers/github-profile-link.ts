import * as Vue from 'vue';
import {
  createMemoryHistory,
  createRouter,
  RouterLink,
  routeLocationKey,
  routerKey,
} from 'vue-router';

import * as githubUrlUtils from '../../app/utils/githubUrlUtils';
import { resolveNavigationEntryRoute } from '../../app/utils/navigationEntryRouting';
import { compileVue } from './compile-vue';

export const opensGitHubLinksKey: Vue.InjectionKey<Vue.Ref<boolean>> = Symbol('opensGitHubLinks');

const defaultPreference = Vue.shallowRef(false);
const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/dashboard/profile', component: {} }],
});
const NuxtLinkLocale = Vue.defineComponent({
  props: {
    to: {
      type: Object as Vue.PropType<ReturnType<typeof resolveNavigationEntryRoute>>,
      required: true,
    },
  },
  setup(props, { slots }) {
    const activeRouter = Vue.inject(routerKey, router);
    Vue.provide(routerKey, activeRouter);
    Vue.provide(routeLocationKey, Vue.inject(routeLocationKey, activeRouter.currentRoute.value));
    return () => Vue.h(RouterLink, { to: props.to }, slots);
  },
});

export async function compileGitHubProfileLinkModules(
  useGitHubLinkRouting: () => { opensGitHubLinks: Readonly<Vue.Ref<boolean>> } = () => ({
    opensGitHubLinks: Vue.inject(opensGitHubLinksKey, defaultPreference),
  })
) {
  const ProfileLink = await compileVue(
    'app/components/ui/GitHubProfileLink.vue',
    {
      vue: {
        ...Vue,
        resolveComponent: (name: string) =>
          name === 'NuxtLinkLocale' ? NuxtLinkLocale : Vue.resolveComponent(name),
      },
      '~/utils/githubUrlUtils': githubUrlUtils,
      'virtual:profile-routing': { resolveNavigationEntryRoute, useGitHubLinkRouting },
    },
    {
      resolveNavigationEntryRoute: 'virtual:profile-routing',
      useGitHubLinkRouting: 'virtual:profile-routing',
    }
  );

  return { '~/components/ui/GitHubProfileLink.vue': { default: ProfileLink } };
}

export const githubProfileLinkModules = await compileGitHubProfileLinkModules();
