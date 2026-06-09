import './style.css';
import { buildGitPulseUrl, isGithubWebUrl } from '@/utils/gitpulse-url';
import { gitPulseBaseUrl } from '@/utils/settings';

const BUTTON_ID = 'gitpulse-jump-button';
const CHECK_INTERVAL_MS = 1000;
const DEFAULT_BUTTON_TEXT = 'GitPulse';
const DEFAULT_BUTTON_TITLE = 'Open this GitHub page in GitPulse';
const ERROR_RESET_DELAY_MS = 2400;

export default defineContentScript({
  matches: ['https://github.com/*', 'https://www.github.com/*'],
  runAt: 'document_idle',
  main() {
    if (document.getElementById(BUTTON_ID)) return;

    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.textContent = DEFAULT_BUTTON_TEXT;
    button.title = DEFAULT_BUTTON_TITLE;
    button.setAttribute('aria-label', DEFAULT_BUTTON_TITLE);

    const syncVisibility = () => {
      button.hidden = !isGithubWebUrl(window.location.href);
    };

    const showOpenError = (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Could not open GitPulse.';

      button.textContent = 'Error';
      button.title = message;
      button.setAttribute('aria-label', message);

      window.setTimeout(() => {
        button.textContent = DEFAULT_BUTTON_TEXT;
        button.title = DEFAULT_BUTTON_TITLE;
        button.setAttribute('aria-label', DEFAULT_BUTTON_TITLE);
      }, ERROR_RESET_DELAY_MS);
    };

    button.addEventListener('click', async () => {
      button.disabled = true;

      try {
        const baseUrl = await gitPulseBaseUrl.getValue();
        const gitPulseWindow = window.open(
          buildGitPulseUrl(baseUrl, window.location.href),
          '_blank',
          'noopener,noreferrer'
        );

        if (!gitPulseWindow) {
          throw new Error('Could not open GitPulse. Check popup settings.');
        }
      } catch (error) {
        showOpenError(error);
      } finally {
        button.disabled = false;
      }
    });

    document.body.append(button);
    syncVisibility();
    window.setInterval(syncVisibility, CHECK_INTERVAL_MS);
  },
});
