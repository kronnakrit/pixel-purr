// Ads: AdMob rewarded videos and interstitials on the phone, a mock overlay on the web.
// Native flow: initialize → consent info (UMP form when required) → iOS tracking prompt → preload both formats.
// Every ad is reloaded after it closes, failed loads retry with backoff, and nothing ever throws to the caller.
import type { AdsApi, RewardedPlacement } from '../app/contracts';
import { ADMOB, isTestAdId } from './config';
import { DEV, errText, localFlag, logger, sleep, type Os } from './env';
import type { MockAdUi } from './mockAd';

export type AdKind = 'rewarded' | 'interstitial';
export type AdEvent = 'rewarded' | 'rewardDismissed' | 'rewardFailedToShow' | 'interstitialDismissed' | 'interstitialFailedToShow';

export interface ConsentInfo {
  status: 'NOT_REQUIRED' | 'OBTAINED' | 'REQUIRED' | 'UNKNOWN';
  isConsentFormAvailable?: boolean;
  canRequestAds: boolean;
  privacyOptionsRequirementStatus?: 'NOT_REQUIRED' | 'REQUIRED' | 'UNKNOWN';
}

/** The AdMob calls this module makes, as a narrow interface so tests can drive it with a fake. */
export interface AdMobBridge {
  initialize(): Promise<void>;
  requestConsentInfo(): Promise<ConsentInfo>;
  showConsentForm(): Promise<ConsentInfo>;
  showPrivacyOptionsForm(): Promise<void>;
  trackingStatus(): Promise<'authorized' | 'denied' | 'notDetermined' | 'restricted'>;
  requestTracking(): Promise<void>;
  /** Loads one ad of this kind for the ad unit. Rejects when no ad could be loaded. */
  prepare(kind: AdKind, adId: string): Promise<void>;
  /** Presents the loaded ad. Rewarded: resolves only when the reward is earned. Interstitial: resolves once presented. */
  show(kind: AdKind, adId: string): Promise<unknown>;
  on(event: AdEvent, cb: () => void): Promise<void>;
}

export interface Ads extends AdsApi {
  interstitialReady(): boolean;
  /** Called with true while a full-screen ad covers the game (pause the loop and music), false when it is gone. */
  onFullscreen(cb: (showing: boolean) => void): () => void;
  /** UMP says the player must be able to change their ad consent: show a "Privacy choices" button in settings. */
  readonly privacyOptionsRequired: boolean;
  showPrivacyOptions(): Promise<void>;
  /** Retry whatever is missing now (consent info, ad loads). Called automatically when the app resumes. */
  wake(): void;
}

export interface AdsDeps {
  native: boolean;
  os: Os;
  /** Native: loads the AdMob plugin (lazily, so web builds never touch it). */
  bridge?: () => Promise<AdMobBridge>;
  /** Web: shows the mock ad overlay. */
  mockUi?: MockAdUi;
  mockSeconds?: number;
  /** Reads dev switches ('pp.mock.adsFail' = '1' makes the mock fail). */
  flag?: (key: string) => string | null;
  track?: (name: string, params: Record<string, string | number | boolean>) => void;
  /** Remote kill switch for interstitials. */
  interstitialAllowed?: () => boolean;
  /** Subscribe to app resume (used to retry loads). */
  onResume?: (cb: () => void) => void;
  /** How long after a rewarded ad closes we still accept its reward callback. */
  rewardGraceMs?: number;
  /** Delay before load retry n (1-based). */
  backoffMs?: (attempt: number) => number;
  now?: () => number;
}

const log = logger('ads');
/** AdMob ads expire an hour after loading; refresh a little before. */
const AD_TTL_MS = 55 * 60_000;
export const defaultBackoff = (n: number) => Math.min(5 * 60_000, 2000 * 2 ** (n - 1)); // 2 s, 4 s, 8 s … 5 min

export function createAds(d: AdsDeps): Ads {
  return d.native ? nativeAds(d) : mockAds(d);
}

// ---------------------------------------------------------------- shared bits

