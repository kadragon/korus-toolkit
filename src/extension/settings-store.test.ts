import { describe, expect, it } from 'vitest';

import {
  createPhraseStore,
  isPhraseEnabled,
  PREFILL_PHRASE_KEY,
  type ExtensionApi,
} from './settings-store';

function createFakeApi(initialValue: unknown): {
  api: ExtensionApi;
  getStoredValue: () => unknown;
  setItems: Record<string, string>[];
} {
  let value = initialValue;
  const setItems: Record<string, string>[] = [];

  const api: ExtensionApi = {
    storage: {
      local: {
        get: (_keys, callback) => callback({ [PREFILL_PHRASE_KEY]: value }),
        set: (items, callback) => {
          setItems.push(items);
          value = items[PREFILL_PHRASE_KEY];
          callback();
        },
      },
    },
  };

  return { api, getStoredValue: () => value, setItems };
}

describe('phrase storage adapter', () => {
  it('loads only a string phrase and treats other stored values as empty', async () => {
    const stringStore = createFakeApi('synthetic phrase');
    const nonStringStore = createFakeApi({ unexpected: true });

    await expect(createPhraseStore(stringStore.api).load()).resolves.toBe('synthetic phrase');
    await expect(createPhraseStore(nonStringStore.api).load()).resolves.toBe('');
  });

  it('writes exactly one local-storage field and preserves special characters', async () => {
    const fake = createFakeApi('');
    const phrase = '<tag> & "quote"\nsecond line';

    await createPhraseStore(fake.api).save(phrase);

    expect(fake.getStoredValue()).toBe(phrase);
    expect(fake.setItems).toEqual([{ [PREFILL_PHRASE_KEY]: phrase }]);
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
