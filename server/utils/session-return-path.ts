import routeTablePaths from 'gitpulse/route-table-paths';

import { DEFAULT_AUTH_RETURN_PATH } from '#shared/utils/auth-return-route';
import { admitAuthReturnTo } from '#shared/utils/route-admission';
import { createRouteMatcher } from '#shared/utils/route-matcher';

function routePaths(value: unknown): readonly string[] {
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== 'string') ||
    value.length === 0
  ) {
    throw new Error(
      'GitPulse route table is missing. Page paths were not collected before the server bundle was created.'
    );
  }
  return value;
}

const matchRoute = createRouteMatcher(routePaths(routeTablePaths));

export function resolveSessionReturnPath(returnTo: string | null): string {
  return admitAuthReturnTo(returnTo, matchRoute, DEFAULT_AUTH_RETURN_PATH);
}
