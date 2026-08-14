import { describe, expect, it } from 'vitest';

import {
  SettingsController,
  type SettingsView,
} from './settings-controller';
import type { PhraseStore } from './settings-store';

class FakeView implements SettingsView {
  public phrase = '';
  public status = '';

  public getPhrase(): string {
    return this.phrase;
  }

  public setPhrase(phrase: string): void {
    this.phrase = phrase;
  }

  public setStatus(message: string): void {
    this.status = message;
  }
}

class FakeStore implements PhraseStore {
  public phrase = '';
  public savedPhrases: string[] = [];
  public shouldFail = false;

  public async load(): Promise<string> {
    if (this.shouldFail) {
      throw new Error('synthetic storage failure');
    }

    return this.phrase;
  }

  public async save(phrase: string): Promise<void> {
    if (this.shouldFail) {
      throw new Error('synthetic storage failure');
    }

    this.phrase = phrase;
    this.savedPhrases.push(phrase);
  }
}

describe('SettingsController', () => {
  it('loads and saves one exact phrase without changing its text', async () => {
    const store = new FakeStore();
    const view = new FakeView();
    const controller = new SettingsController(store, view);
    const phrase = '안녕하세요, <operator> & "team"\n확인 부탁드립니다.';

    view.phrase = phrase;
    await controller.save();
    await controller.load();

    expect(store.savedPhrases).toEqual([phrase]);
    expect(view.phrase).toBe(phrase);
    expect(view.status).toBe('Phrase loaded.');
  });

  it('clears the phrase and keeps empty text disabled', async () => {
    const store = new FakeStore();
    const view = new FakeView();
    const controller = new SettingsController(store, view);

    view.phrase = 'temporary phrase';
    await controller.save();
    await controller.clear();

    expect(store.phrase).toBe('');
    expect(store.savedPhrases).toEqual(['temporary phrase', '']);
    expect(view.phrase).toBe('');
    expect(view.status).toBe('Phrase cleared.');
  });

  it('reports storage failures without exposing stored text', async () => {
    const store = new FakeStore();
    const view = new FakeView();
    const controller = new SettingsController(store, view);

    store.shouldFail = true;
    view.phrase = 'synthetic phrase';
    await controller.save();

    expect(view.status).toBe('Could not save the phrase. Try again.');
    expect(view.status).not.toContain(view.phrase);
  });
});
