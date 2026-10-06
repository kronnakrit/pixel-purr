// SVG art kit, ported from the design page (pixel-flow/art.js): Purrlets, glossy round icons, booster tiles,
// the app icon, plus crisp canvas thumbnails of engine pictures. SVG functions return markup strings sized by `w`;
// gradient ids are unique per call so many copies can live inline in one document.
import type { BoosterKey } from '../app/contracts';
import { PALETTE, type Paint } from '../engine/palette';
import type { Picture } from '../engine/picture';

export const INK = '#24193F';
const CREAM = '#FFF4E4';
let uid = 0;
const id = (p: string) => `pp-${p}${++uid}`;
const LILITA = `font-family="'Lilita One', 'Arial Rounded MT Bold', sans-serif"`;

// ---------------------------------------------------------------- Purrlets

type Accessory = 'bow' | 'leaf' | 'star' | 'drop' | 'bubble' | 'flower' | 'heart';
const ACC: Record<string, Accessory> = { cherry: 'bow', tangerine: 'leaf', lemon: 'star', matcha: 'leaf', mint: 'drop', soda: 'bubble', grape: 'bow', lilac: 'flower', bubblegum: 'heart', cocoa: 'flower', milk: 'bow', licorice: 'star' };
const ACC_FILL: Record<Accessory, string> = { bow: '#FF5C8A', leaf: '#5FCB5A', star: '#FFE45C', drop: '#7FD7FF', bubble: '#BDEBFF', flower: '#FFFFFF', heart: '#FF4D6D' };
const MYSTERY: Paint = { key: 'licorice', name: 'Mystery', hex: '#6C6390', light: '#9A91C2', dark: '#463E68' };

function accessory(kind: Accessory, x: number, y: number, s = 1): string {
  const f = ACC_FILL[kind], o = `stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"`, T = `transform="translate(${x} ${y}) scale(${s})"`;
  switch (kind) {
    case 'bow': return `<g ${T}><path d="M0 0 L-12 -8 Q-15 0 -12 8 Z M0 0 L12 -8 Q15 0 12 8 Z" fill="${f}" ${o}/><circle r="3.6" fill="${f}" ${o}/></g>`;
    case 'leaf': return `<g ${T}><path d="M-2 4 Q-2 -12 12 -12 Q12 4 -2 4 Z" fill="${f}" ${o}/><path d="M-2 4 L6 -5" stroke="${INK}" stroke-width="1.6"/></g>`;
    case 'star': return `<g ${T}><path d="M0 -10 L3 -3 L10 -3 L4.5 1.5 L6.5 9 L0 4.5 L-6.5 9 L-4.5 1.5 L-10 -3 L-3 -3 Z" fill="${f}" ${o}/></g>`;
    case 'drop': return `<g ${T}><path d="M0 -11 Q8 0 6 4 A6 6 0 0 1 -6 4 Q-8 0 0 -11 Z" fill="${f}" ${o}/></g>`;
    case 'bubble': return `<g ${T}><circle r="7" fill="${f}" ${o}/><circle cx="-2.4" cy="-2.4" r="2" fill="#fff"/><circle cx="9" cy="-8" r="3" fill="${f}" ${o}/></g>`;
    case 'flower': return `<g ${T}>${[0, 72, 144, 216, 288].map(a => `<circle cx="${(6 * Math.cos((a * Math.PI) / 180)).toFixed(1)}" cy="${(6 * Math.sin((a * Math.PI) / 180)).toFixed(1)}" r="4.6" fill="${f}" ${o}/>`).join('')}<circle r="3.6" fill="#FFD43B" ${o}/></g>`;
    case 'heart': return `<g ${T}><path d="M0 8 C-12 0 -9 -10 0 -5 C9 -10 12 0 0 8 Z" fill="${f}" ${o}/></g>`;
  }
}

/** idle: round eyes · fire: squint while painting · nap: closed arcs · pop: happy arcs · worried: brows and a sweat drop. */
export type Mood = 'idle' | 'fire' | 'nap' | 'pop' | 'worried';
export interface PurrletOpts { n?: number | null; mood?: Mood; hidden?: boolean; w?: number; acc?: boolean; label?: string }

