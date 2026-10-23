import { describe, expect, test } from 'bun:test';

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

  test('normalizes the explicit issue type editing capability', () => {
    expect(createEmptyRepoPermissions().canEditIssueType).toBe(false);
    expect(normalizeRepoPermissions({ triage: true }).canEditIssueType).toBe(false);
    expect(normalizeRepoPermissions({ canEditIssueType: true }).canEditIssueType).toBe(true);
    expect(normalizeRepoPermissions({ canEditIssueType: false }).canEditIssueType).toBe(false);
  });
});
