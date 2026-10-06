# Going live: ads, purchases and store setup

A checklist for the owner. Until you do this, the app works with Google's **test ads** and **no real purchases**. In the browser (`npm run dev`) everything is mocked, so you can play every flow without accounts.

Every id the game code uses is in `src/services/config.ts`. Search the repo for `REPLACE BEFORE RELEASE` to find them all.

## 1. Bundle id (do this first, it can't change later)

- [ ] Pick the final id (now `com.kronnakrit.pixelpurr`).
- [ ] If you change it, change it in all three places: `capacitor.config.ts` (`appId`), `android/app/build.gradle` (`applicationId` and `namespace`) and Xcode (target App → General → Bundle Identifier). Then run `npx cap sync`.

## 2. AdMob (ads)

- [ ] Create an AdMob account at admob.google.com and add **two apps**: Pixel Purr iOS and Pixel Purr Android.
- [ ] In each app, create **two ad units**: one *Rewarded* and one *Interstitial* (4 ad units in total).
- [ ] Put the ids in place:

| Id | Looks like | Where it goes |
| --- | --- | --- |
| iOS app id | `ca-app-pub-123…~456` | `ios/App/App/Info.plist` → `GADApplicationIdentifier`, and `ADMOB.appId.ios` in config.ts |
| Android app id | `ca-app-pub-123…~789` | `android/app/src/main/res/values/strings.xml` → `admob_app_id`, and `ADMOB.appId.android` in config.ts |
| Rewarded ad units | `ca-app-pub-123…/111` | `ADMOB.rewarded.ios` / `.android` in config.ts |
| Interstitial ad units | `ca-app-pub-123…/222` | `ADMOB.interstitial.ios` / `.android` in config.ts |

- [ ] To test real ad units on your own phone without breaking AdMob rules, add your phone's test device id (printed in Xcode / Logcat after the first ad request) to `ADMOB.testDevices`. Empty it again before uploading.
- [ ] Publish an `app-ads.txt` file on the website you list in the stores (AdMob → Apps → app-ads.txt shows the line).
- [ ] AdMob → **Privacy & messaging**: create and publish a **European regulations (GDPR)** message, a **US state regulations** message, and an **IDFA explainer** message for iOS. The game already asks for consent at start-up and only loads ads when allowed, and on iOS shows Apple's tracking prompt if your IDFA message didn't. The prompt text is in `Info.plist` (`NSUserTrackingUsageDescription`).
- [ ] Where consent applies, players must be able to change it: when `ads.privacyOptionsRequired` is true, the settings screen should show a "Privacy choices" button that calls `ads.showPrivacyOptions()`.
- [ ] iOS `Info.plist` already lists Google's SKAdNetwork ids. Refresh the list from Google's iOS quick-start guide now and then.
- [ ] Ads are limited to "Parental guidance" content (`ADMOB.maxAdContentRating`). Change it there if you want.

## 3. Store products

Create these 7 products in **both** App Store Connect (In-App Purchases) and Play Console (Monetize → In-app products). Use the same product ids. If you have to use different ids, put them in `STORE_PRODUCT_IDS` in config.ts.

| Product id | What it is | App Store type | Price |
| --- | --- | --- | --- |
| `coins_pouch` | 1,000 coins | Consumable | $0.99 |
| `coins_basket` | 5,500 coins | Consumable | $4.99 |
| `coins_jar` | 12,000 coins | Consumable | $9.99 |
| `coins_treasure` | 28,000 coins | Consumable | $19.99 |
| `cosy_bundle` | Remove Ads + 3 of each booster + 2,000 coins | Non-Consumable | $6.99 |
| `starter_bundle` | 2,500 coins + 2 of each booster | Non-Consumable | $1.99 |
| `remove_ads` | No interstitial ads | Non-Consumable | $3.99 |

