// Store art (dev/store.html): frames a phone screenshot under a one-line caption for the store listings, and draws the
// Play feature graphic. tools/dev/store-shots.cjs drives it through window.__store; open ?feature=1 to see the graphic.
import { content } from '../../src/content';
import { C, PALETTE } from '../../src/engine';
import { FONT_DISPLAY, FONT_BODY, fontsReady } from '../../src/fonts';
import { appIcon, pictureCanvas, purrlet } from '../../src/ui/art';

const INK = '#24193F';
const root = document.querySelector<HTMLElement>('#root')!;

function stage(w: number, h: number): HTMLElement {
  root.innerHTML = '';
  Object.assign(root.style, { position: 'relative', width: `${w}px`, height: `${h}px`, overflow: 'hidden', background: 'linear-gradient(#FFB8DA, #C9A8FF 38%, #6F55D9)' });
  return root;
}

/** Candy pixels scattered over the background, kept out of `clear` (x0, y0, x1, y1); deterministic so re-runs match. */
function sprinkles(el: HTMLElement, w: number, h: number, n: number, size: number, clear: [number, number, number, number] = [0, 0, 0, 0]): void {
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0, tries = 0; i < n && tries < n * 20; tries++) {
    const p = PALETTE[1 + Math.floor(rnd() * 9)]!, d = size * (0.5 + rnd()), x = rnd() * w, y = rnd() * h, rot = (rnd() - 0.5) * 40;
    if (x + d > clear[0] && x < clear[2] && y + d > clear[1] && y < clear[3]) continue;
    i++;
    const sq = document.createElement('i');
    Object.assign(sq.style, { position: 'absolute', left: `${x}px`, top: `${y}px`, width: `${d}px`, height: `${d}px`, borderRadius: `${d * 0.18}px`,
      background: p.hex, boxShadow: `inset ${-d * 0.14}px ${-d * 0.14}px 0 ${p.dark}, inset ${d * 0.14}px ${d * 0.14}px 0 ${p.light}`, opacity: '0.85', transform: `rotate(${rot}deg)` });
    el.append(sq);
  }
}

function caption(text: string, size: number): HTMLElement {
  const t = document.createElement('div');
  t.textContent = text;
  Object.assign(t.style, { fontFamily: FONT_DISPLAY, fontSize: `${size}px`, lineHeight: '1.08', color: '#fff', textAlign: 'center',
    WebkitTextStroke: `${size * 0.11}px ${INK}`, paintOrder: 'stroke fill', textShadow: `0 ${size * 0.08}px 0 ${INK}`, letterSpacing: '0.01em', textWrap: 'balance' });
  return t;
}

/** One store screenshot: caption on top, the phone screenshot below in a rounded frame. */
async function frame(src: string, text: string, w: number, h: number): Promise<void> {
  const el = stage(w, h);
  const img = new Image();
  img.src = src;
  await img.decode();
  const capH = h * 0.165, pad = w * 0.05, ratio = img.naturalWidth / img.naturalHeight;
  const pw = Math.min(w * 0.8, (h - capH - pad) * ratio), ph = pw / ratio, bw = Math.max(4, w * 0.012);
  const side = (w - pw) / 2 - bw - w * 0.055;
  sprinkles(el, w, h, 30, w * 0.035, [side, capH * 0.12, w - side, h]);
  const cap = caption(text, Math.min(w * 0.078, capH * 0.36));
  Object.assign(cap.style, { position: 'absolute', left: `${w * 0.06}px`, right: `${w * 0.06}px`, top: '0', height: `${capH}px`, display: 'flex', alignItems: 'center', justifyContent: 'center' });
  const phone = document.createElement('div');
  Object.assign(phone.style, { position: 'absolute', left: `${(w - pw) / 2 - bw}px`, top: `${capH}px`, width: `${pw + 2 * bw}px`, height: `${ph + 2 * bw}px`,
    border: `${bw}px solid ${INK}`, borderRadius: `${pw * 0.085}px`, overflow: 'hidden', background: INK, boxShadow: `0 ${w * 0.02}px ${w * 0.05}px rgba(36,25,63,.45)` });
  Object.assign(img.style, { display: 'block', width: `${pw}px`, height: `${ph}px`, borderRadius: `${pw * 0.075}px` });
  phone.append(img);
  el.append(cap, phone);
  await fontsReady();
}

/** Play feature graphic, 1024 x 500: icon, name and tagline on the left; a finished picture and its kittens on the right. */
async function feature(w = 1024, h = 500): Promise<void> {
  const el = stage(w, h);
  el.style.background = 'linear-gradient(115deg, #FFB8DA, #C9A8FF 45%, #6F55D9)';
  sprinkles(el, w, h, 30, 22, [40, 20, 600, 480]);
  const left = document.createElement('div');
  Object.assign(left.style, { position: 'absolute', left: '64px', top: '0', bottom: '0', width: '560px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '18px' });
  const icon = document.createElement('div');
  icon.innerHTML = appIcon(132);
  icon.style.filter = `drop-shadow(0 8px 0 ${INK})`;
  const name = caption('Pixel Purr', 96);
  Object.assign(name.style, { textAlign: 'left', whiteSpace: 'nowrap' });
  const tag = document.createElement('div');
  tag.textContent = 'Tap a kitten. Watch it paint.';
  Object.assign(tag.style, { fontFamily: FONT_BODY, fontWeight: '900', fontSize: '34px', color: INK });
  left.append(icon, name, tag);
  const card = document.createElement('div');
  Object.assign(card.style, { position: 'absolute', right: '70px', top: '58px', width: '330px', height: '330px', borderRadius: '42px', background: '#2E2260',
    border: `6px solid ${INK}`, boxShadow: `0 10px 0 ${INK}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'rotate(4deg)' });
  const pic = pictureCanvas(content.levelPicture(4), 270, 2);
  card.append(pic);
  const cats = document.createElement('div');
  Object.assign(cats.style, { position: 'absolute', right: '40px', bottom: '-6px', display: 'flex', gap: '2px', alignItems: 'flex-end' });
  cats.innerHTML = [[C.tangerine, 'pop'], [C.milk, 'fire'], [C.bubblegum, 'idle']].map(([c, mood], i) => purrlet(c as number, { w: i === 1 ? 128 : 112, mood: mood as 'idle' })).join('');
  el.append(left, card, cats);
  await fontsReady();
}

const api = { frame, feature };
(window as unknown as { __store: typeof api }).__store = api;
if (new URLSearchParams(location.search).has('feature')) void feature();
