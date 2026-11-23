import { afterEach, describe, expect, test } from 'bun:test';

import { defineComponent, h, nextTick, reactive } from 'vue';

import { compileVue } from './helpers/compile-vue';
import { createVueDom } from './helpers/vue-dom';

const icon = defineComponent({ setup: () => () => h('span') });

const PageErrorState = await compileVue('app/components/ui/PageErrorState.vue', {
  '@lucide/vue': {
    ChevronDownIcon: icon,
    RefreshCwIcon: icon,
    TriangleExclamationPointIcon: icon,
  },
  'vue-i18n': { useI18n: () => ({ t: (key: string) => key }) },
});

let dom: ReturnType<typeof createVueDom>;

afterEach(async () => {
  await dom.cleanup();
});

function mount(props: Record<string, unknown>) {
  dom = createVueDom();
  const state = reactive({ retries: 0 });
  const host = defineComponent({
    setup: () => () =>
      h(PageErrorState as never, { ...props, onRetry: () => (state.retries += 1) }),
  });
  return { root: dom.mount(host).root, state };
}

describe('page error state', () => {
  test('renders the failure title and description as an alert', () => {
    const { root } = mount({
      title: 'Failed to load branches.',
      description: 'Check your connection.',
      retryLabel: 'Retry',
    });

    expect(root.querySelector('.page-error-state__message[role="alert"]')).toBeTruthy();
    expect(root.querySelector('.page-error-state__title')?.textContent).toContain(
      'Failed to load branches.'
    );
    expect(root.querySelector('.page-error-state__description')?.textContent).toContain(
      'Check your connection.'
    );
  });

  test('the retry control emits retry', () => {
    const { root, state } = mount({ title: 'Failed', retryLabel: 'Retry' });

    root.querySelector<HTMLButtonElement>('.page-error-state__retry')!.click();

    expect(state.retries).toBe(1);
  });

  test('details stay collapsed until the toggle is pressed', async () => {
    const { root } = mount({
      title: 'Failed',
      retryLabel: 'Retry',
      details: 'Request failed with status code 500',
    });

    const toggle = root.querySelector<HTMLButtonElement>('.page-error-state__toggle')!;
    expect(root.querySelector('.page-error-state__details')).toBeNull();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    toggle.click();
    await nextTick();

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(root.querySelector('.page-error-state__details')?.textContent).toContain(
      'Request failed with status code 500'
    );
  });

  test('no details toggle is rendered without a detail message', () => {
    const { root } = mount({ title: 'Failed', retryLabel: 'Retry' });

    expect(root.querySelector('.page-error-state__toggle')).toBeNull();
  });

  test('the inline variant keeps the same contract on a compact block', () => {
    const { root } = mount({
      title: 'Failed to load this wiki page.',
      retryLabel: 'Retry',
      variant: 'inline',
    });

    expect(
      root.querySelector('.page-error-state')?.classList.contains('page-error-state--inline')
    ).toBe(true);
    expect(root.querySelector('.page-error-state__message[role="alert"]')).toBeTruthy();
    expect(root.querySelector('.page-error-state__retry')).toBeTruthy();
  });
});
