import { afterEach, describe, expect, test } from 'bun:test';

import { defineComponent, h } from 'vue';

import { compileVue } from './helpers/compile-vue';
import { createVueDom } from './helpers/vue-dom';

const icon = defineComponent({ setup: () => () => h('span') });
const Button = defineComponent({
  setup:
    (_, { slots }) =>
    () =>
      h('button', slots.default?.()),
});
const Navbar = defineComponent({ setup: () => () => h('nav') });

const SkipToContentLink = await compileVue('app/components/ui/SkipToContentLink.vue');
const PublicShell = await compileVue('app/components/layouts/PublicShell.vue', {
  '~/components/layouts/Navbar.vue': { default: Navbar },
  '~/components/ui/SkipToContentLink.vue': { default: SkipToContentLink },
});

const ErrorPage = await compileVue('app/error.vue', {
  '@lucide/vue': {
    TriangleExclamationPointIcon: icon,
    CoffeeIcon: icon,
    LockKeyholeIcon: icon,
    MapPinOffIcon: icon,
    ServerOffIcon: icon,
  },
  '~/components/layouts/PublicShell.vue': { default: PublicShell },
  '~/components/ui/Button.vue': { default: Button },
});

let dom: ReturnType<typeof createVueDom>;

afterEach(async () => {
  await dom.cleanup();
});

function mountError(statusCode: number) {
  dom = createVueDom({
    notFoundRobots: () => 'noindex, nofollow',
    useHead: () => {},
    useI18n: () => ({ t: (key: string) => key }),
    useLocalePath: () => (path: string) => path,
    clearError: () => {},
  });
  const host = defineComponent({
    setup: () => () =>
      h(ErrorPage as never, { error: { status: statusCode, message: 'not found' } }),
  });
  return dom.mount(host).root;
}

describe('error page', () => {
  test('renders the error card inside the public shell landmark', () => {
    const root = mountError(404);

    const main = root.querySelector('main');
    expect(main).toBeTruthy();
    expect(main?.querySelector('[data-testid="error-card"]')).toBeTruthy();
    // The shell, not the error page, owns the skip link to that landmark.
    expect(root.querySelector(`a[href="#${main?.id}"]`)).toBeTruthy();
  });

  test('shows the status code the error carries', () => {
    const root = mountError(404);

    expect(root.querySelector('.error-card__code')?.textContent?.trim()).toBe('404');
    expect(root.querySelectorAll('.error-card__actions button').length).toBe(2);
  });
});
