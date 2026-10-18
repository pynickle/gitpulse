import { defineEventHandler, getHeader, getQuery } from 'h3';

import { useNativeLoginHandoff } from '../../../utils/native-login-handoff';

export default defineEventHandler((event) =>
  useNativeLoginHandoff(
    event,
    {
      id: getQuery(event).id,
      verifier: getHeader(event, 'x-native-verifier'),
      origin: getHeader(event, 'x-native-origin'),
    },
    'status'
  )
);
