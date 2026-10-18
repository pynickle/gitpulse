export type NativeLoginBrowserStatus =
  | 'pending'
  | 'approved'
  | 'cancelled'
  | 'expired'
  | 'redeemed';

/** Public view of the browser approval page. It never includes a GitHub token. */
export interface NativeLoginBrowserPage {
  id: string;
  browserToken: string;
  status: NativeLoginBrowserStatus;
  confirmationCode: string;
  signedIn: boolean;
  login: string;
  name: string;
  avatarUrl: string;
  signInUrl: string;
  approveAction: string;
  csrfToken: string;
}
