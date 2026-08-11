import { createNotificationSubjectEnrichmentHttpAdapter } from './notification-subject-enrichment/httpAdapter';
import { createNotificationSubjectEnrichmentSession } from './notification-subject-enrichment/session';

export function useNotificationSubjectEnrichment() {
  const adapter = createNotificationSubjectEnrichmentHttpAdapter(useGitPulseApiFetch());

  return createNotificationSubjectEnrichmentSession({
    adapter,
    parseSubject: parseGitHubNotificationSubjectTarget,
  });
}
