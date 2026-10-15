import { z } from 'zod';

import {
  createTimelineHistoryService,
  recoveredReleaseSchema,
} from '#server/utils/timeline-history-utils';
import { getUserSettingsLogin } from '#server/utils/user-settings-utils';
const mutation = z.discriminatedUnion('action', [
  z.object({ action: z.literal('clear') }),
  z.object({ action: z.literal('merge'), records: z.array(recoveredReleaseSchema).max(15000) }),
]);
export default defineEventHandler(async (event) => {
  const login = await getUserSettingsLogin(event);
  const parsed = mutation.safeParse(await readBody(event));
  if (!parsed.success)
    throw createError({ statusCode: 400, statusMessage: 'Invalid timeline history mutation' });
  const service = createTimelineHistoryService();
  return parsed.data.action === 'clear'
    ? service.clear(login)
    : service.merge(login, parsed.data.records);
});
