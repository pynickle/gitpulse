import { defineEventHandler, getCookie, getQuery, setHeader } from 'h3';

import { withAppBase } from '#shared/utils/auth-return-route';

import { readNativeLoginBrowser } from '../utils/native-login-handoff';

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!
  );

export default defineEventHandler(async (event) => {
  const browser = await readNativeLoginBrowser(event, getQuery(event));
  const session = await getUserSession(event);
  const signedIn =
    session.auth_provider === 'github' && session.user && session.secure?.access_token;
  const base = useRuntimeConfig().app.baseURL;
  const returnTo = `/native-login?${new URLSearchParams({ id: browser.id, browserToken: browser.browserToken })}`;
  const signInUrl = `${withAppBase('/auth/github', base)}?${new URLSearchParams({ returnTo })}`;
  setHeader(event, 'Content-Type', 'text/html; charset=utf-8');
  setHeader(event, 'X-Frame-Options', 'DENY');
  setHeader(
    event,
    'Content-Security-Policy',
    "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
  );
  const pending = browser.status === 'pending';
  const statusText = {
    pending: 'Return to the app after approval. / 批准后请返回应用。',
    approved: 'Approved. Return to the GitPulse app. / 已批准，请返回 GitPulse 应用。',
    cancelled: 'Cancelled. Start again in the app. / 已取消，请在应用中重新发起。',
    expired: 'Expired. Start again in the app. / 已过期，请在应用中重新发起。',
    redeemed: 'App sign-in completed. / 应用登录已完成。',
  }[browser.status];
  const csrfToken = getCookie(event, 'gitpulse_csrf') || event.context.gitpulseCsrfToken || '';
  const approvalForm = `<p>GitHub: <strong>${escapeHtml(session.user?.login ?? '')}</strong></p>
<form method="post" action="${escapeHtml(withAppBase('/auth/native/approve', base))}">
<input type="hidden" name="id" value="${browser.id}">
<input type="hidden" name="browserToken" value="${browser.browserToken}">
<input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}">
<button>Approve app sign-in / 批准应用登录</button></form>`;
  // This server route is also the same-origin return target of the unchanged
  // upstream OAuth handler. Its proof is unrelated to GitHub state/PKCE.
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>GitPulse app sign-in</title>
<style>body{font:18px system-ui;max-width:36rem;margin:10vh auto;padding:24px;line-height:1.6}button,a{font:inherit}code{font-size:2rem;letter-spacing:.15em}</style>
<h1>GitPulse app sign-in / 应用登录</h1>
<p>Only approve if you started sign-in in your GitPulse app and its code matches.<br>仅当你在 GitPulse 应用中发起登录且确认码一致时批准。</p>
<p><code>${browser.confirmationCode}</code></p>
${pending ? (signedIn ? approvalForm : `<a href="${escapeHtml(signInUrl)}">Continue with GitHub / 使用 GitHub 继续</a>`) : ''}
<p role="status">${statusText}</p>
</html>`;
});
