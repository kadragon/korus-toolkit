import {
  isComposerPage,
  prefillComposer,
  type PageLocation,
} from './korus-new-composer';
import { createPhraseStore, type PhraseStore } from './settings-store';

const EDITABLE_BODY_SELECTOR = 'div.note-editable[contenteditable="true"]';
const RECIPIENT_LIST_SELECTOR = 'select#selectrcvuser';

function findObservationTarget(pageDocument: Document): Node {
  const recipientList = pageDocument.querySelector<HTMLElement>(RECIPIENT_LIST_SELECTOR);
  return recipientList?.parentElement ?? pageDocument.body!;
}

export function observeComposer(
  store: PhraseStore,
  pageDocument: Document,
  pageLocation: PageLocation,
): MutationObserver | undefined {
  if (!pageDocument.body || typeof MutationObserver === 'undefined') {
    return undefined;
  }

  let observer: MutationObserver | undefined;
  let observedTarget: Node | undefined;
  const retargetObserver = (): void => {
    const target = findObservationTarget(pageDocument);
    if (target === observedTarget) {
      return;
    }

    observer?.disconnect();
    observer?.observe(target, { childList: true, subtree: true });
    observedTarget = target;
  };

  const attemptPrefill = async (): Promise<void> => {
    const inserted = await prefillComposer(store, pageDocument, pageLocation);
    if (inserted) {
      observer?.disconnect();
      return;
    }

    retargetObserver();
  };

  observer = new MutationObserver((mutations) => {
    const editableBody = pageDocument.querySelector<HTMLElement>(EDITABLE_BODY_SELECTOR);
    if (editableBody && mutations.every(({ target }) => editableBody.contains(target))) {
      return;
    }

    retargetObserver();
    void attemptPrefill();
  });
  retargetObserver();
  void attemptPrefill();
  return observer;
}

export function observeNewComposer(
  store: PhraseStore,
  pageDocument: Document,
  pageLocation: PageLocation,
): MutationObserver | undefined {
  return observeComposer(store, pageDocument, pageLocation);
}

export function startContentScript(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  if (!isComposerPage(window.location) || !document.body) {
    return;
  }

  let store: PhraseStore;
  try {
    store = createPhraseStore();
  } catch {
    return;
  }

  observeComposer(store, document, window.location);
}

startContentScript();
