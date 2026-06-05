export default defineEventHandler(async (event) => {
  const userLogin = await getUserSettingsLogin(event);

  return readUserSettings(userLogin);
});
