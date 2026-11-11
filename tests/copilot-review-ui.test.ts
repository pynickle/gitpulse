import { afterEach, expect, mock, test } from 'bun:test';

import { defineComponent, h, nextTick, shallowRef } from 'vue';

import en from '../i18n/locales/en.json';
import * as copilot from '../shared/utils/copilot-review';
import type { CopilotReviewEffort } from '../shared/utils/copilot-review';
import { compileVue } from './helpers/compile-vue';
import { createVueDom } from './helpers/vue-dom';

mock.module(
  '~/utils/parseGitHubMarkdownTarget',
  () => import('../app/utils/parseGitHubMarkdownTarget')
);
mock.module('~/utils/parseGitHubRepoPath', () => import('../app/utils/parseGitHubRepoPath'));
const timeline = await import('../app/composables/usePRTimelineEvents');
const messages: Record<string, string> = Object.fromEntries(
  Object.entries(en.prReview.copilot).map(([key, value]) => [`prReview.copilot.${key}`, value])
);
const useI18n = () => ({ t: (key: string) => messages[key] ?? key });
const icon = defineComponent({ render: () => h('svg') });
const FilterDropdown = await compileVue('app/components/ui/FilterDropdown.vue', {
  '@lucide/vue': new Proxy({}, { get: () => icon }),
  '~/components/ui/ScrollArea.vue': {
    default: defineComponent({
      setup:
        (_props, { slots, attrs }) =>
        () =>
          h('ul', attrs, slots.default?.()),
    }),
  },
});
const Picker = await compileVue('app/components/dashboard/pr/CopilotReviewEffortPicker.vue', {
  'vue-i18n': { useI18n },
  '#shared/utils/copilot-review': copilot,
  '~/components/ui/FilterDropdown.vue': { default: FilterDropdown },
});
const StateEvent = await compileVue(
  'app/components/dashboard/pr/PRTimelineStateEvents.vue',
  {
    'vue-i18n': { useI18n },
    '~/composables/usePRTimelineEvents': timeline,
    '~/utils/getTextColorFromBackground': await import('../app/utils/getTextColorFromBackground'),
  },
  { useI18n: 'vue-i18n' }
);
const PeoplePicker = defineComponent({
  props: ['candidates'],
  setup:
    (props, { slots }) =>
    () =>
      h('div', [
        slots.default?.(),
        ...(props.candidates as Array<{ name: string; badgeLabel: string }>).map((candidate) =>
          h('span', `${candidate.name} ${candidate.badgeLabel}`)
        ),
      ]),
});
const RequestModal = await compileVue('app/components/dashboard/pr/PRReviewerRequestModal.vue', {
  '@lucide/vue': new Proxy({}, { get: () => icon }),
  'vue-i18n': { useI18n },
  '#shared/utils/copilot-review': copilot,
  '~/components/dashboard/detail/DetailPeoplePickerModal.vue': { default: PeoplePicker },
});

let dom: ReturnType<typeof createVueDom> | undefined;
afterEach(async () => {
  await dom?.cleanup();
});

test('the effort editor emits a next-review choice and respects available levels', async () => {
  dom = createVueDom();
  const effort = shallowRef<CopilotReviewEffort>('balanced');
  const root = dom.mount(
    defineComponent({
      setup: () => () =>
        h(Picker, {
          modelValue: effort.value,
          efforts: ['lite', 'balanced', 'max'],
          'onUpdate:modelValue': (value: CopilotReviewEffort) => {
            effort.value = value;
          },
        }),
    })
  ).root;
  const trigger = root.querySelector<HTMLButtonElement>('[role="combobox"]')!;
  expect(trigger.textContent).toContain('Balanced');
  trigger.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await nextTick();
  const options = [...dom.document.querySelectorAll('[role="option"]')];
  expect(dom.document.querySelector<HTMLElement>('.filter-dropdown-panel')?.style.width).toBe(
    'max-content'
  );
  expect(options.map((option) => option.textContent?.trim())).toEqual([
    'GitHub default',
    'Lite',
    'Balanced',
    'Max',
  ]);
  options
    .find((option) => option.textContent?.trim() === 'Max')
    ?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await nextTick();
  expect(effort.value).toBe('max');
});

