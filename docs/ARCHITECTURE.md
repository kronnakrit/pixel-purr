# Pixel Purr architecture

Pixel Purr is a cute pixel colour-flow puzzle game for iOS and Android, for working adults who want a calm, colourful break. A paint pot kitten (a **Purrlet**) rides a conveyor belt around a pixel picture and paints matching pixels. This file is the map of the app: what each module does, how they talk, and the numbers the game uses.

The approved design is the [Pixel Purr design page](https://claude.ai/artifact/8ooo13FNK8GYp1VzUW4tRz). Its sources are in the project files (`pixel-flow/`: `art.js` SVG art kit, `screens.js` screen mockups, `app.js` animation demos, `page.html` text). When this file and the design page disagree on a rule or a number, this file wins.

## Stack

TypeScript (strict, `noUncheckedIndexedAccess`), Three.js for the play field, plain DOM + CSS + inline SVG for the interface, Vite, Capacitor 8 for iOS and Android. No UI framework. Fonts are bundled (`src/fonts.ts`): **Lilita One** for display text and numbers (white fill, plum outline `#24193F`), **Nunito** 700–900 for UI copy.

Installed runtime packages: `three`, `@capacitor/core`, `@capacitor/app`, `@capacitor/haptics`, `@capacitor/preferences`, `@capacitor/status-bar`, `@capacitor/splash-screen`, `@capacitor-community/admob`, `@revenuecat/purchases-capacitor`, `@fontsource/lilita-one`, `@fontsource/nunito`.

## Modules

| Module | Path | Job |
| --- | --- | --- |
| Engine | `src/engine/` | Rules, generator, solver, real-time `Game` with boosters. Pure, deterministic, no DOM. |
| Content | `src/content/` | Level 1–100 data (1–20 tuned in the engine, 21–100 shipped as level files in packs), endless levels 101+, level metadata, intro cards. Internal level editor (`editor.html`). |
| Meta | `src/meta/` | The player's saved profile: coins, lives timer, boosters, progress, Sticker Book, daily gift, settings, purchase flags, ad bookkeeping, economy numbers. |
| Services | `src/services/` | Ads (AdMob), purchases (RevenueCat), remote config, analytics, platform (splash, back button, pause). Web builds use built-in mocks. |
| Audio | `src/audio/` | Synthesised sound effects (Web Audio, no files), a gentle music loop, haptics. Maps engine events to sound + haptics. |
| Render | `src/render/` | The Three.js play field. `purrlet/`: the kitten model and its animations. `scene/`: pixels, belt, dock, tray, queues, riders, effects, camera, tap input. |
| UI | `src/ui/` | HUD, booster bar, every screen and modal (home map, intro cards, win, fail, shop, pause, Sticker Book, daily gift, offers), tutorial pointer, flying coins. SVG art kit ported from the design page. |
| App | `src/app/` | `contracts.ts` (the interfaces between modules) and the controller that runs the game flow. `src/main.ts` boots it. |

Modules talk only through the interfaces in `src/app/contracts.ts`. Each module's `index.ts` exports exactly what the contract file names:

- `src/content/index.ts` → `content: ContentApi`
- `src/meta/index.ts` → `loadMeta(now, economy?)`, `DEFAULT_ECONOMY`, `PRODUCTS`
- `src/services/index.ts` → `ads`, `purchases`, `remoteConfig`, `analytics`, `platform`
- `src/audio/index.ts` → `audio: AudioApi`
- `src/render/index.ts` → `createGameScene(canvas, { reducedMotion })`
- `src/render/purrlet/index.ts` → `PurrletView`, `PurrletMood`, `warmupPurrlets()`
- `src/ui/index.ts` → `createUi(): UiApi`

## Rules (exact)

- **Paint conservation:** for every colour, the paint on all its Purrlets equals that colour's pixel count. Boosters never create or destroy paint.
- **Belt:** a Purrlet hops on at the bottom-left dock and rides counter-clockwise one spot per step: along the bottom (aiming up), up the right (aiming left), along the top (aiming down), down the left (aiming right). One lap = 2w + 2h spots.
- **Line of sight:** at each spot it looks straight into that row or column; if the first pixel it meets is its colour it paints it (−1 paint). Other colours block.
- **Belt capacity:** at most 5 riders; tapping is blocked while the belt is full or the entry is occupied (a rider within 2 spots of the dock). The dock shows free spaces, e.g. `4/5`.
- **After a lap:** a Purrlet pops in a sparkle the moment its paint runs out, wherever it is. With paint left it naps on a tray cushion; tap it to send it round again.
- **Lose:** a Purrlet finishes its lap with paint left and every cushion is taken. One continue per attempt: +1 cushion for 900 coins or a rewarded video (`Game.addTraySlot()` resumes the game).
- **Win:** last pixel painted; the picture joins the Sticker Book.
- **Mystery Purrlets** (level 7+): grey pot with "?" until they reach the front of their queue.
- **Linked pairs** (level 12+): two neighbours tied with a ribbon; they launch together, 2 spots apart, only when both are at the front.
- **Spicy levels:** every 5th level; flame badge on the map and level pill.

### Boosters (unlock level, price, 3 free on unlock)

| Key | Name | Unlock | Price | Effect | Engine call |
| --- | --- | --- | --- | --- | --- |
| `slot` | Extra Cushion | 4 | 900 | Adds a 6th tray slot (dashed gold) for the rest of the level. | `game.addTraySlot()` |
| `shuffle` | Yarn Shuffle | 6 | 600 | Re-deals the order of every waiting Purrlet (linked pairs stay put). | `game.shuffleQueues(rng)` |
| `nap` | Cat Nap | 9 | 1200 | Sends every tray Purrlet to the end of the shortest queues, emptying the tray. | `game.napTray()` |
| `xray` | X-Ray Specs | 13 | 1500 | The next Purrlet launched sees through other colours for one lap. | `game.armXray()` |

Boosters are used from the booster bar during play. With none left, tapping one offers to buy it for coins (or a rewarded video for one).

## Engine API used by the app

`new Game(level)`: `queues` (front first), `tray`, `riders` (`s` = belt spot), `trayCap`, `px`, `left`, `status`, `beltFree`, `front(q)`, `isRevealed(p)`, `launchGroup(q)`, `canLaunchQueue(q)`, `launchQueue(q)`, `canLaunchTray(i)`, `launchTray(i)`, `step()`, boosters above, `canShuffle()`, `canNap()`, `canXray()`. Every mutating call returns `GameEvent[]`; the controller forwards each batch to the scene (`apply`) and audio (`gameEvents`). Event types: `launch`, `shot`, `pop`, `park`, `reveal`, `won`, `lost`, `traySlots`, `shuffle`, `napBack`, `xrayArmed`, `resumed`.

The controller steps the engine at a fixed rate (`beltStepsPerSec`, default 36) and renders every animation frame with `stepFrac` for smooth riding.

## Game flow (controller)

1. **Boot:** fonts, remote config, meta (saved profile), services init (ads, purchases), platform splash hidden after the first frame. Audio unlocks on the first tap.
2. **Home:** map of levels around the current one (done levels show their picture, spicy ones a flame), Play button, daily gift (red dot when available), shop, Sticker Book, settings. Lives and coins in the HUD.
3. **Play:** needs a life (unlimited lives skip this). With no lives: out-of-lives modal (refill for coins, video for one life, or wait).
   - Before the level: booster unlocks newly reached (`unlockBoostersUpTo`) show the unlock card; intro cards show once per mechanic (`basics` L1, `tray` L2, `spicy` L5, `mystery` L7, `linked` L12, `background` L18).
   - **Tutorial** on levels 1–4: L1 points at a queue front ("Tap a Purrlet"), then lets the player play; L2 points at a napping tray Purrlet once one exists ("Tap a napping Purrlet to send it again"); L4 points at the Extra Cushion booster the first time the tray has 4+.
   - Pause: resume, restart (costs a life), home (costs a life). Settings toggles live in the pause modal.
4. **Win:** the scene celebrates, then the win card: picture, "+20" coins (spicy +40), Continue or "Double with video" (when an ad is ready). Coins fly to the chip. Then: starter bundle offer after level 5 (once), interstitial ad if the policy allows, Remove Ads offer after the 3rd interstitial (once), back to home with the next level selected.
5. **Lose:** fail card: +1 cushion for 900 coins, or free with a video, once per attempt; "Give up" spends a life and returns home.

### Ads and offers policy (fair for working adults)

- Rewarded ads are always optional and always say what you get: continue, a booster, double win coins, one life, 100 shop coins, double daily gift.
- Interstitials only from level 10, at most one every 3 minutes, never right after a loss, never with Remove Ads.
- Remove Ads keeps the optional rewarded ads.
- No loot boxes; every price is a plain price for a plain thing.

## Economy defaults (remote config can override)

| Thing | Value |
| --- | --- |
| Lives | max 5, one back every 30 min; refill all for 900 coins |
| Win coins | 20, spicy 40 |
| Continue | 900 coins or a video |
| Starting coins | 300 |
| Daily gift (streak days 1–7) | 50, 75, 1 Yarn Shuffle, 100, 1 Extra Cushion, 150, 250 + 30 min unlimited lives |
| Coin packs | Pouch 1,000 ($0.99), Basket 5,500 ($4.99), Treat Jar 12,000 ($9.99), Treasure 28,000 ($19.99) |
| Cosy Bundle | $6.99: Remove Ads + 3 of each booster + 2,000 coins (one time) |
| Starter Bundle | $1.99 after level 5: 2,500 coins + 2 of each booster (one time) |
| Remove Ads | $3.99 (one time) |

Product ids: `coins_pouch`, `coins_basket`, `coins_jar`, `coins_treasure`, `cosy_bundle`, `starter_bundle`, `remove_ads`.

## Look

- **Stage:** dark purple gradient (`#4A3A96` top → `#33276F` → `#231A4F` bottom) with faint rotated pixel squares. Everything has a chunky plum outline `#24193F`.
- **UI colours:** level pill blue `#5AA2FF`→`#2D63D8`; go button green `#7EE07A`; coin gold `#FFC93B`; panel `#5B4BB8`→`#3A2D86`; ribbon pink `#FF7EC8`→`#D6449A`; belt metal lavender `#9C92E8`; tray cushion `#1C1540`.
- **Paint colours:** the 12 colours in `src/engine/palette.ts`, each with light/base/dark for 3-tone glossy shading. Each colour has an accessory so colours read for colour-blind players: cherry bow, tangerine leaf, lemon star, matcha leaf, mint drop, soda bubble, grape bow, lilac flower, bubblegum heart, cocoa flower, milk bow, licorice star.
- **Purrlet:** cream kitten (`#FFF4E4`) peeking out of a pot of its paint colour; paint splash on the head and ear insides; pink blush; paint count on the pot in white Lilita One with a plum outline. Moods: idle (round eyes), painting (squint `> <`), napping (closed arcs, floating z), cheering (happy arcs), worried (sweat drop). Mystery: grey pot `#6C6390` with "?".
- **Pixels:** glossy candy cubes: base colour, darker bevel bottom-right, light glint top-left.
- **Belt:** glossy lavender rounded frame with chevrons pointing the way round; blue coil dock at bottom-left with the free-spaces counter.
- **Tray:** a row of 5 dark cushions under the board; the Extra Cushion slot is dashed gold.

### Gameplay screen layout (portrait, top to bottom)

Top HUD (pause button, blue level pill, coin chip with +) → board with belt (square, as wide as the screen allows) → tray row → queues (front Purrlet biggest, two more behind it getting smaller and dimmer) → booster bar (4 round buttons with count badges). The scene reads the HUD heights from `ui.hud.insets()` and fits everything in between.

### Animation timings

| Animation | Length | Easing | Details | Haptic and sound |
| --- | --- | --- | --- | --- |
| Idle | loop 3.4 s | ease in-out | breathe 2.5%, peek up and down, blink every 4–6 s, ear twitch, tail sway; cats out of step | none |
| Tap and hop | 0.45 s | back-out | squash 14%, stretch up, land squash, settle; dock pops | light tap, soft pop |
| Ride | 0.7 s loop | ease in-out | bob, tilt 2°, fast tail wag, ears lag 0.1 s | none |
| Paint a pixel | 0.25 s | ease out | squint, recoil 7%, paint dot flies, pixel swells 30% then pops | tiny tick, rising plink per streak |
| Empty and pop | 0.7 s | back-out | squash, jump, grow 22% with happy eyes, star burst | medium tap, sparkle chime |
| Nap on tray | loop 4 s | sine | slow breathing, floating z | soft thud on landing |
| Win dance | 0.9 s loop | ease in-out | jump, tilt left/right, stagger 0.15 s, confetti | success buzz, fanfare |
| Tray full | 0.5 s then hold | linear shake | worried shake, ears droop, sweat drop | double tap, low "oh no" |
| Mystery reveal | 0.6 s | back-out | wiggle, flip to the colour, 15% overshoot | light tap, ta-da |
| Button press | 0.15 s | ease out | press down 3 px, spring back; idle pulse 7% on the main button | light tap, click |
| Coins | 0.8 s | ease in | arc to the coin chip, chip bumps 18% | tick per coin |

**Reduce Motion** (follows the phone setting unless overridden): no bobbing, no shake, only fades and a gentle scale on tap.

## Performance budget

60 fps on a mid-range 2019 Android. Pixels: one instanced mesh (one draw call). At most ~30 Purrlets on screen; share geometries and materials between cats. Particles (paint dots, sparkles, confetti) pooled in instanced meshes. No post-processing. Device pixel ratio capped at 2. Pause rendering while a full-screen modal covers the field or the app is in the background.

## Development

```sh
npm run dev                 # the game
npm run editor              # level editor (editor.html), dev only
npm test                    # all unit tests
npx tsc --noEmit -p .       # typecheck
node tools/dev/shot.cjs <url> <out.png> [--tap x,y] [--eval js]   # phone-size screenshot in headless Chromium
```

Dev harness pages live in `dev/` (e.g. `dev/purrlet.html`) and are served by the dev server but not built into the app.
