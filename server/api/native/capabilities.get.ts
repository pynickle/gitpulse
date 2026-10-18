import { defineEventHandler } from 'h3';

import type { NativeCapabilities } from '#shared/types/native-capabilities';

import { resolveAuthProviderState } from '../../utils/auth-providers';
import { nativeLoginHandoffAvailable } from '../../utils/native-login-handoff';

export default defineEventHandler((): NativeCapabilities => {
  const { personalMode, patEnabled, oauthEnabled, mode } = resolveAuthProviderState();
  return {
    protocolVersion: 1,
    // Add capabilities only alongside the implementation and its contract tests.
    capabilities: [
      'provider-discovery',
      // Core release reading: the app requires these routes instead of degrading.
      'release-timeline',
      ...(nativeLoginHandoffAvailable() ? ['native-login-handoff'] : []),
    ],
    providers: { personalMode, patEnabled, oauthEnabled, mode },
  };
});
