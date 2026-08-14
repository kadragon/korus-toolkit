export const PREFILL_PHRASE_KEY = 'prefillPhrase';

export interface PhraseStore {
  load(): Promise<string>;
  save(phrase: string): Promise<void>;
}

export interface ExtensionStorageArea {
  get(keys: string, callback: (items: Record<string, unknown>) => void): void;
  set(items: Record<string, string>, callback: () => void): void;
}

export interface ExtensionApi {
  storage: {
    local: ExtensionStorageArea;
  };
  runtime?: {
    lastError?: unknown;
  };
}

export function getExtensionApi(): ExtensionApi {
  const api = (globalThis as typeof globalThis & { chrome?: ExtensionApi }).chrome;
  if (!api?.storage?.local) {
    throw new Error('Extension storage is unavailable.');
  }

  return api;
}

export function createPhraseStore(api: ExtensionApi = getExtensionApi()): PhraseStore {
  return {
    load: () =>
      new Promise<string>((resolve, reject) => {
        api.storage.local.get(PREFILL_PHRASE_KEY, (items) => {
          if (api.runtime?.lastError) {
            reject(new Error('Could not load the prefill phrase.'));
            return;
          }

          const phrase = items[PREFILL_PHRASE_KEY];
          resolve(typeof phrase === 'string' ? phrase : '');
        });
      }),
    save: (phrase) =>
      new Promise<void>((resolve, reject) => {
        api.storage.local.set({ [PREFILL_PHRASE_KEY]: phrase }, () => {
          if (api.runtime?.lastError) {
            reject(new Error('Could not save the prefill phrase.'));
            return;
          }

          resolve();
        });
      }),
  };
}

export function isPhraseEnabled(phrase: string): boolean {
  return phrase.length > 0;
}