/** The paint pot peeker: a cream kitten in a pot of its paint colour. c = engine colour index (1..12). */
export function purrlet(c: number, o: PurrletOpts = {}): string {
  const { n = null, mood = 'idle', hidden = false, w = 100, acc = true } = o;
  const col = hidden ? MYSTERY : PALETTE[c] ?? MYSTERY;
  const g = id('pg'), sh = id('ps'), OL = `stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"`;
  const hy = mood === 'fire' ? -5 : mood === 'nap' ? 5 : mood === 'pop' ? -9 : 0;
  let eyes: string;
  if (mood === 'nap') eyes = `<path d="M34 45 q5 5 10 0 M56 45 q5 5 10 0" stroke="${INK}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`;
  else if (mood === 'fire') eyes = `<path d="M34 41 l8 4 l-8 4 M66 41 l-8 4 l8 4" stroke="${INK}" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  else if (mood === 'pop') eyes = `<path d="M34 47 q5 -6 10 0 M56 47 q5 -6 10 0" stroke="${INK}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`;
  else eyes = `<ellipse cx="39" cy="45" rx="4.4" ry="5.6" fill="${INK}"/><ellipse cx="61" cy="45" rx="4.4" ry="5.6" fill="${INK}"/><circle cx="37.7" cy="42.9" r="1.85" fill="#fff"/><circle cx="59.7" cy="42.9" r="1.85" fill="#fff"/><circle cx="40.5" cy="47.2" r=".8" fill="#fff"/><circle cx="62.5" cy="47.2" r=".8" fill="#fff"/>`
    + (mood === 'worried' ? `<path d="M32 37 L43 33 M68 37 L57 33" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>` : '');
  const nose = `<path d="M47.4 51 h5.2 l-2.6 2.8 Z" fill="#FF7EA8" stroke="${INK}" stroke-width="1" stroke-linejoin="round"/>`;
  const mouth = mood === 'fire' || mood === 'pop' ? `<path d="M46.8 54.6 q3.2 6 6.4 0 Z" fill="${INK}"/><path d="M48.4 57.4 q1.6 1.2 3.2 0" fill="#FF7EA8"/>`
    : mood === 'worried' ? `<path d="M45.6 57 q2.2 -2.4 4.4 0 q2.2 2.4 4.4 0" stroke="${INK}" stroke-width="2.1" fill="none" stroke-linecap="round"/>`
      : `<path d="M46.8 54.4 q1.6 2.6 3.2 0 q1.6 2.6 3.2 0" stroke="${INK}" stroke-width="2.1" fill="none" stroke-linecap="round"/>`;
  const num = hidden ? `<text x="50" y="97" text-anchor="middle" ${LILITA} font-size="22" fill="#C9C2EA" stroke="${INK}" stroke-width="4" paint-order="stroke">?</text>`
    : n == null ? '' : `<text x="50" y="96" text-anchor="middle" ${LILITA} font-size="${String(n).length > 2 ? 15 : 17}" fill="#fff" stroke="${INK}" stroke-width="4.4" paint-order="stroke" stroke-linejoin="round">${n}</text>`;
  const sweat = mood === 'worried' ? `<path class="pp-sweat" d="M83 30 Q89 39 86.5 42.5 A4 4 0 0 1 79.6 39 Q79.5 35 83 30 Z" fill="#9BE0FF" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>` : '';
  const py = mood === 'pop' ? 59 : 63 + hy * 0.3;
  const label = o.label ?? `${col.name} Purrlet${n != null ? ` with ${n} paint` : ''}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" class="pp-cat pp-mood-${mood}" viewBox="0 0 100 116" width="${w}" height="${(w * 1.16).toFixed(1)}" role="img" aria-label="${label}">
<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col.light}"/><stop offset=".45" stop-color="${col.hex}"/><stop offset="1" stop-color="${col.dark}"/></linearGradient>
<radialGradient id="${sh}"><stop offset="0" stop-color="#000" stop-opacity=".38"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>
<ellipse class="pp-shadow" cx="50" cy="111" rx="32" ry="5" fill="url(#${sh})"/>
<g transform="translate(0 6)"><g class="pp-all">
<ellipse cx="50" cy="62" rx="33" ry="8" fill="${col.dark}" ${OL}/><ellipse cx="50" cy="63" rx="29" ry="5.6" fill="${mood === 'pop' ? col.dark : col.hex}"/>
<g class="pp-head"><g transform="translate(0 ${hy})">
${mood === 'pop' ? '' : `<g class="pp-tail"><path d="M74 60 q14 -6 10 -22 q-2 -6 -7 -3" stroke="${INK}" stroke-width="9" fill="none" stroke-linecap="round"/><path d="M74 60 q14 -6 10 -22 q-2 -6 -7 -3" stroke="${CREAM}" stroke-width="5" fill="none" stroke-linecap="round"/></g>`}
<g class="pp-earL"><path d="M23 44 L25 14 Q27 9 33 13 L46 27 Z" fill="${CREAM}" ${OL}/><path d="M28 34 L29 19 L39 27 Z" fill="${col.light}"/></g>
<g class="pp-earR"><path d="M77 44 L75 14 Q73 9 67 13 L54 27 Z" fill="${CREAM}" ${OL}/><path d="M72 34 L71 19 L61 27 Z" fill="${col.light}"/></g>
<ellipse cx="50" cy="46" rx="29" ry="24" fill="${CREAM}" ${OL}/>
${hidden ? '' : `<path d="M58 24 q5 -4 10 0 q4 3 0 7 q-1 6 -4 2 q-4 2 -6 -2 q-4 -3 0 -7 Z" fill="${col.hex}"/><circle cx="71" cy="36" r="2" fill="${col.hex}"/>`}
<g class="pp-eyes">${eyes}</g>${nose}${mouth}<ellipse cx="29" cy="53" rx="5" ry="3" fill="#FF6FA8" opacity=".55"/><ellipse cx="71" cy="53" rx="5" ry="3" fill="#FF6FA8" opacity=".55"/>
<path d="M21 50 l-9 -2 M21 54 l-9 2 M79 50 l9 -2 M79 54 l9 2" stroke="${INK}" stroke-width="1.5" stroke-linecap="round" opacity=".55"/>
${acc && !hidden ? accessory(ACC[col.key] ?? 'bow', 30, 24, 0.7) : ''}${sweat}
</g></g>
<path d="M17 62 A33 8 0 0 0 83 62 L79 97 Q50 107 21 97 Z" fill="url(#${g})" ${OL}/>
<path d="M30 69 v9 a3.2 3.2 0 0 0 6.4 0 v-8 Z M60 70 v5 a3 3 0 0 0 6 0 v-5 Z" fill="${col.light}"/><path d="M23 72 Q50 82 77 72" stroke="#fff" stroke-opacity=".35" stroke-width="3" fill="none"/>
<ellipse cx="37" cy="${py}" rx="7" ry="4.6" fill="${CREAM}" ${OL}/><ellipse cx="63" cy="${py}" rx="7" ry="4.6" fill="${CREAM}" ${OL}/>
<path d="M35 ${py - 2} v3 M39 ${py - 2} v3 M61 ${py - 2} v3 M65 ${py - 2} v3" stroke="${INK}" stroke-width="1.2" stroke-linecap="round" opacity=".5"/>
${num}
</g></g></svg>`;
}

