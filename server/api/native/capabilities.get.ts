import { defineEventHandler } from 'h3';

import type { NativeCapabilities } from '#shared/types/native-capabilities';

import { resolveAuthProviderState } from '../../utils/auth-providers';

export default defineEventHandler((): NativeCapabilities => {
  const { personalMode, patEnabled, oauthEnabled, mode } = resolveAuthProviderState();
  return {
    protocolVersion: 1,
    // Add capabilities only alongside the implementation and its contract tests.
    capabilities: ['provider-discovery'],
    providers: { personalMode, patEnabled, oauthEnabled, mode },
  };
});
