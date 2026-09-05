import { browser } from 'wxt/browser';

import { isLaunchRequest, launchGitPulse } from '@/utils/launch';
import { gitPulseBaseUrl } from '@/utils/settings';

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, sender) => {
    if (sender.id !== browser.runtime.id || !isLaunchRequest(message)) {
      return;
    }

    return launchGitPulse(message, {
      getBaseUrl: () => gitPulseBaseUrl.getValue(),
      createTab: (url) => browser.tabs.create({ url }),
    });
  });
});
