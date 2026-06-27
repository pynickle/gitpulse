import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import createEmptyRepoPermissions, {
  normalizeRepoPermissions,
} from '../app/utils/createEmptyRepoPermissions';

describe('detail assignee integration', () => {
  test('normalizes assignee editing permission from repository permissions', () => {
    expect(createEmptyRepoPermissions().canEditAssignees).toBe(false);
    expect(normalizeRepoPermissions({ triage: true }).canEditAssignees).toBe(false);
    expect(normalizeRepoPermissions({ push: true }).canEditAssignees).toBe(true);
    expect(normalizeRepoPermissions({ canEditAssignees: true }).canEditAssignees).toBe(true);
  });

  test('renders the shared assignee sidebar on issue and pull request detail panes', () => {
    const issueDetail = readFileSync('app/components/dashboard/detail/IssueDetail.vue', 'utf8');
    const pullRequestDetail = readFileSync('app/components/dashboard/detail/PRDetail.vue', 'utf8');
    const issueActions = readFileSync('app/components/dashboard/issue/IssueActions.vue', 'utf8');
    const pullRequestActions = readFileSync('app/components/dashboard/pr/PRActions.vue', 'utf8');

    expect(issueDetail).toContain('<DetailAssignees');
    expect(issueDetail).toContain(':can-edit-assignees="canEditAssignees"');
    expect(pullRequestDetail).toContain('<DetailAssignees');
    expect(pullRequestDetail).toContain(':can-edit-assignees="canEditAssignees"');
    expect(issueActions).not.toContain('issueDetail.assignee');
    expect(pullRequestActions).not.toContain('prReview.assignee');
  });

  test('uses the shared people picker modal for reviewer and assignee selection', () => {
    const assignees = readFileSync('app/components/dashboard/detail/DetailAssignees.vue', 'utf8');
    const reviewerModal = readFileSync(
      'app/components/dashboard/pr/PRReviewerRequestModal.vue',
      'utf8'
    );
    const peoplePickerModal = readFileSync(
      'app/components/dashboard/detail/DetailPeoplePickerModal.vue',
      'utf8'
    );
    const pickerTypes = readFileSync('app/types/detail-people-picker.ts', 'utf8');
    const reviewerModalStyles = readFileSync('app/assets/scss/reviewer-modal.scss', 'utf8');

    expect(assignees).toContain('<DetailPeoplePickerModal');
    expect(reviewerModal).toContain('<DetailPeoplePickerModal');
    expect(assignees).not.toContain('<Teleport to="body">');
    expect(reviewerModal).not.toContain('<Teleport to="body">');
    expect(peoplePickerModal).toContain('<Teleport to="body">');
    expect(peoplePickerModal).toContain("@use '~/assets/scss/reviewer-modal'");
    expect(peoplePickerModal).toContain('reviewer-modal-candidate--selected');
    expect(pickerTypes).toContain('export interface DetailPeoplePickerCandidate');
    expect(assignees).not.toContain('assignee-modal');
    expect(reviewerModalStyles).toContain('.reviewer-modal-candidate--selected &');
    expect(reviewerModalStyles).toContain('color: var(--bulma-primary-invert, #fff)');
    expect(reviewerModalStyles).toContain('animation: spin 1s linear infinite');
  });

  test('keeps detail pane loaders out of the component directory', () => {
    const dashboard = readFileSync('app/pages/dashboard.vue', 'utf8');
    const detailOverlayHost = readFileSync(
      'app/components/dashboard/detail/DetailOverlayHost.vue',
      'utf8'
    );
    const paneLoaders = readFileSync('app/utils/createDashboardDetailPaneLoaders.ts', 'utf8');

    expect(dashboard).toContain('createDashboardDetailPaneLoaders');
    expect(detailOverlayHost).toContain('createDashboardDetailPaneLoaders');
    expect(dashboard).not.toContain('components/dashboard/detail/detail-pane-loaders');
    expect(detailOverlayHost).not.toContain('./detail-pane-loaders');
    expect(paneLoaders).toContain('export default function createDashboardDetailPaneLoaders');
  });
});
