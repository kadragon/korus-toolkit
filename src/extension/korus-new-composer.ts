import { isPhraseEnabled, type PhraseStore } from './settings-store';

export const KORUS_ORIGIN = 'https://knue.korus.ac.kr';
export const NEW_COMPOSER_PATH = '/bms/wcm/bizAddView.do';
export const REPLY_COMPOSER_PATH = '/bms/wcm/bizAnswerView.do';
export const RANK_PLACEHOLDER = '{{placeholder}}';
export const RECIPIENT_PLACEHOLDER = '{{받는 사람}}';
const PREFILLED_ATTRIBUTE = 'data-korus-toolkit-prefilled';

export interface PageLocation {
  origin: string;
  pathname: string;
}

const PAGE_MARKER_SELECTOR = 'h1, h2, h3, h4, h5, h6, td.pupup_title';
const BODY_CONTAINER_SELECTOR = 'div.note-editable';
const BODY_SELECTOR = `${BODY_CONTAINER_SELECTOR}[contenteditable="true"]`;
const RECIPIENT_LIST_SELECTOR = 'select#selectrcvuser';
const RECIPIENT_METADATA_ATTRIBUTES = ['username', 'userid'];
const insertedBodies = new WeakSet<HTMLDivElement>();

export const composerObservationOptions: MutationObserverInit = {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: [...RECIPIENT_METADATA_ATTRIBUTES, 'class', 'contenteditable', 'hidden', 'aria-hidden', 'style'],
};

export function isComposerMutationRelevant({ target, type, attributeName }: MutationRecord): boolean {
  const element = target.nodeType === target.ELEMENT_NODE ? (target as Element) : target.parentElement;
  if (type === 'childList') {
    return !element?.closest(BODY_SELECTOR);
  }

  if (!element || !attributeName) {
    return false;
  }

  if (RECIPIENT_METADATA_ATTRIBUTES.includes(attributeName)) {
    return element.matches('option') && element.closest(RECIPIENT_LIST_SELECTOR) !== null;
  }

  return element.matches(BODY_CONTAINER_SELECTOR) ||
    (attributeName === 'class' && element.matches('div[contenteditable="true"]')) ||
    (attributeName !== 'contenteditable' && element.querySelector(BODY_SELECTOR) !== null);
}

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

  const selection = body.ownerDocument.getSelection();
  const caretAtStart = selection?.isCollapsed && selection.anchorNode === body && selection.anchorOffset === 0;
  const fragment = appendPhraseNodes(body.ownerDocument, phrase);
  const insertedNodeCount = fragment.childNodes.length;

  body.insertBefore(fragment, body.firstChild);
  if (caretAtStart) {
    selection.collapse(body, insertedNodeCount);
  }
  body.setAttribute(PREFILLED_ATTRIBUTE, 'true');
  insertedBodies.add(body);
  return true;
}

function findFirstRecipient(pageDocument: Document): { name: string; option: HTMLOptionElement } | null {
  const recipientLists = pageDocument.querySelectorAll<HTMLSelectElement>(RECIPIENT_LIST_SELECTOR);
  if (recipientLists.length !== 1) {
    return null;
  }

  const option = Array.from(recipientLists[0].options).find((candidate) =>
    RECIPIENT_METADATA_ATTRIBUTES.some((attribute) => candidate.hasAttribute(attribute)),
  );
  if (!option) {
    return null;
  }

  const username = option.getAttribute('username');
  if (username !== null) {
    const name = username.trim();
    return name ? { name, option } : null;
  }

  if (!option.getAttribute('userid')?.trim()) {
    return null;
  }

  const [name, detail] = option.text.split(/\s+\/\s+/, 2);
  return name.trim() && detail?.trim() ? { name: name.trim(), option } : null;
}

export function findFirstRecipientName(pageDocument: Document): string | null {
  return findFirstRecipient(pageDocument)?.name ?? null;
}

export function resolvePhrase(
  pageDocument: Document,
  phrase: string,
  placeholder = '',
): string | null {
  let resolvedPhrase = phrase;

  if (resolvedPhrase.includes(RANK_PLACEHOLDER)) {
    let rank = placeholder.trim();
    if (!rank) {
      return null;
    }

    if (rank === '선생님') {
      const recipient = findFirstRecipient(pageDocument);
      if (!recipient) {
        return null;
      }

      const { option } = recipient;
      const position = option.value.split('/')[2]?.trim() || option.textContent?.split('/')[2]?.trim();
      if (position?.includes('주사')) {
        rank = '팀장님';
      }
    }

    resolvedPhrase = resolvedPhrase.replaceAll(RANK_PLACEHOLDER, () => rank);
  }

  if (resolvedPhrase.includes(RECIPIENT_PLACEHOLDER)) {
    const recipientName = findFirstRecipientName(pageDocument);
    if (!recipientName) {
      return null;
    }

    resolvedPhrase = resolvedPhrase.replaceAll(RECIPIENT_PLACEHOLDER, () => recipientName);
  }

  return resolvedPhrase;
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

  let settings;
  try {
    settings = await store.load();
  } catch {
    return false;
  }

  const resolvedPhrase = resolvePhrase(pageDocument, settings.phrase, settings.placeholder);
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
