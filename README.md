# Pixel Purr

A cute pixel colour-flow puzzle game for iOS and Android. Tap a paint pot kitten (a Purrlet), it rides the belt around the picture and paints every matching pixel it can see. Leftover paint naps in the 5-slot tray; overflow the tray and you lose.

Design: [Pixel Purr design page](https://claude.ai/artifact/8ooo13FNK8GYp1VzUW4tRz) (rules, cast, levels, animation, monetisation). How the code is put together, and every number the game uses: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## What's in the app

- **100 hand-checked levels, then endless ones.** Levels 1–20 teach one idea at a time (the tray, spicy levels, mystery kittens, linked pairs, full backgrounds); 21–100 ship as level files in two packs (21–60 and 61–100); 101+ are generated on the phone. Every shipped level is proven solvable by the solver, and the tests replay each proof in the real-time game.
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
npx tsx tools/pictures.ts sheet.png 61-100                 # contact sheet of level pictures, with checks
npx tsx tools/levels.ts 61-100                             # rebuild level files after editing their pictures
node tools/dev/store-shots.cjs http://localhost:5173/ out  # store screenshots + Play feature graphic (dev server running)
npx cap sync         # copy dist/ into the iOS and Android projects
npx cap open ios     # open in Xcode (macOS)
npx cap open android # open in Android Studio
```

### Adding levels

Hand-made levels come in packs: a file of picture recipes plus a level file built from it.

1. Draw the pictures in a new `src/content/pictures-<first>-<last>.ts` (see `pictures-61-100.ts`; shared bits such as faces and sparkles are in `shapes.ts`) and add them to `FILE_PICTURES` in `src/content/recipes.ts`.
2. Add the pack to `PACKS` in `src/content/params.ts`, then create its `levels-<first>-<last>.json` (start it as `[]`) and add it to `LEVEL_FILES` in `src/content/index.ts`.
3. Check the pictures with `npx tsx tools/pictures.ts sheet.png <first>-<last>` and build the levels with `npx tsx tools/levels.ts <first>-<last>`, which tunes each one and proves it can be won.
4. Raise the level count in `test/content/content.test.ts` and run `npm test`.

Levels after the last pack stay endless. A level made in the editor (`npm run editor`) can also be exported as a level file.

Dev builds expose `window.__pp` in the browser console: `state()`, `play(n)`, `autoplay()`, `win()`, `lose()`, `speed(k)`, `addCoins(n)`, `resetProfile()`. To try failures without a store, set `localStorage['pp.mock.buy']` to `cancel`, `fail` or `pending`, or `localStorage['pp.mock.adsFail']` to `1`.

`dev/*.html` are workbenches for single modules (the kitten, the scene, the interface screens, sound, saves, services, content, store art).

CI runs typecheck, tests and the web build on every pull request, then builds a debug Android APK (download it from the run's artifacts to sideload on a test phone). The iOS simulator build runs on demand: Actions → CI → Run workflow → tick "Also build the iOS app".

## Before the first store upload

Everything that needs your accounts is in [docs/SETUP-STORES.md](docs/SETUP-STORES.md): the bundle id, AdMob, the store products, RevenueCat, remote config, the privacy policy and privacy forms. Values to fill in are marked `REPLACE BEFORE RELEASE` in `src/services/config.ts`, `ios/App/App/Info.plist` and `android/app/src/main/res/values/strings.xml`. Store text, ratings and the screenshot set are in [docs/STORE-LISTING.md](docs/STORE-LISTING.md).
