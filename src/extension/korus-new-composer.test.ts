// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';

import {
  findComposerBody,
  findNewComposerBody,
  insertPhraseOnce,
  isComposerPage,
  isNewComposerPage,
  isReplyComposerPage,
  prefillComposer,
  prefillNewComposer,
  REPLY_COMPOSER_PATH,
  type PageLocation,
} from './korus-new-composer';
import { observeComposer, observeNewComposer } from './content-script';
import type { PhraseStore } from './settings-store';

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
  `;
  markVisible('[data-body]');
  return document.querySelector<HTMLDivElement>('[data-body]')!;
}

function createStore(phrase: string): PhraseStore {
  return {
    load: vi.fn(async () => phrase),
    save: vi.fn(async () => undefined),
  };
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
});
