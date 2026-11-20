import { onMounted, shallowRef } from 'vue';

import type { SubIssueConnection, SubIssueIdentity } from '#shared/types/sub-issues';

export function useSubIssues({ owner, repo, number }: SubIssueIdentity) {
  const apiFetch = useGitPulseApiFetch();
  const connection = shallowRef<SubIssueConnection | null>(null);
  const loading = shallowRef(false);
  const failed = shallowRef(false);
  const load = async () => {
    if (loading.value) return;

    loading.value = true;
    failed.value = false;
    try {
      connection.value = await apiFetch<SubIssueConnection>(
        `/api/issues/${owner}/${repo}/${number}/sub-issues`
      );
    } catch {
      failed.value = true;
    } finally {
      loading.value = false;
    }
  };

  onMounted(load);

  return { connection, loading, failed, load };
}
