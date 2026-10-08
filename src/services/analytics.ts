// Analytics: one event/screen API for the whole app. Logs to the console in dev and does nothing in release builds
// until a sink is plugged in (Firebase Analytics later: setSink(e => FirebaseAnalytics.logEvent(...))).
import type { AnalyticsApi } from '../app/contracts';
import { DEV } from './env';

export type AnalyticsParams = Record<string, string | number | boolean>;
export type AnalyticsEntry = { kind: 'event'; name: string; params?: AnalyticsParams } | { kind: 'screen'; name: string };
export type AnalyticsSink = (e: AnalyticsEntry) => void;

export interface Analytics extends AnalyticsApi {
  /** Route every event and screen to a backend. null unplugs it. */
  setSink(fn: AnalyticsSink | null): void;
}

/** Firebase's rule for event and parameter names; checked in dev so names stay valid when Firebase arrives. */
const NAME = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;

export function createAnalytics(opts: { dev?: boolean; log?: (...a: unknown[]) => void } = {}): Analytics {
  const dev = opts.dev ?? DEV, log = opts.log ?? ((...a: unknown[]) => console.debug(...a));
  let sink: AnalyticsSink | null = null;

  const emit = (e: AnalyticsEntry) => {
    if (dev) {
      const bad = [e.name, ...(e.kind === 'event' ? Object.keys(e.params ?? {}) : [])].filter(n => !NAME.test(n));
      log(`[analytics] ${e.kind} ${e.name}`, e.kind === 'event' && e.params ? e.params : '', bad.length ? `(invalid names: ${bad.join(', ')})` : '');
    }
    if (!sink) return;
    try { sink(e); } catch (err) { if (dev) log('[analytics] sink failed', err); } // analytics must never break the game
  };

  return {
    event(name, params) { emit(params ? { kind: 'event', name, params: { ...params } } : { kind: 'event', name }); },
    screen(name) { emit({ kind: 'screen', name }); },
    setSink(fn) { sink = fn; },
  };
}
