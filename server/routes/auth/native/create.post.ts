import { defineEventHandler, readBody } from 'h3';

import { assertCsrfToken } from '../../../utils/csrf-utils';
import { createNativeLoginHandoff } from '../../../utils/native-login-handoff';

export default defineEventHandler(async (event) => {
  assertCsrfToken(event, '/auth/native/create');
  return createNativeLoginHandoff(event, await readBody(event));
});