/** Place an <svg> string inside another at x, y with width w (keeps its aspect). */
export function place(svg: string, x: number, y: number, w: number): string {
  const vb = /viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"/.exec(svg), h = vb ? (w * Number(vb[4])) / Number(vb[3]) : w;
  return svg.replace('<svg ', `<svg x="${x}" y="${y}" `).replace(/width="[\d.]+"( height="[\d.]+")?/, `width="${w}" height="${h.toFixed(1)}"`);
}

/** Two Purrlets tied with a yarn ribbon (linked pair). */
export function linked(c1: number, n1: number, c2: number, n2: number, w = 210): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 116" width="${w}" height="${((w * 116) / 210).toFixed(1)}" role="img" aria-label="Linked Purrlets">
${place(purrlet(c1, { n: n1 }), 0, 0, 100)}${place(purrlet(c2, { n: n2 }), 110, 0, 100)}
<path d="M84 70 Q105 58 126 70" stroke="#FF7EC8" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M84 70 Q105 58 126 70" stroke="#fff" stroke-width="2" fill="none" stroke-dasharray="3 5" stroke-linecap="round"/>
<g transform="translate(105 62)"><path d="M0 0 L-10 -7 Q-12 0 -10 7 Z M0 0 L10 -7 Q12 0 10 7 Z" fill="#FF7EC8" stroke="${INK}" stroke-width="2"/><circle r="3.4" fill="#FF7EC8" stroke="${INK}" stroke-width="2"/></g></svg>`;
}

// ---------------------------------------------------------------- glossy icons

interface BtnOpts { fill?: string; dark?: string; w?: number; label?: string; round?: boolean }
/** A chunky glossy button face (round, or rounded square) with `inside` drawn around its centre. */
export function btn(inside: string, o: BtnOpts = {}): string {
  const { fill = '#3D8BFF', dark = '#2457C9', w = 64, label = '', round = true } = o, g = id('bt');
  const face = round
    ? `<circle cx="32" cy="34" r="29" fill="${INK}"/><circle cx="32" cy="31" r="27" fill="url(#${g})"/><ellipse cx="25" cy="17" rx="12" ry="6" fill="#fff" opacity=".35"/>`
    : `<rect x="3" y="6" width="58" height="56" rx="18" fill="${INK}"/><rect x="5" y="3" width="54" height="54" rx="16" fill="url(#${g})"/><ellipse cx="24" cy="14" rx="14" ry="5" fill="#fff" opacity=".35"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${w}" height="${w}" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'}>
