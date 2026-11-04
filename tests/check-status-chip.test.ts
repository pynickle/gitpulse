import { afterEach, describe, expect, test } from 'bun:test';

import { defineComponent, h } from 'vue';

import * as prChecks from '../shared/utils/pr-checks';
import { compileVue } from './helpers/compile-vue';
import { createVueDom } from './helpers/vue-dom';

const icon = defineComponent({ render: () => h('svg') });

const CheckStatusChip = await compileVue(
  'app/components/dashboard/pr/CheckStatusChip.vue',
  {
    '#shared/utils/pr-checks': prChecks,
    '~/utils/getCheckStatusToneIcon': { getCheckStatusToneIcon: () => icon },
  },
  { getCheckStatusToneIcon: '~/utils/getCheckStatusToneIcon' }
);

const messages: Record<string, string> = {
  'dashboard.checks.chipPassed': '{passed} of {total} checks passed',
  'dashboard.checks.chipFailed': '{failed} of {total} checks failed',
  'dashboard.checks.overLimit': 'More than {limit} checks, {total} total',
};

const t = (key: string, params?: Record<string, unknown>) =>
  (messages[key] ?? key).replace(/\{(\w+)\}/g, (_, name: string) => {
    const param = params?.[name];
    if (typeof param === 'string') return param;
    if (typeof param === 'number' || typeof param === 'boolean') return String(param);
    return '';
  });

/** Three completed contexts, all green: the chip reads "3/3". */
const passingRollup = {
  state: 'SUCCESS',
  contexts: {
    totalCount: 3,
    nodes: [
      { name: 'build', conclusion: 'SUCCESS' },
      { name: 'test', conclusion: 'SUCCESS' },
      { name: 'lint', conclusion: 'SUCCESS' },
    ],
  },
};

/** A rollup cut off at the fetch limit: no fraction, only the reported total. */
const truncatedRollup = {
  state: 'SUCCESS',
  contexts: { totalCount: 130, nodes: [{ name: 'build', conclusion: 'SUCCESS' }] },
};

let dom: ReturnType<typeof createVueDom>;

// Each test builds its own dom so the globals match the fixture it mounts.
function mountChip(rollup: unknown) {
  dom = createVueDom({ useI18n: () => ({ t }), getCheckStatusToneIcon: () => icon });
  const Harness = defineComponent({
    setup: () => () => h(CheckStatusChip as never, { rollup }),
  });
  return dom.mount(Harness).root;
}

afterEach(async () => {
  await dom.cleanup();
});

describe('CheckStatusChip', () => {
  test('speaks the fraction it shows, so voice control can name the button', () => {
    const chip = mountChip(passingRollup).querySelector('.check-status-chip');

    const visible = chip?.textContent?.trim() ?? '';
    expect(visible).toBe('3/3');
    expect(chip?.getAttribute('aria-label')).toContain(visible);
  });

  test('keeps the reported total in the name when the fraction is withheld', () => {
    const chip = mountChip(truncatedRollup).querySelector('.check-status-chip');

    const visible = chip?.textContent?.trim() ?? '';
    expect(visible).toBe('130');
    expect(chip?.getAttribute('aria-label')).toContain(visible);
  });

  test('renders nothing for a pull request with no checks', () => {
    const root = mountChip({ state: null, contexts: { totalCount: 0, nodes: [] } });

    expect(root.querySelector('.check-status-chip')).toBeNull();
  });
});
