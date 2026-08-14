import { isPhraseEnabled, type PhraseStore } from './settings-store';

export const KORUS_ORIGIN = 'https://knue.korus.ac.kr';
export const NEW_COMPOSER_PATH = '/bms/wcm/bizAddView.do';
const PREFILLED_ATTRIBUTE = 'data-korus-toolkit-prefilled';

export interface PageLocation {
  origin: string;
  pathname: string;
}

const PAGE_MARKER_SELECTOR = 'h1, h2, h3, h4, h5, h6, td.pupup_title';
const BODY_SELECTOR = 'div.note-editable[contenteditable="true"]';
const insertedBodies = new WeakSet<HTMLDivElement>();

export function isNewComposerPage(pageLocation: PageLocation): boolean {
  return pageLocation.origin === KORUS_ORIGIN && pageLocation.pathname === NEW_COMPOSER_PATH;
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

export function findNewComposerBody(
  pageDocument: Document,
  pageLocation: PageLocation,
): HTMLDivElement | null {
  if (!isNewComposerPage(pageLocation)) {
    return null;
  }

  const markers = Array.from(pageDocument.querySelectorAll<HTMLElement>(PAGE_MARKER_SELECTOR))
    .filter(isVisible)
    .filter((element) => element.textContent?.trim() === '메일쓰기');
  if (markers.length !== 1) {
    return null;
  }

  const bodies = Array.from(pageDocument.querySelectorAll<HTMLDivElement>(BODY_SELECTOR)).filter(isVisible);
  return bodies.length === 1 ? bodies[0] : null;
}

export function insertPhraseOnce(body: HTMLDivElement, phrase: string): boolean {
  if (
    !isPhraseEnabled(phrase) ||
    insertedBodies.has(body) ||
    body.hasAttribute(PREFILLED_ATTRIBUTE)
  ) {
    return false;
  }

  const textNode = body.ownerDocument.createTextNode(phrase);
  body.insertBefore(textNode, body.firstChild);
  body.setAttribute(PREFILLED_ATTRIBUTE, 'true');
  insertedBodies.add(body);
  return true;
}

export async function prefillNewComposer(
  store: PhraseStore,
  pageDocument: Document,
  pageLocation: PageLocation,
): Promise<boolean> {
  const body = findNewComposerBody(pageDocument, pageLocation);
  if (!body || insertedBodies.has(body) || body.hasAttribute(PREFILLED_ATTRIBUTE)) {
    return false;
  }

  let phrase: string;
  try {
    phrase = await store.load();
  } catch {
    return false;
  }

  if (findNewComposerBody(pageDocument, pageLocation) !== body) {
    return false;
  }

  return insertPhraseOnce(body, phrase);
}
