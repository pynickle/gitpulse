import type { AuthProviderState } from '#shared/types/auth-provider';

import { resolveAuthProviderState } from '../../utils/auth-providers';

export default defineEventHandler((): AuthProviderState => {
  return resolveAuthProviderState();
});
