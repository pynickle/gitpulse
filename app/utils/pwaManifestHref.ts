import { withAppBase } from '#shared/utils/auth-return-route';

export function pwaManifestHref(baseURL: string): string {
  return withAppBase('/manifest.webmanifest', baseURL);
}
