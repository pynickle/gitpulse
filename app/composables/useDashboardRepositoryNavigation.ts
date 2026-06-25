import type { LocationQueryRaw } from 'vue-router';

import { createDashboardRepositoryTarget } from '~/utils/dashboardUrlNavigationUtils';
import getQueryParamValue from '~/utils/getQueryParamValue';

interface OpenDashboardRepositoryOptions {
  tab?: string;
  branch?: string;
}

export function useDashboardRepositoryNavigation() {
  const route = useRoute();
  const router = useRouter();
  const localePath = useLocalePath();
  const { navigateToRepo } = useNavigationHistory();
  const { opensGitHubLinks, openGitHubTarget } = useGitHubLinkRouting();

  const getCurrentTab = () => getQueryParamValue(route.query.tab);

  const openRepository = async (
    owner: string,
    repo: string,
    options: OpenDashboardRepositoryOptions = {}
  ) => {
    if (!owner || !repo) return;

    const tab = options.tab ?? getCurrentTab() ?? undefined;

    if (opensGitHubLinks.value) {
      openGitHubTarget(createDashboardRepositoryTarget(owner, repo, options.branch));
      return;
    }

    const query: LocationQueryRaw = {
      tab,
      repo: `${owner}/${repo}`,
      branch: options.branch,
    };

    navigateToRepo(owner, repo, tab, options.branch);

    await router.push({
      path: localePath('/dashboard'),
      query,
    });
  };

  return {
    openRepository,
  };
}
