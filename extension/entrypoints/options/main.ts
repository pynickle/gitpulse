import './style.css';
import { bindBaseUrlForm } from '../../utils/base-url-form';

const baseUrlInput = document.querySelector<HTMLInputElement>('#base-url');
const form = document.querySelector<HTMLFormElement>('#settings-form');
const statusElement = document.querySelector<HTMLElement>('#status');

if (!baseUrlInput || !form || !statusElement) {
  throw new Error('Options DOM is incomplete.');
}

bindBaseUrlForm({
  input: baseUrlInput,
  form,
  status: statusElement,
});
