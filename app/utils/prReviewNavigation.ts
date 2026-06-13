import type { NavigationEntry } from '~/composables/useNavigationHistory';

interface PRReviewNavigationTarget {
  readonly previousEntry: NavigationEntry | null | undefined;
  readonly owner: string;
  readonly repo: string;
  readonly pullNumber: number;
}

export default function shouldCloseReviewWorkspaceAfterSubmit({
  previousEntry,
  owner,
  repo,
  pullNumber,
}: PRReviewNavigationTarget) {
  const data = previousEntry?.data;

  return (
    previousEntry?.type === 'pull-request' &&
    data?.owner === owner &&
    data.repo === repo &&
    data.number === pullNumber
  );
}
