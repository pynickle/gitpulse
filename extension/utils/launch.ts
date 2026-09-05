import { buildGitPulseUrl, isGithubWebUrl } from './gitpulse-url';

export const LAUNCH_MESSAGE_TYPE = 'gitpulse:open';

export interface LaunchRequest {
  type: typeof LAUNCH_MESSAGE_TYPE;
  githubUrl?: string;
}

export type LaunchResult = { ok: true } | { ok: false; error: string };

interface LaunchDependencies {
  getBaseUrl: () => Promise<string>;
  createTab: (url: string) => Promise<unknown>;
}

export function isLaunchRequest(message: unknown): message is LaunchRequest {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === LAUNCH_MESSAGE_TYPE &&
    (!('githubUrl' in message) || typeof message.githubUrl === 'string')
  );
}

export async function launchGitPulse(
  request: LaunchRequest,
  dependencies: LaunchDependencies
): Promise<LaunchResult> {
  try {
    if (request.githubUrl !== undefined && !isGithubWebUrl(request.githubUrl)) {
      throw new Error('Only HTTPS GitHub pages can be opened in GitPulse.');
    }

    const baseUrl = await dependencies.getBaseUrl();
    await dependencies.createTab(buildGitPulseUrl(baseUrl, request.githubUrl));
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not open GitPulse.',
    };
  }
}
