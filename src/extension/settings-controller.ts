import { isPhraseEnabled, type PhraseStore } from './settings-store';

export interface SettingsView {
  getPhrase(): string;
  setPhrase(phrase: string): void;
  setStatus(message: string): void;
}

export class SettingsController {
  public constructor(
    private readonly store: PhraseStore,
    private readonly view: SettingsView,
  ) {}

  public async load(): Promise<void> {
    try {
      this.view.setPhrase(await this.store.load());
      this.view.setStatus('Phrase loaded.');
    } catch {
      this.view.setStatus('Could not load the phrase. Try again.');
    }
  }

  public async save(): Promise<void> {
    const phrase = this.view.getPhrase();

    try {
      await this.store.save(phrase);
      this.view.setStatus(isPhraseEnabled(phrase) ? 'Phrase saved.' : 'Phrase cleared.');
    } catch {
      this.view.setStatus('Could not save the phrase. Try again.');
    }
  }

  public async clear(): Promise<void> {
    try {
      await this.store.save('');
      this.view.setPhrase('');
      this.view.setStatus('Phrase cleared.');
    } catch {
      this.view.setStatus('Could not clear the phrase. Try again.');
    }
  }
}
