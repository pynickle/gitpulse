export type AuthProviderMode = 'personal' | 'pat-only' | 'oauth-only' | 'hybrid';

export interface AuthProviderState {
  personalMode: boolean;
  patEnabled: boolean;
  oauthEnabled: boolean;
  oauthRequested: boolean;
  oauthEnvReady: boolean;
  hasAvailableProvider: boolean;
  mode: AuthProviderMode;
  warnings: string[];
}
