// Store screenshots: plays the real app in headless Chromium and frames six moments under captions (docs/STORE-LISTING.md).
// Usage: npm run dev, then node tools/dev/store-shots.cjs <dev server url> <out dir> [--raw-only]
// Writes raw/<n>-<name>.png (1320 x 2868 phone captures), ios/<n>-<name>.png (1320 x 2868, App Store 6.9"),
// play/<n>-<name>.png (1080 x 1920) and play/feature-graphic.png (1024 x 500). Fresh profile; nothing is saved to your browser.
const path = require('path');
const fs = require('fs');
const pw = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'));
const [base = 'http://127.0.0.1:5173/', out = 'store-shots'] = process.argv.slice(2);
const rawOnly = process.argv.includes('--raw-only');
const PHONE = { width: 440, height: 956, dpr: 3 }; // iPhone 16 / 17 Pro Max points; x3 = 1320 x 2868
const SHOTS = [
  ['belt', 'Tap a kitten. Watch it paint.'],
  ['win', 'Fill the picture to win'],
  ['tray', 'No rush. Kittens nap until you need them'],
  ['boosters', "Cosy boosters when you're stuck"],
  ['stickers', 'Collect 60 cute pictures'],
  ['daily', 'A gift every day'],
];
const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'];
for (const d of ['raw', 'ios', 'play']) fs.mkdirSync(path.join(out, d), { recursive: true });
const rawPath = name => path.join(out, 'raw', `${SHOTS.findIndex(s => s[0] === name) + 1}-${name}.png`);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function capture(b) {
  const p = await b.newPage({ viewport: { width: PHONE.width, height: PHONE.height }, deviceScaleFactor: PHONE.dpr, hasTouch: true, isMobile: true });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(new URL('index.html', base).href);
  await p.waitForFunction(() => window.__pp && window.__pp.state().screen === 'home', null, { timeout: 60000 });
  await p.evaluate(() => { localStorage.clear(); return window.__pp.resetProfile(); });
  await sleep(800);
  const st = () => p.evaluate(() => window.__pp.state());
  const shot = async name => { await p.screenshot({ path: rawPath(name) }); console.log('captured', name); };
  const click = sel => p.evaluate(sel => { const e = document.querySelector(sel); if (e) e.click(); return !!e; }, sel);
  const clickTop = sel => p.evaluate(sel => {
    const ms = document.querySelectorAll('.pp-l-modals .pp-panel'), top = ms[ms.length - 1], e = top && top.querySelector(sel);
    if (e) e.click();
    return !!e;
  }, sel);
  // Close whatever card is open the way a player would: skip offers, take the main button otherwise.
  const answer = async m => (m === 'offer' ? (await clickTop('.pp-x')) || clickTop('.pp-link') : m === 'fail' ? (await clickTop('.pp-link')) || clickTop('.pp-primary') : clickTop('.pp-primary'));

  // 1. Win levels 1-15 at once so the sticker book has pictures and every booster is unlocked.
  await p.evaluate(() => window.__pp.speed(20));
  for (let t0 = Date.now(); Date.now() - t0 < 300000;) {
    const s = await st();
    if (s.profile.level > 15 && s.screen === 'home' && !s.modal) break;
    if (s.modal) await answer(s.modal);
    else if (s.screen === 'home') await click('.pp-play');
    else if (s.session && s.session.running && s.session.status === 'playing' && !s.session.busy) await p.evaluate(() => window.__pp.win());
    await sleep(350);
  }
  await sleep(1500);

  // 5. Sticker book, 6. daily gift (left unclaimed).
  await click('.pp-nav button[aria-label="Sticker Book"]');
  await sleep(1800);
  await shot('stickers');
  await click('.pp-l-modals .pp-phead button[aria-label="Back"]');
  await sleep(1200);
  await click('button.pp-daily-btn');
  await sleep(1800);
  await shot('daily');
  await clickTop('.pp-x');
  await sleep(1000);

  // 1-3. Play a level at normal speed with its stored solution: belt busy, kittens napping in the tray, the win dance.
  const play = async (n, onTick) => {
    await p.evaluate(() => window.__pp.speed(1));
    await p.evaluate(n => window.__pp.play(n), n);
    for (let t0 = Date.now(); Date.now() - t0 < 30000;) {
      const s = await st();
      if (s.modal) await answer(s.modal);
      else if (s.session && s.session.running && s.session.level === n) break;
      await sleep(250);
    }
    await sleep(900);
    const done = p.evaluate(() => window.__pp.autoplay());
    let result = null;
    done.then(r => (result = r), () => (result = 'error'));
    while (result === null) { const s = await st(); if (s.session) await onTick(s.session); await sleep(120); }
    return result;
  };
  let belt = false, tray = false, win = false;
  const tick = async s => {
    const painted = 1 - s.left / s.total;
    if (!belt && s.riders >= 3 && painted > 0.3 && painted < 0.8) { belt = true; await shot('belt'); }
    if (!tray && s.tray >= 2 && s.riders >= 1) { tray = true; await shot('tray'); }
  };
  for (const n of [16, 19, 17, 18]) {
    if (belt && tray) break;
    await play(n, tick);
    if (!win) {
      for (let t0 = Date.now(); Date.now() - t0 < 1400;) { const s = await st(); if (s.session && s.session.status === 'won') break; await sleep(50); }
      await sleep(700);
      await shot('win');
      win = true;
    }
    for (let t0 = Date.now(); Date.now() - t0 < 20000;) {
      const s = await st();
      if (s.screen === 'home' && !s.modal) break;
      if (s.modal) await answer(s.modal);
      await sleep(300);
    }
  }
  if (!belt || !tray) console.log('missing:', !belt ? 'belt' : '', !tray ? 'tray' : '');

  // 4. X-Ray Specs armed and glowing in the booster bar.
  await p.evaluate(() => window.__pp.play(21));
  for (let t0 = Date.now(); Date.now() - t0 < 30000;) {
    const s = await st();
    if (s.modal) await answer(s.modal);
    else if (s.session && s.session.running) break;
    await sleep(250);
  }
  await sleep(1200);
  await click('.pp-boost[aria-label^="X-Ray"]');
  await sleep(900);
  await shot('boosters');
  if (errs.length) console.log('page errors:', errs.slice(0, 10).join('\n'));
  await p.close();
}

