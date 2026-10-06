// Every id and key the services use, in one place. Search for "REPLACE BEFORE RELEASE" before the first store upload.
// docs/SETUP-STORES.md walks through where each value comes from.
import type { Product, ProductId } from '../app/contracts';

export type NativeOs = 'ios' | 'android';

/** Google's sample publisher. Ids under it always serve test ads and never pay out. */
export const GOOGLE_TEST_PUBLISHER = 'ca-app-pub-3940256099942544';

// ---------------------------------------------------------------- AdMob

export const ADMOB = {
  /**
   * REPLACE BEFORE RELEASE: your AdMob app ids (AdMob → Apps → App settings), with a "~".
   * The native SDKs read them from the native projects before any JavaScript runs, so they must also be set in
   * ios/App/App/Info.plist (GADApplicationIdentifier) and android/app/src/main/res/values/strings.xml (admob_app_id).
   * Kept here for reference and the release check below.
   */
  appId: {
    ios: `${GOOGLE_TEST_PUBLISHER}~1458002511`,
    android: `${GOOGLE_TEST_PUBLISHER}~3347511713`,
  } satisfies Record<NativeOs, string>,
  /** REPLACE BEFORE RELEASE: rewarded ad unit ids (with a "/"). Google's public test units until then. */
  rewarded: {
    ios: `${GOOGLE_TEST_PUBLISHER}/1712485313`,
    android: `${GOOGLE_TEST_PUBLISHER}/5224354917`,
  } satisfies Record<NativeOs, string>,
  /** REPLACE BEFORE RELEASE: interstitial ad unit ids. Google's public test units until then. */
  interstitial: {
    ios: `${GOOGLE_TEST_PUBLISHER}/4411468910`,
    android: `${GOOGLE_TEST_PUBLISHER}/1033173712`,
  } satisfies Record<NativeOs, string>,
  /**
   * Test devices (ids printed in Xcode / Logcat after the first ad request) get test ads even with real ad units,
   * so you can try release builds without invalid clicks. Leave empty in the store build.
   */
  testDevices: [] as string[],
  /** Testing only: pretend the test devices are in the EEA to see the consent form. Must be null in the store build. */
  consentDebugGeography: null as null | 'EEA' | 'NOT_EEA',
  /** A calm game for adults: no child-directed treatment, and keep mature ads (gambling, dating) out. */
  tagForChildDirectedTreatment: false,
  maxAdContentRating: 'ParentalGuidance' as 'General' | 'ParentalGuidance' | 'Teen' | 'MatureAudience',
};

export const isTestAdId = (id: string): boolean => id.startsWith(GOOGLE_TEST_PUBLISHER);

// ---------------------------------------------------------------- RevenueCat

export const REVENUECAT = {
  /**
   * REPLACE BEFORE RELEASE: RevenueCat public SDK keys (RevenueCat → Project → API keys): "appl_..." for the App
   * Store app, "goog_..." for the Play Store app. Public keys are meant to ship in the app. Empty = purchases are off
   * on that platform (the shop shows the fallback prices below and buying fails politely).
   */
  apiKey: { ios: '', android: '' } satisfies Record<NativeOs, string>,
  /**
   * Optional: RevenueCat entitlement ids that mean "owns this product", used by restore. Attach both the remove_ads
   * and cosy_bundle products to a "remove_ads" entitlement in RevenueCat and Restore brings back no-ads either way.
   */
  entitlements: { remove_ads: 'remove_ads' } as Record<string, ProductId>,
};

// ---------------------------------------------------------------- store products

export const PRODUCT_ORDER: readonly ProductId[] = [
  'coins_pouch', 'coins_basket', 'coins_jar', 'coins_treasure', 'cosy_bundle', 'starter_bundle', 'remove_ads',
];

/**
 * One-time products: "Non-Consumable" in App Store Connect, and marked non-consumable for the Play product in
 * RevenueCat (RevenueCat consumes Play one-time products unless told otherwise). Coin packs are consumables.
 */
export const ONE_TIME_PRODUCTS: readonly ProductId[] = ['cosy_bundle', 'starter_bundle', 'remove_ads'];

const sameIds = (): Record<ProductId, string> =>
  Object.fromEntries(PRODUCT_ORDER.map(id => [id, id])) as Record<ProductId, string>;

/**
 * REPLACE BEFORE RELEASE if your store product ids differ: the product id you create in App Store Connect and Play
 * Console for each game product. By default they are the same as the game's ids (e.g. "coins_pouch").
 */
export const STORE_PRODUCT_IDS: Record<NativeOs, Record<ProductId, string>> = {
  ios: sameIds(),
  android: sameIds(),
};

/**
 * Shown on the web (dev), when no RevenueCat key is set, and for any product the store did not return.
 * The store's localized price replaces `price` on the phone. Titles are the game's own names (the shop design).
 */
export const FALLBACK_PRODUCTS: readonly Product[] = [
  { id: 'coins_pouch', title: 'Pouch', description: '1,000 coins', price: '$0.99' },
  { id: 'coins_basket', title: 'Basket', description: '5,500 coins', price: '$4.99' },
  { id: 'coins_jar', title: 'Treat Jar', description: '12,000 coins', price: '$9.99' },
  { id: 'coins_treasure', title: 'Treasure', description: '28,000 coins', price: '$19.99' },
  { id: 'cosy_bundle', title: 'Cosy Bundle', description: 'No ads + 3 of each booster + 2,000 coins', price: '$6.99' },
  { id: 'starter_bundle', title: 'Starter Bundle', description: '2,500 coins + 2 of each booster', price: '$1.99' },
  { id: 'remove_ads', title: 'Remove Ads', description: 'No more ads between levels. Optional videos stay.', price: '$3.99' },
];

// ---------------------------------------------------------------- remote config

export const REMOTE_CONFIG = {
  /**
   * REPLACE BEFORE RELEASE (optional): https URL of a small JSON file with overrides, e.g.
   * {"beltStepsPerSec": 36, "interstitialEnabled": true, "economy": {"winCoins": 25}}. Empty = remote config off.
   * Any static host works (GitHub Pages, Firebase Hosting, S3). On the phone it is fetched natively (no CORS needed).
   */
  url: '',
  /** Boot waits at most this long for a fresh copy; otherwise it uses the cached one and saves the fresh one for next launch. */
  timeoutMs: 2500,
};
