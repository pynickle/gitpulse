export interface RepoPermissions {
  admin: boolean;
  maintain: boolean;
  push: boolean;
  triage: boolean;
  pull: boolean;
  canEditLabels: boolean;
  canLockIssue: boolean;
  canEditAssignees: boolean;
}

type RepoPermissionsSource = Partial<Record<keyof RepoPermissions, unknown>> | null | undefined;

export function normalizeRepoPermissions(source: RepoPermissionsSource): RepoPermissions {
  const admin = Boolean(source?.admin);
  const maintain = Boolean(source?.maintain);
  const push = Boolean(source?.push);
  const triage = Boolean(source?.triage);

  return {
    admin,
    maintain,
    push,
    triage,
    pull: Boolean(source?.pull),
    canEditLabels: Boolean(source?.canEditLabels),
    canLockIssue: Boolean(source?.canLockIssue),
    canEditAssignees: Boolean(source?.canEditAssignees || admin || maintain || push),
  };
}

export default function createEmptyRepoPermissions(): RepoPermissions {
  return normalizeRepoPermissions(null);
}
