import type { H3Event } from 'h3';
import type { RequestEvent } from 'nuxt/server';

import { parseCanonicalOrigin } from '#shared/utils/canonical-origin';
import {
  resolveDiscoveryDocuments,
  type DiscoveryDocuments,
} from '#shared/utils/discovery-documents';
import { getSiteIndexable } from '#site-config/server';

// Nitro's robots hook types the request as `RequestEvent`. Route handlers see
// the same object as `H3Event`.
type DiscoveryEvent = H3Event | Pick<RequestEvent, 'context'>;

export function discoveryDocumentsForEvent(event: DiscoveryEvent): DiscoveryDocuments | null {
  const baseUrl = useRuntimeConfig(event as H3Event).public.i18n?.baseUrl;
  const parsed = parseCanonicalOrigin(baseUrl);
  return resolveDiscoveryDocuments({
    indexable: getSiteIndexable(event as Pick<RequestEvent, 'context'>),
    origin: parsed.ok ? parsed.origin : undefined,
  });
}
