// Home screen: winding level map, Play button, daily gift, bottom nav (Shop, Home, Sticker Book).
import type { HomeChoice, HomeState } from '../app/contracts';
import { ICONS, flame, pictureCanvas, purrlet } from './art';
import type { Ctx } from './ctx';
import { art, h, iconBtn, otext, pill } from './dom';
import { formatNumber } from './format';
import { mapLayout, mapPath } from './layout';

export interface HomeView {
  readonly el: HTMLElement;
  readonly visible: boolean;
  show(s: HomeState, choose: (c: HomeChoice) => void): void;
  hide(): void;
}

export function createHome(ctx: Ctx): HomeView {
  let choose: ((c: HomeChoice) => void) | null = null, state: HomeState | null = null, visible = false;
  const pick = (c: HomeChoice) => { const f = choose; if (!f) return; choose = null; f(c); };

  const mapIn = h('div', 'pp-map-in');
  const map = h('div', 'pp-map', mapIn);
  map.setAttribute('aria-label', 'Level map');
  const dailyDot = h('i', 'pp-dot');
  const daily = h('div', 'pp-side', iconBtn(ICONS.gift(56), 'Daily gift', () => pick('daily'), 'pp-daily-btn'), otext('Daily', 'pp-side-t', 'span'), dailyDot);
  const play = pill('Play', 'green', () => pick('play'), { size: 'xl', cls: 'pp-primary pp-pulse pp-play' });
  const stickBadge = otext('0', 'pp-navbadge', 'span');
  const navBtn = (icon: string, label: string, c: HomeChoice | null, cls = '') => {
    const b = iconBtn(icon, label, () => { if (c) pick(c); }, `pp-nav-b ${cls}`);
    if (!c) b.setAttribute('aria-current', 'page');
    return h('div', `pp-nav-i ${cls}`, b, h('span', 'pp-nav-t', label));
  };
  const stick = navBtn(ICONS.stickers(50), 'Sticker Book', 'stickers');
  stick.append(stickBadge);
  const nav = h('nav', 'pp-nav', h('div', 'pp-nav-in', navBtn(ICONS.shop(50), 'Shop', 'shop'), navBtn(ICONS.home(60), 'Home', null, 'pp-nav-home'), stick));
  nav.setAttribute('aria-label', 'Main');
  const el = h('div', 'pp-home pp-gone', h('div', 'pp-stagebg'), h('div', 'pp-col', map, daily, h('div', 'pp-playwrap', play)), nav);
  ctx.layers.screen.append(el);

  let lastW = 0;
  addEventListener('resize', () => { if (visible && state && map.clientWidth !== lastW) renderMap(state, false); });

  function renderMap(s: HomeState, scroll: boolean) {
    const W = map.clientWidth || Math.min(innerWidth, 480);
    lastW = W;
    const nodes = [...s.map].sort((a, b) => a.n - b.n);
    const L = mapLayout(nodes.map(n => n.n), W);
    mapIn.style.height = `${L.height}px`;
    mapIn.replaceChildren();
    const path = `<svg class="pp-path" width="${W}" height="${L.height}" aria-hidden="true"><path d="${mapPath(L.pts)}" fill="none" stroke="#fff" stroke-opacity=".2" stroke-width="10" stroke-dasharray="1 17" stroke-linecap="round"/></svg>`;
    mapIn.insertAdjacentHTML('beforeend', path);
    let curY = L.height / 2, cat: HTMLElement | null = null;
    nodes.forEach((m, i) => {
      const p = L.pts[i]!, cur = m.n === s.level, kind = cur ? 'pp-cur' : m.done ? 'pp-done' : m.spicy ? 'pp-hot' : 'pp-lock';
      const face = h('span', 'pp-node-face');
      if (m.done && m.picture && !cur) face.append(pictureCanvas(m.picture, 34));
      else face.append(otext(String(m.n), 'pp-node-n', 'span'));
      let node: HTMLElement;
      if (cur) {
        node = h('button', `pp-node ${kind}`, face);
        (node as HTMLButtonElement).type = 'button';
        node.setAttribute('aria-label', `Play level ${m.n}${m.spicy ? ', spicy' : ''}`);
        node.addEventListener('click', () => pick('play'));
        curY = p.y;
        // the cat peeks over the current node, leaning away from the next one so it never hides it
        const next = L.pts[i + 1], lean = next ? (next.x < p.x ? 1 : -1) * 18 : 0;
        cat = art(purrlet(3, { label: 'Your Purrlet' }), 'pp-mapcat pp-alive');
        cat.style.left = `${p.x + lean}px`; cat.style.top = `${p.y}px`;
      } else {
        node = h('div', `pp-node ${kind}`, face);
        node.setAttribute('role', 'img');
        node.setAttribute('aria-label', m.done ? `Level ${m.n}, done${m.picture ? `: ${m.picture.name}` : ''}` : `Level ${m.n}, ${m.n < s.level ? 'not finished' : 'locked'}${m.spicy ? ', spicy' : ''}`);
      }
      if (m.spicy) node.append(art(flame(cur ? 26 : 22), 'pp-node-flame'));
      node.style.left = `${p.x}px`; node.style.top = `${p.y}px`;
      mapIn.append(node);
    });
    if (cat) mapIn.append(cat);
    if (scroll) requestAnimationFrame(() => { map.scrollTop = Math.max(0, curY - map.clientHeight * 0.6); });
  }

  return {
    el,
    get visible() { return visible; },
    show(s, c) {
      state = s; choose = c;
      play.querySelector('.pp-pill-t')!.textContent = `Play ${s.level}`;
      play.setAttribute('aria-label', `Play level ${s.level}`);
      daily.classList.toggle('pp-has', s.dailyAvailable);
      dailyDot.hidden = !s.dailyAvailable;
      daily.querySelector('button')?.setAttribute('aria-label', s.dailyAvailable ? 'Daily gift, ready to claim' : 'Daily gift');
      stickBadge.textContent = formatNumber(s.stickers);
      stickBadge.hidden = s.stickers <= 0;
      const fresh = !visible;
      visible = true;
      el.classList.remove('pp-gone', 'pp-leave');
      if (fresh) { el.classList.remove('pp-enter'); void el.offsetWidth; el.classList.add('pp-enter'); }
      renderMap(s, fresh);
    },
    hide() {
      if (!visible) return;
      visible = false; choose = null;
      el.classList.add('pp-leave');
      setTimeout(() => { if (!visible) el.classList.add('pp-gone'); }, 220);
    },
  };
}
