export interface RepoPermissions {
  admin: boolean;
  maintain: boolean;
  push: boolean;
  triage: boolean;
  pull: boolean;
  canEditLabels: boolean;
  canLockIssue: boolean;
}

export default function createEmptyRepoPermissions(): RepoPermissions {
  return {
    admin: false,
    maintain: false,
    push: false,
    triage: false,
    pull: false,
    canEditLabels: false,
    canLockIssue: false,
  };
}
