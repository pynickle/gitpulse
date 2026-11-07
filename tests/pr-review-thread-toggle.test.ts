import { describe, expect, test } from 'bun:test';

import { defineComponent, h, nextTick, type Component } from 'vue';

import { compileVue } from './helpers/compile-vue';
import { createVueDom } from './helpers/vue-dom';

const icon = (name: string) =>
  defineComponent({
    setup: () => () => h('svg', { 'data-icon': name }),
  });

const loadToggle = () =>
  compileVue(
    'app/components/dashboard/pr/PRReviewThreadToggle.vue',
    {
      '@lucide/vue': { CheckIcon: icon('check'), CircleIcon: icon('circle') },
      '~/components/ui/LoadingIcon.vue': { default: icon('loader') },
      'vue-i18n': { useI18n: () => ({ t: (key: string) => key }) },
    },
    { useI18n: 'vue-i18n' }
  );

// The button's accessible name is its visible (not aria-hidden) state label.
const exposedLabel = (root: Element) =>
  root
    .querySelector('.pr-review-thread-toggle__text:not([aria-hidden="true"])')
    ?.textContent?.trim();

const activeIcon = (root: Element) =>
  root.querySelector('.pr-review-thread-toggle__mark.is-active')?.getAttribute('data-icon') ?? null;

const activeSpinner = (root: Element) =>
  root.querySelector('.pr-review-thread-toggle__spinner.is-active')?.getAttribute('data-icon') ??
  null;

const mountToggle = async (props: Record<string, unknown>) => {
  const Toggle = (await loadToggle()) as Component;
  const dom = createVueDom();
  const toggles: number[] = [];
  const view = dom.mount(
    defineComponent({
      setup: () => () => h(Toggle, { ...props, onToggle: () => toggles.push(1) }),
    })
  );
  await nextTick();
  return { dom, view, toggles, button: view.root.querySelector('button')! };
};

describe('review thread toggle', () => {
  test('renders one button that names the current state and the action it performs', async () => {
    const { dom, view, button } = await mountToggle({ resolved: false });
    try {
      expect(view.root.querySelectorAll('button')).toHaveLength(1);
      expect(exposedLabel(button)).toBe('prReview.threadUnresolved');
      expect(button.getAttribute('aria-pressed')).toBe('false');
      expect(button.getAttribute('title')).toBe('prReview.resolveThread');
    } finally {
      await dom.cleanup();
    }
  });

  test('a resolved thread shows the resolved state and offers to unresolve it', async () => {
    const { dom, button } = await mountToggle({ resolved: true });
    try {
      expect(exposedLabel(button)).toBe('prReview.threadResolved');
      expect(button.getAttribute('aria-pressed')).toBe('true');
      expect(button.getAttribute('title')).toBe('prReview.unresolveThread');
    } finally {
      await dom.cleanup();
    }
  });

  test('clicking the button asks its owner to switch the thread state', async () => {
    const { dom, button, toggles } = await mountToggle({ resolved: true });
    try {
      button.click();
      await nextTick();
      expect(toggles).toHaveLength(1);
    } finally {
      await dom.cleanup();
    }
  });

  test('an update in flight shows a loading mark while the state stays put', async () => {
    const { dom, view, button, toggles } = await mountToggle({
      resolved: false,
      loading: true,
    });
    try {
      expect(activeSpinner(button)).toBe('loader');
      expect(activeIcon(button)).toBeNull();
      expect(exposedLabel(button)).toBe('prReview.threadUnresolved');
      expect(button.getAttribute('aria-disabled')).toBe('true');
      expect(button.getAttribute('aria-busy')).toBe('true');
      expect(button.disabled).toBe(false);
      expect(view.root.querySelectorAll('button')).toHaveLength(1);
      button.click();
      await nextTick();
      expect(toggles).toHaveLength(0);
    } finally {
      await dom.cleanup();
    }
  });
});
