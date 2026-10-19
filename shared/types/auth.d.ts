declare module '#auth-utils' {
  interface User {
    id?: number;
    login: string;
    name: string;
    avatar_url: string;
  }

  interface UserSession {
    logged_in_at: Date;
    auth_provider: 'github' | 'pat';
  }

  interface SecureSessionData {
    access_token: string;
  }
}

export {};
