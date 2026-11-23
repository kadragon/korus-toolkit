import { describe, expect, it } from 'vitest';

import {
  createPhraseStore,
  isPhraseEnabled,
  PREFILL_PLACEHOLDER_KEY,
  PREFILL_PHRASE_KEY,
  type PhraseSettings,
  type ExtensionApi,
} from './settings-store';

function createFakeApi(initialPhrase: unknown, initialPlaceholder: unknown = ''): {
  api: ExtensionApi;
  getStoredSettings: () => { phrase: unknown; placeholder: unknown };
  setItems: Record<string, string>[];
} {
  let phrase = initialPhrase;
  let placeholder = initialPlaceholder;
  const setItems: Record<string, string>[] = [];

  const api: ExtensionApi = {
    storage: {
      local: {
        get: (_keys, callback) =>
          callback({
            [PREFILL_PHRASE_KEY]: phrase,
            [PREFILL_PLACEHOLDER_KEY]: placeholder,
          }),
        set: (items, callback) => {
          setItems.push(items);
          phrase = items[PREFILL_PHRASE_KEY];
          placeholder = items[PREFILL_PLACEHOLDER_KEY];
          callback();
        },
      },
    },
  };

  return {
    api,
    getStoredSettings: () => ({ phrase, placeholder }),
    setItems,
  };
}

describe('phrase storage adapter', () => {
  it('loads only string settings and treats other stored values as empty', async () => {
    const stringStore = createFakeApi('synthetic phrase', '팀장님');
    const nonStringStore = createFakeApi({ unexpected: true }, ['unexpected']);

    await expect(createPhraseStore(stringStore.api).load()).resolves.toEqual({
      phrase: 'synthetic phrase',
      placeholder: '팀장님',
    });
    await expect(createPhraseStore(nonStringStore.api).load()).resolves.toEqual({
      phrase: '',
      placeholder: '',
    });
  });

  it('writes exactly two local-storage fields and preserves special characters', async () => {
    const fake = createFakeApi('');
    const settings: PhraseSettings = {
      phrase: '<tag> & "quote"\nsecond line',
      placeholder: '연구사님 & "quote"',
    };

    await createPhraseStore(fake.api).save(settings);

    expect(fake.getStoredSettings()).toEqual(settings);
    expect(fake.setItems).toEqual([
      {
        [PREFILL_PHRASE_KEY]: settings.phrase,
        [PREFILL_PLACEHOLDER_KEY]: settings.placeholder,
      },
    ]);
  });

  it('rejects browser storage errors with a non-sensitive message', async () => {
    const fake = createFakeApi('synthetic phrase');
    fake.api.runtime = { lastError: { message: 'synthetic internal detail' } };

    await expect(createPhraseStore(fake.api).load()).rejects.toThrow(
      'Could not load the prefill phrase.',
    );
  });

  it('enables insertion only for a non-empty phrase', () => {
    expect(isPhraseEnabled('')).toBe(false);
    expect(isPhraseEnabled(' ')).toBe(true);
    expect(isPhraseEnabled('synthetic phrase')).toBe(true);
  });
});
