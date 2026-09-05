import './style.css';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';

import { requestGitPulseLaunch } from '@/utils/request-launch';

const BUTTON_ID = 'gitpulse-jump-button';
const DEFAULT_BUTTON_TEXT = 'GitPulse';
const DEFAULT_BUTTON_TITLE = 'Open this GitHub page in GitPulse';
const ERROR_RESET_DELAY_MS = 2400;

export default defineContentScript({
  matches: ['https://github.com/*', 'https://www.github.com/*'],
  runAt: 'document_idle',
  cssInjectionMode: 'ui',
  async main(ctx) {
    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.textContent = DEFAULT_BUTTON_TEXT;
    button.title = DEFAULT_BUTTON_TITLE;
    button.setAttribute('aria-label', DEFAULT_BUTTON_TITLE);

    const showOpenError = (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Could not open GitPulse.';

      button.textContent = 'Error';
      button.title = message;
      button.setAttribute('aria-label', message);

      ctx.setTimeout(() => {
        button.textContent = DEFAULT_BUTTON_TEXT;
        button.title = DEFAULT_BUTTON_TITLE;
        button.setAttribute('aria-label', DEFAULT_BUTTON_TITLE);
      }, ERROR_RESET_DELAY_MS);
    };

    ctx.addEventListener(button, 'click', async () => {
      button.disabled = true;

      try {
        // Capture the URL at the click, including changes made by GitHub's SPA.
        await requestGitPulseLaunch(window.location.href);
      } catch (error) {
        showOpenError(error);
      } finally {
        button.disabled = false;
      }
    });

    const ui = await createShadowRootUi(ctx, {
      name: 'gitpulse-jump',
      position: 'inline',
      anchor: 'body',
      isolateEvents: true,
      onMount(container) {
        container.append(button);
      },
    });

    const mount = () => {
      if (ctx.isValid && document.body && !ui.shadowHost.isConnected) {
        ui.mount();
      }
    };
    const observer = new MutationObserver(mount);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    ctx.onInvalidated(() => observer.disconnect());
    mount();
  },
});