<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${fill}"/><stop offset="1" stop-color="${dark}"/></linearGradient></defs>
${face}<g transform="translate(32 31)">${inside}</g></svg>`;
}

const S = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
const gearPath = (() => {
  let d = '';
  const p = (r: number, t: number) => `${(r * Math.cos(t)).toFixed(1)} ${(r * Math.sin(t)).toFixed(1)}`;
  for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, a1 = a - 0.2, a2 = a + 0.2; d += (i ? 'L' : 'M') + p(12, a1 - 0.2) + 'L' + p(17, a1) + 'L' + p(17, a2) + 'L' + p(12, a2 + 0.2); }
  return d + 'Z';
})();
const PURPLE = { fill: '#8E5BF0', dark: '#5B2FC0' };

/** Small flat flame (spicy levels). */
export function flame(w = 24): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 30" width="${w}" height="${((w * 30) / 24).toFixed(1)}" role="img" aria-label="Spicy">
<path d="M12 2 C14 8 21 11 21 19 A9 9 0 0 1 3 19 C3 14 6 12 7 8 C9 11 10 12 11 12 C12 9 12 6 12 2 Z" fill="#FF6B3D" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
<path d="M12 14 C13 17 16 18 16 21.5 A4 4 0 0 1 8 21.5 C8 19 10 18 12 14 Z" fill="#FFD43B"/></svg>`;
}

export function coin(w = 64, label = 'Coin'): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${w}" height="${w}" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'}><circle cx="32" cy="34" r="26" fill="#C98A12" stroke="${INK}" stroke-width="2.5"/><circle cx="32" cy="31" r="25" fill="#FFC93B" stroke="${INK}" stroke-width="2.5"/><circle cx="32" cy="31" r="17" fill="#FFDD6B" stroke="#E0A21C" stroke-width="3"/><path d="M24 26 l3 -7 l5 5 l5 -5 l3 7 Q32 34 24 26 Z" fill="#E0A21C"/><ellipse cx="22" cy="18" rx="8" ry="4" fill="#fff" opacity=".6"/></svg>`;
}

/** 1..4 coins piled up (shop packs). */
export function coinPile(k: number, w = 96): string {
  const spots: [number, number, number][][] = [
    [[24, 18, 48]],
    [[12, 20, 46], [38, 16, 46]],
    [[8, 30, 44], [44, 30, 44], [26, 10, 46]],
    [[4, 34, 42], [50, 34, 42], [14, 8, 44], [40, 8, 44]],
  ];
  const set = spots[Math.min(4, Math.max(1, k)) - 1]!;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 80" width="${w}" height="${((w * 80) / 96).toFixed(1)}" aria-hidden="true">${set.map(([x, y, s]) => place(coin(64, ''), x, y, s)).join('')}</svg>`;
}

export function heart(w = 64): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${w}" height="${w}" aria-hidden="true"><path d="M32 57 C3 39 5 11 22 11 C28 11 31 15 32 18 C33 15 36 11 42 11 C59 11 61 39 32 57 Z" fill="${INK}"/><path d="M32 56 C4 38 6 12 22 12 C28 12 31 16 32 19 C33 16 36 12 42 12 C58 12 60 38 32 56 Z" fill="#C21E4A"/><path d="M32 52 C6 36 8 12 22 12 C28 12 31 16 32 19 C33 16 36 12 42 12 C56 12 58 36 32 52 Z" fill="#FF4D6D"/><ellipse cx="20" cy="22" rx="6" ry="4" fill="#fff" opacity=".6" transform="rotate(-30 20 22)"/></svg>`;
}

