# Store listing

Ready-to-paste text for App Store Connect and Play Console. Character limits are in brackets; every line below fits.
Lines marked **REPLACE BEFORE RELEASE** need your details.

## Names

| Field | Text | Limit |
| --- | --- | --- |
| App name (both stores) | Pixel Purr: Cosy Colour Puzzle | 30 |
| App Store subtitle | Paint pixel art with kittens | 30 |
| Play short description | Tap paint-pot kittens to fill cute pixel pictures. Calm, cosy, no rush. | 80 |
| App Store promotional text | 60 cosy pictures to paint with the Purrlets. A new daily gift every day, and no timers: think as long as you like. | 170 |
| Home screen name | Pixel Purr | 12 (iOS shows about 12) |

## App Store keywords [100]

```
pixel,art,colour,color,cat,kitten,cute,puzzle,cozy,relax,paint,sort,flow,calm,brain,logic,casual
```

Apple already indexes the name and subtitle, so the keywords avoid repeating "purr" and "pixel art" twice.

## Description [4000]

```
Meet the Purrlets: tiny kittens peeking out of paint pots, each one ready to paint its colour.

Tap a Purrlet and it hops onto the conveyor belt that runs around a pixel picture. As it rides, it paints every pixel of its colour it can see. When its pot is empty it pops with a happy little burst. If it still has paint after a lap, it naps on a cushion until you need it again. Fill the whole picture to win.

Easy to start, satisfying to master. Pick the right kitten at the right time, keep the cushions free, and watch the picture bloom.

WHY YOU'LL LOVE IT
• 60 hand-tuned pictures: lattes, sushi, sakura, a sleepy panda, a goldfish, a rocket trip and more
• Calm play with no timers. Take a break and come back any time
• Every level can be solved. The game checks each one before it ships
• Mystery Purrlets, linked pairs and spicy levels keep things fresh
• Cosy boosters when you're stuck: Extra Cushion, Yarn Shuffle, Cat Nap and X-Ray Specs
• A daily gift that grows through the week
• Collect every finished picture in your sticker book
• Soft sounds, gentle haptics and a Reduce Motion setting
• Plays offline

Perfect for a coffee break, the commute, or winding down before bed.

Pixel Purr is free to play. It contains optional in-app purchases (coin packs, bundles and Remove Ads) and ads. You can remove interstitial ads with a one-time purchase. Rewarded videos are always your choice.
```

## What's New (first release) [4000]

```
Hello from the Purrlets! 60 pictures to paint, a daily gift, and four cosy boosters. We'd love to hear what you think.
```

## Categories and ratings

| Field | App Store | Play |
| --- | --- | --- |
| Primary category | Games › Puzzle | Game › Puzzle |
| Secondary category | Games › Casual | (tags: Casual, Relaxing, Cute, Offline) |
| Age rating | 4+ (no objectionable content; answer "none" to every content question) | IARC: Everyone / PEGI 3 |
| Contains ads | Yes | Yes |
| In-app purchases | Yes | Yes |
| Target audience | n/a | 18 and over (and optionally 13–17). Do **not** tick under-13: the ads are not set up for children. |

Ad content is limited to "Parental guidance" in `src/services/config.ts`, so the 4+ rating stays honest while ads run.

## Contact and links

- Support URL: **REPLACE BEFORE RELEASE** (a simple page or a GitHub Pages site works)
- Marketing URL (optional): same site
- Privacy policy URL: host `docs/privacy.html` (for example with GitHub Pages) and paste its address in both stores
- Support email: **REPLACE BEFORE RELEASE**

## Screenshots

Both stores want portrait screenshots. Take them from a real build on a simulator or phone so they match the app exactly.

| Store | Size (portrait) | Count |
| --- | --- | --- |
| App Store, iPhone 6.9" (required) | 1320 × 2868 (iPhone 16 Pro Max / 17 Pro Max simulator) | 3–10 |
| App Store, iPad 13" (required only if iPad is supported) | 2064 × 2752 | 3–10 |
| Play phone | 1080 × 1920 or larger, 9:16 | 2–8 |
| Play feature graphic | 1024 × 500 | 1 |
| Play icon | 512 × 512 PNG | 1 |

Suggested set, in order, each with a one-line caption on top in Lilita One:

1. A level halfway painted with three Purrlets on the belt — "Tap a kitten. Watch it paint."
2. The win dance with confetti and the finished picture — "Fill the picture to win"
3. The tray with two napping Purrlets — "No rush. Kittens nap until you need them"
4. The booster bar with X-Ray Specs glowing — "Cosy boosters when you're stuck"
5. The sticker book with a dozen pictures — "Collect 60 cute pictures"
6. The daily gift ladder — "A gift every day"

`tools/dev/store-shots.cjs` takes this set from the real game in headless Chromium: with `npm run dev` running, `node tools/dev/store-shots.cjs http://localhost:5173/ store-shots` writes the App Store 6.9" set (`ios/`), the Play set and the feature graphic (`play/`), and the raw phone captures (`raw/`). The captions and the feature graphic are drawn by `dev/store.html`. Retake them from a simulator before release if the app changes; `window.__pp` in the browser console can jump to any level.

## Before you submit

- [ ] App Privacy (App Store) and Data safety (Play) forms filled in from `docs/SETUP-STORES.md` section 6
- [ ] Privacy policy hosted and linked
- [ ] Sandbox or license tester purchase tried once on each platform
- [ ] Screenshots taken from the release build
