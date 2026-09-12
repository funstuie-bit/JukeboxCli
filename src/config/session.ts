import { saveConfig, type Config } from "./config";

/** Keep launch-only values separate from preferences explicitly changed in the UI. */
export class ConfigSession {
  private saved: Config;
  private effective: Config;
  private writing: Promise<void> = Promise.resolve();

  constructor(saved: Config, overrides: Partial<Config> = {}, private persist = saveConfig) {
    this.saved = { ...saved };
    this.effective = { ...saved, ...overrides };
  }

  get(): Config { return { ...this.effective }; }

  save(next: Config): Promise<void> {
    // Callers pass the whole visible config. Save only fields they changed,
    // not unchanged CLI values carried along by object spreading.
    const changes: Partial<Config> = {};
    for (const key of new Set([...Object.keys(this.effective), ...Object.keys(next)]) as Set<keyof Config>) {
      if (!Object.is(next[key], this.effective[key])) Object.assign(changes, { [key]: next[key] });
    }
    this.effective = { ...next };
    if (!Object.keys(changes).length) return this.writing;
    this.saved = { ...this.saved, ...changes };
    const snapshot = { ...this.saved };
    // Serialize writes so rapid toggles cannot finish in the wrong order.
    this.writing = this.writing.catch(() => {}).then(() => this.persist(snapshot));
    return this.writing;
  }
}
