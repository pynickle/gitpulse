export type AuthProviderMode = 'pat-only' | 'oauth-only' | 'hybrid';

export interface AuthProviderState {
  patEnabled: boolean;
  oauthEnabled: boolean;
  oauthRequested: boolean;
  oauthEnvReady: boolean;
  hasAvailableProvider: boolean;
  mode: AuthProviderMode;
  warnings: string[];
}