export function star(w = 64): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${w}" height="${w}" aria-hidden="true"><path d="M32 6 L40 24 L59 25 L44 37 L49 56 L32 46 L15 56 L20 37 L5 25 L24 24 Z" fill="#D79A12" transform="translate(0 3)"/><path d="M32 6 L40 24 L59 25 L44 37 L49 56 L32 46 L15 56 L20 37 L5 25 L24 24 Z" fill="#FFD43B" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M26 22 L32 10 L35 20 Z" fill="#fff" opacity=".7"/></svg>`;
}

/** White infinity sign with a plum outline (unlimited lives). */
export function infinity(w = 28): string {
  const d = 'M16 12 C12 4 3 5 3 12 C3 19 12 20 16 12 C20 4 29 5 29 12 C29 19 20 20 16 12 Z';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 24" width="${w}" height="${((w * 24) / 32).toFixed(1)}" role="img" aria-label="Unlimited"><path d="${d}" fill="none" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#fff" stroke-width="3.4" stroke-linejoin="round"/></svg>`;
}

/** Small white video badge used inside "with video" buttons. */
export function videoGlyph(w = 26): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 22" width="${w}" height="${((w * 22) / 30).toFixed(1)}" aria-hidden="true"><rect x="1.5" y="1.5" width="27" height="19" rx="5" fill="#fff" stroke="${INK}" stroke-width="2.5"/><path d="M12 6.5 L19.5 11 L12 15.5 Z" fill="#2D63D8"/></svg>`;
}

export function check(w = 22): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${w}" height="${w}" aria-hidden="true"><circle cx="12" cy="12" r="10.5" fill="#5FCB5A" stroke="${INK}" stroke-width="2.5"/><path d="M7 12.5 l3.4 3.4 L17 9" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

export type IconKey = 'settings' | 'pause' | 'plus' | 'back' | 'close' | 'sound' | 'music' | 'vibrate' | 'motion' | 'lock'
  | 'home' | 'shop' | 'stickers' | 'trophy' | 'gift' | 'restart' | 'video';

