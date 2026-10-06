# Pixel Purr

A cute pixel colour-flow puzzle game for iOS and Android. Tap a paint pot kitten (a Purrlet), it rides the belt around the picture and paints every matching pixel it can see. Leftover paint naps in the 5-slot tray; overflow the tray and you lose.

Design: [Pixel Purr design page](https://claude.ai/artifact/8ooo13FNK8GYp1VzUW4tRz) (rules, cast, levels, animation, implementation plan, monetisation).

## Stack

- **Game:** TypeScript + Three.js, bundled with Vite.
- **App shells:** Capacitor 8 (`ios/`, `android/`). The web build in `dist/` runs inside the native WebView.
- **No game server.** Launch levels ship in the app and levels 21+ are generated on the phone. Purchases (RevenueCat), ads (AdMob / AppLovin MAX), remote config, analytics and crash reports (Firebase) are hosted services added in later phases.

## Layout

| Path | What it is |
| --- | --- |
| `src/engine/` | Rules engine: pure, deterministic, no rendering. Generator, solver, real-time `Game`, level file format. |
| `src/render/` | Three.js views. `BoardView` draws a `Game`: instanced pixel cubes (one draw call), belt, riders. |
| `src/main.ts` | Phase 0 sandbox: autoplays a launch level's stored solution with an fps meter. |
| `test/` | Vitest. Every launch level is replayed in both the solver model and the real-time game. |
| `tools/tune.ts` | Picks the (seed, disorder) pair for each launch level and writes the table into `src/engine/level.ts`. |
| `tools/reference/` | The design page's original JavaScript generator. `npm run golden` regenerates `test/fixtures/golden.json` from it; the TypeScript engine must match it exactly. |

## Engine in one paragraph

A level is a pixel picture plus queues of Purrlets. Each colour's total paint equals its pixel count (paint conservation), so a level is always clearable in principle. The belt runs counter-clockwise from the bottom-left; at each belt spot a Purrlet looks straight in and paints the first pixel in line if it is its colour. After one lap it pops (empty) or parks in the tray. `Game.step()` advances every rider one spot, which is also the render clock. The solver plays one Purrlet at a time, a subset of real play, so any plan it finds is a proof the level can be cleared.

## Commands

```sh
npm install
npm run dev          # sandbox in the browser; ?level=20 picks a level
npm test             # engine tests (all 20 launch levels)
npm run typecheck
npm run build        # typecheck + production web build into dist/
npm run tune         # retune launch levels after changing pictures or the curve (about 3 minutes)
npx cap sync         # copy dist/ into the iOS and Android projects
npx cap open ios     # open in Xcode (macOS)
npx cap open android # open in Android Studio
```

CI runs typecheck, tests and the web build on every pull request, then builds a debug Android APK (download it from the run's artifacts to sideload on a test phone). The iOS simulator build runs on demand: Actions → CI → Run workflow → tick "Also build the iOS app".

## Before the first store upload

- Change `appId` in `capacitor.config.ts` (currently `com.kronnakrit.pixelpurr`) if you want a different bundle id; it can't change after the first upload.
- Add Firebase config files (`ios/App/App/GoogleService-Info.plist`, `android/app/google-services.json`) for crash reports and analytics.
