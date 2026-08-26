import { computed, shallowRef } from 'vue';

import type {
  LinkedPullRequestCountClickPayload,
  LinkedPullRequestIdentity,
} from '#shared/types/linked-pull-requests';
import { toLinkedPullRequestClickIntent } from '#shared/utils/linked-pull-requests';

export function useLinkedPullRequestListNavigation(
  openPullRequest: (identity: LinkedPullRequestIdentity) => void | Promise<void>
) {
  const pickerIssue = shallowRef<LinkedPullRequestIdentity | null>(null);
  const isPickerVisible = computed(() => pickerIssue.value !== null);

  const handleLinkedPullRequestCountClick = (payload: LinkedPullRequestCountClickPayload) => {
    const intent = toLinkedPullRequestClickIntent(payload.summary);
    if (intent.kind === 'open') {
      void openPullRequest(intent.identity);
      return;
    }

    if (intent.kind === 'pick' && payload.issue) {
      pickerIssue.value = payload.issue;
    }
  };

  const closePicker = () => {
    pickerIssue.value = null;
  };

  const selectFromPicker = (identity: LinkedPullRequestIdentity) => {
    closePicker();
    void openPullRequest(identity);
  };

  return {
    pickerIssue,
    isPickerVisible,
    handleLinkedPullRequestCountClick,
    closePicker,
    selectFromPicker,
  };
}
