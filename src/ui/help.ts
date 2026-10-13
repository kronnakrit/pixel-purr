// Help page: what every booster does, with a little picture of it working, then the rules the player has met.
// Opens from the "?" at the end of the booster bar during play, and from the pause and settings cards.
import type { BoosterKey, HelpInfo, IntroKey } from '../app/contracts';
import { PALETTE } from '../engine/palette';
import { INK, boosterArt, flame, linked, place, purrlet, tray } from './art';
import { BOOSTER_INFO } from './boosters';
import { skyArt } from './cards';
import type { Ctx } from './ctx';
import { art, h, otext, pill } from './dom';
import type { Modals } from './modal';
import { actions, pageHead } from './panel';

// Paint indices (src/engine/palette.ts): the demos use a few friendly colours.
const CHERRY = 1, LEMON = 3, MATCHA = 4, SODA = 6, GRAPE = 7, BUBBLEGUM = 9;

const svgOpen = (w: number, h: number, label: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${label}">`;

/** A right-pointing arrow (white with an ink outline) from x0 to x1 at height y. */
function arrow(x0: number, x1: number, y: number): string {
  const d = `M${x0} ${y} H${x1 - 4} M${x1 - 13} ${y - 10} L${x1 - 2} ${y} L${x1 - 13} ${y + 10}`;
  return `<path d="${d}" stroke="${INK}" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
    + `<path d="${d}" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
}

/** One candy pixel cube like the board's, `s` wide, at x, y. */
function cube(x: number, y: number, s: number, c: number, opacity = 1): string {
  const p = PALETTE[c]!;
  return `<g opacity="${opacity}"><rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${s * 0.2}" fill="${p.dark}"/>`
    + `<rect x="${x}" y="${y}" width="${s * 0.88}" height="${s * 0.88}" rx="${s * 0.18}" fill="${p.hex}"/>`
    + `<rect x="${x + s * 0.14}" y="${y + s * 0.12}" width="${s * 0.3}" height="${s * 0.14}" rx="${s * 0.07}" fill="#fff" opacity=".55"/></g>`;
}

/** X-Ray Specs drawn over a Purrlet placed at x, y with width w (lined up with its eyes). */
function specs(x: number, y: number, w: number): string {
  const k = w / 100, ex = (v: number) => (x + v * k).toFixed(1), ey = (y + 51 * k).toFixed(1), r = (10 * k).toFixed(1);
  return `<path d="M${ex(49)} ${ey} H${ex(51)}" stroke="${INK}" stroke-width="${3 * k}"/>`
    + [39, 61].map(cx => `<circle cx="${ex(cx)}" cy="${ey}" r="${r}" fill="#9BE0FF" fill-opacity=".8" stroke="${INK}" stroke-width="${3.4 * k}"/>`).join('')
    + `<path d="M${ex(33)} ${(y + 47 * k).toFixed(1)} l${3 * k} ${-2 * k} M${ex(55)} ${(y + 47 * k).toFixed(1)} l${3 * k} ${-2 * k}" stroke="#fff" stroke-width="${2.2 * k}" stroke-linecap="round"/>`;
}

/** A small burst of rays around (x, y): the pixel being painted. */
function burst(x: number, y: number, r: number): string {
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4, c = Math.cos(a), s = Math.sin(a);
    return `M${(x + c * r * 0.6).toFixed(1)} ${(y + s * r * 0.6).toFixed(1)} L${(x + c * r).toFixed(1)} ${(y + s * r).toFixed(1)}`;
  }).join(' ');
  return `<path d="${rays}" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><path d="${rays}" stroke="#FFD43B" stroke-width="3" stroke-linecap="round"/>`;
}

/** Queues as columns of Purrlets, front at the top (drawn last so it sits over the one behind). */
function queues(cols: readonly (readonly number[])[], x0: number, y0: number, w = 34, dx = 38, dy = 25): string {
  let out = '';
  cols.forEach((col, qi) => {
    for (let d = col.length - 1; d >= 0; d--) {
      const cat = place(purrlet(col[d]!, { acc: false, label: '' }), x0 + qi * dx, y0 + d * dy, w);
      out += d === 0 ? cat : `<g opacity=".72">${cat}</g>`;
    }
  });
  return out;
}

