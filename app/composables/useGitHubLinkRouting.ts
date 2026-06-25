import { computed } from 'vue';

import type { DashboardUrlTarget } from '~/utils/dashboardUrlNavigationUtils';
import { buildGitHubUrlFromDashboardTarget } from '~/utils/dashboardUrlNavigationUtils';

interface OpenGitHubTargetOptions {
  target?: '_self' | '_blank';
}

export function useGitHubLinkRouting() {
  const { settings } = useUserSettings();

  const opensGitHubLinks = computed(() => settings.value.navigation.linkTarget === 'github');

  const getGitHubTargetUrl = (target: DashboardUrlTarget) => {
    return buildGitHubUrlFromDashboardTarget(target);
  };

  const getPreferredTargetHref = (target: DashboardUrlTarget, gitPulseHref: string) => {
    return opensGitHubLinks.value ? getGitHubTargetUrl(target) : gitPulseHref;
  };

  const openGitHubTarget = (target: DashboardUrlTarget, options: OpenGitHubTargetOptions = {}) => {
    const href = getGitHubTargetUrl(target);
    const linkTarget = options.target ?? '_blank';

    if (!import.meta.client) {
      return href;
    }

    if (linkTarget === '_self') {
      window.location.assign(href);
      return href;
    }

    window.open(href, '_blank', 'noopener');
    return href;
  };

  return {
    opensGitHubLinks,
    getGitHubTargetUrl,
    getPreferredTargetHref,
    openGitHubTarget,
  };
}
