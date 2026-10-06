// Services: ads (AdMob), purchases (RevenueCat), remote config, analytics and platform glue.
// On the phone they talk to the native plugins; in the browser they use built-in mocks so every flow can be played.
// Ids and keys live in ./config.ts ("REPLACE BEFORE RELEASE"). Creating these objects starts nothing except the
// native splash failsafe; each service starts with its init() / ready() call.
import { createAds, type Ads } from './ads';
import { createAnalytics, type Analytics } from './analytics';
import { REMOTE_CONFIG } from './config';
import { detectOs, isNative, preferencesStore } from './env';
import { domMockAd } from './mockAd';
import { createPlatform, type Platform } from './platform';
import { createPurchases, type Purchases } from './purchases';
import { createRemoteConfig, nativeFetchJson, webFetchJson, type RemoteConfig } from './remoteConfig';

const native = isNative(), os = detectOs();

export const analytics: Analytics = createAnalytics();

export const platform: Platform = createPlatform({ native, os, splashFailsafeMs: 12_000 });

export const remoteConfig: RemoteConfig = createRemoteConfig({
  ...REMOTE_CONFIG,
  store: preferencesStore(),
  fetchJson: native ? nativeFetchJson : webFetchJson,
});

export const ads: Ads = createAds({
  native,
  os,
  mockUi: domMockAd,
  track: (name, params) => analytics.event(name, params),
  interstitialAllowed: () => remoteConfig.get('interstitialEnabled', true),
  onResume: cb => { platform.onPause(paused => { if (!paused) cb(); }); },
});

export const purchases: Purchases = createPurchases({ native, os, track: (name, params) => analytics.event(name, params) });

export type { Ads } from './ads';
export type { Analytics, AnalyticsEntry, AnalyticsParams, AnalyticsSink } from './analytics';
export type { Platform } from './platform';
export type { PurchaseFailure, Purchases } from './purchases';
export type { RemoteConfig } from './remoteConfig';
export { REMOTE_DEFAULTS } from './remoteConfig';
