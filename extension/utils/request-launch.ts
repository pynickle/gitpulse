import { browser } from 'wxt/browser';

import { LAUNCH_MESSAGE_TYPE, type LaunchRequest, type LaunchResult } from './launch';

export async function requestGitPulseLaunch(githubUrl?: string) {
  const request: LaunchRequest = {
    type: LAUNCH_MESSAGE_TYPE,
    ...(githubUrl ? { githubUrl } : {}),
  };
  const result: LaunchResult | undefined = await browser.runtime.sendMessage(request);

  if (!result?.ok) {
    throw new Error(result?.error || 'Could not open GitPulse. Reload the page and try again.');
  }
}
