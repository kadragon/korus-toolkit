import {
  isNewComposerPage,
  prefillNewComposer,
  type PageLocation,
} from './korus-new-composer';
import { createPhraseStore, type PhraseStore } from './settings-store';

export function observeNewComposer(
  store: PhraseStore,
  pageDocument: Document,
  pageLocation: PageLocation,
): MutationObserver | undefined {
  if (!pageDocument.body || typeof MutationObserver === 'undefined') {
    return undefined;
  }

  let observer: MutationObserver | undefined;
  const attemptPrefill = async (): Promise<void> => {
    const inserted = await prefillNewComposer(store, pageDocument, pageLocation);
    if (inserted) {
      observer?.disconnect();
    }
  };

  observer = new MutationObserver(() => {
    void attemptPrefill();
  });
  observer.observe(pageDocument.body, { childList: true, subtree: true });
  void attemptPrefill();
  return observer;
}

export function startContentScript(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  if (!isNewComposerPage(window.location) || !document.body) {
    return;
  }

  let store: PhraseStore;
  try {
    store = createPhraseStore();
  } catch {
    return;
  }

  observeNewComposer(store, document, window.location);
}

startContentScript();
