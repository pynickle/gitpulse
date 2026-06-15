import { getUserSettingsLogin, patchUserSettings } from '#server/utils/user-settings-utils';
import { parseUserSettingsPatchBody } from '#server/utils/user-settings-validation-utils';

export default defineEventHandler(async (event) => {
  const userLogin = await getUserSettingsLogin(event);
  const body = parseUserSettingsPatchBody(await readBody(event));

  return patchUserSettings(userLogin, body);
});