export const ICONS: Record<IconKey, (w?: number) => string> = {
  settings: w => btn(`<path d="${gearPath}" fill="#fff" ${S}/><circle r="5" fill="#3D8BFF" ${S}/>`, { w }),
  pause: w => btn(`<rect x="-10" y="-11" width="7" height="22" rx="2" fill="#fff"/><rect x="3" y="-11" width="7" height="22" rx="2" fill="#fff"/>`, { w }),
  plus: w => btn(`<path d="M0 -11 V11 M-11 0 H11" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M0 -11 V11 M-11 0 H11" stroke="#fff" stroke-width="5" stroke-linecap="round"/>`, { fill: '#FFC93B', dark: '#E08A12', round: false, w }),
  back: w => btn(`<path d="M5 -11 L-7 0 L5 11" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`, { w }),
  close: w => btn(`<path d="M-9 -9 L9 9 M9 -9 L-9 9" stroke="#fff" stroke-width="6" stroke-linecap="round"/>`, { fill: '#FF5C7A', dark: '#C21E4A', w }),
  sound: w => btn(`<path d="M-12 -5 h6 l8 -7 v24 l-8 -7 h-6 z" fill="#fff"/><path d="M6 -6 q5 6 0 12 M10 -10 q9 10 0 20" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>`, { ...PURPLE, w }),
  music: w => btn(`<path d="M-4 8 V-12 L10 -15 V5" stroke="#fff" stroke-width="3.5" fill="none" stroke-linejoin="round"/><circle cx="-8" cy="8" r="5" fill="#fff"/><circle cx="6" cy="5" r="5" fill="#fff"/>`, { ...PURPLE, w }),
  vibrate: w => btn(`<rect x="-7" y="-12" width="14" height="24" rx="4" fill="#fff"/><path d="M-12 -6 l-3 3 l3 3 l-3 3 M12 -6 l3 3 l-3 3 l3 3" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round"/>`, { ...PURPLE, w }),
  motion: w => btn(`<path d="M0 -13 Q2 -2 13 0 Q2 2 0 13 Q-2 2 -13 0 Q-2 -2 0 -13 Z" fill="#fff"/><circle cx="10" cy="-10" r="2.6" fill="#fff"/><circle cx="-10" cy="10" r="2" fill="#fff"/>`, { ...PURPLE, w }),
  lock: w => btn(`<rect x="-10" y="-3" width="20" height="16" rx="4" fill="#fff"/><path d="M-6 -3 v-5 a6 6 0 0 1 12 0 v5" stroke="#fff" stroke-width="4" fill="none"/><circle cy="5" r="2.5" fill="#6C6390"/>`, { fill: '#8C83B8', dark: '#5C5488', w }),
  home: w => btn(`<path d="M-12 0 L0 -12 L12 0 V12 H-12 Z" fill="#fff" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><rect x="-3" y="3" width="6" height="9" fill="#3D8BFF"/>`, { w }),
  shop: w => btn(`<path d="M-11 -4 h22 l-2 16 h-18 z" fill="#fff" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/><path d="M-5 -4 v-4 a5 5 0 0 1 10 0 v4" stroke="#fff" stroke-width="3" fill="none"/><circle cx="-4.5" cy="1" r="1.6" fill="#D6449A"/><circle cx="4.5" cy="1" r="1.6" fill="#D6449A"/>`, { fill: '#FF7EC8', dark: '#D6449A', w }),
  stickers: w => btn(`<path d="M-12 -12 h19 a4 4 0 0 1 4 4 v20 h-19 a4 4 0 0 1 -4 -4 Z" fill="#fff"/><path d="M-8 -12 v24" stroke="#BFA0FF" stroke-width="2.5"/><path d="M3 -7 L4.8 -3.2 L9 -2.8 L5.8 0 L6.8 4.2 L3 2 L-0.8 4.2 L0.2 0 L-3 -2.8 L1.2 -3.2 Z" fill="#FFD43B" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`, { ...PURPLE, w }),
  trophy: w => btn(`<path d="M-9 -12 h18 v6 a9 9 0 0 1 -18 0 z" fill="#FFD43B"/><path d="M-9 -9 h-5 a5 5 0 0 0 5 7 M9 -9 h5 a5 5 0 0 1 -5 7" stroke="#FFD43B" stroke-width="3" fill="none"/><rect x="-2" y="2" width="4" height="6" fill="#FFD43B"/><rect x="-7" y="8" width="14" height="4" rx="2" fill="#FFD43B"/>`, { ...PURPLE, w }),
  gift: w => btn(`<rect x="-11" y="-4" width="22" height="15" rx="2" fill="#fff"/><rect x="-13" y="-9" width="26" height="6" rx="2" fill="#fff"/><rect x="-2" y="-9" width="4" height="20" fill="#FF4D6D"/><path d="M0 -9 q-9 -8 -10 -1 M0 -9 q9 -8 10 -1" stroke="#FF4D6D" stroke-width="3" fill="none"/>`, { fill: '#5FCB5A', dark: '#2E9440', w }),
  restart: w => btn(`<path d="M9 -6 A11 11 0 1 0 10 5" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M4 -12 L12 -7 L5 -1 Z" fill="#fff" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>`, { w }),
  video: w => btn(`<rect x="-13" y="-9" width="26" height="18" rx="4" fill="#fff"/><path d="M-3 -5 L6 0 L-3 5 Z" fill="#5FCB5A"/>`, { fill: '#5FCB5A', dark: '#2E9440', w }),
};

// ---------------------------------------------------------------- boosters