function fullscreenHub() {
  const cbs = new Set<(on: boolean) => void>();
  return {
    on(cb: (on: boolean) => void) { cbs.add(cb); return () => { cbs.delete(cb); }; },
    emit(on: boolean) { for (const cb of [...cbs]) { try { cb(on); } catch (e) { log.warn('fullscreen handler failed', e); } } },
  };
}

function tracker(d: AdsDeps) {
  return (name: string, params: Record<string, string | number | boolean>) => { try { d.track?.(name, params); } catch { /* never mind */ } };
}

// ---------------------------------------------------------------- web mock

function mockAds(d: AdsDeps): Ads {
  const flag = d.flag ?? localFlag, track = tracker(d), fs = fullscreenHub();
  const failing = () => flag('pp.mock.adsFail') === '1';
  let showing = false;

  async function show(kind: AdKind, placement: RewardedPlacement | null): Promise<boolean> {
    if (showing || failing() || !d.mockUi) {
      if (failing()) log.info('mock ad failed (localStorage pp.mock.adsFail = 1)');
      return false;
    }
    showing = true;
    fs.emit(true);
    try { return await d.mockUi(kind, placement, d.mockSeconds ?? 2); } catch (e) { log.warn('mock ad', e); return false; } finally {
      showing = false;
      fs.emit(false);
    }
  }

  return {
    async init() { log.info('web: mock ads'); },
    rewardedReady: () => !showing && !failing() && !!d.mockUi,
    interstitialReady: () => !showing && !failing() && !!d.mockUi,
    async showRewarded(p) {
      const earned = await show('rewarded', p);
      track('ad_rewarded', { placement: p, result: earned ? 'earned' : 'not_earned' });
      return earned;
    },
    async showInterstitial() {
      if (d.interstitialAllowed && !d.interstitialAllowed()) return false;
      const shown = await show('interstitial', null);
      if (shown) track('ad_interstitial', { result: 'shown' });
      return shown;
    },
    onFullscreen: fs.on,
    privacyOptionsRequired: false,
    async showPrivacyOptions() { log.info('web: no privacy options form'); },
    wake() {},
  };
}

// ---------------------------------------------------------------- native (AdMob)

interface Slot { loaded: boolean; loadedAt: number; loading: boolean; attempts: number; timer: ReturnType<typeof setTimeout> | null }
interface Session { kind: AdKind; reward(): void; dismissed(): void; failed(): void }

