import { ref } from 'vue';

export function useGithubData() {
  const loading = ref(false);
  const error = ref<string | null>(null);
  const notifications = ref<any[]>([]);
  const issues = ref<any[]>([]);
  const pulls = ref<any[]>([]);
  const repos = ref<any[]>([]);
  const stats = ref({
    issues: 0,
    prs: 0,
    repos: 0,
  });

  const fetchNotifications = async () => {
    loading.value = true;
    error.value = null;

    try {
      const response = await fetch('/api/notifications');
      if (!response.ok) throw new Error('Failed to fetch notifications');
      const data = await response.json();
      notifications.value = data;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'An error occurred';
    } finally {
      loading.value = false;
    }
  };

  const fetchIssues = async () => {
    loading.value = true;
    error.value = null;

    try {
      const response = await fetch('/api/issues');
      if (!response.ok) throw new Error('Failed to fetch issues');
      const data = await response.json();
      issues.value = data.items || [];
      stats.value.issues = data.total_count || 0;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'An error occurred';
    } finally {
      loading.value = false;
    }
  };

  const fetchPulls = async () => {
    loading.value = true;
    error.value = null;

    try {
      const response = await fetch('/api/pulls');
      if (!response.ok) throw new Error('Failed to fetch pull requests');
      const data = await response.json();
      pulls.value = data.items || [];
      stats.value.prs = data.total_count || 0;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'An error occurred';
    } finally {
      loading.value = false;
    }
  };

  const fetchRepos = async () => {
    loading.value = true;
    error.value = null;

    try {
      const response = await fetch('/api/repos');
      if (!response.ok) throw new Error('Failed to fetch repositories');
      const data = await response.json();
      repos.value = data;
      stats.value.repos = data.length;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'An error occurred';
    } finally {
      loading.value = false;
    }
  };

  return {
    loading,
    error,
    notifications,
    issues,
    pulls,
    repos,
    stats,
    fetchNotifications,
    fetchIssues,
    fetchPulls,
    fetchRepos,
  };
}
