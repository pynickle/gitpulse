import { storage } from '#imports';

import { DEFAULT_GITPULSE_BASE_URL } from './gitpulse-url';

export const gitPulseBaseUrl = storage.defineItem<string>('sync:gitpulse-base-url', {
  fallback: DEFAULT_GITPULSE_BASE_URL,
});
