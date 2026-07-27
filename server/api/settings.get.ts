export default definePrivateApiCoalescedEventHandler(async (event) => {
  const userLogin = await getUserSettingsLogin(event);

  return readUserSettings(userLogin);
});
