import type { LocationQueryRaw } from 'vue-router';

const GITHUB_WEB_HOSTS = new Set(['github.com', 'www.github.com']);
const GITHUB_PACKAGE_TYPES = new Set(['npm', 'maven', 'rubygems', 'docker', 'nuget', 'container']);
const GITHUB_WIKI_ACTIONS = new Set(['_new', '_edit', '_history', '_compare', '_pages']);
const GITHUB_PROFILE_TABS = new Set([
  'overview',
  'repositories',
  'packages',
  'followers',
  'following',
]);
const GITHUB_RESERVED_PATHS = new Set([
  'about',
  'actions',
  'advisories',
  'apps',
  'collections',
  'contact',
  'codespaces',
  'copilot',
  'customer-stories',
  'dashboard',
  'enterprise',
  'events',
  'explore',
  'features',
  'issues',
  'join',
  'login',
  'marketplace',
  'new',
  'notifications',
  'orgs',
  'organizations',
  'pricing',
  'pulls',
  'readme',
  'repositories',
  'search',
  'security',
  'settings',
  'sponsors',
  'stars',
  'team',
  'topics',
  'trending',
  'users',
  'watching',
]);

type LaunchEntry = Parameters<typeof resolveNavigationEntryRoute>[0];

export interface GitPulseLaunchRoute {
  path: string;
  query: LocationQueryRaw;
  hash?: string;
}

function decodeSegment(segment: string) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function getSegments(url: URL) {
  return url.pathname.split('/').filter(Boolean).map(decodeSegment);
}

function parseProfileEntry(url: URL, segments: string[]): LaunchEntry {
  let user: string | undefined;

  if (segments.length === 1) {
    user = segments[0];
  } else if ((segments[0] === 'orgs' || segments[0] === 'users') && segments.length === 2) {
    user = segments[1];
  }

  if (
    !user ||
    !/^[A-Za-z0-9-]+$/.test(user) ||
    (segments.length === 1 && GITHUB_RESERVED_PATHS.has(user.toLowerCase()))
  ) {
    return null;
  }

  const rawTab = url.searchParams.get('tab') || undefined;
  if (rawTab === 'stars') {
    return { type: 'starred', data: { user } };
  }

  if (rawTab && !GITHUB_PROFILE_TABS.has(rawTab)) return null;

  return {
    type: 'profile',
    data: {
      user,
      tab: rawTab,
    },
  };
}

function parsePackageEntry(segments: string[]): LaunchEntry {
  const [scope, user, packages, packageType, ...nameSegments] = segments;
  if (
    (scope !== 'users' && scope !== 'orgs') ||
    !user ||
    packages !== 'packages' ||
    !packageType ||
    nameSegments.length !== 1 ||
    !nameSegments[0] ||
    !GITHUB_PACKAGE_TYPES.has(packageType)
  ) {
    return null;
  }

  return {
    type: 'package',
    data: {
      user,
      packageType,
      packageName: nameSegments[0],
      packageOrganization: scope === 'orgs' ? true : undefined,
    },
  };
}

function parseRepositoryEntry(url: URL, segments: string[]): LaunchEntry {
  const [owner, repo, route, ...routeSegments] = segments;
  if (!owner || !repo || !route) return null;

  if (route === 'issues' || route === 'pulls') {
    if (routeSegments.length > 0) return null;

    const state = url.searchParams.get('state');
    return {
      type: 'repository',
      data: {
        owner,
        repo,
        section: route,
        repoState:
          state === 'closed' || state === 'all' || (route === 'pulls' && state === 'merged')
            ? state
            : undefined,
      },
    };
  }

  if (route === 'commits') {
    // Extra path segments can be a branch name or file history; the URL alone
    // cannot distinguish them. A slash inside an encoded ref stays one segment.
    if (routeSegments.length > 1) return null;

    return {
      type: 'repository',
      data: {
        owner,
        repo,
        branch: routeSegments[0],
        section: 'commits',
      },
    };
  }

  if (route === 'branches' && routeSegments.length === 0) {
    return { type: 'branches-list', data: { owner, repo } };
  }

  if (route === 'releases' && routeSegments.length === 0) {
    return { type: 'releases-list', data: { owner, repo } };
  }

  if (route === 'graphs' && routeSegments.length === 1 && routeSegments[0] === 'contributors') {
    return { type: 'contributors-list', data: { owner, repo } };
  }

  if (route === 'wiki') {
    if (routeSegments.some((segment) => GITHUB_WIKI_ACTIONS.has(segment))) return null;

    return {
      type: 'wiki',
      data: {
        owner,
        repo,
        path: routeSegments.length > 0 ? routeSegments.join('/') : undefined,
      },
    };
  }

  // GitHub does not include a file path on `/tree/<ref>`, but GitPulse can
  // still open the repository root for the unambiguous single-segment form.
  if (route === 'tree' && routeSegments.length === 1) {
    return {
      type: 'file',
      data: { owner, repo, branch: routeSegments[0], path: '' },
    };
  }

  return null;
}

function parseGitHubPageEntry(url: URL): LaunchEntry {
  if (!GITHUB_WEB_HOSTS.has(url.hostname.toLowerCase())) return null;

  const segments = getSegments(url);
  if (segments.length === 0) return null;

  const packageEntry = parsePackageEntry(segments);
  if (packageEntry) return packageEntry;

  if (
    (segments[0] === 'orgs' || segments[0] === 'users') &&
    segments.length === 3 &&
    segments[2] === 'packages'
  ) {
    return { type: 'profile', data: { user: segments[1], tab: 'packages' } };
  }

  if (segments[0] === 'stars' && segments.length === 2 && /^[A-Za-z0-9-]+$/.test(segments[1]!)) {
    return { type: 'starred', data: { user: segments[1] } };
  }

  if (
    segments.length === 1 ||
    ((segments[0] === 'orgs' || segments[0] === 'users') && segments.length === 2)
  ) {
    return parseProfileEntry(url, segments);
  }

  if (segments.length >= 2 && GITHUB_RESERVED_PATHS.has(segments[0]!.toLowerCase())) {
    return null;
  }

  return parseRepositoryEntry(url, segments);
}

export default function (value: string | null | undefined): GitPulseLaunchRoute | null {
  if (!value) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:' || url.username || url.password) return null;

  const pageEntry = parseGitHubPageEntry(url);
  if (pageEntry) {
    const route = resolveNavigationEntryRoute(pageEntry);
    return {
      ...route,
      hash: url.hash || undefined,
    };
  }

  if (
    GITHUB_WEB_HOSTS.has(url.hostname.toLowerCase()) &&
    GITHUB_RESERVED_PATHS.has(getSegments(url)[0]?.toLowerCase() ?? '')
  ) {
    return null;
  }

  const detailTarget = parseDashboardUrlTarget(url.href);
  if (!detailTarget) return null;

  return {
    path: '/dashboard',
    query: detailTarget.query,
    hash: detailTarget.hash,
  };
}
