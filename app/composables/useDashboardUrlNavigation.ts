import {
  parseDashboardUrlTarget,
  type DashboardUrlTarget,
} from '~/utils/dashboard-url-navigation-utils';
import type { MarkdownRepoContext } from '~/utils/markdown-repo-path-utils';

export function useDashboardUrlNavigation() {
  const localePath = useLocalePath();
  const router = useRouter();
  const {
    navigateToDiscussion,
    navigateToFile,
    navigateToIssue,
    navigateToPullRequest,
    navigateToRelease,
    navigateToRepo,
  } = useNavigationHistory();

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

  const trackDashboardUrlNavigation = (target: DashboardUrlTarget) => {
    if (target.type === 'issue') {
      navigateToIssue(target.owner, target.repo, target.number);
      return;
    }

    if (target.type === 'pull-request') {
      navigateToPullRequest(target.owner, target.repo, target.number, undefined, target.view);
      return;
    }

    if (target.type === 'discussion') {
      navigateToDiscussion(target.owner, target.repo, target.number);
      return;
    }

    if (target.type === 'release') {
      navigateToRelease(target.owner, target.repo, target.releaseRef);
      return;
    }

    if (target.type === 'repository') {
      navigateToRepo(target.owner, target.repo, undefined, target.branch);
      return;
    }

    navigateToFile(target.owner, target.repo, target.path, target.branch);
  };

  const navigateToDashboardUrl = async (
    value: string | null | undefined,
    context: MarkdownRepoContext = {}
  ) => {
    const target = resolveDashboardUrlTarget(value, context);
    if (!target) return false;

    trackDashboardUrlNavigation(target);
    await router.push(getDashboardUrlRoute(target));
    return true;
  };

  return {
    resolveDashboardUrlTarget,
    getDashboardUrlRoute,
    buildDashboardUrlRoute,
    trackDashboardUrlNavigation,
    navigateToDashboardUrl,
  };
}
