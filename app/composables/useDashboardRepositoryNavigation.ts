import type { LocationQueryRaw } from 'vue-router';

import { createDashboardRepositoryTarget } from '~/utils/dashboardUrlNavigationUtils';
import getQueryParamValue from '~/utils/getQueryParamValue';
import { resolveNavigationEntryRoute } from '~/utils/navigationEntryRouting';

interface OpenDashboardRepositoryOptions {
  tab?: string;
  branch?: string;
}

export function useDashboardRepositoryNavigation() {
  const route = useRoute();
  const router = useRouter();
  const localePath = useLocalePath();
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

    await router.push({
      path: localePath('/dashboard'),
      query,
    });
  };

  const openRelease = async (owner: string, repo: string, releaseId: number) => {
    if (!owner || !repo || !releaseId) return;

    const resolved = resolveNavigationEntryRoute({
      type: 'release',
      data: {
        owner,
        repo,
        number: releaseId,
        releaseRef: { kind: 'id', id: releaseId },
        tab: getCurrentTab() ?? undefined,
      },
    });

    await router.push({
      path: localePath(resolved.path),
      query: resolved.query,
    });
  };

  return {
    openRepository,
    openRelease,
  };
}
