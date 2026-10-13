import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAds, defaultBackoff, type AdEvent, type AdKind, type AdMobBridge, type ConsentInfo } from '../../src/services/ads';
import { ADMOB } from '../../src/services/config';

beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}); vi.spyOn(console, 'info').mockImplementation(() => {}); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('web mock ads', () => {
  const setup = (o: { fail?: boolean; watched?: boolean; allowed?: boolean } = {}) => {
    const ui = vi.fn(async () => o.watched ?? true);
    const track = vi.fn();
    const ads = createAds({
      native: false, os: 'web', mockUi: ui, track,
      flag: k => (k === 'pp.mock.adsFail' && o.fail ? '1' : null),
      interstitialAllowed: () => o.allowed ?? true,
    });
    return { ads, ui, track };
  };

  it('shows the overlay and resolves true when watched', async () => {
    const { ads, ui, track } = setup();
    const fs = vi.fn();
    ads.onFullscreen(fs);
    await ads.init();
    expect(ads.rewardedReady()).toBe(true);
    expect(await ads.showRewarded('continue')).toBe(true);
    expect(ui).toHaveBeenCalledWith('rewarded', 'continue', 2);
    expect(fs.mock.calls).toEqual([[true], [false]]);
    expect(track).toHaveBeenCalledWith('ad_rewarded', { placement: 'continue', result: 'earned' });
    expect(await ads.showInterstitial()).toBe(true);
    expect(ui).toHaveBeenLastCalledWith('interstitial', null, 2);
  });

  it('skipping the mock gives no reward', async () => {
    const { ads } = setup({ watched: false });
    expect(await ads.showRewarded('booster')).toBe(false);
  });

  it('pp.mock.adsFail = 1 makes every ad fail', async () => {
    const { ads, ui } = setup({ fail: true });
    expect(ads.rewardedReady()).toBe(false);
    expect(await ads.showRewarded('lives')).toBe(false);
    expect(await ads.showInterstitial()).toBe(false);
    expect(ui).not.toHaveBeenCalled();
  });

  it('respects the interstitial kill switch', async () => {
    const { ads, ui } = setup({ allowed: false });
    expect(await ads.showInterstitial()).toBe(false);
    expect(ui).not.toHaveBeenCalled();
  });

  it('never shows two ads at once', async () => {
    const { ads, ui } = setup();
    const [a, b] = await Promise.all([ads.showRewarded('shopCoins'), ads.showRewarded('shopCoins')]);
    expect([a, b].sort()).toEqual([false, true]);
    expect(ui).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------- native flow against a fake AdMob

interface FakeOpts {
  consent?: ConsentInfo;
  consentAfterForm?: ConsentInfo;
  consentError?: boolean;
  tracking?: 'authorized' | 'denied' | 'notDetermined' | 'restricted';
  initFailures?: number;
  loadFailures?: Partial<Record<AdKind, number>>;
}

function fakeAdMob(o: FakeOpts = {}) {
  const handlers = new Map<AdEvent, (() => void)[]>();
  const emit = (e: AdEvent) => { for (const h of handlers.get(e) ?? []) h(); };
  const fails = { rewarded: o.loadFailures?.rewarded ?? 0, interstitial: o.loadFailures?.interstitial ?? 0 };
  let initFailures = o.initFailures ?? 0;
  let showResolve: ((v: unknown) => void) | null = null, showReject: ((e: unknown) => void) | null = null;
  const consent = o.consent ?? { status: 'OBTAINED', isConsentFormAvailable: true, canRequestAds: true, privacyOptionsRequirementStatus: 'REQUIRED' };
  const bridge = {
    initialize: vi.fn(async () => { if (initFailures-- > 0) throw new Error('no view yet'); }),
    requestConsentInfo: vi.fn(async () => { if (o.consentError) throw new Error('offline'); return consent; }),
    showConsentForm: vi.fn(async () => o.consentAfterForm ?? { ...consent, status: 'OBTAINED' as const, canRequestAds: true }),
    showPrivacyOptionsForm: vi.fn(async () => {}),
    trackingStatus: vi.fn(async () => o.tracking ?? 'authorized'),
    requestTracking: vi.fn(async () => {}),
    prepare: vi.fn(async (kind: AdKind, _adId: string) => { if (fails[kind]-- > 0) throw new Error('No fill'); }),
    show: vi.fn((_kind: AdKind, _adId: string) => new Promise<unknown>((res, rej) => { showResolve = res; showReject = rej; })),
    on: vi.fn(async (e: AdEvent, cb: () => void) => { handlers.set(e, [...(handlers.get(e) ?? []), cb]); }),
  } satisfies AdMobBridge;
  return {
    bridge, emit,
    /** The plugin resolves showRewardVideoAd when the reward is earned. */
    resolveShow: () => showResolve?.({ type: 'coins', amount: 1 }),
    rejectShow: (e: unknown) => showReject?.(e),
  };
}

const flush = () => vi.advanceTimersByTimeAsync(0);
vi.setConfig({ testTimeout: 5000 });

function nativeAds(f: ReturnType<typeof fakeAdMob>, os: 'ios' | 'android' = 'android', extra: { allowed?: () => boolean; resume?: (cb: () => void) => void } = {}) {
  const track = vi.fn();
  const ads = createAds({
    native: true, os, bridge: async () => f.bridge, track, rewardGraceMs: 500,
    interstitialAllowed: extra.allowed, onResume: extra.resume,
  });
  return { ads, track };
}

describe('native ads (AdMob)', () => {
  beforeEach(() => { vi.useFakeTimers(); });

  it('initializes, gets consent, preloads both formats with the platform ad units', async () => {
    const f = fakeAdMob();
    const { ads } = nativeAds(f, 'ios');
    await ads.init();
    expect(f.bridge.initialize).toHaveBeenCalledTimes(1);
    expect(f.bridge.requestConsentInfo).toHaveBeenCalledTimes(1);
    expect(f.bridge.showConsentForm).not.toHaveBeenCalled(); // already obtained
    expect(f.bridge.prepare).toHaveBeenCalledWith('rewarded', ADMOB.rewarded.ios);
    expect(f.bridge.prepare).toHaveBeenCalledWith('interstitial', ADMOB.interstitial.ios);
    await flush();
    expect(ads.rewardedReady()).toBe(true);
    expect(ads.interstitialReady()).toBe(true);
    expect(ads.privacyOptionsRequired).toBe(true);
  });

  it('shows the UMP form when consent is required, then the iOS tracking prompt if still undecided', async () => {
    const f = fakeAdMob({ consent: { status: 'REQUIRED', isConsentFormAvailable: true, canRequestAds: false }, tracking: 'notDetermined' });
    const { ads } = nativeAds(f, 'ios');
    await ads.init();
    expect(f.bridge.showConsentForm).toHaveBeenCalledTimes(1);
    expect(f.bridge.requestTracking).toHaveBeenCalledTimes(1);
    expect(f.bridge.prepare).toHaveBeenCalledTimes(2);
  });

  it('never asks for tracking on Android', async () => {
    const f = fakeAdMob({ tracking: 'notDetermined' });
    await nativeAds(f, 'android').ads.init();
    expect(f.bridge.trackingStatus).not.toHaveBeenCalled();
    expect(f.bridge.requestTracking).not.toHaveBeenCalled();
    expect(f.bridge.prepare).toHaveBeenCalledWith('rewarded', ADMOB.rewarded.android);
  });

  it('loads nothing when consent says ads may not be requested', async () => {
    const f = fakeAdMob({ consent: { status: 'REQUIRED', isConsentFormAvailable: true, canRequestAds: false }, consentAfterForm: { status: 'REQUIRED', canRequestAds: false } });
    const { ads } = nativeAds(f);
    await ads.init();
    expect(f.bridge.prepare).not.toHaveBeenCalled();
    expect(ads.rewardedReady()).toBe(false);
    expect(await ads.showRewarded('continue')).toBe(false);
  });

  it('retries initialize while the Android view is not ready', async () => {
    const f = fakeAdMob({ initFailures: 2 });
    const { ads } = nativeAds(f);
    const p = ads.init();
    await vi.advanceTimersByTimeAsync(5000);
    await p;
    expect(f.bridge.initialize).toHaveBeenCalledTimes(3);
    expect(f.bridge.prepare).toHaveBeenCalledTimes(2);
  });

  it('retries consent on resume after an offline start', async () => {
    let resume = () => {};
    const f = fakeAdMob({ consentError: true });
    const { ads } = nativeAds(f, 'android', { resume: cb => { resume = cb; } });
    await ads.init();
    expect(f.bridge.prepare).not.toHaveBeenCalled();
    f.bridge.requestConsentInfo.mockResolvedValueOnce({ status: 'NOT_REQUIRED', canRequestAds: true });
    resume();
    await flush();
    expect(f.bridge.prepare).toHaveBeenCalledTimes(2);
  });

  it('rewarded: true only when the reward fired, then reloads', async () => {
    const f = fakeAdMob();
    const { ads, track } = nativeAds(f);
    const fs = vi.fn();
    ads.onFullscreen(fs);
    await ads.init();
    await flush();
    const p = ads.showRewarded('doubleCoins');
    expect(ads.rewardedReady()).toBe(false); // on screen
    f.emit('rewarded');
    f.resolveShow();
    await flush();
    f.emit('rewardDismissed');
    expect(await p).toBe(true);
    expect(fs.mock.calls).toEqual([[true], [false]]);
    expect(track).toHaveBeenCalledWith('ad_rewarded', { placement: 'doubleCoins', result: 'earned' });
    expect(f.bridge.prepare.mock.calls.filter(c => c[0] === 'rewarded')).toHaveLength(2); // preloaded the next one
    await flush();
    expect(ads.rewardedReady()).toBe(true);
  });

  it('rewarded: closing early gives no reward (after the grace period)', async () => {
    const f = fakeAdMob();
    const { ads } = nativeAds(f);
    await ads.init();
    await flush();
    let result: boolean | null = null;
    void ads.showRewarded('continue').then(r => { result = r; });
    f.emit('rewardDismissed');
    await vi.advanceTimersByTimeAsync(499);
    expect(result).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(result).toBe(false);
  });

  it('rewarded: a reward that lands just after the close still counts', async () => {
    const f = fakeAdMob();
    const { ads } = nativeAds(f);
    await ads.init();
    await flush();
    const p = ads.showRewarded('lives');
    f.emit('rewardDismissed');
    await vi.advanceTimersByTimeAsync(100);
    f.emit('rewarded');
    expect(await p).toBe(true);
  });

  it('rewarded: a show failure resolves false and reloads', async () => {
    const f = fakeAdMob();
    const { ads } = nativeAds(f);
    await ads.init();
    await flush();
    const p = ads.showRewarded('booster');
    f.emit('rewardFailedToShow');
    expect(await p).toBe(false);
    await flush();
    expect(ads.rewardedReady()).toBe(true); // reloaded
    const r = ads.showRewarded('booster');
    await flush();
    f.rejectShow(new Error('Reward Video is Not Ready Yet')); // the plugin lost it: no hang, no reward
    expect(await r).toBe(false);
    expect(f.bridge.prepare.mock.calls.filter(c => c[0] === 'rewarded')).toHaveLength(3);
  });

  it('interstitial: resolves after it closes; ignores the reward events of other formats', async () => {
    const f = fakeAdMob();
    const { ads } = nativeAds(f);
    await ads.init();
    await flush();
    let shown: boolean | null = null;
    void ads.showInterstitial().then(v => { shown = v; });
    f.resolveShow(); // presented
    f.emit('rewardDismissed');
    await flush();
    expect(shown).toBeNull();
    f.emit('interstitialDismissed');
    await flush();
    expect(shown).toBe(true);
  });

  it('interstitial: kill switch and not-ready both resolve false without showing', async () => {
    let allowed = false;
    const f = fakeAdMob({ loadFailures: { interstitial: 1 } });
    const { ads } = nativeAds(f, 'android', { allowed: () => allowed });
    await ads.init();
    await flush();
    expect(await ads.showInterstitial()).toBe(false);
    allowed = true;
    expect(await ads.showInterstitial()).toBe(false); // first load failed; a retry is scheduled
    expect(f.bridge.show).not.toHaveBeenCalled();
  });

  it('retries failed loads with growing backoff', async () => {
    const f = fakeAdMob({ loadFailures: { rewarded: 3 } });
    const { ads } = nativeAds(f);
    await ads.init();
    await flush();
    const calls = () => f.bridge.prepare.mock.calls.filter(c => c[0] === 'rewarded').length;
    expect(calls()).toBe(1);
    await vi.advanceTimersByTimeAsync(defaultBackoff(1));
    expect(calls()).toBe(2);
    await vi.advanceTimersByTimeAsync(defaultBackoff(2) - 1);
    expect(calls()).toBe(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls()).toBe(3);
    await vi.advanceTimersByTimeAsync(defaultBackoff(3));
    expect(calls()).toBe(4);
    expect(ads.rewardedReady()).toBe(true);
    expect([1, 2, 3, 9, 20].map(defaultBackoff)).toEqual([2000, 4000, 8000, 300_000, 300_000]);
  });

  it('never throws when the plugin is missing', async () => {
    const ads = createAds({ native: true, os: 'ios', bridge: async () => { throw new Error('plugin not installed'); } });
    await expect(ads.init()).resolves.toBeUndefined();
    expect(ads.rewardedReady()).toBe(false);
    expect(await ads.showRewarded('continue')).toBe(false);
    expect(await ads.showInterstitial()).toBe(false);
  });
});
