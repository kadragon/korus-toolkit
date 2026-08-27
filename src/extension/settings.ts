import { SettingsController, type SettingsView } from './settings-controller';
import { createPhraseStore } from './settings-store';

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Settings page is missing ${selector}.`);
  }

  return element;
}

const form = requiredElement<HTMLFormElement>('#settings-form');
const phraseInput = requiredElement<HTMLTextAreaElement>('#prefill-phrase');
const placeholderInput = requiredElement<HTMLInputElement>('#prefill-placeholder');
const clearButton = requiredElement<HTMLButtonElement>('#clear-button');
const status = requiredElement<HTMLElement>('#settings-status');

const view: SettingsView = {
  getPhrase: () => phraseInput.value,
  setPhrase: (phrase) => {
    phraseInput.value = phrase;
  },
  getPlaceholder: () => placeholderInput.value,
  setPlaceholder: (placeholder) => {
    placeholderInput.value = placeholder;
  },
  setStatus: (message) => {
    status.textContent = message;
  },
};

try {
  const controller = new SettingsController(createPhraseStore(), view);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void controller.save();
  });

  clearButton.addEventListener('click', () => {
    void controller.clear();
  });

  void controller.load();
} catch {
  view.setStatus('확장 프로그램 저장소를 사용할 수 없습니다.');
}
