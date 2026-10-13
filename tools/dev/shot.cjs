// Dev helper: screenshot a page in headless Chromium (software WebGL) at phone size, optionally after taps.
// Usage: node tools/dev/shot.cjs <url> <out.png> [--w 390] [--h 844] [--wait 1500] [--tap x,y]... [--eval "js"]... [--full]
// Prints console errors and page errors. --eval runs JS in the page (after the initial wait) and prints its JSON result.
const path = require('path');
const pw = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'));
const a = process.argv.slice(2), url = a[0], out = a[1];
const opt = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : d; };
const all = k => a.reduce((r, v, i) => (v === '--' + k ? r.concat(a[i + 1]) : r), []);
(async () => {
  const b = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: +opt('w', 390), height: +opt('h', 844) }, deviceScaleFactor: +opt('dpr', 2), hasTouch: true, isMobile: true });
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  await p.goto(url); await p.waitForTimeout(+opt('wait', 1500));
  for (const js of all('eval')) { try { console.log('eval:', JSON.stringify(await p.evaluate(js))); } catch (e) { console.log('eval error:', e.message); } }
  for (const t of all('tap')) { const [x, y] = t.split(',').map(Number); await p.mouse.click(x, y); await p.waitForTimeout(+opt('tapwait', 600)); }
  await p.screenshot({ path: out, fullPage: a.includes('--full') });
  console.log('saved', out); if (errs.length) console.log(errs.slice(0, 30).join('\n'));
  await b.close();
})();
