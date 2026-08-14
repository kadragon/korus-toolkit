import { isPhraseEnabled, type PhraseStore } from './settings-store';

export const KORUS_ORIGIN = 'https://knue.korus.ac.kr';
export const NEW_COMPOSER_PATH = '/bms/wcm/bizAddView.do';
export const REPLY_COMPOSER_PATH = '/bms/wcm/bizAnswerView.do';
export const RECIPIENT_PLACEHOLDER = '{{받는 사람}}';
const PREFILLED_ATTRIBUTE = 'data-korus-toolkit-prefilled';

export interface PageLocation {
  origin: string;
  pathname: string;
}

const PAGE_MARKER_SELECTOR = 'h1, h2, h3, h4, h5, h6, td.pupup_title';
const BODY_SELECTOR = 'div.note-editable[contenteditable="true"]';
const RECIPIENT_LIST_SELECTOR = 'select#selectrcvuser';
const insertedBodies = new WeakSet<HTMLDivElement>();

export function isNewComposerPage(pageLocation: PageLocation): boolean {
  return pageLocation.origin === KORUS_ORIGIN && pageLocation.pathname === NEW_COMPOSER_PATH;
}

export function isReplyComposerPage(pageLocation: PageLocation): boolean {
  return pageLocation.origin === KORUS_ORIGIN && pageLocation.pathname === REPLY_COMPOSER_PATH;
}

export function isComposerPage(pageLocation: PageLocation): boolean {
  return isNewComposerPage(pageLocation) || isReplyComposerPage(pageLocation);
}

function isVisible(element: HTMLElement): boolean {
  if (element.hidden || element.getAttribute('aria-hidden') === 'true') {
    return false;
  }

  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  if (style?.display === 'none' || style?.visibility === 'hidden' || style?.visibility === 'collapse') {
    return false;
  }

  return element.getClientRects().length > 0;
}

export function findComposerBody(
  pageDocument: Document,
  pageLocation: PageLocation,
): HTMLDivElement | null {
  if (!isComposerPage(pageLocation)) {
    return null;
  }

  const hasPageMarker = isNewComposerPage(pageLocation)
    ? Array.from(pageDocument.querySelectorAll<HTMLElement>(PAGE_MARKER_SELECTOR))
        .filter(isVisible)
        .filter((element) => element.textContent === '메일쓰기').length === 1
    : pageDocument.title === '메일쓰기';
  if (!hasPageMarker) {
    return null;
  }

  const bodies = Array.from(pageDocument.querySelectorAll<HTMLDivElement>(BODY_SELECTOR)).filter(isVisible);
  return bodies.length === 1 ? bodies[0] : null;
}

export function findNewComposerBody(
  pageDocument: Document,
  pageLocation: PageLocation,
): HTMLDivElement | null {
  return findComposerBody(pageDocument, pageLocation);
}

function appendPhraseNodes(
  ownerDocument: Document,
  phrase: string,
): DocumentFragment {
  const fragment = ownerDocument.createDocumentFragment();
  const lines = phrase.replace(/\r\n?/g, '\n').split('\n');

  lines.forEach((line, index) => {
    if (index > 0) {
      fragment.append(ownerDocument.createElement('br'));
    }
    if (line.length > 0) {
      fragment.append(ownerDocument.createTextNode(line));
    }
  });

  return fragment;
}

export function insertPhraseOnce(body: HTMLDivElement, phrase: string): boolean {
  if (
    !isPhraseEnabled(phrase) ||
    insertedBodies.has(body) ||
    body.hasAttribute(PREFILLED_ATTRIBUTE)
  ) {
    return false;
  }

  body.insertBefore(appendPhraseNodes(body.ownerDocument, phrase), body.firstChild);
  body.setAttribute(PREFILLED_ATTRIBUTE, 'true');
  insertedBodies.add(body);
  return true;
}

export function findFirstRecipientName(pageDocument: Document): string | null {
  const recipientLists = pageDocument.querySelectorAll<HTMLSelectElement>(RECIPIENT_LIST_SELECTOR);
  if (recipientLists.length !== 1) {
    return null;
  }

  const firstRecipient = recipientLists[0].querySelector<HTMLOptionElement>('option[username]');
  const recipientName = firstRecipient?.getAttribute('username')?.trim();
  return recipientName || null;
}

export function resolvePhrase(pageDocument: Document, phrase: string): string | null {
  if (!phrase.includes(RECIPIENT_PLACEHOLDER)) {
    return phrase;
  }

  const recipientName = findFirstRecipientName(pageDocument);
  return recipientName ? phrase.replaceAll(RECIPIENT_PLACEHOLDER, recipientName) : null;
}

export async function prefillComposer(
  store: PhraseStore,
  pageDocument: Document,
  pageLocation: PageLocation,
): Promise<boolean> {
  const body = findComposerBody(pageDocument, pageLocation);
  if (!body || insertedBodies.has(body) || body.hasAttribute(PREFILLED_ATTRIBUTE)) {
    return false;
  }

  let phrase: string;
  try {
    phrase = await store.load();
  } catch {
    return false;
  }

  const resolvedPhrase = resolvePhrase(pageDocument, phrase);
  if (resolvedPhrase === null) {
    return false;
  }

  if (findComposerBody(pageDocument, pageLocation) !== body) {
    return false;
  }

  return insertPhraseOnce(body, resolvedPhrase);
}

export async function prefillNewComposer(
  store: PhraseStore,
  pageDocument: Document,
  pageLocation: PageLocation,
): Promise<boolean> {
  return prefillComposer(store, pageDocument, pageLocation);
}
