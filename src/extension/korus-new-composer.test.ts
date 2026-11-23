// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';

import {
  findComposerBody,
  findFirstRecipientName,
  findNewComposerBody,
  insertPhraseOnce,
  isComposerPage,
  isNewComposerPage,
  isReplyComposerPage,
  prefillComposer,
  prefillNewComposer,
  RANK_PLACEHOLDER,
  RECIPIENT_PLACEHOLDER,
  REPLY_COMPOSER_PATH,
  resolvePhrase,
  type PageLocation,
} from './korus-new-composer';
import { observeComposer, observeNewComposer } from './content-script';
import type { PhraseSettings, PhraseStore } from './settings-store';

const matchingPage: PageLocation = {
  origin: 'https://knue.korus.ac.kr',
  pathname: '/bms/wcm/bizAddView.do',
};

const matchingReplyPage: PageLocation = {
  origin: 'https://knue.korus.ac.kr',
  pathname: REPLY_COMPOSER_PATH,
};

function markVisible(selector: string): void {
  for (const element of document.querySelectorAll<HTMLElement>(selector)) {
    Object.defineProperty(element, 'getClientRects', {
      configurable: true,
      value: () => [{}],
    });
  }
}

function installFixture(bodyMarkup = ''): HTMLDivElement {
  document.title = '';
  document.body.className = '';
  document.body.innerHTML = `
    <h2 data-marker>메일쓰기</h2>
    <select id="selectrcvuser" name="selectrcvuser"></select>
    <div class="note-editable" contenteditable="true" data-body>${bodyMarkup}</div>
  `;
  markVisible('[data-marker], [data-body]');
  return document.querySelector<HTMLDivElement>('[data-body]')!;
}

function installReplyFixture(bodyMarkup = '<br><br><p>Quoted content</p>'): HTMLDivElement {
  document.title = '메일쓰기';
  document.body.className = 'memo';
  document.body.innerHTML = `
    <div class="note-editable" contenteditable="true" data-body>${bodyMarkup}</div>
    <select id="selectrcvuser" name="selectrcvuser"></select>
  `;
  markVisible('[data-body]');
  return document.querySelector<HTMLDivElement>('[data-body]')!;
}

function createStore(phrase: string): PhraseStore {
  return {
    load: vi.fn(async (): Promise<PhraseSettings> => ({ phrase, placeholder: '' })),
    save: vi.fn(async () => undefined),
  };
}

function createRankStore(phrase: string, placeholder: string): PhraseStore {
  return {
    load: vi.fn(async (): Promise<PhraseSettings> => ({ phrase, placeholder })),
    save: vi.fn(async () => undefined),
  };
}

function addRecipient(name: string): HTMLOptionElement {
  const recipientList = document.querySelector<HTMLSelectElement>('#selectrcvuser')!;
  const option = document.createElement('option');
  option.setAttribute('username', name);
  recipientList.append(option);
  return option;
}

