import { afterEach, describe, expect, test } from 'bun:test';

import { defineComponent, h, nextTick, ref, type Component } from 'vue';

import {
  createEmptyRepoPermissions,
  normalizeRepoPermissions,
} from '../app/utils/createEmptyRepoPermissions';
import { getFetchErrorMessage } from '../app/utils/getFetchErrorMessage';
import { compileVue } from './helpers/compile-vue';
import { createVueDom } from './helpers/vue-dom';

const icon = defineComponent({ render: () => h('svg') });
const emptyStub = defineComponent({ setup: () => () => null });

interface AssigneeItem {
  login: string;
  avatar_url?: string | null;
}

const sessionUser = ref<{ login: string; avatar_url?: string } | null>({ login: 'octocat' });
const isAnyModalOpen = ref(false);
const addAssigneesCalls: Array<{
  owner: string;
  repo: string;
  issueNumber: number;
  assignees: string[];
}> = [];
let addAssigneesImpl: (
  owner: string,
  repo: string,
  issueNumber: number,
  payload: { assignees: string[] }
) => Promise<{ assignees: AssigneeItem[] }> = async (_owner, _repo, _issueNumber, payload) => ({
  assignees: payload.assignees.map((login) => ({ login })),
});

const DetailAssignees = await compileVue(
  'app/components/dashboard/detail/DetailAssignees.vue',
  {
    '@lucide/vue': new Proxy({}, { get: () => icon }),
    'vue-i18n': { useI18n: () => ({ t: (key: string) => key }) },
    '~/components/dashboard/detail/DetailPeoplePickerModal.vue': { default: emptyStub },
    '~/components/ui/GitHubAvatar.vue': { default: emptyStub },
    '~/utils/getFetchErrorMessage': { getFetchErrorMessage },
    'virtual:auto-imports': {
      useModalState: () => ({
        isAnyModalOpen,
        openModal: () => {
          isAnyModalOpen.value = true;
        },
        closeModal: () => {
          isAnyModalOpen.value = false;
        },
      }),
      useIssueAssignees: () => ({
        fetchAssigneeCandidates: async () => ({ items: [], assignees: [] }),
        addAssignees: async (
          owner: string,
          repo: string,
          issueNumber: number,
          payload: { assignees: string[] }
        ) => {
          addAssigneesCalls.push({ owner, repo, issueNumber, assignees: payload.assignees });
          return addAssigneesImpl(owner, repo, issueNumber, payload);
        },
        removeAssignees: async () => ({ assignees: [] }),
      }),
      useUserSession: () => ({ user: sessionUser }),
    },
  },
  {
    useModalState: 'virtual:auto-imports',
    useIssueAssignees: 'virtual:auto-imports',
    useUserSession: 'virtual:auto-imports',
  }
);

let dom: ReturnType<typeof createVueDom> | undefined;

afterEach(async () => {
  addAssigneesCalls.length = 0;
  sessionUser.value = { login: 'octocat' };
  isAnyModalOpen.value = false;
  addAssigneesImpl = async (_owner, _repo, _issueNumber, payload) => ({
    assignees: payload.assignees.map((login) => ({ login })),
  });
  await dom?.cleanup();
  dom = undefined;
});

const settle = async () => {
  await nextTick();
  await Promise.resolve();
  await nextTick();
};

const mountAssignees = (options?: {
  assignees?: AssigneeItem[];
  canEditAssignees?: boolean;
  onUpdate?: (assignees: AssigneeItem[]) => void;
}) => {
  dom = createVueDom();
  const assignees = ref<AssigneeItem[]>(options?.assignees ?? []);
  const canEditAssignees = ref(options?.canEditAssignees ?? true);

  const mounted = dom.mount(
    defineComponent({
      setup: () => () =>
        h(DetailAssignees as Component, {
          assignees: assignees.value,
          canEditAssignees: canEditAssignees.value,
          repoInfo: { owner: 'acme', repo: 'widgets' },
          issueNumber: 42,
          'onUpdate:assignees': (next: AssigneeItem[]) => {
            assignees.value = next;
            options?.onUpdate?.(next);
          },
        }),
    })
  );

  return { root: mounted.root, assignees, canEditAssignees };
};

const findButtonByText = (root: HTMLElement, text: string) =>
  Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
    (button) => button.textContent?.trim() === text
  ) ?? null;

