import { defineEventHandler, getHeader, readBody, sendRedirect } from 'h3';

import { withAppBase } from '#shared/utils/auth-return-route';

import { assertCsrfToken } from '../../../utils/csrf-utils';
import { approveNativeLoginHandoff } from '../../../utils/native-login-handoff';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const isForm =
    getHeader(event, 'content-type')?.split(';')[0] === 'application/x-www-form-urlencoded';
  assertCsrfToken(
    event,
    '/auth/native/approve',
    isForm ? String(body?.csrfToken ?? '') : undefined
  );
  const input = isForm ? { id: body?.id, browserToken: body?.browserToken } : body;
  const result = await approveNativeLoginHandoff(event, input);
  if (!isForm) return result;
  const query = new URLSearchParams({ id: input.id, browserToken: input.browserToken });
  return sendRedirect(
    event,
    `${withAppBase('/native-login', useRuntimeConfig().app.baseURL)}?${query}`,
    303
  );
});
