import './style.css';
import { browser } from 'wxt/browser';

import { bindBaseUrlForm, setBaseUrlStatus } from '../../utils/base-url-form';
import { buildGitPulseUrl, isGithubWebUrl } from '../../utils/gitpulse-url';
import { gitPulseBaseUrl } from '../../utils/settings';

const baseUrlInput = document.querySelector<HTMLInputElement>('#base-url');
const form = document.querySelector<HTMLFormElement>('#settings-form');
const openButton = document.querySelector<HTMLButtonElement>('#open-gitpulse');
const optionsButton = document.querySelector<HTMLButtonElement>('#open-options');
const statusElement = document.querySelector<HTMLElement>('#status');

if (!baseUrlInput || !form || !openButton || !optionsButton || !statusElement) {
  throw new Error('Popup DOM is incomplete.');
}

const getActiveGithubUrl = async () => {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return isGithubWebUrl(tab?.url) ? tab?.url : undefined;
};

bindBaseUrlForm({
  input: baseUrlInput,
  form,
  status: statusElement,
});

openButton.addEventListener('click', async () => {
  openButton.disabled = true;
  setBaseUrlStatus(statusElement, 'Opening...');

  try {
    const baseUrl = await gitPulseBaseUrl.getValue();
    const githubUrl = await getActiveGithubUrl();
    await browser.tabs.create({ url: buildGitPulseUrl(baseUrl, githubUrl) });
    window.close();
  } catch (error) {
    setBaseUrlStatus(
      statusElement,
      error instanceof Error ? error.message : 'Could not open GitPulse.',
      'error'
    );
  } finally {
    openButton.disabled = false;
  }
});

optionsButton.addEventListener('click', () => {
  void browser.runtime.openOptionsPage().catch((error) => {
    setBaseUrlStatus(
      statusElement,
      error instanceof Error ? error.message : 'Could not open options.',
      'error'
    );
  });
});
