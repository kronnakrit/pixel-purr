import { afterEach, describe, expect, it, vi } from 'vitest';
import { memoryStore } from '../../src/services/env';
import { createRemoteConfig, parseConfig, RC_CACHE_KEY, REMOTE_DEFAULTS, sameKind, type FetchJson } from '../../src/services/remoteConfig';

const URL = 'https://example.test/pixel-purr.json';
const ok = (doc: unknown): FetchJson => async () => doc;
const failing: FetchJson = async () => { throw new Error('offline'); };
const make = (o: { url?: string; fetchJson?: FetchJson; seed?: Record<string, string>; timeoutMs?: number } = {}) => {
  const store = memoryStore(o.seed);
  const rc = createRemoteConfig({ url: o.url ?? '', timeoutMs: o.timeoutMs ?? 2500, store, fetchJson: o.fetchJson ?? failing });
  return { rc, store };
};

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('parseConfig', () => {
  it('accepts JSON objects (or their text) and rejects anything else', () => {
    expect(parseConfig({ a: 1 })).toEqual({ a: 1 });
    expect(parseConfig('{"interstitialEnabled":false}')).toEqual({ interstitialEnabled: false });
    for (const bad of [null, 3, 'nope', '[1,2]', [1], '{oops']) expect(parseConfig(bad)).toBeNull();
  });

  it('drops invalid values for known keys and keeps the rest', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(parseConfig({ beltStepsPerSec: 'fast', interstitialEnabled: 1, economy: [], extra: 'x' })).toEqual({ extra: 'x' });
    expect(parseConfig({ beltStepsPerSec: 2 })).toEqual({}); // out of range would make the game crawl
    expect(parseConfig({ beltStepsPerSec: 40, economy: { winCoins: 25 } })).toEqual({ beltStepsPerSec: 40, economy: { winCoins: 25 } });
  });
});

describe('sameKind', () => {
  it('compares JSON kinds against the fallback', () => {
    expect(sameKind(3, 1)).toBe(true);
    expect(sameKind(Number.NaN, 1)).toBe(false);
    expect(sameKind('3', 1)).toBe(false);
    expect(sameKind({}, {})).toBe(true);
    expect(sameKind([], {})).toBe(false);
    expect(sameKind([], [])).toBe(true);
    expect(sameKind(false, true)).toBe(true);
    expect(sameKind(undefined, true)).toBe(false);
  });
});

describe('remote config', () => {
  it('serves the code defaults before and without a URL', async () => {
    const { rc } = make();
    expect(rc.get('beltStepsPerSec', 0)).toBe(36);
    await rc.init();
    expect(rc.source).toBe('defaults');
    expect(rc.get('beltStepsPerSec', 0)).toBe(36);
    expect(rc.get('interstitialEnabled', false)).toBe(true);
    expect(rc.get('economy', {})).toEqual({});
    expect(rc.get('unknownKey', 'fallback')).toBe('fallback');
    expect(REMOTE_DEFAULTS.beltStepsPerSec).toBe(36);
  });

  it('applies a fetched config and caches it', async () => {
    const { rc, store } = make({ url: URL, fetchJson: ok({ beltStepsPerSec: 42, economy: { winCoins: 25 }, interstitialEnabled: false }) });
    await rc.init();
    expect(rc.source).toBe('remote');
    expect(rc.get('beltStepsPerSec', 36)).toBe(42);
    expect(rc.get('economy', {})).toEqual({ winCoins: 25 });
    expect(rc.get('interstitialEnabled', true)).toBe(false);
    expect(JSON.parse(store.data.get(RC_CACHE_KEY)!)).toEqual({ beltStepsPerSec: 42, economy: { winCoins: 25 }, interstitialEnabled: false });
  });

  it('type-checks reads: a wrong kind falls back to the code default, then to the caller fallback', async () => {
    const { rc } = make({ url: URL, fetchJson: ok({ beltStepsPerSec: 50, label: 'x' }) });
    await rc.init();
    expect(rc.get('beltStepsPerSec', 'a string')).toBe('a string'); // neither remote nor default is a string
    expect(rc.get('label', 7)).toBe(7);
    expect(rc.get('label', '')).toBe('x');
  });

  it('uses the cached copy at the next launch when the network is down', async () => {
    const first = make({ url: URL, fetchJson: ok({ beltStepsPerSec: 44 }) });
    await first.rc.init();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const seed = Object.fromEntries(first.store.data);
    const second = make({ url: URL, fetchJson: failing, seed });
    await second.rc.init();
    expect(second.rc.source).toBe('cache');
    expect(second.rc.get('beltStepsPerSec', 36)).toBe(44);
  });

  it('keeps the old cache when the server sends garbage', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const seed = { [RC_CACHE_KEY]: JSON.stringify({ beltStepsPerSec: 30 }) };
    const { rc, store } = make({ url: URL, fetchJson: ok('<html>404</html>'), seed });
    await rc.init();
    expect(rc.source).toBe('cache');
    expect(rc.get('beltStepsPerSec', 36)).toBe(30);
    expect(store.data.get(RC_CACHE_KEY)).toBe(JSON.stringify({ beltStepsPerSec: 30 }));
  });

  it('ignores a corrupt cache', async () => {
    const { rc } = make({ seed: { [RC_CACHE_KEY]: '{not json' } });
    await rc.init();
    expect(rc.source).toBe('defaults');
    expect(rc.get('beltStepsPerSec', 0)).toBe(36);
  });

  it('does not hold the boot for a slow server: values stay put, the fresh copy is saved for next launch', async () => {
    vi.useFakeTimers();
    let deliver!: (v: unknown) => void;
    const slow: FetchJson = () => new Promise(r => { deliver = r; });
    const seed = { [RC_CACHE_KEY]: JSON.stringify({ beltStepsPerSec: 30 }) };
    const { rc, store } = make({ url: URL, fetchJson: slow, seed, timeoutMs: 1000 });
    const done = rc.init();
    await vi.advanceTimersByTimeAsync(1000);
    await done;
    expect(rc.source).toBe('cache');
    deliver({ beltStepsPerSec: 50 });
    await vi.advanceTimersByTimeAsync(0);
    expect(rc.get('beltStepsPerSec', 36)).toBe(30); // never changes mid-session
    expect(JSON.parse(store.data.get(RC_CACHE_KEY)!)).toEqual({ beltStepsPerSec: 50 });
  });

  it('init runs once', async () => {
    const fetchJson = vi.fn(ok({ beltStepsPerSec: 40 }));
    const { rc } = make({ url: URL, fetchJson });
    await Promise.all([rc.init(), rc.init()]);
    await rc.init();
    expect(fetchJson).toHaveBeenCalledTimes(1);
  });
});
