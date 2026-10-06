// Where the profile lives. On the phone: Capacitor Preferences (UserDefaults / SharedPreferences), which survive
// WebView storage clean-ups. On the web the plugin falls back to localStorage.
import { Preferences } from '@capacitor/preferences';

export interface MetaStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export const preferencesStorage = (): MetaStorage => ({
  get: async key => (await Preferences.get({ key })).value,
  set: (key, value) => Preferences.set({ key, value }),
});

/** In-memory storage for tests and dev pages. `data` is exposed so callers can inspect or seed it. */
export function memoryStorage(seed: Record<string, string> = {}): MetaStorage & { data: Map<string, string>; writes: number } {
  const data = new Map(Object.entries(seed));
  return {
    data,
    writes: 0,
    async get(key) { return data.get(key) ?? null; },
    async set(key, value) { this.writes++; data.set(key, value); },
  };
}
