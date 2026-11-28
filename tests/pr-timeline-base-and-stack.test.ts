import { afterEach, expect, test } from 'bun:test';

import { defineComponent, h, shallowRef } from 'vue';

import { compileVue } from './helpers/compile-vue';
import { githubProfileLinkModules } from './helpers/github-profile-link';
import { createVueDom } from './helpers/vue-dom';

const icon = defineComponent({ render: () => h('svg') });

const useI18n = () => ({
  t: (key: string) => key,
  locale: shallowRef('en'),
});

const StateEvents = await compileVue(
  'app/components/dashboard/pr/PRTimelineStateEvents.vue',
  {
    ...githubProfileLinkModules,
    '@lucide/vue': new Proxy({}, { get: () => icon }),
    'vue-i18n': { useI18n },
    '~/composables/usePRTimelineEvents': {
      describeRequestedReviewer: () => ({ login: '' }),
    },
    '~/utils/getTextColorFromBackground': await import('../app/utils/getTextColorFromBackground'),
  },
  { useI18n: 'vue-i18n' }
);

const EventBody = await compileVue(
  'app/components/dashboard/pr/PRTimelineEventBody.vue',
  {
    ...githubProfileLinkModules,
    'vue-i18n': { useI18n },
    '~/components/dashboard/pr/PRTimelineStateEvents.vue': { default: StateEvents },
    '~/utils/formatDurationFromNow': { formatDurationFromNow: () => '' },
    'virtual:relative-time': { useRelativeTimeNow: () => shallowRef('2026-11-28T00:00:00.000Z') },
  },
  { useRelativeTimeNow: 'virtual:relative-time' }
);

let dom: ReturnType<typeof createVueDom> | undefined;
afterEach(async () => {
  await dom?.cleanup();
  dom = undefined;
});

function mountState(item: Record<string, unknown>, onOpenStack?: (stackNumber: number) => void) {
  dom = createVueDom({ useI18n });
  const Harness = defineComponent({
    setup: () => () => h(StateEvents, { item, onOpenStack }),
  });
  return dom.mount(Harness).root;
}

function mountBody(item: Record<string, unknown>) {
  dom = createVueDom({ useI18n });
  const Harness = defineComponent({
    setup: () => () => h(EventBody, { item, repoOwner: 'PCL-Community', repoName: 'PCL-CE' }),
  });
  return dom.mount(Harness).root;
}

test('an automatic base change names both branches and no person', () => {
  const root = mountState({
    kind: 'event',
    eventType: 'automatic_base_change_succeeded',
    actor: { login: 'Chiloven945' },
    oldBase: 'feat/video-background',
    newBase: 'dev',
  });

  expect(root.textContent?.replace(/\s+/g, ' ').trim()).toBe(
    'Base automatically changed from feat/video-background to dev'
  );
});

test('an automatic base change without branches omits the from/to clause', () => {
  const root = mountState({
    kind: 'event',
    eventType: 'automatic_base_change_succeeded',
    actor: { login: 'Chiloven945' },
  });

  expect(root.textContent?.trim()).toBe('Base automatically changed');
});

test('a failed automatic base change names both branches', () => {
  const root = mountState({
    kind: 'event',
    eventType: 'automatic_base_change_failed',
    oldBase: 'feat/old',
    newBase: 'dev',
  });

  expect(root.textContent?.replace(/\s+/g, ' ').trim()).toBe(
    'Automatic base change from feat/old to dev failed'
  );
});

test('a failed automatic base change without branches is only the failure', () => {
  const root = mountState({
    kind: 'event',
    eventType: 'automatic_base_change_failed',
  });

  expect(root.textContent?.trim()).toBe('Automatic base change failed');
});

test('the automatic base change row does not prefix the actor login', () => {
  const root = mountBody({
    kind: 'event',
    eventType: 'automatic_base_change_succeeded',
    actor: { login: 'Chiloven945', url: 'https://github.com/Chiloven945' },
    oldBase: 'feat/video-background',
    newBase: 'dev',
    createdAt: '2026-11-26T12:44:29Z',
  });

  expect(root.textContent).not.toContain('Chiloven945');
  expect(root.textContent).toContain('Base automatically changed');
});

test('adding a pull request to a stack names the person and opens that stack number', () => {
  const opened: number[] = [];
  const root = mountState(
    {
      kind: 'event',
      eventType: 'added_to_stack',
      actor: { login: 'Chiloven945' },
      stackNumber: 3855,
    },
    (stackNumber) => opened.push(stackNumber)
  );

  expect(root.textContent?.replace(/\s+/g, ' ').trim()).toBe(
    'added this pull request to stack #3855'
  );
  const button = root.querySelector('button');
  expect(button?.getAttribute('aria-haspopup')).toBe('dialog');
  button?.dispatchEvent(new dom!.window.Event('click', { bubbles: true }));
  expect(opened).toEqual([3855]);
});

test('removing a pull request from a stack uses the same stack control', () => {
  const root = mountState({
    kind: 'event',
    eventType: 'removed_from_stack',
    stackNumber: 3855,
  });

  expect(root.textContent?.replace(/\s+/g, ' ').trim()).toBe(
    'removed this pull request from stack #3855'
  );
});

test('a stack membership change without a number has nothing to open', () => {
  const root = mountState({
    kind: 'event',
    eventType: 'added_to_stack',
  });

  expect(root.textContent?.replace(/\s+/g, ' ').trim()).toBe('added this pull request to a stack');
  expect(root.querySelector('button')).toBeNull();
});

test('a stack membership row still prefixes the actor login', () => {
  const root = mountBody({
    kind: 'event',
    eventType: 'added_to_stack',
    actor: { login: 'Chiloven945', url: 'https://github.com/Chiloven945' },
    stackNumber: 3855,
    createdAt: '2026-11-21T13:10:13Z',
  });

  expect(root.textContent).toContain('Chiloven945');
  expect(root.textContent).toContain('stack #3855');
});
