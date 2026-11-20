import { shallowRef } from 'vue';

import type { SubIssueIdentity } from '#shared/types/sub-issues';

export function useSubIssuePickerNavigation(openIssue: (identity: SubIssueIdentity) => void) {
  const pickerIssue = shallowRef<SubIssueIdentity | null>(null);
  const openPicker = (issue: SubIssueIdentity) => {
    pickerIssue.value = issue;
  };
  const closePicker = () => {
    pickerIssue.value = null;
  };
  const selectFromPicker = (identity: SubIssueIdentity) => {
    closePicker();
    openIssue(identity);
  };

  return { pickerIssue, openPicker, closePicker, selectFromPicker };
}
