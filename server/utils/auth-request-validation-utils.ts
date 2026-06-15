import * as z from 'zod';

import { parseZodRequestBody } from './zod-validation-utils';

const tokenBodySchema = z.strictObject({
  token: z.string().trim().min(1),
});

const unlockBodySchema = z
  .strictObject({
    password: z.string().trim().min(1).optional(),
    remember: z.boolean().optional().default(false),
  })
  .transform((body) => ({ password: body.password ?? '', remember: body.remember }));

export function parseTokenAuthBody(body: unknown) {
  return parseZodRequestBody(tokenBodySchema, body, 'Invalid token request body').token;
}

export function parsePersonalUnlockBody(body: unknown) {
  return parseZodRequestBody(unlockBodySchema, body, 'Invalid request body');
}
