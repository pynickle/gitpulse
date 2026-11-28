import { afterEach, describe, expect, test } from 'bun:test';

import { defineComponent, h } from 'vue';

import { compileVue } from './helpers/compile-vue';
import { createVueDom } from './helpers/vue-dom';

const NuxtLinkLocaleStub = defineComponent({
  name: 'NuxtLinkLocale',
  inheritAttrs: false,
  props: {
    to: { type: [String, Object], required: true },
  },
  setup(props, { attrs, slots }) {
    return () =>
      h(
        'a',
        {
          ...attrs,
          'data-nuxt-link-locale': 'true',
          'data-to': typeof props.to === 'string' ? props.to : JSON.stringify(props.to),
        },
        slots.default?.()
      );
  },
});

const Button = await compileVue(
  'app/components/ui/Button.vue',
  {
    '#components': { NuxtLinkLocale: NuxtLinkLocaleStub },
  },
  {
    NuxtLinkLocale: '#components',
  }
);

let dom: ReturnType<typeof createVueDom>;

afterEach(async () => {
  await dom?.cleanup();
});

function mountButton(props: Record<string, unknown> = {}, label = 'Continue') {
  dom = createVueDom();
  const host = defineComponent({
    setup: () => () => h(Button as never, props, () => label),
  });
  return dom.mount(host).root;
}

