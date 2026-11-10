import { describe, expect, mock, test } from 'bun:test';

import { shallowRef } from 'vue';

import type { LinkedPullRequestCountClickPayload } from '#shared/types/linked-pull-requests';
import type { UserNavigationSettings } from '#shared/types/user-settings';

import * as linkedPullRequests from '../shared/utils/linked-pull-requests';

mock.module('#shared/utils/linked-pull-requests', () => linkedPullRequests);

const settings = shallowRef({
  navigation: {
    linkTarget: 'gitpulse',
    previewSingleLinkedPullRequest: true,
  } satisfies UserNavigationSettings,
});

Object.assign(globalThis, {
  useUserSettings: () => ({ settings }),
});

const { useLinkedPullRequestListNavigation } =
  await import('../app/composables/useLinkedPullRequestListNavigation');

const issue = { owner: 'acme', repo: 'widgets', number: 4 };
const pullRequest = { owner: 'acme', repo: 'widgets', number: 12 };

const click = (preview: boolean, payload: LinkedPullRequestCountClickPayload) => {
  settings.value = {
    navigation: { linkTarget: 'gitpulse', previewSingleLinkedPullRequest: preview },
  };
  const opened: Array<typeof pullRequest> = [];
  const list = useLinkedPullRequestListNavigation((identity) => {
    opened.push(identity);
  });
  list.handleLinkedPullRequestCountClick(payload);
  return { opened, picker: list.pickerIssue.value };
};

describe('linked pull request list navigation', () => {
  test('opens the picker for one complete pull request when preview is on', () => {
    const result = click(true, { summary: { count: 1, identity: pullRequest }, issue });

    expect(result.opened).toEqual([]);
    expect(result.picker).toEqual(issue);
  });

  test('does not open the pull request when preview is on and the issue is missing', () => {
    const result = click(true, { summary: { count: 1, identity: pullRequest }, issue: null });

    expect(result.opened).toEqual([]);
    expect(result.picker).toBeNull();
  });

  test('opens the pull request directly when preview is off', () => {
    const result = click(false, { summary: { count: 1, identity: pullRequest }, issue });

    expect(result.opened).toEqual([pullRequest]);
    expect(result.picker).toBeNull();
  });
});