- [ ] App Store Connect: sign the **Paid Apps agreement** and fill in tax and banking first, or products never load.
- [ ] Play Console: set up a payments profile. Play only lets you create products after you've uploaded a build (an internal testing release is enough).
- [ ] Prices: the shop shows each store's localized price automatically. The $ prices in `FALLBACK_PRODUCTS` (config.ts) only show in the browser or when the store can't be reached.

## 4. RevenueCat (purchases and restore)

- [ ] Create a free account at revenuecat.com and a project "Pixel Purr".
- [ ] Add the **App Store** app: bundle id, plus an **In-App Purchase Key** (App Store Connect → Users and Access → Integrations → In-App Purchase, download the .p8 file).
- [ ] Add the **Play Store** app: package name, plus a Google Cloud **service account** JSON with access in Play Console (RevenueCat's guide walks through it; it can take up to a day to start working).
- [ ] Import the 7 products. For the Play app, mark `cosy_bundle`, `starter_bundle` and `remove_ads` as **non-consumable** (RevenueCat consumes Play one-time products unless told otherwise, which would let people buy them twice).
- [ ] Create an entitlement `remove_ads` and attach both `remove_ads` and `cosy_bundle` to it, so Restore brings back no-ads either way. (Offerings and paywalls are not needed; the game loads products by id.)
- [ ] Copy the **public SDK keys** (Project → API keys) into config.ts: `REVENUECAT.apiKey.ios` (`appl_…`) and `.android` (`goog_…`). These public keys are safe to ship in the app.
- [ ] Test: iOS with a Sandbox tester account (Settings → App Store → Sandbox Account on the phone); Android with a license tester account on an internal testing build.
- [ ] Apple requires a **Restore Purchases** button for non-consumables: it's in the shop.

Without a key on a phone, the shop shows the fallback prices and buying fails politely (and says why in the log).

## 5. Remote config (optional)

Lets you tune numbers without an app update. Put a small JSON file on any static host (GitHub Pages, Firebase Hosting, S3), for example:

```json
{ "beltStepsPerSec": 36, "interstitialEnabled": true, "economy": { "winCoins": 25 } }
```

- [ ] Put its https URL in `REMOTE_CONFIG.url` in config.ts. Empty means off.
- The game uses the last downloaded copy when offline, and a change shows up on the next launch at the latest. Bad values are ignored.

## 6. Privacy forms and policy

- [ ] Write a privacy policy (ads and in-app purchases require one) and link it in both stores.
- [ ] App Store Connect → App Privacy: declare what the Google Mobile Ads SDK collects (Google's "Prepare for Apple's App Store data disclosure requirements" page lists it: device id, advertising and usage data, diagnostics, coarse location) plus purchase history (RevenueCat).
- [ ] Play Console → App content: **Ads** = yes, **Advertising ID** = yes (used for advertising), **Data safety** with the same data as above, target audience **18+ or 13+** (not children).
- [ ] Export compliance (asked on every iOS upload): the app's only encryption is the system's HTTPS. Answer Apple's questions on that basis; once you know your answer you can add `ITSAppUsesNonExemptEncryption` to `Info.plist` so it isn't asked again.

## 7. Analytics (later)

- [ ] When you want real analytics, add a Firebase Analytics Capacitor plugin and the Firebase config files (`ios/App/App/GoogleService-Info.plist`, `android/app/google-services.json`), then plug it in at boot with `analytics.setSink(e => …)`. Until then, analytics events only print in the dev console.
- [ ] Update the privacy forms above if you add it.

## 8. Before each store upload

- [ ] No `REPLACE BEFORE RELEASE` value is still a test id (a release build logs "using Google test ad units" if it is).
- [ ] `ADMOB.testDevices` is empty and `ADMOB.consentDebugGeography` is `null`.
- [ ] `npm run build && npx cap sync`, then archive in Xcode / build a signed AAB in Android Studio.
- [ ] Bump the version: `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` in Xcode, `versionName` / `versionCode` in `android/app/build.gradle`.
