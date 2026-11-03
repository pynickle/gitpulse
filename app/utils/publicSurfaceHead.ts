export function notFoundRobots(status: number | undefined): 'noindex, nofollow' | undefined {
  return status === 404 ? 'noindex, nofollow' : undefined;
}

export function hasAuthReturnQuery(query: { returnTo?: unknown }): boolean {
  return query.returnTo !== undefined;
}

export function landingCanonicalHref(input: {
  localePath: string;
  canonicalOrigin: string | undefined;
  requestOrigin: string;
}): string {
  const origin = input.canonicalOrigin ?? input.requestOrigin;
  return new URL(input.localePath || '/', origin).href;
}

export function landingAuthReturnHead(input: {
  hasReturnTo: boolean;
  canonicalHref: string;
}): { robots: 'noindex, nofollow'; canonicalHref: string } | null {
  if (!input.hasReturnTo) return null;
  return { robots: 'noindex, nofollow', canonicalHref: input.canonicalHref };
}
