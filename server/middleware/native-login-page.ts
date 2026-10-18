import { getQuery, getRequestURL } from 'h3';

import { loadNativeLoginBrowserPage } from '../utils/native-login-browser-page';

function isNativeLoginPage(pathname: string) {
  return pathname === '/native-login' || pathname.endsWith('/native-login');
}

// The Nuxt page is the OAuth return target. Approval stays a POST.
export default defineEventHandler(async (event) => {
  if (event.method !== 'GET' && event.method !== 'HEAD') return;
  if (!isNativeLoginPage(getRequestURL(event).pathname)) return;

  event.context.nativeLoginBrowserPage = await loadNativeLoginBrowserPage(event, getQuery(event));
});
