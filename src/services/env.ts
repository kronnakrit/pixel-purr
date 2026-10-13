// Small shared helpers: where we run, persistent key-value storage, dev flags and logging.
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

export type Os = 'ios' | 'android' | 'web';

export function detectOs(): Os {
  const p = Capacitor.getPlatform();
  return p === 'ios' || p === 'android' ? p : 'web';
}

export const isNative = (): boolean => Capacitor.isNativePlatform();

/** Vite dev server or tests; false in `vite build` output. */
export const DEV: boolean = import.meta.env.DEV;

export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

/** Capacitor Preferences: UserDefaults / SharedPreferences on the phone, localStorage on the web. */
export const preferencesStore = (): KeyValueStore => ({
  get: async key => (await Preferences.get({ key })).value,
  set: (key, value) => Preferences.set({ key, value }),
});

/** In-memory store for tests and dev pages. */
export function memoryStore(seed: Record<string, string> = {}): KeyValueStore & { data: Map<string, string> } {
  const data = new Map(Object.entries(seed));
  return {
    data,
    async get(key) { return data.get(key) ?? null; },
    async set(key, value) { data.set(key, value); },
  };
}

/** Reads a dev/test switch from localStorage (e.g. 'pp.mock.adsFail'). Never throws: storage can be blocked. */
export function localFlag(key: string): string | null {
  try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; }
}

export function setLocalFlag(key: string, value: string | null): void {
  try {
    if (value === null) globalThis.localStorage?.removeItem(key);
    else globalThis.localStorage?.setItem(key, value);
  } catch { /* storage blocked: the flag just doesn't stick */ }
}

export const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));

/** Resolves with the promise's value, or `fallback` after `ms` (the promise keeps running). */
export function withTimeout<T, F>(p: Promise<T>, ms: number, fallback: F): Promise<T | F> {
  return new Promise<T | F>(resolve => {
    const t = setTimeout(() => resolve(fallback), ms);
    p.then(v => { clearTimeout(t); resolve(v); }, () => { clearTimeout(t); resolve(fallback); });
  });
}

export const errText = (e: unknown): string =>
  e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String(e.message) : String(e);

/** Scoped logger. info is dev-only; warnings also go to the native console (Xcode / Logcat) in release builds. */
export const logger = (scope: string) => ({
  info: (...a: unknown[]) => { if (DEV) console.info(`[${scope}]`, ...a); },
  warn: (...a: unknown[]) => console.warn(`[${scope}]`, ...a),
});