test('the effort editor can be read-only and omit unavailable effort levels', async () => {
  dom = createVueDom();
  const root = dom.mount(
    defineComponent({
      setup: () => () =>
        h(Picker, {
          modelValue: 'balanced',
          disabled: true,
          efforts: ['lite', 'balanced'],
        }),
    })
  ).root;
  expect(root.querySelector<HTMLButtonElement>('[role="combobox"]')?.disabled).toBe(true);
  root
    .querySelector('[role="combobox"]')
    ?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await nextTick();
  expect(dom.document.querySelector('[role="listbox"]')).toBeNull();
  expect(root.textContent).not.toContain('Max');
});

test('the menu fits a clipped label and uses the trigger font across its portal', async () => {
  dom = createVueDom();
  Object.defineProperty(dom.document.documentElement, 'clientWidth', { value: 360 });
  Object.defineProperty(dom.document.documentElement, 'clientHeight', { value: 800 });
  const root = dom.mount(
    defineComponent({ setup: () => () => h(Picker, { modelValue: 'balanced' }) })
  ).root;
  const trigger = root.querySelector<HTMLButtonElement>('[role="combobox"]')!;
  trigger.style.fontSize = '11px';
  root.querySelector<HTMLElement>('.filter-dropdown')!.getBoundingClientRect = () =>
    new dom!.window.DOMRect(300, 100, 60, 20) as unknown as DOMRect;
  trigger.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await nextTick();
  const panel = dom.document.querySelector<HTMLElement>('.filter-dropdown-panel')!;
  panel.getBoundingClientRect = () =>
    new dom!.window.DOMRect(300, 124, 80, 180) as unknown as DOMRect;
  const label = panel.querySelector<HTMLElement>('.filter-dropdown-option-label')!;
  Object.defineProperty(label, 'scrollWidth', { value: 140 });
  Object.defineProperty(label, 'clientWidth', { value: 24 });
  dom.window.dispatchEvent(new dom.window.Event('resize'));
  await new Promise((resolve) => dom!.window.requestAnimationFrame(resolve));
  await nextTick();
  expect(panel.style.width).toBe('196px');
  expect(panel.style.left).toBe('156px');
  expect(panel.style.fontSize).toBe('11px');
});

test('the request modal displays the chosen effort without an editor', () => {
  dom = createVueDom();
  const root = dom.mount(
    defineComponent({
      setup: () => () =>
        h(RequestModal, {
          isVisible: true,
          candidates: [
            {
              key: 'user:copilot',
              kind: 'user',
              name: 'Copilot',
              login: 'Copilot',
              requested: false,
            },
          ],
          warnings: [],
          loading: false,
          submitting: false,
          error: '',
          copilotReviewEffort: 'max',
        }),
    })
  ).root;
  expect(root.textContent).toContain('Copilot Max');
  expect(root.querySelector('select')).toBeNull();
});

test('an ordinary timeline request includes from before the reviewer', () => {
  dom = createVueDom();
  const root = dom.mount(
    defineComponent({
      setup: () => () =>
        h(StateEvent, {
          item: {
            kind: 'event',
            eventType: 'review_requested',
            requestedReviewer: { login: 'reviewer', url: 'https://github.com/reviewer' },
          },
        }),
    })
  ).root;
  expect(root.textContent?.replace(/\s+/g, ' ').trim()).toBe('requested review from reviewer');
});

test('a Copilot work event distinguishes the service from its human requester', () => {
  dom = createVueDom();
  const root = dom.mount(
    defineComponent({
      setup: () => () =>
        h(StateEvent, {
          item: {
            kind: 'event',
            eventType: 'copilot_work_started',
            copilotWorkType: 'review',
            actor: { login: 'viadanna', url: 'https://github.com/viadanna' },
          },
        }),
    })
  ).root;
  expect(root.textContent?.replace(/\s+/g, ' ').trim()).toBe(
    'Copilot AI started reviewing on behalf of viadanna'
  );
});