function nativeAds(d: AdsDeps): Ads {
  const track = tracker(d), fs = fullscreenHub(), now = d.now ?? Date.now;
  const backoff = d.backoffMs ?? defaultBackoff, graceMs = d.rewardGraceMs ?? 600;
  const os = d.os === 'ios' ? 'ios' : 'android';
  const unit = (k: AdKind) => ADMOB[k][os];
  const slots: Record<AdKind, Slot> = {
    rewarded: { loaded: false, loadedAt: 0, loading: false, attempts: 0, timer: null },
    interstitial: { loaded: false, loadedAt: 0, loading: false, attempts: 0, timer: null },
  };
  let b: AdMobBridge | null = null;
  let stage: 'sdk' | 'consent' | 'ready' = 'sdk', busy = false, canRequest = false, privacyRequired = false, attAsked = false;
  let session: Session | null = null, initP: Promise<void> | null = null;

  const ready = (k: AdKind) => {
    const s = slots[k];
    if (s.loaded && now() - s.loadedAt > AD_TTL_MS) { s.loaded = false; load(k); } // expired: get a fresh one
    return s.loaded && !session;
  };

  function load(k: AdKind) {
    const s = slots[k];
    // Never prepare a kind while it is on screen: the plugin keys ads by unit id and would drop the new one on close.
    if (!b || !canRequest || s.loaded || s.loading || s.timer || session?.kind === k) return;
    s.loading = true;
    b.prepare(k, unit(k)).then(() => {
      s.loading = false; s.loaded = true; s.loadedAt = now(); s.attempts = 0;
      log.info(`${k} loaded`);
    }, e => {
      s.loading = false;
      const wait = backoff(++s.attempts);
      log.info(`${k} failed to load (${errText(e)}), retry ${s.attempts} in ${Math.round(wait / 1000)} s`);
      s.timer = setTimeout(() => { s.timer = null; load(k); }, wait);
    });
  }

  function applyConsent(info: ConsentInfo) {
    canRequest = info.canRequestAds;
    privacyRequired = info.privacyOptionsRequirementStatus === 'REQUIRED';
  }

  /** Moves through sdk → consent → ready as far as it can; safe to call again after a failure. */
  async function advance() {
    if (busy || !b) return;
    busy = true;
    try {
      if (stage === 'sdk') {
        await b.initialize();
        stage = 'consent';
      }
      if (stage === 'consent') {
        let info = await b.requestConsentInfo(); // rejects offline: we stay here and retry on resume
        if (info.isConsentFormAvailable && info.status === 'REQUIRED') {
          info = await b.showConsentForm().catch(e => { log.warn('consent form', errText(e)); return info; });
        }
        applyConsent(info);
        stage = 'ready';
        if (os === 'ios' && !attAsked) {
          attAsked = true;
          // If an IDFA message is published in AdMob, UMP already showed Apple's prompt and the status is decided.
          if ((await b.trackingStatus().catch(() => 'denied' as const)) === 'notDetermined') await b.requestTracking().catch(e => log.warn('tracking prompt', errText(e)));
        }
        log.info(`consent ${info.status}, can request ads: ${canRequest}`);
      }
      if (stage === 'ready' && canRequest) { load('rewarded'); load('interstitial'); }
    } catch (e) {
      log.warn(`${stage === 'sdk' ? 'initialize' : 'consent info'} failed`, errText(e));
    } finally { busy = false; }
  }

  async function setup() {
    b = await (d.bridge ?? loadAdMobBridge)();
    const route = (ev: AdEvent, fn: (s: Session) => void, kind: AdKind) => b!.on(ev, () => { if (session?.kind === kind) fn(session); });
    await Promise.all([
      route('rewarded', s => s.reward(), 'rewarded'),
      route('rewardDismissed', s => s.dismissed(), 'rewarded'),
      route('rewardFailedToShow', s => s.failed(), 'rewarded'),
      route('interstitialDismissed', s => s.dismissed(), 'interstitial'),
      route('interstitialFailedToShow', s => s.failed(), 'interstitial'),
    ]);
    if (!DEV && (isTestAdId(unit('rewarded')) || isTestAdId(unit('interstitial')))) log.warn('using Google test ad units (src/services/config.ts)');
    // Android's initialize rejects while the activity's view isn't attached yet; give it a few tries.
    for (let i = 0; i < 3 && stage === 'sdk'; i++) {
      if (i) await sleep(1000 * i);
      await advance();
    }
    d.onResume?.(wake);
  }

  function wake() {
    if (!b) return;
    if (stage !== 'ready') { void advance(); return; }
    for (const k of ['rewarded', 'interstitial'] as const) {
      const s = slots[k];
      if (s.timer) { clearTimeout(s.timer); s.timer = null; } // back in the app: retry now, keep the backoff count
      load(k);
    }
  }

  /** Shows one ad and settles when it is gone. Rewarded resolves with "reward earned"; interstitial with "shown". */
  function present(k: AdKind): Promise<boolean> {
    slots[k].loaded = false;
    fs.emit(true);
    return new Promise<boolean>(resolve => {
      let earned = false, over = false, grace: ReturnType<typeof setTimeout> | undefined;
      const end = (v: boolean) => {
        if (over) return;
        over = true;
        clearTimeout(grace);
        session = null;
        resolve(v);
      };
      session = k === 'rewarded'
        ? {
          kind: k,
          reward: () => { earned = true; if (grace !== undefined) end(true); },
          // The reward callback can land just after the close on some SDK versions: wait a moment for it.
          dismissed: () => { if (earned) end(true); else grace ??= setTimeout(() => end(earned), graceMs); },
          failed: () => end(earned),
        }
        : { kind: k, reward: () => {}, dismissed: () => end(true), failed: () => end(false) };
      const s = session;
      const bridge = b!;
      Promise.resolve().then(() => bridge.show(k, unit(k))).then( // a synchronous throw becomes a rejection too
        () => { if (k === 'rewarded' && session === s) s.reward(); }, // the plugin resolves a rewarded show on reward
        e => { log.warn(`${k} show failed`, errText(e)); if (session === s) end(k === 'rewarded' ? earned : false); },
      );
    }).finally(() => {
      fs.emit(false);
      load(k);
    });
  }

  return {
    init() { return (initP ??= setup().catch(e => log.warn('ads unavailable', errText(e)))); },
    rewardedReady: () => ready('rewarded'),
    interstitialReady: () => ready('interstitial'),
    async showRewarded(p) {
      try {
        if (!ready('rewarded')) {
          load('rewarded');
          track('ad_rewarded', { placement: p, result: 'not_ready' });
          return false;
        }
        const earned = await present('rewarded');
        track('ad_rewarded', { placement: p, result: earned ? 'earned' : 'not_earned' });
        return earned;
      } catch (e) { log.warn('showRewarded', errText(e)); return false; }
    },
    async showInterstitial() {
      try {
        if (d.interstitialAllowed && !d.interstitialAllowed()) return false;
        if (!ready('interstitial')) { load('interstitial'); return false; }
        const shown = await present('interstitial');
        if (shown) track('ad_interstitial', { result: 'shown' });
        return shown;
      } catch (e) { log.warn('showInterstitial', errText(e)); return false; }
    },
    onFullscreen: fs.on,
    get privacyOptionsRequired() { return privacyRequired; },
    async showPrivacyOptions() {
      if (!b) return;
      try {
        await b.showPrivacyOptionsForm();
        applyConsent(await b.requestConsentInfo());
        if (canRequest) { load('rewarded'); load('interstitial'); }
      } catch (e) { log.warn('privacy options', errText(e)); }
    },
    wake,
  };
}

