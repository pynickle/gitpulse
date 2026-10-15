import { definePrivateApiCoalescedEventHandler } from '#server/utils/api-cache-utils';
import { createTimelineHistoryService } from '#server/utils/timeline-history-utils';
import { getUserSettingsLogin } from '#server/utils/user-settings-utils';
export default definePrivateApiCoalescedEventHandler(async (event) =>
  createTimelineHistoryService().read(await getUserSettingsLogin(event))
);
