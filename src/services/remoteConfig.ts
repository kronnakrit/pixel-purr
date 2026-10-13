// Remote config: defaults in code, optionally overridden by a JSON file on any static host. The last good copy is
// cached in Preferences, so the game boots with it offline. A fresh copy that arrives after the boot timeout is only
// saved for the next launch: values never change mid-session.
import { CapacitorHttp } from '@capacitor/core';
import type { RemoteConfigApi } from '../app/contracts';
import { errText, logger, type KeyValueStore } from './env';

/** Keys the app reads, with their defaults. Unknown keys from the server are kept and type-checked on read. */
export const REMOTE_DEFAULTS: Readonly<Record<string, unknown>> = Object.freeze({
  beltStepsPerSec: 36,
  /** Partial EconomyConfig; meta validates and merges it over DEFAULT_ECONOMY. */
  economy: Object.freeze({}),
  /** Kill switch for interstitials (rewarded ads are always optional and stay on). */
  interstitialEnabled: true,
});

/** Range checks for known keys, so a typo on the server can't break the game. */
const VALID: Record<string, (v: unknown) => boolean> = {
  beltStepsPerSec: v => typeof v === 'number' && Number.isFinite(v) && v >= 6 && v <= 120,
  interstitialEnabled: v => typeof v === 'boolean',
  economy: v => isPlainObject(v),
};

export const RC_CACHE_KEY = 'pp.remoteConfig';

export type FetchJson = (url: string, timeoutMs: number) => Promise<unknown>;

export interface RemoteConfig extends RemoteConfigApi {
  /** Where the current values came from. */
  readonly source: 'defaults' | 'cache' | 'remote';
  /** The overrides in use (without defaults), for debugging. */
  values(): Record<string, unknown>;
}

const log = logger('remoteConfig');

export const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Same JSON kind as the fallback: finite numbers, strings, booleans, arrays, plain objects. */
export function sameKind(v: unknown, fallback: unknown): boolean {
  if (v === undefined) return false;
  if (fallback === null || fallback === undefined) return true; // nothing to check against
  if (typeof fallback === 'number') return typeof v === 'number' && Number.isFinite(v);
  if (Array.isArray(fallback)) return Array.isArray(v);
  if (typeof fallback === 'object') return isPlainObject(v);
  return typeof v === typeof fallback;
}

/** Keeps the valid keys of a config document; null when it isn't a JSON object at all. */
export function parseConfig(raw: unknown): Record<string, unknown> | null {
  let doc = raw;
  if (typeof doc === 'string') { try { doc = JSON.parse(doc); } catch { return null; } }
  if (!isPlainObject(doc)) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(doc)) {
    const check = VALID[k];
    if (check && !check(v)) { log.warn(`ignoring invalid value for "${k}"`, v); continue; }
    if (v !== null && v !== undefined) out[k] = v;
  }
  return out;
}

export function createRemoteConfig(opts: {
  url: string;
  timeoutMs: number;
  store: KeyValueStore;
  fetchJson: FetchJson;
  defaults?: Readonly<Record<string, unknown>>;
}): RemoteConfig {
  const defaults = opts.defaults ?? REMOTE_DEFAULTS;
  let values: Record<string, unknown> = {};
  let source: RemoteConfig['source'] = 'defaults';
  let initP: Promise<void> | null = null;

  async function load() {
    try {
      const cached = parseConfig(await opts.store.get(RC_CACHE_KEY));
      if (cached) { values = cached; source = 'cache'; }
    } catch (e) { log.warn('could not read the cached config', errText(e)); }
    if (!opts.url) return;

    // The fetch has its own, longer limit; boot only waits timeoutMs for it.
    const fresh = opts.fetchJson(opts.url, Math.max(opts.timeoutMs * 4, 10_000)).then(async raw => {
      const cfg = parseConfig(raw);
      if (!cfg) throw new Error('not a JSON object');
      await opts.store.set(RC_CACHE_KEY, JSON.stringify(cfg)).catch(e => log.warn('could not cache the config', errText(e)));
      return cfg;
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<'late'>(r => { timer = setTimeout(() => r('late'), opts.timeoutMs); });
    try {
      const got = await Promise.race([fresh, late]);
      if (got === 'late') {
        log.info('slow network: using the cached config; the fresh one is saved for next launch');
        fresh.catch(e => log.warn('fetch failed', errText(e)));
      } else { values = got; source = 'remote'; }
    } catch (e) {
      log.warn(`fetch failed, using ${source}`, errText(e));
    } finally { clearTimeout(timer); }
  }

  return {
    get source() { return source; },
    values: () => ({ ...values }),
    init() { return (initP ??= load()); },
    get<T>(key: string, fallback: T): T {
      const v = Object.prototype.hasOwnProperty.call(values, key) ? values[key] : undefined; // Object.hasOwn needs iOS 15.4
      if (sameKind(v, fallback)) return v as T;
      const d = defaults[key];
      return sameKind(d, fallback) ? (d as T) : fallback;
    },
  };
}

// ---------------------------------------------------------------- fetchers

/** Native: Capacitor's HTTP plugin (no CORS, works with any static host). */
export const nativeFetchJson: FetchJson = async (url, timeoutMs) => {
  const res = await CapacitorHttp.get({ url, connectTimeout: timeoutMs, readTimeout: timeoutMs, responseType: 'json', headers: { 'Cache-Control': 'no-cache' } });
  if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}`);
  return res.data;
};

/** Web (dev): fetch with an abort timer. */
export const webFetchJson: FetchJson = async (url, timeoutMs) => {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctl.signal, cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally { clearTimeout(t); }
};
