import { afterEach, describe, expect, test } from 'bun:test';

import { defineComponent, h, reactive } from 'vue';

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
    const { root, state } = mount({ title: 'Failed' });

    root.querySelector<HTMLButtonElement>('.page-error-state__retry')!.click();

    expect(state.retries).toBe(1);
  });

  test('the server message is shown without a second interaction', () => {
    const { root } = mount({
      title: 'Failed',
      description: 'Request failed with status code 500',
    });

    expect(root.querySelector('.page-error-state__description')?.textContent).toContain(
      'Request failed with status code 500'
    );
  });

  test('a page can show a human sentence and the technical message together', () => {
    const { root } = mount({
      title: 'Unable to load this view',
      description: 'Please check your connection and try again.',
      details: 'Request failed with status code 502',
    });

    expect(root.querySelector('.page-error-state__description')?.textContent).toContain(
      'Please check your connection'
    );
    expect(root.querySelector('.page-error-state__details')?.textContent).toContain('502');
  });

  test('the retry control stays outside the alert', () => {
    const { root } = mount({ title: 'Failed', description: 'boom' });
    const alert = root.querySelector('.page-error-state__message[role="alert"]')!;

    expect(alert.textContent).toContain('boom');
    expect(alert.querySelector('.page-error-state__retry')).toBeNull();
  });
});
