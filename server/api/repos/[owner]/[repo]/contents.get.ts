import { fetchRepoContents } from '#server/utils/repo-contents-utils';

export default definePrivateApiCoalescedEventHandler(async (event) => {
  return fetchRepoContents(event, '');
});
