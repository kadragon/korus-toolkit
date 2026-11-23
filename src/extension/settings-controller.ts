import { isPhraseEnabled, type PhraseSettings, type PhraseStore } from './settings-store';

export interface SettingsView {
  getPhrase(): string;
  setPhrase(phrase: string): void;
  getPlaceholder(): string;
  setPlaceholder(placeholder: string): void;
  setStatus(message: string): void;
}

export class SettingsController {
  public constructor(
    private readonly store: PhraseStore,
    private readonly view: SettingsView,
  ) {}

  public async load(): Promise<void> {
    try {
      const settings = await this.store.load();
      this.view.setPhrase(settings.phrase);
      this.view.setPlaceholder(settings.placeholder);
      this.view.setStatus('설정을 불러왔어요.');
    } catch {
      this.view.setStatus('설정을 불러오지 못했어요. 다시 시도해 주세요.');
    }
  }

  public async save(): Promise<void> {
    const settings: PhraseSettings = {
      phrase: this.view.getPhrase(),
      placeholder: this.view.getPlaceholder(),
    };

    try {
      await this.store.save(settings);
      this.view.setStatus(
        isPhraseEnabled(settings.phrase) ? '설정을 저장했어요.' : '설정을 초기화했어요.',
      );
    } catch {
      this.view.setStatus('설정을 저장하지 못했어요. 다시 시도해 주세요.');
    }
  }

  public async clear(): Promise<void> {
    try {
      await this.store.save({ phrase: '', placeholder: '' });
      this.view.setPhrase('');
      this.view.setPlaceholder('');
      this.view.setStatus('설정을 초기화했어요.');
    } catch {
      this.view.setStatus('설정을 초기화하지 못했어요. 다시 시도해 주세요.');
    }
  }
}