describe('detail assignee integration', () => {
  test('normalizes assignee editing permission from repository permissions', () => {
    expect(createEmptyRepoPermissions().canEditAssignees).toBe(false);
    expect(normalizeRepoPermissions({ pull: true }).canEditAssignees).toBe(false);
    expect(normalizeRepoPermissions({ triage: true }).canEditAssignees).toBe(true);
    expect(normalizeRepoPermissions({ push: true }).canEditAssignees).toBe(true);
    expect(normalizeRepoPermissions({ maintain: true }).canEditAssignees).toBe(true);
    expect(normalizeRepoPermissions({ admin: true }).canEditAssignees).toBe(true);
    expect(normalizeRepoPermissions({ canEditAssignees: true }).canEditAssignees).toBe(true);
  });

  test('normalizes the explicit issue type editing capability', () => {
    expect(createEmptyRepoPermissions().canEditIssueType).toBe(false);
    expect(normalizeRepoPermissions({ triage: true }).canEditIssueType).toBe(false);
    expect(normalizeRepoPermissions({ canEditIssueType: true }).canEditIssueType).toBe(true);
    expect(normalizeRepoPermissions({ canEditIssueType: false }).canEditIssueType).toBe(false);
  });

  test('shows Assign yourself when empty or assigned to others, and hides when already assigned or read-only', async () => {
    const { root, assignees, canEditAssignees } = mountAssignees({ assignees: [] });
    await settle();
    expect(findButtonByText(root, 'detailAssignees.assignYourself')).not.toBeNull();

    assignees.value = [{ login: 'alice' }];
    await settle();
    expect(findButtonByText(root, 'detailAssignees.assignYourself')).not.toBeNull();

    assignees.value = [{ login: 'alice' }, { login: 'OctoCat' }];
    await settle();
    expect(findButtonByText(root, 'detailAssignees.assignYourself')).toBeNull();

    assignees.value = [{ login: 'alice' }];
    canEditAssignees.value = false;
    await settle();
    expect(findButtonByText(root, 'detailAssignees.assignYourself')).toBeNull();
  });

  test('requires inline two-step confirmation and dismisses on Cancel, Escape, and outside press', async () => {
    const { root } = mountAssignees({ assignees: [{ login: 'alice' }] });
    await settle();

    // Cancel button dismissal
    findButtonByText(root, 'detailAssignees.assignYourself')!.click();
    await settle();
    expect(addAssigneesCalls).toHaveLength(0);
    expect(findButtonByText(root, 'detailAssignees.confirmAssignYourself')).not.toBeNull();
    findButtonByText(root, 'detailAssignees.cancel')!.click();
    await settle();
    expect(findButtonByText(root, 'detailAssignees.assignYourself')).not.toBeNull();
    expect(addAssigneesCalls).toHaveLength(0);

    // Escape dismissal
    findButtonByText(root, 'detailAssignees.assignYourself')!.click();
    await settle();
    const escapeEvent = new dom!.window.KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    dom!.document.dispatchEvent(escapeEvent as unknown as KeyboardEvent);
    await settle();
    expect(escapeEvent.defaultPrevented).toBe(true);
    expect(findButtonByText(root, 'detailAssignees.assignYourself')).not.toBeNull();
    expect(addAssigneesCalls).toHaveLength(0);

    // Outside pointerdown dismissal
    findButtonByText(root, 'detailAssignees.assignYourself')!.click();
    await settle();
    const outside = dom!.document.createElement('div');
    dom!.document.body.append(outside);
    outside.dispatchEvent(new dom!.window.Event('pointerdown', { bubbles: true }));
    await settle();
    expect(findButtonByText(root, 'detailAssignees.assignYourself')).not.toBeNull();
    expect(addAssigneesCalls).toHaveLength(0);

    // Opening any modal resets inline confirmation and lets Escape pass through
    findButtonByText(root, 'detailAssignees.assignYourself')!.click();
    await settle();
    expect(findButtonByText(root, 'detailAssignees.confirmAssignYourself')).not.toBeNull();
    isAnyModalOpen.value = true;
    await settle();
    expect(findButtonByText(root, 'detailAssignees.assignYourself')).not.toBeNull();
    const modalEscapeEvent = new dom!.window.KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    dom!.document.dispatchEvent(modalEscapeEvent as unknown as KeyboardEvent);
    expect(modalEscapeEvent.defaultPrevented).toBe(false);
  });

  test('submits self-assignment after inline confirmation and emits updated assignees', async () => {
    const emitted: AssigneeItem[][] = [];
    addAssigneesImpl = async () => ({
      assignees: [{ login: 'alice' }, { login: 'octocat' }],
    });

    const { root } = mountAssignees({
      assignees: [{ login: 'alice' }],
      onUpdate: (next) => emitted.push(next),
    });
    await settle();

    findButtonByText(root, 'detailAssignees.assignYourself')!.click();
    await settle();
    findButtonByText(root, 'detailAssignees.confirmAssignYourself')!.click();
    await settle();

    expect(addAssigneesCalls).toEqual([
      { owner: 'acme', repo: 'widgets', issueNumber: 42, assignees: ['octocat'] },
    ]);
    expect(emitted).toEqual([[{ login: 'alice' }, { login: 'octocat' }]]);
    expect(findButtonByText(root, 'detailAssignees.assignYourself')).toBeNull();
  });
});
