import { normalizeGitPulseBaseUrl } from './gitpulse-url';
import { gitPulseBaseUrl } from './settings';

type StatusTone = 'neutral' | 'error';

interface BaseUrlFormElements {
  input: HTMLInputElement;
  form: HTMLFormElement;
  status: HTMLElement;
}

export function setBaseUrlStatus(
  statusElement: HTMLElement,
  message: string,
  tone: StatusTone = 'neutral'
) {
  statusElement.textContent = message;
  statusElement.dataset.tone = tone;
}

export function bindBaseUrlForm(elements: BaseUrlFormElements) {
  elements.form.addEventListener('submit', async (event) => {
    event.preventDefault();

    try {
      const normalizedBaseUrl = normalizeGitPulseBaseUrl(elements.input.value);
      await gitPulseBaseUrl.setValue(normalizedBaseUrl);
      elements.input.value = normalizedBaseUrl;
      setBaseUrlStatus(elements.status, 'Saved');
    } catch (error) {
      setBaseUrlStatus(
        elements.status,
        error instanceof Error ? error.message : 'Invalid URL',
        'error'
      );
    }
  });

  void gitPulseBaseUrl
    .getValue()
    .then((baseUrl) => {
      elements.input.value = baseUrl;
    })
    .catch((error) => {
      setBaseUrlStatus(
        elements.status,
        error instanceof Error ? error.message : 'Could not load settings.',
        'error'
      );
    });
}