const BOOSTER_FACE: Record<BoosterKey, { inside: string; fill: string; dark: string }> = {
  slot: { fill: '#C9A8FF', dark: '#8E5BF0', inside: `<rect x="-16" y="-6" width="32" height="18" rx="5" fill="#2A2058" stroke="${INK}" stroke-width="2.5"/><rect x="-12" y="-3" width="10" height="12" rx="3" fill="#FFD43B"/><rect x="2" y="-3" width="10" height="12" rx="3" fill="#1C1540" stroke="#FFD43B" stroke-dasharray="3 2" stroke-width="1.6"/><circle cx="12" cy="-12" r="7" fill="#5FCB5A" stroke="${INK}" stroke-width="2.5"/><path d="M12 -16 v8 M8 -12 h8" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>` },
  shuffle: { fill: '#9BE0FF', dark: '#3FB8F5', inside: `<circle r="12" fill="#FF7EC8" stroke="${INK}" stroke-width="2.5"/><path d="M-9 -6 q9 4 18 -1 M-11 1 q11 5 22 0 M-8 7 q8 3 16 -1" stroke="#fff" stroke-width="2" fill="none"/><path d="M10 9 q8 4 6 10" stroke="#FF7EC8" stroke-width="3" fill="none" stroke-linecap="round"/>` },
  nap: { fill: '#B4AAF5', dark: '#5B4FC0', inside: `<path d="M-15 8 q15 -16 30 0 z" fill="#FFD43B" stroke="${INK}" stroke-width="2.5"/><path d="M-6 2 q3 3 6 0 M2 2 q3 3 6 0" stroke="${INK}" stroke-width="2" fill="none"/><text x="6" y="-6" ${LILITA} font-size="12" fill="#fff" stroke="${INK}" stroke-width="3" paint-order="stroke">z</text><text x="12" y="-13" ${LILITA} font-size="9" fill="#fff" stroke="${INK}" stroke-width="3" paint-order="stroke">z</text>` },
  xray: { fill: '#FF9AAE', dark: '#FF4D6D', inside: `<circle cx="-8" cy="0" r="8" fill="#9BE0FF" stroke="${INK}" stroke-width="3"/><circle cx="8" cy="0" r="8" fill="#9BE0FF" stroke="${INK}" stroke-width="3"/><path d="M-1 0 h2" stroke="${INK}" stroke-width="3"/><path d="M-12 -3 l3 -2 M4 -3 l3 -2" stroke="#fff" stroke-width="2" stroke-linecap="round"/>` },
};

/** Booster tile art (rounded square). */
export function boosterArt(k: BoosterKey, w = 72): string {
  const f = BOOSTER_FACE[k];
  return btn(f.inside, { fill: f.fill, dark: f.dark, round: false, w });
}
export const boosterColor = (k: BoosterKey): string => BOOSTER_FACE[k].dark;

// ---------------------------------------------------------------- tray, hand, app icon