// ---------------------------------------------------------------- the real plugin

/** Adapts @capacitor-community/admob (v8) to AdMobBridge. Loaded on demand so the web build never imports it. */
export async function loadAdMobBridge(): Promise<AdMobBridge> {
  const m = await import('@capacitor-community/admob');
  const { AdMob } = m;
  const events: Record<AdEvent, string> = {
    rewarded: m.RewardAdPluginEvents.Rewarded,
    rewardDismissed: m.RewardAdPluginEvents.Dismissed,
    rewardFailedToShow: m.RewardAdPluginEvents.FailedToShow,
    interstitialDismissed: m.InterstitialAdPluginEvents.Dismissed,
    interstitialFailedToShow: m.InterstitialAdPluginEvents.FailedToShow,
  };
  // addListener is overloaded per event; all overloads share this runtime shape.
  const listen = AdMob.addListener as unknown as (event: string, cb: () => void) => Promise<unknown>;
  const consentOpts = {
    testDeviceIdentifiers: ADMOB.testDevices,
    ...(ADMOB.consentDebugGeography ? { debugGeography: m.AdmobConsentDebugGeography[ADMOB.consentDebugGeography] } : {}),
  };
  return {
    initialize: () => AdMob.initialize({
      testingDevices: ADMOB.testDevices,
      initializeForTesting: ADMOB.testDevices.length > 0,
      tagForChildDirectedTreatment: ADMOB.tagForChildDirectedTreatment,
      maxAdContentRating: m.MaxAdContentRating[ADMOB.maxAdContentRating],
    }),
    requestConsentInfo: () => AdMob.requestConsentInfo(consentOpts),
    showConsentForm: () => AdMob.showConsentForm(),
    showPrivacyOptionsForm: () => AdMob.showPrivacyOptionsForm(),
    trackingStatus: async () => (await AdMob.trackingAuthorizationStatus()).status,
    requestTracking: () => AdMob.requestTrackingAuthorization(),
    prepare: async (kind, adId) => {
      if (kind === 'rewarded') await AdMob.prepareRewardVideoAd({ adId });
      else await AdMob.prepareInterstitial({ adId });
    },
    show: (kind, adId) => kind === 'rewarded' ? AdMob.showRewardVideoAd({ adId }) : AdMob.showInterstitial({ adId }),
    on: async (event, cb) => { await listen.call(AdMob, events[event], cb); },
  };
}
