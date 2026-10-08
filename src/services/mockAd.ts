// Web (dev) stand-in for a full-screen ad: an overlay with a short countdown and a Close button, so ad flows can be
// played in the browser. A rewarded mock can be skipped early to test the "no reward" path.
import '../fonts';
import { FONT_BODY, FONT_DISPLAY } from '../fonts';
import type { RewardedPlacement } from '../app/contracts';

export type MockAdKind = 'rewarded' | 'interstitial';
/** Shows a mock ad; resolves true when watched to the end (reward earned / ad closed normally). */
export type MockAdUi = (kind: MockAdKind, placement: RewardedPlacement | null, seconds: number) => Promise<boolean>;

/** Chunky check mark: plum outline under a white stroke, like the display text. */
const CHECK = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 25l9 9 19-20" fill="none" stroke="#24193F" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 25l9 9 19-20" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const PLACEMENT: Record<RewardedPlacement, string> = {
  continue: '+1 cushion to keep painting',
  booster: 'a free booster',
  doubleCoins: 'double win coins',
  lives: 'one extra life',
  shopCoins: '100 free coins',
  dailyDouble: 'a doubled daily gift',
};

const CSS = `
.pp-mockad { position: fixed; inset: 0; z-index: 2147483000; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 22px; padding: max(24px, env(safe-area-inset-top)) 24px max(24px, env(safe-area-inset-bottom));
  background: radial-gradient(120% 80% at 50% 30%, #4A3A96 0%, #33276F 50%, #1A1340 100%); color: #fff;
  font: 800 15px/1.3 ${FONT_BODY}; -webkit-user-select: none; user-select: none; touch-action: none; animation: pp-mockad-in .2s ease-out; }
@keyframes pp-mockad-in { from { opacity: 0; } }
.pp-mockad * { box-sizing: border-box; }
.pp-mockad button { all: unset; box-sizing: border-box; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.pp-mockad-o { font-family: ${FONT_DISPLAY}; font-weight: 400; -webkit-text-stroke: 5px #24193F; paint-order: stroke fill; text-shadow: 0 3px 0 #24193F; }
.pp-mockad-tag { position: absolute; top: max(16px, env(safe-area-inset-top)); left: 16px; padding: 4px 12px; border-radius: 999px;
  border: 2.5px solid #24193F; background: linear-gradient(#FFE066, #E08A12); font: 400 16px/1.2 ${FONT_DISPLAY}; color: #fff;
  -webkit-text-stroke: 3.5px #24193F; paint-order: stroke fill; box-shadow: 0 3px 0 #24193F; }
.pp-mockad-card { width: min(320px, 100%); padding: 26px 20px 22px; border-radius: 28px; border: 3px solid #24193F; text-align: center;
  background: linear-gradient(#5B4BB8, #3A2D86); box-shadow: 0 6px 0 #24193F, inset 0 3px 0 rgba(255,255,255,.18); }
.pp-mockad-title { font-size: 30px; line-height: 1.1; }
.pp-mockad-sub { margin-top: 8px; color: #E3DCFF; }
.pp-mockad-ring { --p: 0; position: relative; width: 132px; height: 132px; margin: 20px auto 6px; border-radius: 50%;
  background: conic-gradient(#FFD43B calc(var(--p) * 1turn), rgba(28,21,64,.9) 0); border: 3px solid #24193F;
  box-shadow: 0 5px 0 #24193F; display: grid; place-items: center; }
.pp-mockad-ring::after { content: ''; position: absolute; inset: 12px; border-radius: 50%; background: #2A1F5E; border: 3px solid #24193F; }
.pp-mockad-num { position: relative; z-index: 1; font-size: 54px; }
.pp-mockad-note { min-height: 20px; color: #C9C2EA; }
.pp-mockad .pp-mockad-btn { display: inline-flex; align-items: center; justify-content: center; min-width: 200px; height: 58px; padding: 0 28px; border-radius: 999px; border: 3px solid #24193F; cursor: pointer;
  background: linear-gradient(#8CE886, #2E9440); box-shadow: 0 5px 0 #24193F, inset 0 -4px 0 rgba(0,0,0,.12); color: #fff;
  font: 400 28px/1 ${FONT_DISPLAY}; -webkit-text-stroke: 5px #24193F; paint-order: stroke fill; text-shadow: 0 2px 0 #24193F;
  transition: transform .15s cubic-bezier(.34,1.8,.64,1), filter .15s; -webkit-tap-highlight-color: transparent; }
.pp-mockad .pp-mockad-btn:active:not(:disabled) { transform: translateY(3px); box-shadow: 0 2px 0 #24193F, inset 0 -4px 0 rgba(0,0,0,.12); }
.pp-mockad .pp-mockad-btn:disabled { background: linear-gradient(#A49CC8, #6C6390); cursor: default; }
.pp-mockad .pp-mockad-skip { color: #C9C2EA; font: 900 14px/1.2 ${FONT_BODY}; padding: 8px 14px; cursor: pointer;
  text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 4px; }
.pp-mockad .pp-mockad-skip[aria-hidden="true"] { visibility: hidden; }
.pp-mockad-num svg { display: block; width: 58px; height: 58px; overflow: visible; }
`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text) e.textContent = text;
  return e;
}

export const domMockAd: MockAdUi = (kind, placement, seconds) => new Promise(resolve => {
  if (!document.getElementById('pp-mockad-css')) {
    const s = el('style', '');
    s.id = 'pp-mockad-css';
    s.textContent = CSS;
    document.head.append(s);
  }
  const rewarded = kind === 'rewarded';
  const root = el('div', 'pp-mockad');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Mock ad');
  const card = el('div', 'pp-mockad-card');
  const ring = el('div', 'pp-mockad-ring');
  const num = el('div', 'pp-mockad-num pp-mockad-o', String(seconds));
  ring.append(num);
  const note = el('div', 'pp-mockad-note', rewarded ? 'Watch to the end for your reward' : 'The game continues after the ad');
  card.append(
    el('div', 'pp-mockad-title pp-mockad-o', rewarded ? 'Rewarded video' : 'Ad break'),
    el('div', 'pp-mockad-sub', rewarded && placement ? `Reward: ${PLACEMENT[placement]}` : 'Mock interstitial (web only)'),
    ring, note,
  );
  const close = el('button', 'pp-mockad-btn', 'Close');
  close.disabled = true;
  const skip = el('button', 'pp-mockad-skip', 'Skip (no reward)');
  root.append(el('div', 'pp-mockad-tag', 'AD'), card, close);
  if (rewarded) root.append(skip);
  document.body.append(root);

  const t0 = performance.now(), ms = seconds * 1000;
  let done = false, raf = 0;
  const tick = () => {
    const p = Math.min(1, (performance.now() - t0) / ms);
    ring.style.setProperty('--p', String(p));
    num.textContent = String(Math.ceil((1 - p) * seconds));
    if (p < 1) { raf = requestAnimationFrame(tick); return; }
    num.innerHTML = CHECK;
    close.disabled = false;
    note.textContent = rewarded ? 'Reward earned!' : 'Thanks for watching';
    skip.setAttribute('aria-hidden', 'true'); // keep its space so nothing jumps
    skip.tabIndex = -1;
    close.focus();
  };
  raf = requestAnimationFrame(tick);
  const finish = (watched: boolean) => {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    root.remove();
    resolve(watched);
  };
  close.onclick = () => finish(true);
  skip.onclick = () => finish(false);
});