/** Little pictures of each booster at work. */
const DEMO: Record<BoosterKey, () => string> = {
  // the tray with five napping Purrlets and the new, sixth cushion
  slot: () => {
    const t = place(tray(6, [[CHERRY, 10], [SODA, 20], [LEMON, 15], [MATCHA, 30], [BUBBLEGUM, 5]], 392, true), 0, 4, 300);
    return `${svgOpen(304, 76, 'A tray of five full cushions gets one more, empty one')}${t}`
      + `<circle cx="290" cy="13" r="12" fill="#5FCB5A" stroke="${INK}" stroke-width="3"/><path d="M290 7 v12 M284 13 h12" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/></svg>`;
  },
  // three queues with cherry at every front, then the same Purrlets with new colours in front
  shuffle: () => {
    const before = [[CHERRY, SODA, LEMON], [CHERRY, MATCHA, SODA], [CHERRY, LEMON, MATCHA]];
    const after = [[SODA, CHERRY, LEMON], [LEMON, CHERRY, MATCHA], [MATCHA, SODA, CHERRY]];
    return `${svgOpen(300, 98, 'Queues before and after a shuffle: the waiting Purrlets are mixed up, so different colours can come to the front')}${queues(before, 0, 0)}${arrow(124, 168, 46)}${queues(after, 186, 0)}</svg>`;
  },
  // napping Purrlets float up out of the tray, leaving every cushion free
  nap: () => {
    const cats = [CHERRY, SODA, LEMON, MATCHA, GRAPE].map((c, i) => {
      // centred over the cushions of the tray below (cushion centres at 36 + 64i in its 328 wide drawing)
      const x = ((36 + 64 * i) * 300) / 328 - 20, lift = i % 2 ? 4 : 0;
      return place(purrlet(c, { mood: 'nap', acc: false, label: '' }), x, lift, 40)
        + `<path d="M${x + 20} ${66 + lift} v-12 m-6 6 l6 -6 l6 6" stroke="${INK}" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
        + `<path d="M${x + 20} ${66 + lift} v-12 m-6 6 l6 -6 l6 6" stroke="#fff" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    }).join('');
    return `${svgOpen(300, 140, 'Napping Purrlets leave the tray, so every cushion is free')}${place(tray(5, [], 328), 0, 72, 300)}${cats}</svg>`;
  },
  // without specs the blue pixels block the cherry Purrlet; with them it paints the cherry pixel behind
  xray: () => {
    const row = (y: number, on: boolean) => {
      const cat = place(purrlet(CHERRY, { mood: on ? 'fire' : 'idle', acc: false, label: '' }), 6, y, 52);
      const eye = y + 32, s = 34, cx = [138, 178, 218];
      const beamEnd = on ? cx[2]! - 2 : cx[0]! - 4;
      const beam = `<path d="M62 ${eye} H${beamEnd}" stroke="${on ? '#FFD43B' : '#C9C2EA'}" stroke-width="5" stroke-dasharray="${on ? '0' : '7 6'}" stroke-linecap="round" opacity="${on ? 0.95 : 0.8}"/>`;
      const cubes = cube(cx[0]!, eye - s / 2, s, SODA, on ? 0.45 : 1) + cube(cx[1]!, eye - s / 2, s, SODA, on ? 0.45 : 1) + cube(cx[2]!, eye - s / 2, s, CHERRY);
      const mark = on ? burst(cx[2]! + s * 0.44, eye - s * 0.06, 34)
        : `<path d="M${cx[0]! - 20} ${eye - 8} l12 12 m0 -12 l-12 12" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M${cx[0]! - 20} ${eye - 8} l12 12 m0 -12 l-12 12" stroke="#FF6E88" stroke-width="3.6" stroke-linecap="round"/>`;
      return on ? `${cubes}${beam}${mark}${cat}${specs(6, y, 52)}` : `${beam}${cubes}${mark}${cat}`;
    };
    return `${svgOpen(276, 132, 'Without X-Ray Specs blue pixels block a cherry Purrlet; with them it paints the cherry pixel behind')}${row(0, false)}${row(68, true)}</svg>`;
  },
};

/** Small art for each rule. */
const RULE_ART: Record<IntroKey, () => string> = {
  basics: () => purrlet(CHERRY, { n: 30, label: '' }),
  tray: () => purrlet(SODA, { mood: 'nap', n: 10, label: '' }),
  spicy: () => flame(54),
  mystery: () => purrlet(0, { hidden: true, label: '' }),
  linked: () => linked(SODA, 20, CHERRY, 20, 210),
  background: () => skyArt(),
};

function boosterCard(b: HelpInfo['boosters'][number]): HTMLElement {
  const info = BOOSTER_INFO[b.key];
  const tag = b.unlocked ? otext(`${b.count} left`, `pp-helpb-tag ${b.count ? '' : 'pp-zero'}`, 'span') : otext(`Level ${info.unlock}`, 'pp-helpb-tag pp-lock', 'span');
  tag.setAttribute('aria-label', b.unlocked ? `You have ${b.count}` : `Unlocks at level ${info.unlock}`);
  const when = h('p', 'pp-helpb-when', h('b', '', 'Use it when '), info.when);
  const card = h('section', `pp-helpb ${b.unlocked ? '' : 'pp-locked'}`,
    h('div', 'pp-helpb-head', art(boosterArt(b.key, 56), 'pp-helpb-ic'), otext(info.name, 'pp-helpb-name', 'h3'), tag),
    art(DEMO[b.key](), 'pp-helpb-demo'),
    h('p', 'pp-sub pp-helpb-does', info.help),
    when);
  card.setAttribute('aria-label', info.name);
  return card;
}

function ruleRow(r: HelpInfo['rules'][number]): HTMLElement {
  // the heading names the rule; the little picture is decoration
  const ic = art(RULE_ART[r.key](), 'pp-helpr-ic');
  ic.setAttribute('aria-hidden', 'true');
  return h('div', `pp-helpr pp-helpr-${r.key}`, ic,
    h('div', 'pp-helpr-l', otext(r.title, 'pp-helpr-t', 'h3'), h('p', 'pp-sub', r.body)));
}

export function helpPage(m: Modals, ctx: Ctx, info: HelpInfo): Promise<void> {
  return m.show<void>({
    label: 'Help', kind: 'page', back: done => done(),
    build: done => {
      const body = h('div', 'pp-pbody pp-help',
        otext('Boosters', 'pp-help-h', 'h2'),
        h('p', 'pp-sub pp-help-lead', 'Tap one under the board during a level to use it. When you run out, tap it to get another for coins or a video.'),
        ...info.boosters.map(boosterCard));
      if (info.rules.length) body.append(otext('How to play', 'pp-help-h', 'h2'), ...info.rules.map(ruleRow));
      body.append(actions(pill('Got it!', 'green', () => done(), { cls: 'pp-primary' })));
      // no coin chip: nothing here costs coins, and a page's chip stays registered until the coins next change
      return h('div', 'pp-pagebox', pageHead(ctx, 'Help', () => done(), h('div', 'pp-help-sp')), body);
    },
  });
}
