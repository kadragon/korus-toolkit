import { describe, expect, it } from 'vitest';

import {
  SettingsController,
  type SettingsView,
} from './settings-controller';
import type { PhraseSettings, PhraseStore } from './settings-store';

class FakeView implements SettingsView {
  public phrase = '';
  public placeholder = '';
  public status = '';

  public getPhrase(): string {
    return this.phrase;
  }

  public setPhrase(phrase: string): void {
    this.phrase = phrase;
  }

  public getPlaceholder(): string {
    return this.placeholder;
  }

  public setPlaceholder(placeholder: string): void {
    this.placeholder = placeholder;
  }

  public setStatus(message: string): void {
    this.status = message;
  }
}

class FakeStore implements PhraseStore {
  public settings: PhraseSettings = { phrase: '', placeholder: '' };
  public savedSettings: PhraseSettings[] = [];
  public shouldFail = false;

  public async load(): Promise<PhraseSettings> {
    if (this.shouldFail) {
      throw new Error('synthetic storage failure');
    }

    return this.settings;
  }

  public async save(settings: PhraseSettings): Promise<void> {
    if (this.shouldFail) {
      throw new Error('synthetic storage failure');
    }

    this.settings = settings;
    this.savedSettings.push(settings);
  }
}

describe('SettingsController', () => {
  it('loads and saves exact phrase and placeholder values', async () => {
    const store = new FakeStore();
    const view = new FakeView();
    const controller = new SettingsController(store, view);
    const phrase = '안녕하세요, <operator> & "team"\n확인 부탁드립니다.';
    const placeholder = '총장님';

    view.phrase = phrase;
    view.placeholder = placeholder;
    await controller.save();
    await controller.load();

    expect(store.savedSettings).toEqual([{ phrase, placeholder }]);
    expect(view.phrase).toBe(phrase);
    expect(view.placeholder).toBe(placeholder);
    expect(view.status).toBe('설정을 불러왔어요.');
  });

  it('clears the phrase and placeholder together', async () => {
    const store = new FakeStore();
    const view = new FakeView();
    const controller = new SettingsController(store, view);

    view.phrase = 'temporary phrase';
    view.placeholder = '팀장님';
    await controller.save();
    await controller.clear();

    expect(store.settings).toEqual({ phrase: '', placeholder: '' });
    expect(store.savedSettings).toEqual([
      { phrase: 'temporary phrase', placeholder: '팀장님' },
      { phrase: '', placeholder: '' },
    ]);
    expect(view.phrase).toBe('');
    expect(view.placeholder).toBe('');
    expect(view.status).toBe('설정을 초기화했어요.');
  });

  it('reports storage failures without exposing stored text', async () => {
    const store = new FakeStore();
    const view = new FakeView();
    const controller = new SettingsController(store, view);

    store.shouldFail = true;
    view.phrase = 'synthetic phrase';
    await controller.save();

    expect(view.status).toBe('설정을 저장하지 못했어요. 다시 시도해 주세요.');
    expect(view.status).not.toContain(view.phrase);
  });
});
