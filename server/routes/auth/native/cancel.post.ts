import { defineEventHandler, readBody } from 'h3';

import { assertCsrfToken } from '../../../utils/csrf-utils';
import { useNativeLoginHandoff } from '../../../utils/native-login-handoff';

export default defineEventHandler(async (event) => {
  assertCsrfToken(event, '/auth/native/cancel');
  return useNativeLoginHandoff(event, await readBody(event), 'cancel');
});
