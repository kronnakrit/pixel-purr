# Pixel Purr

A cute pixel colour-flow puzzle game for iOS and Android. Tap a paint pot kitten (a Purrlet), it rides the belt around the picture and paints every matching pixel it can see. Leftover paint naps in the 5-slot tray; overflow the tray and you lose.

Design: [Pixel Purr design page](https://claude.ai/artifact/8ooo13FNK8GYp1VzUW4tRz) (rules, cast, levels, animation, monetisation). How the code is put together, and every number the game uses: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## What's in the app

- **60 hand-checked levels, then endless ones.** Levels 1–20 teach one idea at a time (the tray, spicy levels, mystery kittens, linked pairs, full backgrounds); 21–60 ship as level files; 61+ are generated on the phone. Every shipped level is proven solvable by the solver, and the tests replay each proof in the real-time game.
- **The play field** in Three.js: glossy pixel cubes, the belt, kittens with moods (painting, napping, worried, happy pop), the win dance and confetti.
- **The game around the levels:** home map, intro cards, booster unlocks, win and fail cards, one continue per attempt, lives with a refill timer, the Sticker Book, the 7-day daily gift, settings, a tutorial pointer, sound effects and music (synthesised, no audio files), haptics.
- **Boosters:** Extra Cushion (+1 tray slot), Yarn Shuffle, Cat Nap, X-Ray Specs.
- **Money:** coin packs, Cosy Bundle, Starter Bundle, Remove Ads (RevenueCat); rewarded videos and interstitials (AdMob) with the pacing in the architecture doc. In the browser both run on built-in mocks so every flow can be played.
- **Level editor** (`npm run editor`): paint a picture, generate queues, check it with the solver, play it, export a level file.

No game server: levels ship in the app, saves stay on the phone, and purchases, ads and remote config are hosted services.

## Commands

```sh
npm install
npm run dev          # the game in the browser (mock ads and purchases)
npm test             # all tests: engine, every shipped level, content, saves, services, UI flow
npm run typecheck
npm run build        # typecheck + production web build into dist/
npm run editor       # the level editor
npm run tune         # retune levels 1-20 after changing pictures or the curve (about 3 minutes)
npx tsx tools/levels.ts                                    # rebuild the 21-60 level files after editing their pictures
node tools/dev/store-shots.cjs http://localhost:5173/ out  # store screenshots + Play feature graphic (dev server running)
npx cap sync         # copy dist/ into the iOS and Android projects
npx cap open ios     # open in Xcode (macOS)
npx cap open android # open in Android Studio
```

Dev builds expose `window.__pp` in the browser console: `state()`, `play(n)`, `autoplay()`, `win()`, `lose()`, `speed(k)`, `addCoins(n)`, `resetProfile()`. To try failures without a store, set `localStorage['pp.mock.buy']` to `cancel`, `fail` or `pending`, or `localStorage['pp.mock.adsFail']` to `1`.

`dev/*.html` are workbenches for single modules (the kitten, the scene, the interface screens, sound, saves, services, content, store art).

CI runs typecheck, tests and the web build on every pull request, then builds a debug Android APK (download it from the run's artifacts to sideload on a test phone). The iOS simulator build runs on demand: Actions → CI → Run workflow → tick "Also build the iOS app".

## Before the first store upload

Everything that needs your accounts is in [docs/SETUP-STORES.md](docs/SETUP-STORES.md): the bundle id, AdMob, the store products, RevenueCat, remote config, the privacy policy and privacy forms. Values to fill in are marked `REPLACE BEFORE RELEASE` in `src/services/config.ts`, `ios/App/App/Info.plist` and `android/app/src/main/res/values/strings.xml`. Store text, ratings and the screenshot set are in [docs/STORE-LISTING.md](docs/STORE-LISTING.md).