/** A mini cushion tray with napping Purrlets ([colour, paint] per slot); `extra` makes the last slot dashed gold. */
export function tray(slots: number, filled: readonly (readonly [number, number])[], w = 300, extra = false): string {
  const sw = 56, gap = 8, W = slots * sw + (slots - 1) * gap + 16;
  const cells = Array.from({ length: slots }, (_, i) => {
    const x = 8 + i * (sw + gap), f = filled[i], ex = extra && i === slots - 1;
    return `<rect x="${x}" y="14" width="${sw}" height="58" rx="14" fill="${ex ? '#3E3482' : '#1C1540'}" stroke="${ex ? '#FFD43B' : '#3B3070'}" stroke-width="${ex ? 2.5 : 2}" ${ex ? 'stroke-dasharray="6 4"' : ''}/>
<rect x="${x + 4}" y="16" width="${sw - 8}" height="7" rx="3.5" fill="#000" opacity=".25"/>${f ? place(purrlet(f[0], { n: f[1], mood: 'nap', acc: false }), x + 4, 12, sw - 8) : ''}`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 86" width="${w}" height="${((w * 86) / W).toFixed(1)}" role="img" aria-label="Cushion tray with ${slots} slots"><rect x="0" y="6" width="${W}" height="74" rx="20" fill="#2A2058"/>${cells}</svg>`;
}

/** Pointing hand for the tutorial. The fingertip is at (22, 4) of the 64×80 box. */
export function hand(w = 64): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 66 82" width="${w}" height="${((w * 82) / 66).toFixed(1)}" aria-hidden="true">
<path d="M16 38 V10 a6 6 0 0 1 12 0 V30 a5.5 5.5 0 0 1 11 0 v2 a5.5 5.5 0 0 1 11 0 v4 a5 5 0 0 1 10 0 V52 q0 18 -20 20 h-6 q-14 0 -20 -14 l-8 -14 a5 5 0 0 1 8 -6 Z" fill="${INK}" transform="translate(0 3)"/>
<path d="M16 38 V10 a6 6 0 0 1 12 0 V30 a5.5 5.5 0 0 1 11 0 v2 a5.5 5.5 0 0 1 11 0 v4 a5 5 0 0 1 10 0 V52 q0 18 -20 20 h-6 q-14 0 -20 -14 l-8 -14 a5 5 0 0 1 8 -6 Z" fill="${CREAM}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
<path d="M28 32 v6 M39 33 v5 M50 37 v4" stroke="${INK}" stroke-width="2.2" stroke-linecap="round" opacity=".5"/><ellipse cx="20" cy="9" rx="2.5" ry="4" fill="#fff" opacity=".8"/>
<ellipse cx="40" cy="58" rx="6" ry="3.6" fill="#FF6FA8" opacity=".45"/></svg>`;
}

/** App icon: lemon Purrlet face filling a glossy squircle. */
export function appIcon(w = 180): string {
  const g = id('ai');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="${w}" height="${w}" role="img" aria-label="Pixel Purr">
<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF08A"/><stop offset=".5" stop-color="#FFD43B"/><stop offset="1" stop-color="#E9A916"/></linearGradient></defs>
<rect width="180" height="180" rx="42" fill="url(#${g})"/>
<path d="M22 64 L30 18 Q33 10 41 15 L72 40 Z M158 64 L150 18 Q147 10 139 15 L108 40 Z" fill="#F2BC22"/><path d="M33 50 L37 27 L54 41 Z M147 50 L143 27 L126 41 Z" fill="#FF9CC6"/>
<ellipse cx="60" cy="96" rx="13" ry="16" fill="${INK}"/><ellipse cx="120" cy="96" rx="13" ry="16" fill="${INK}"/><circle cx="55" cy="89" r="5.5" fill="#fff"/><circle cx="115" cy="89" r="5.5" fill="#fff"/>
<ellipse cx="38" cy="122" rx="12" ry="7" fill="#FF6FA8" opacity=".55"/><ellipse cx="142" cy="122" rx="12" ry="7" fill="#FF6FA8" opacity=".55"/>
<path d="M80 118 q5 7 10 0 q5 7 10 0" stroke="${INK}" stroke-width="4.5" fill="none" stroke-linecap="round"/>
${[0, 1, 2].map(i => `<rect x="${126 + i * 13}" y="${146 - (i % 2) * 13}" width="12" height="12" rx="2" fill="${['#FF4D6D', '#3FB8F5', '#5FCB5A'][i]}"/>`).join('')}
<ellipse cx="54" cy="36" rx="24" ry="9" fill="#fff" opacity=".5" transform="rotate(-18 54 36)"/></svg>`;
}

// ---------------------------------------------------------------- picture thumbnails

/**
 * The picture as glossy candy pixels on a canvas, at a whole number of device pixels per cell so edges stay crisp.
 * The canvas is sized to at most `css` CSS pixels on its longer side.
 */
export function pictureCanvas(pic: Picture, css: number, dpr = typeof devicePixelRatio === 'number' ? Math.min(3, devicePixelRatio || 1) : 1): HTMLCanvasElement {
  const side = Math.max(pic.w, pic.h), cell = Math.max(1, Math.floor((css * dpr) / side));
  const cv = document.createElement('canvas');
  cv.width = pic.w * cell; cv.height = pic.h * cell;
  cv.style.width = `${cv.width / dpr}px`; cv.style.height = `${cv.height / dpr}px`;
  cv.className = 'pp-pic';
  cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', pic.name);
  const ctx = cv.getContext('2d');
  if (!ctx) return cv;
  const bev = cell >= 3 ? Math.max(1, Math.round(cell * 0.16)) : 0;
  for (let y = 0; y < pic.h; y++) for (let x = 0; x < pic.w; x++) {
    const k = PALETTE[pic.px[y * pic.w + x] ?? 0];
    if (!k) continue;
    const X = x * cell, Y = y * cell;
    ctx.fillStyle = bev ? k.dark : k.hex; ctx.fillRect(X, Y, cell, cell);
    if (bev) { ctx.fillStyle = k.hex; ctx.fillRect(X, Y, cell - bev, cell - bev); }
    if (cell >= 5) { ctx.fillStyle = k.light; ctx.fillRect(X + Math.round(cell * 0.14), Y + Math.round(cell * 0.14), Math.max(1, Math.round(cell * 0.3)), Math.max(1, Math.round(cell * 0.22))); }
  }
  return cv;
}
