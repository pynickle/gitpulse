import type { AuthProviderState } from './auth-provider';

/** Public, unauthenticated contract for the native client's connection check. */
export interface NativeCapabilities {
  protocolVersion: number;
  capabilities: string[];
  providers: Pick<AuthProviderState, 'personalMode' | 'patEnabled' | 'oauthEnabled' | 'mode'>;
}
