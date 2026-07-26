import {
  parseDashboardUrlTarget,
  type DashboardUrlTarget,
} from '~/utils/dashboardUrlNavigationUtils';
import type { MarkdownRepoContext } from '~/utils/markdownRepoPathUtils';

export function useDashboardUrlNavigation() {
  const localePath = useLocalePath();
  const router = useRouter();
  const { opensGitHubLinks, getPreferredTargetHref, openGitHubTarget } = useGitHubLinkRouting();

  const resolveDashboardUrlTarget = (
    value: string | null | undefined,
    context: MarkdownRepoContext = {}
  ) => parseDashboardUrlTarget(value, context);

  const getDashboardUrlRoute = (target: DashboardUrlTarget) =>
    localePath({
      path: '/dashboard',
      query: target.query,
      hash: target.hash,
    });

  const buildDashboardUrlRoute = (
    value: string | null | undefined,
    context: MarkdownRepoContext = {}
  ) => {
    const target = resolveDashboardUrlTarget(value, context);
    return target ? getDashboardUrlRoute(target) : null;
  };

  const getPreferredDashboardUrlHref = (target: DashboardUrlTarget) => {
    return getPreferredTargetHref(target, getDashboardUrlRoute(target));
  };

  const buildPreferredDashboardUrlHref = (
    value: string | null | undefined,
    context: MarkdownRepoContext = {}
  ) => {
    const target = resolveDashboardUrlTarget(value, context);
    return target ? getPreferredDashboardUrlHref(target) : null;
  };

  const navigateToDashboardUrl = async (
    value: string | null | undefined,
    context: MarkdownRepoContext = {}
  ) => {
    const target = resolveDashboardUrlTarget(value, context);
    if (!target) return false;

    if (opensGitHubLinks.value) {
      openGitHubTarget(target);
      return true;
    }

    await router.push(getDashboardUrlRoute(target));
    return true;
  };

  return {
    resolveDashboardUrlTarget,
    getDashboardUrlRoute,
    buildDashboardUrlRoute,
    getPreferredDashboardUrlHref,
    buildPreferredDashboardUrlHref,
    navigateToDashboardUrl,
  };
}
