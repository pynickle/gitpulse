import { defineEventHandler } from 'h3';

import type { AuthProviderState } from '#shared/types/auth-provider';

import { resolveAuthProviderState } from '../../utils/auth-providers';

export default defineEventHandler((event): AuthProviderState => {
  return resolveAuthProviderState(event);
});
