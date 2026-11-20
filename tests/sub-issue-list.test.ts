import { expect, test } from 'bun:test';

import * as icons from '@lucide/vue';
import { defineComponent, h, nextTick } from 'vue';

import { useSubIssuePickerNavigation } from '../app/composables/useSubIssuePickerNavigation';
import { useSubIssues } from '../app/composables/useSubIssues';
import type { SubIssueIdentity, SubIssueNode } from '../shared/types/sub-issues';
import * as subIssues from '../shared/utils/sub-issues';
import { compileVue } from './helpers/compile-vue';
import { createVueDom } from './helpers/vue-dom';

const Rows = await compileVue('app/components/dashboard/issue/SubIssueRows.vue', {
  '@lucide/vue': icons,
});
const modules = {
  '@lucide/vue': icons,
  '#shared/utils/sub-issues': subIssues,
  './SubIssueRows.vue': { default: Rows },
};
const List = await compileVue('app/components/dashboard/issue/SubIssueList.vue', modules);
const PickerModal = await compileVue('app/components/dashboard/PickerModal.vue', {
  '@lucide/vue': icons,
  '~/components/ui/ScrollArea.vue': {
    default: defineComponent({
      setup:
        (_, { slots }) =>
        () =>
          h('div', slots.default?.()),
    }),
  },
});
const Picker = await compileVue('app/components/dashboard/issue/SubIssuePickerModal.vue', {
  ...modules,
  '~/components/dashboard/PickerModal.vue': { default: PickerModal },
});

const issue = { owner: 'acme', repo: 'widgets', number: 1 };
const nodes: SubIssueNode[] = Array.from({ length: 7 }, (_, index) => ({
  owner: 'acme',
  repo: index === 6 ? 'docs' : 'widgets',
  number: 10 - index,
  title: `Task ${index + 1}`,
  state: index === 0 ? 'completed' : 'open',
  subIssuesSummary: null,
}));

function createHarness() {
  const requests: string[] = [];
  const selections: SubIssueIdentity[] = [];
  const dom = createVueDom({
    useI18n: () => ({ t: (key: string) => key.split('.').at(-1) }),
    useSubIssues,
    useGitPulseApiFetch: () => async (url: string) => {
      requests.push(url);
      return { nodes, totalCount: nodes.length, completedCount: 1 };
    },
  });

  return { dom, requests, selections };
}

const rowButtons = (root: Element) => [...root.querySelectorAll<HTMLButtonElement>('li button')];

function click(root: Element, label: string) {
  [...root.querySelectorAll('button')]
    .find((button) => button.textContent?.trim() === label)
    ?.click();
}

async function flush() {
  await Promise.resolve();
  await nextTick();
}

test('Issue Detail loads and toggles the full list as a group', async () => {
  const { dom, requests, selections } = createHarness();
  const { root } = dom.mount(
    defineComponent({
      setup: () => () =>
        h(List, {
          issue,
          progress: { total: 7, completed: 1 },
          onSelect: (identity: SubIssueIdentity) => selections.push(identity),
        }),
    })
  );

  try {
    await flush();
    const details = root.querySelector('details')!;
    expect(details.open).toBe(true);
    const summary = details.querySelector('summary')!;
    expect(summary.textContent).toContain('1/7');
    expect(details.querySelector('progress')).toBeNull();
    summary.click();
    expect(details.open).toBe(false);
    summary.click();
    expect(details.open).toBe(true);
    expect(requests).toEqual(['/api/issues/acme/widgets/1/sub-issues']);
    expect(
      rowButtons(root).map((button) => button.textContent?.trim().match(/Task \d+$/)?.[0])
    ).toEqual(nodes.map((node) => node.title));
    expect(rowButtons(root).at(-1)?.textContent).toContain('acme/docs#4');
    rowButtons(root).at(-1)?.click();
    expect(selections).toEqual([{ owner: 'acme', repo: 'docs', number: 4 }]);
  } finally {
    await dom.cleanup();
  }
});

test('the Picker fetches on demand and closes after opening the selected Issue', async () => {
  const { dom, requests, selections } = createHarness();
  const { root } = dom.mount(
    defineComponent({
      setup() {
        const { pickerIssue, openPicker, closePicker, selectFromPicker } =
          useSubIssuePickerNavigation((identity) => selections.push(identity));
        return () =>
          h('div', [
            h('button', { onClick: () => openPicker(issue) }, '0/1'),
            pickerIssue.value &&
              h(Picker, {
                issue: pickerIssue.value,
                onClose: closePicker,
                onSelect: selectFromPicker,
              }),
          ]);
      },
    })
  );

  try {
    expect(requests).toEqual([]);
    click(root, '0/1');
    await flush();
    const dialog = dom.document.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(requests).toEqual(['/api/issues/acme/widgets/1/sub-issues']);
    expect(rowButtons(dialog)).toHaveLength(7);
    rowButtons(dialog).at(-1)?.click();
    await flush();
    expect(dom.document.querySelector('[role="dialog"]')).toBeNull();
    expect(selections).toEqual([{ owner: 'acme', repo: 'docs', number: 4 }]);
  } finally {
    await dom.cleanup();
  }
});
