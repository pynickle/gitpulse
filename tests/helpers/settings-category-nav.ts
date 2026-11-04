import { defineComponent, h } from 'vue';

import { compileVue } from './compile-vue';

// Stand-in for the lucide icons these components render: the tests assert on layout and
// text, never on icon internals.
export const svgStub = defineComponent({ render: () => h('svg') });

export const SettingsCategoryNav = await compileVue(
  'app/components/dashboard/settings/SettingsCategoryNav.vue',
  {
    '@lucide/vue': { ChevronRightIcon: svgStub },
  }
);

export const categoryRows = (root: ParentNode) => [
  ...root.querySelectorAll<HTMLElement>('.settings-category-nav__item'),
];