describe('KORUS new composer contract', () => {
  it('recognizes only the exact origin, path, marker, and unique visible body', () => {
    const body = installFixture();

    expect(isNewComposerPage(matchingPage)).toBe(true);
    expect(isComposerPage(matchingPage)).toBe(true);
    expect(findNewComposerBody(document, matchingPage)).toBe(body);
    expect(
      findNewComposerBody(document, {
        ...matchingPage,
        origin: 'https://example.test',
      }),
    ).toBeNull();
    expect(
      findNewComposerBody(document, {
        ...matchingPage,
        pathname: '/bms/wcm/recvList.do',
      }),
    ).toBeNull();

    document.querySelector<HTMLElement>('[data-marker]')!.textContent = ' 메일쓰기 ';
    expect(findComposerBody(document, matchingPage)).toBeNull();
  });

  it('recognizes the observed reply path only with its exact title and unique visible body', () => {
    const body = installReplyFixture();

    expect(isNewComposerPage(matchingReplyPage)).toBe(false);
    expect(isReplyComposerPage(matchingReplyPage)).toBe(true);
    expect(isComposerPage(matchingReplyPage)).toBe(true);
    expect(findComposerBody(document, matchingReplyPage)).toBe(body);

    document.title = '다른 화면';
    expect(findComposerBody(document, matchingReplyPage)).toBeNull();
    document.title = '메일쓰기!';
    expect(findComposerBody(document, matchingReplyPage)).toBeNull();
  });

  it('recognizes the observed popup title cell without counting its table ancestor', () => {
    document.body.innerHTML = `
      <table><tr><td><table><tr><td class="pupup_title">메일쓰기</td></tr></table></td></tr></table>
      <div class="note-editable" contenteditable="true" data-body></div>
    `;
    markVisible('td.pupup_title, [data-body]');

    expect(findNewComposerBody(document, matchingPage)).toBe(
      document.querySelector<HTMLDivElement>('[data-body]'),
    );
  });

  it('fails closed for an ambiguous marker or body target', () => {
    installFixture();
    const secondMarker = document.createElement('h2');
    secondMarker.textContent = '메일쓰기';
    document.body.append(secondMarker);
    markVisible('h2');
    expect(findNewComposerBody(document, matchingPage)).toBeNull();

    document.body.innerHTML = '<h2 data-marker>메일쓰기</h2><div class="note-editable" contenteditable="true"></div><div class="note-editable" contenteditable="true"></div>';
    markVisible('h2, .note-editable');
    expect(findNewComposerBody(document, matchingPage)).toBeNull();
  });

  it('inserts text once and preserves existing markup', () => {
    const body = installFixture('<p>Existing <strong>text</strong></p>');
    const phrase = '<tag> & "quote"';

    expect(insertPhraseOnce(body, phrase)).toBe(true);
    expect(body.textContent).toBe(`${phrase}Existing text`);
    expect(body.querySelector('strong')?.textContent).toBe('text');
    expect(insertPhraseOnce(body, phrase)).toBe(false);
    expect(body.textContent).toBe(`${phrase}Existing text`);
  });

  it('renders LF, CRLF, and CR as text-safe line breaks', () => {
    const body = installFixture('Existing text');
    const phrase = '첫 줄\r\n둘째 줄\n셋째 줄\r넷째 줄';

    expect(insertPhraseOnce(body, phrase)).toBe(true);
    expect(body.innerHTML).toContain('첫 줄<br>둘째 줄<br>셋째 줄<br>넷째 줄');
    expect(body.querySelectorAll(':scope > br')).toHaveLength(3);
    expect(body.textContent).toBe('첫 줄둘째 줄셋째 줄넷째 줄Existing text');
  });

  it('does not mutate the body for an empty phrase', () => {
    const body = installFixture('Existing text');

    expect(insertPhraseOnce(body, '')).toBe(false);
    expect(body.textContent).toBe('Existing text');
  });

  it('resolves the placeholder from the first recipient only', () => {
    installFixture();
    document.querySelector<HTMLSelectElement>('#selectrcvuser')!.append(document.createElement('option'));
    addRecipient('홍길동');
    addRecipient('김철수');

    expect(findFirstRecipientName(document)).toBe('홍길동');
    expect(resolvePhrase(document, `안녕하세요. ${RECIPIENT_PLACEHOLDER}님.`)).toBe(
      '안녕하세요. 홍길동님.',
    );
  });

  it('resolves every rank placeholder from the configured value', () => {
    installFixture();
    const phrase = `안녕하세요, ${RANK_PLACEHOLDER}. ${RANK_PLACEHOLDER}`;

    expect(resolvePhrase(document, phrase, '팀장님')).toBe('안녕하세요, 팀장님. 팀장님');
  });

  it('does not resolve a rank placeholder when its configured value is blank', () => {
    installFixture();

    expect(resolvePhrase(document, `안녕하세요, ${RANK_PLACEHOLDER}.`)).toBeNull();
    expect(resolvePhrase(document, `안녕하세요, ${RANK_PLACEHOLDER}.`, '  ')).toBeNull();
  });

  it('reads the recipient name from KORUS option metadata', () => {
    installFixture();
    const recipientList = document.querySelector<HTMLSelectElement>('#selectrcvuser')!;
    const option = document.createElement('option');
    option.value = 'synthetic-id';
    option.setAttribute('userid', 'synthetic-user');
    option.setAttribute('type', '수신');
    recipientList.append(option);

    option.textContent = 'Unverified label';
    expect(findFirstRecipientName(document)).toBeNull();

    option.textContent = '홍길동 / 정보전산원 / 전산주사 / 미열람 / 수신';
    expect(findFirstRecipientName(document)).toBe('홍길동');
  });

  it('waits for the first recognized recipient while its username is blank', () => {
    installFixture();
    const first = addRecipient(' ');
    addRecipient('Second');

    expect(findFirstRecipientName(document)).toBeNull();

    first.setAttribute('username', ' First ');
    expect(findFirstRecipientName(document)).toBe('First');
  });

  it('waits for the first recipient before inserting a placeholder phrase', async () => {
    const body = installFixture('Existing text');
    const store = createStore(`안녕하세요. ${RECIPIENT_PLACEHOLDER}님.`);

    await expect(prefillComposer(store, document, matchingPage)).resolves.toBe(false);
    expect(body.textContent).toBe('Existing text');

    addRecipient('홍길동');
    await expect(prefillComposer(store, document, matchingPage)).resolves.toBe(true);
    expect(body.textContent).toBe('안녕하세요. 홍길동님.Existing text');

    addRecipient('김철수');
    await expect(prefillComposer(store, document, matchingPage)).resolves.toBe(false);
    expect(body.textContent).toBe('안녕하세요. 홍길동님.Existing text');
  });

  it('loads and inserts the phrase once across repeated observations', async () => {
    const body = installFixture('Existing text');
    const store = createStore('안녕하세요\n');

    await expect(prefillNewComposer(store, document, matchingPage)).resolves.toBe(true);
    await expect(prefillNewComposer(store, document, matchingPage)).resolves.toBe(false);

    expect(body.innerHTML).toBe('안녕하세요<br>Existing text');
    expect(store.load).toHaveBeenCalledTimes(1);
  });

  it('prefills a reply before existing quoted content and only once', async () => {
    const body = installReplyFixture('<br><br><p>Quoted first line</p><p>Quoted second line</p>');
    const store = createStore('첫 줄\r\n둘째 줄');

    await expect(prefillComposer(store, document, matchingReplyPage)).resolves.toBe(true);
    await expect(prefillComposer(store, document, matchingReplyPage)).resolves.toBe(false);

    expect(body.innerHTML).toBe(
      '첫 줄<br>둘째 줄<br><br><p>Quoted first line</p><p>Quoted second line</p>',
    );
    expect(store.load).toHaveBeenCalledTimes(1);
  });

  it('prefills a reply with the first known recipient', async () => {
    const body = installReplyFixture('<br><br><p>Quoted content</p>');
    addRecipient('홍길동');
    const store = createStore(`안녕하세요. ${RECIPIENT_PLACEHOLDER}님.`);

    await expect(prefillComposer(store, document, matchingReplyPage)).resolves.toBe(true);

    expect(body.innerHTML).toBe('안녕하세요. 홍길동님.<br><br><p>Quoted content</p>');
  });

  it('fails closed when phrase storage is unavailable', async () => {
    const body = installFixture('Existing text');
    const store: PhraseStore = {
      load: vi.fn(async () => {
        throw new Error('synthetic storage failure');
      }),
      save: vi.fn(async () => undefined),
    };

    await expect(prefillNewComposer(store, document, matchingPage)).resolves.toBe(false);
    expect(body.textContent).toBe('Existing text');
  });

  it('observes a delayed body and disconnects after insertion', async () => {
    document.body.innerHTML = '<h2 data-marker>메일쓰기</h2>';
    markVisible('[data-marker]');
    const store = createStore('Delayed phrase');
    const observer = observeNewComposer(store, document, matchingPage);
    const body = document.createElement('div');
    body.className = 'note-editable';
    body.setAttribute('contenteditable', 'true');
    body.dataset.body = 'true';
    document.body.append(body);
    markVisible('[data-body]');

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(body.textContent).toBe('Delayed phrase');
    expect(store.load).toHaveBeenCalledTimes(1);
    observer?.disconnect();
  });

  it('observes a delayed body outside the recipient list subtree', async () => {
    document.body.innerHTML = `
      <h2 data-marker>메일쓰기</h2>
      <div data-recipient-parent><select id="selectrcvuser" name="selectrcvuser"></select></div>
      <div data-editor-parent></div>
    `;
    markVisible('[data-marker]');
    const store = createStore('Delayed sibling phrase');
    const observer = observeNewComposer(store, document, matchingPage);
    const body = document.createElement('div');
    body.className = 'note-editable';
    body.setAttribute('contenteditable', 'true');
    body.dataset.body = 'true';
    document.querySelector('[data-editor-parent]')!.append(body);
    markVisible('[data-body]');

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(body.textContent).toBe('Delayed sibling phrase');
    expect(store.load).toHaveBeenCalledTimes(1);
    observer?.disconnect();
  });

  it('observes a delayed reply body and disconnects after insertion', async () => {
    document.title = '메일쓰기';
    document.body.className = 'memo';
    document.body.innerHTML = '';
    const store = createStore('Reply phrase');
    const observer = observeComposer(store, document, matchingReplyPage);
    const body = document.createElement('div');
    body.className = 'note-editable';
    body.setAttribute('contenteditable', 'true');
    body.dataset.body = 'true';
    body.innerHTML = '<br><br><p>Quoted content</p>';
    document.body.append(body);
    markVisible('[data-body]');

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(body.innerHTML).toBe('Reply phrase<br><br><p>Quoted content</p>');
    expect(store.load).toHaveBeenCalledTimes(1);
    observer?.disconnect();
  });

  it('keeps observing until the first recipient is available', async () => {
    const body = installReplyFixture('Existing content');
    const store = createStore(`안녕하세요. ${RECIPIENT_PLACEHOLDER}님.`);
    const observer = observeComposer(store, document, matchingReplyPage);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(body.textContent).toBe('Existing content');

    addRecipient('홍길동');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(body.textContent).toBe('안녕하세요. 홍길동님.Existing content');
    observer?.disconnect();
  });

  it.each([
    ['전산주사', '팀장님'],
    ['주사보', '팀장님'],
    ['전산서기', '선생님'],
    ['', '선생님'],
  ])('fills the honorific for position %s after recipient metadata arrives', async (position, honorific) => {
    const body = installFixture('Existing text');
    const store = createRankStore(`안녕하세요. ${RANK_PLACEHOLDER}.`, '선생님');
    const observer = observeNewComposer(store, document, matchingPage);

    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      const textBeforeAddingRecipient = body.textContent;

      const option = addRecipient('홍길동');
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(body.textContent).toBe('Existing text');

      option.value = `홍길동 / Sample department / ${position} / 미열람`;
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(body.textContent).toBe(`안녕하세요. ${honorific}.Existing text`);
      expect(textBeforeAddingRecipient).toBe('Existing text');
    } finally {
      observer?.disconnect();
    }
  });

  it.each(['username', 'userid'])('observes a recipient that gains %s after attachment', async (attribute) => {
    const body = installReplyFixture('Existing content');
    const list = document.querySelector<HTMLSelectElement>('#selectrcvuser')!;
    const option = document.createElement('option');
    option.text = 'First / Team / Rank / Unread / Recipient';
    list.append(option);
    const store = createStore(`Hello ${RECIPIENT_PLACEHOLDER}. `);
    const observer = observeComposer(store, document, matchingReplyPage);

    await new Promise((resolve) => setTimeout(resolve, 0));
    const initialContent = body.textContent;

    option.setAttribute(attribute, attribute === 'username' ? 'First' : 'synthetic-id');
    await new Promise((resolve) => setTimeout(resolve, 0));
    observer?.disconnect();

    expect(initialContent).toBe('Existing content');
    expect(body.textContent).toBe('Hello First. Existing content');
  });

  it.each([
    ['hidden', ''],
    ['class', 'loading'],
    ['contenteditable', 'false'],
  ])('observes when an attached editor becomes ready through %s', async (attribute, initialValue) => {
    const body = installReplyFixture('Existing content');
    const readyValue = body.getAttribute(attribute);
    body.setAttribute(attribute, initialValue);
    const store = createStore('Hello. ');
    const observer = observeComposer(store, document, matchingReplyPage);

    await new Promise((resolve) => setTimeout(resolve, 0));
    const initialContent = body.textContent;

    if (readyValue === null) {
      body.removeAttribute(attribute);
    } else {
      body.setAttribute(attribute, readyValue);
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
    observer?.disconnect();

    expect(initialContent).toBe('Existing content');
    expect(body.textContent).toBe('Hello. Existing content');
  });

  it('keeps typing after the phrase when it arrives at the caret', async () => {
    const body = installReplyFixture('');
    const store = createStore(`Hello\n${RECIPIENT_PLACEHOLDER}. `);
    const observer = observeComposer(store, document, matchingReplyPage);
    const selection = document.getSelection()!;
    body.focus();
    selection.collapse(body, 0);

    addRecipient('First');
    await new Promise((resolve) => setTimeout(resolve, 0));
    observer?.disconnect();

    selection.getRangeAt(0).insertNode(document.createTextNode('Typed'));
    selection.removeAllRanges();
    expect(body.innerHTML).toBe('Hello<br>First. Typed');
  });

  it('leaves a selection inside existing content in place', () => {
    const body = installReplyFixture('Existing content');
    const text = body.firstChild!;
    const selection = document.getSelection()!;
    selection.setBaseAndExtent(text, 2, text, 8);

    expect(insertPhraseOnce(body, 'Hello. ')).toBe(true);
    expect(selection.anchorNode).toBe(text);
    expect(selection.anchorOffset).toBe(2);
    expect(selection.focusNode).toBe(text);
    expect(selection.focusOffset).toBe(8);
    selection.removeAllRanges();
  });

  it('prefills a configured rank without changing the placeholder token', async () => {
    const body = installFixture('Existing text');
    const store = createRankStore(`안녕하세요. ${RANK_PLACEHOLDER}`, '연구사님');

    await expect(prefillComposer(store, document, matchingPage)).resolves.toBe(true);
    expect(body.textContent).toBe('안녕하세요. 연구사님Existing text');
  });

  it('waits when a rank placeholder has no configured value', async () => {
    const body = installFixture('Existing text');
    const store = createStore(`안녕하세요. ${RANK_PLACEHOLDER}`);

    await expect(prefillComposer(store, document, matchingPage)).resolves.toBe(false);
    expect(body.textContent).toBe('Existing text');
  });

  it('ignores editor mutations while waiting for the first recipient', async () => {
    const body = installReplyFixture('<p>Existing content</p>');
    const hiddenEditor = document.createElement('div');
    hiddenEditor.className = 'note-editable';
    hiddenEditor.setAttribute('contenteditable', 'true');
    hiddenEditor.hidden = true;
    body.before(hiddenEditor);
    const store = createStore(`안녕하세요. ${RECIPIENT_PLACEHOLDER}님.`);
    const observer = observeComposer(store, document, matchingReplyPage);

    await new Promise((resolve) => setTimeout(resolve, 0));
    const load = vi.mocked(store.load);
    const loadCountBeforeTyping = load.mock.calls.length;

    body.append(document.createTextNode('typed content'));
    body.querySelector('p')!.className = 'typed';
    document.querySelector('select')!.className = 'unrelated-style';
    await new Promise((resolve) => setTimeout(resolve, 0));
    const loadCountAfterTyping = load.mock.calls.length;

    addRecipient('홍길동');
    await new Promise((resolve) => setTimeout(resolve, 0));
    observer?.disconnect();

    expect(loadCountAfterTyping).toBe(loadCountBeforeTyping);
    expect(body.textContent).toBe('안녕하세요. 홍길동님.Existing contenttyped content');
  });
});
