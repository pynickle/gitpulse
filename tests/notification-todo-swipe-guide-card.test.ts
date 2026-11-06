import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { defineComponent, h, nextTick, shallowRef, type Ref } from 'vue';

import { compileVue } from './helpers/compile-vue';
import { createVueDom } from './helpers/vue-dom';

const icon = defineComponent({ setup: () => () => h('span') });

const GuideCard = await compileVue('app/components/dashboard/NotificationTodoSwipeGuideCard.vue', {
  '@lucide/vue': { HandIcon: icon, XIcon: icon },
});

const CARD = '.notification-todo-guide';
const DISMISS = '.notification-todo-guide__dismiss';

let dom: ReturnType<typeof createVueDom>;

beforeEach(() => {
  dom = createVueDom({ useI18n: () => ({ t: (key: string) => key }) });
});

afterEach(async () => {
  await dom.cleanup();
});

const mountCard = (visible: Ref<boolean>) => {
  const dismissals: string[] = [];
  const mounted = dom.mount(
    defineComponent({
      setup: () => () =>
        h(GuideCard, {
          visible: visible.value,
          onDismiss: () => {
            dismissals.push('dismiss');
          },
        }),
    })
  );

  return { ...mounted, dismissals };
};

describe('NotificationTodoSwipeGuideCard', () => {
  test('shows the instruction and a close control while visible', async () => {
    const view = mountCard(shallowRef(true));
    await nextTick();

    expect(view.root.querySelector(CARD)).not.toBeNull();
    expect(view.root.textContent).toContain('dashboard.todos.swipeGuideCard');

    const dismiss = view.root.querySelector(DISMISS);
    expect(dismiss?.getAttribute('aria-label')).toBe('dashboard.todos.swipeGuideDismiss');
    expect(dismiss?.getAttribute('type')).toBe('button');
  });

  test('asks its owner to dismiss when the close control is pressed', async () => {
    const view = mountCard(shallowRef(true));
    await nextTick();

    view.root
      .querySelector(DISMISS)
      ?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(view.dismissals).toEqual(['dismiss']);
  });

  test('draws nothing while hidden', async () => {
    const view = mountCard(shallowRef(false));
    await nextTick();

    expect(view.root.querySelector(CARD)).toBeNull();
  });

  test('animates in when the guide becomes due and out when it is dismissed', async () => {
    const visible = shallowRef(false);
    const view = mountCard(visible);
    await nextTick();

    visible.value = true;
    await nextTick();
    expect(
      view.root.querySelector(CARD)?.classList.contains('notification-todo-guide-enter-active')
    ).toBe(true);

    visible.value = false;
    await nextTick();
    // The exit owns the card until its transition ends; dropping it on the dismiss
    // would make the bar snap shut instead of folding away.
    expect(
      view.root.querySelector(CARD)?.classList.contains('notification-todo-guide-leave-active')
    ).toBe(true);
  });
});