function classListOf(element: Element): string[] {
  return (element.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
}

describe('ui/Button.vue (#201)', () => {
  test('renders a semantic <button> by default without Bulma classes', () => {
    const root = mountButton();
    const button = root.querySelector('button');

    expect(button).toBeTruthy();
    expect(button?.getAttribute('type')).toBe('button');
    expect(button?.textContent?.trim()).toBe('Continue');

    const classes = classListOf(button!);
    expect(classes).toContain('gp-btn');
    expect(classes).toContain('gp-btn--primary');
    expect(classes.some((c) => c === 'button' || c.startsWith('is-') || c === 'px-6')).toBe(false);
  });

  test('renders an <a> when href is provided and forwards target', () => {
    const root = mountButton({
      href: 'https://github.com',
      target: '_blank',
      rel: 'noopener noreferrer',
      variant: 'link',
    });
    const anchor = root.querySelector('a');

    expect(anchor).toBeTruthy();
    expect(root.querySelector('button')).toBeNull();
    expect(anchor?.getAttribute('href')).toBe('https://github.com');
    expect(anchor?.getAttribute('target')).toBe('_blank');
    expect(anchor?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(anchor?.getAttribute('type')).toBeNull();
    expect(classListOf(anchor!)).toContain('gp-btn--link');
  });

  test('renders NuxtLinkLocale when to is provided and prioritizes to over href', () => {
    const route = { path: '/dashboard', query: { tab: 'pulls' } };
    const root = mountButton({
      to: route,
      href: 'https://ignored.example',
      variant: 'ghost',
    });
    const link = root.querySelector('a[data-nuxt-link-locale="true"]');

    expect(link).toBeTruthy();
    expect(link?.getAttribute('data-to')).toBe(JSON.stringify(route));
    expect(link?.getAttribute('href')).toBeNull();
    expect(classListOf(link!)).toContain('gp-btn--ghost');
  });

  test('applies semantic variants, sizes, outlined, block, and pill modifiers', () => {
    for (const variant of [
      'primary',
      'secondary',
      'light',
      'ghost',
      'link',
      'info',
      'success',
      'warning',
      'danger',
      'danger-soft',
    ] as const) {
      const root = mountButton({
        variant,
        size: 'small',
        outlined: true,
        block: true,
        pill: true,
      });
      const classes = classListOf(root.querySelector('button')!);

      expect(classes).toContain('gp-btn');
      expect(classes).toContain(`gp-btn--${variant}`);
      expect(classes).toContain('gp-btn--small');
      expect(classes).toContain('gp-btn--outlined');
      expect(classes).toContain('gp-btn--block');
      expect(classes).toContain('gp-btn--pill');
      expect(classes.some((c) => c === 'button' || c.startsWith('is-'))).toBe(false);
    }
  });

  test('handles loading and disabled states for buttons and links', () => {
    const loadingBtnRoot = mountButton({ loading: true });
    const loadingBtn = loadingBtnRoot.querySelector('button')!;
    expect(classListOf(loadingBtn)).toContain('gp-btn--loading');
    expect(loadingBtn.hasAttribute('disabled')).toBe(true);
    expect(loadingBtn.getAttribute('aria-busy')).toBe('true');

    const disabledAnchorRoot = mountButton({ href: '/auth/github', disabled: true });
    const disabledAnchor = disabledAnchorRoot.querySelector('a')!;
    expect(disabledAnchor.getAttribute('aria-disabled')).toBe('true');
    expect(disabledAnchor.getAttribute('tabindex')).toBe('-1');

    const loadingLinkRoot = mountButton({ to: '/dashboard', loading: true });
    const loadingLink = loadingLinkRoot.querySelector('a[data-nuxt-link-locale="true"]')!;
    expect(classListOf(loadingLink)).toContain('gp-btn--loading');
    expect(loadingLink.getAttribute('aria-disabled')).toBe('true');
    expect(loadingLink.getAttribute('aria-busy')).toBe('true');
    expect(loadingLink.getAttribute('tabindex')).toBe('-1');
  });

  test('forwards type, custom classes, aria/data attributes, and click listeners', () => {
    let clicks = 0;
    const root = mountButton({
      type: 'submit',
      class: 'custom-action',
      'data-testid': 'submit-cta',
      'aria-label': 'Submit form',
      onClick: () => {
        clicks += 1;
      },
    });
    const button = root.querySelector('button')!;

    expect(button.getAttribute('type')).toBe('submit');
    expect(button.getAttribute('data-testid')).toBe('submit-cta');
    expect(button.getAttribute('aria-label')).toBe('Submit form');
    expect(classListOf(button)).toContain('custom-action');
    expect(classListOf(button)).toContain('gp-btn');

    button.click();
    expect(clicks).toBe(1);
  });

  test('blocks caller click handlers on disabled and loading links while forwarding clicks on enabled links', () => {
    let disabledHrefClicks = 0;
    const disabledHrefRoot = mountButton({
      href: 'https://github.com',
      disabled: true,
      onClick: () => {
        disabledHrefClicks += 1;
      },
    });
    const disabledHrefEvent = new dom.window.MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });
    disabledHrefRoot.querySelector('a')!.dispatchEvent(disabledHrefEvent);
    expect(disabledHrefEvent.defaultPrevented).toBe(true);
    expect(disabledHrefClicks).toBe(0);

    let loadingHrefClicks = 0;
    const loadingHrefRoot = mountButton({
      href: 'https://github.com',
      loading: true,
      onClick: () => {
        loadingHrefClicks += 1;
      },
    });
    const loadingHrefEvent = new dom.window.MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });
    loadingHrefRoot.querySelector('a')!.dispatchEvent(loadingHrefEvent);
    expect(loadingHrefEvent.defaultPrevented).toBe(true);
    expect(loadingHrefClicks).toBe(0);

    let disabledToClicks = 0;
    const disabledToRoot = mountButton({
      to: '/dashboard',
      disabled: true,
      onClick: () => {
        disabledToClicks += 1;
      },
    });
    const disabledToEvent = new dom.window.MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });
    disabledToRoot.querySelector('a[data-nuxt-link-locale="true"]')!.dispatchEvent(disabledToEvent);
    expect(disabledToEvent.defaultPrevented).toBe(true);
    expect(disabledToClicks).toBe(0);

    let loadingToClicks = 0;
    const loadingToRoot = mountButton({
      to: '/dashboard',
      loading: true,
      onClick: () => {
        loadingToClicks += 1;
      },
    });
    const loadingToEvent = new dom.window.MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });
    loadingToRoot.querySelector('a[data-nuxt-link-locale="true"]')!.dispatchEvent(loadingToEvent);
    expect(loadingToEvent.defaultPrevented).toBe(true);
    expect(loadingToClicks).toBe(0);

    const enabledHrefCalls: string[] = [];
    const enabledHrefRoot = mountButton({
      href: 'https://github.com',
      onClick: [
        (event: MouseEvent) => {
          event.preventDefault();
          enabledHrefCalls.push('first');
        },
        () => {
          enabledHrefCalls.push('second');
        },
      ],
    });
    enabledHrefRoot.querySelector('a')!.click();
    expect(enabledHrefCalls).toEqual(['first', 'second']);

    let enabledToClicks = 0;
    const enabledToRoot = mountButton({
      to: '/dashboard',
      onClick: (event: MouseEvent) => {
        event.preventDefault();
        enabledToClicks += 1;
      },
    });
    enabledToRoot.querySelector('a[data-nuxt-link-locale="true"]')!.click();
    expect(enabledToClicks).toBe(1);
  });
});