async function compose(b) {
  const p = await b.newPage({ viewport: { width: 1320, height: 2868 }, deviceScaleFactor: 1 });
  await p.goto(new URL('dev/store.html', base).href);
  await p.waitForFunction(() => !!window.__store, null, { timeout: 60000 });
  const sizes = [['ios', 1320, 2868], ['play', 1080, 1920]];
  for (const [name, text] of SHOTS) {
    const file = rawPath(name);
    if (!fs.existsSync(file)) { console.log('skip', name, '(no raw capture)'); continue; }
    const src = 'data:image/png;base64,' + fs.readFileSync(file).toString('base64');
    for (const [dir, w, h] of sizes) {
      await p.setViewportSize({ width: w, height: h });
      await p.evaluate(([src, text, w, h]) => window.__store.frame(src, text, w, h), [src, text, w, h]);
      await p.screenshot({ path: path.join(out, dir, path.basename(file)) });
    }
  }
  await p.setViewportSize({ width: 1024, height: 500 });
  await p.evaluate(() => window.__store.feature());
  await p.screenshot({ path: path.join(out, 'play', 'feature-graphic.png') });
  await p.close();
}

(async () => {
  const b = await pw.chromium.launch({ args: GL });
  try {
    if (!process.argv.includes('--frame-only')) await capture(b);
    if (!rawOnly) await compose(b);
  } finally { await b.close(); }
  console.log('done:', path.resolve(out));
})();
