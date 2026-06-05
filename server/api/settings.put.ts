export default defineEventHandler(async (event) => {
  const userLogin = await getUserSettingsLogin(event);
  const body = await readBody(event);

  return patchUserSettings(userLogin, body);
});
