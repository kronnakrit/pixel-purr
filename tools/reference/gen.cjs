// ---- Pixel Purr level generator + solver (pure, deterministic, no DOM) ----
// A level = a pixel picture + queues of Purrlet shooters whose ammo exactly equals the picture's pixels.
const PF = (() => {
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const hash = n => { n = Math.imul(n ^ 0x9E3779B9, 0x85EBCA6B); n ^= n >>> 13; n = Math.imul(n, 0xC2B2AE35); return (n ^ n >>> 16) >>> 0; };

  // 12 candy colours. Index 0 = empty. Each colour is one Purrlet.
  const PALETTE = [null,
    { key: 'cherry',    name: 'Cherry',    hex: '#FF4D6D', light: '#FF9AAE', dark: '#C21E4A' },
    { key: 'tangerine', name: 'Tangerine', hex: '#FF9838', light: '#FFC680', dark: '#D2611A' },
    { key: 'lemon',     name: 'Lemon',     hex: '#FFD43B', light: '#FFF08A', dark: '#D79A12' },
    { key: 'matcha',    name: 'Matcha',    hex: '#5FCB5A', light: '#A5EC8C', dark: '#2E9440' },
    { key: 'mint',      name: 'Mint',      hex: '#8FF0CF', light: '#D2FFEE', dark: '#3FBF98' },
    { key: 'soda',      name: 'Soda',      hex: '#3FB8F5', light: '#9BE0FF', dark: '#1A7CC9' },
    { key: 'grape',     name: 'Grape',     hex: '#8E5BF0', light: '#BFA0FF', dark: '#5B2FC0' },
    { key: 'lilac',     name: 'Lilac',     hex: '#C9A8FF', light: '#EADCFF', dark: '#9473D9' },
    { key: 'bubblegum', name: 'Bubblegum', hex: '#FF7EC8', light: '#FFC0E4', dark: '#D6449A' },
    { key: 'cocoa',     name: 'Cocoa',     hex: '#9A5B3A', light: '#C98A62', dark: '#673620' },
    { key: 'milk',      name: 'Milk',      hex: '#FBF6FF', light: '#FFFFFF', dark: '#CFC3DE' },
    { key: 'licorice',  name: 'Licorice',  hex: '#3A2F55', light: '#6A5C8E', dark: '#1E1733' },
  ];
  const C = {}; PALETTE.forEach((p, i) => { if (p) C[p.key] = i; });

  const RULES = { tray: 5, belt: 5, gap: 2 }; // holding tray slots, max Purrlets on the belt, belt spacing of linked pairs

  // ---------- picture rasteriser (shapes in a 0..1 unit square) ----------
  const S = {
    circ: (cx, cy, r) => (u, v) => (u - cx) ** 2 + (v - cy) ** 2 <= r * r,
    ell: (cx, cy, rx, ry) => (u, v) => ((u - cx) / rx) ** 2 + ((v - cy) / ry) ** 2 <= 1,
    rect: (x0, y0, x1, y1) => (u, v) => u >= x0 && u <= x1 && v >= y0 && v <= y1,
    rrect: (x0, y0, x1, y1, r) => (u, v) => { if (u < x0 || u > x1 || v < y0 || v > y1) return false; const dx = Math.max(x0 + r - u, 0, u - (x1 - r)), dy = Math.max(y0 + r - v, 0, v - (y1 - r)); return dx * dx + dy * dy <= r * r; },
    poly: pts => (u, v) => { let ins = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > v) !== (yj > v) && u < (xj - xi) * (v - yi) / (yj - yi) + xi) ins = !ins; } return ins; },
    line: (x0, y0, x1, y1, w) => (u, v) => { const dx = x1 - x0, dy = y1 - y0, t = Math.max(0, Math.min(1, ((u - x0) * dx + (v - y0) * dy) / (dx * dx + dy * dy))); return (u - x0 - t * dx) ** 2 + (v - y0 - t * dy) ** 2 <= w * w / 4; },
    heart: (cx, cy, s) => (u, v) => { const x = (u - cx) / s, y = -(v - cy) / s; return (x * x + y * y - 1) ** 3 - x * x * y ** 3 <= 0; },
    star: (cx, cy, r) => (u, v) => { const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]); } return S.poly(pts)(u, v); },
    and: (...f) => (u, v) => f.every(g => g(u, v)),
    or: (...f) => (u, v) => f.some(g => g(u, v)),
    not: f => (u, v) => !f(u, v),
    all: () => () => true,
  };

  function raster(def, N) {
    const px = new Uint8Array(N * N);
    for (const [shape, col] of def.layers(S)) {
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const u = (x + 0.5) / N, v = (y + 0.5) / N;
        if (shape(u, v)) px[y * N + x] = col === 0 ? 0 : C[col];
      }
    }
    if (def.outline) { // ring of one colour around everything drawn (4-neighbour)
      const o = C[def.outline], src = px.slice();
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        if (src[y * N + x]) continue;
        if ((x > 0 && src[y * N + x - 1]) || (x < N - 1 && src[y * N + x + 1]) || (y > 0 && src[(y - 1) * N + x]) || (y < N - 1 && src[(y + 1) * N + x])) px[y * N + x] = o;
      }
    }
    return { w: N, h: N, px, name: def.name };
  }

  // ---------- the 20 v1 pictures (cute, everyday treats and comforts) ----------
  const PICTURES = [
    { name: 'Love Note', layers: s => [[s.heart(.5, .54, .37), 'cherry'], [s.ell(.34, .36, .08, .06), 'bubblegum']] },
    { name: 'Strawberry', layers: s => [
      [s.or(s.ell(.5, .5, .36, .26), s.poly([[.15, .48], [.85, .48], [.5, .95]]), s.ell(.5, .7, .25, .2)), 'cherry'],
      [s.or(s.ell(.5, .26, .3, .09), s.poly([[.36, .22], [.64, .22], [.5, .4]]), s.rect(.46, .06, .54, .24)), 'matcha'],
      [s.or(s.circ(.36, .5, .035), s.circ(.6, .52, .035), s.circ(.48, .64, .035), s.circ(.68, .64, .035), s.circ(.33, .66, .035), s.circ(.52, .8, .035)), 'lemon']] },
    { name: 'Morning Latte', layers: s => [
      [s.or(s.rrect(.14, .4, .7, .9, .1), s.and(s.circ(.72, .63, .17), s.not(s.circ(.72, .63, .08)))), 'bubblegum'],
      [s.ell(.42, .42, .26, .06), 'cocoa'],
      [s.or(s.line(.32, .32, .27, .24, .06), s.line(.27, .24, .32, .15, .06), s.line(.52, .3, .47, .21, .06), s.line(.47, .21, .52, .12, .06)), 'milk'],
      [s.heart(.42, .66, .09), 'milk']] },
    { name: 'Tabby', layers: s => [
      [s.or(s.ell(.5, .58, .4, .33), s.poly([[.12, .45], [.2, .08], [.42, .3]]), s.poly([[.88, .45], [.8, .08], [.58, .3]])), 'tangerine'],
      [s.or(s.poly([[.19, .36], [.22, .17], [.34, .3]]), s.poly([[.81, .36], [.78, .17], [.66, .3]])), 'bubblegum'],
      [s.ell(.5, .72, .18, .13), 'milk'],
      [s.or(s.ell(.34, .55, .05, .07), s.ell(.66, .55, .05, .07)), 'licorice'],
      [s.ell(.5, .66, .05, .035), 'bubblegum']] },
    { name: 'Boba Break', layers: s => [
      [s.poly([[.2, .32], [.8, .32], [.72, .95], [.28, .95]]), 'tangerine'],
      [s.rect(.2, .44, .8, .5), 'milk'],
      [s.or(s.circ(.36, .86, .05), s.circ(.5, .87, .05), s.circ(.64, .86, .05), s.circ(.43, .77, .05), s.circ(.57, .77, .05)), 'licorice'],
      [s.or(s.ell(.5, .3, .34, .1), s.rect(.16, .28, .84, .33)), 'soda'],
      [s.line(.55, .3, .7, .03, .07), 'cherry']] },
    { name: 'Cupcake', layers: s => [
      [s.poly([[.2, .55], [.8, .55], [.7, .94], [.3, .94]]), 'soda'],
      [s.or(s.rect(.36, .55, .42, .94), s.rect(.58, .55, .64, .94)), 'grape'],
      [s.or(s.ell(.5, .54, .36, .1), s.ell(.5, .43, .29, .1), s.ell(.5, .33, .2, .09)), 'bubblegum'],
      [s.or(s.rect(.3, .5, .35, .52), s.rect(.6, .4, .65, .42), s.rect(.42, .3, .47, .32), s.rect(.66, .52, .71, .54)), 'lemon'],
      [s.circ(.52, .18, .08), 'cherry']] },
    { name: 'Sunflower', layers: s => [
      [s.or(s.rect(.47, .55, .53, .97), s.ell(.33, .8, .12, .05), s.ell(.67, .74, .12, .05)), 'matcha'],
      [s.or(...Array.from({ length: 10 }, (_, i) => s.circ(.5 + .25 * Math.cos(i * Math.PI / 5), .38 + .25 * Math.sin(i * Math.PI / 5), .11))), 'lemon'],
      [s.or(...Array.from({ length: 10 }, (_, i) => s.circ(.5 + .29 * Math.cos(i * Math.PI / 5), .38 + .29 * Math.sin(i * Math.PI / 5), .05))), 'tangerine'],
      [s.circ(.5, .38, .17), 'cocoa']] },
    { name: 'Avo Buddy', layers: s => [
      [s.or(s.ell(.5, .62, .34, .32), s.ell(.5, .32, .24, .26)), 'matcha'],
      [s.or(s.ell(.5, .63, .28, .26), s.ell(.5, .34, .18, .21)), 'mint'],
      [s.circ(.5, .66, .14), 'cocoa'],
      [s.or(s.circ(.4, .44, .03), s.circ(.6, .44, .03)), 'licorice'],
      [s.or(s.ell(.33, .5, .05, .03), s.ell(.67, .5, .05, .03)), 'bubblegum']] },
    { name: 'Rainbow Day', layers: s => {
      const arc = (r0, r1) => s.and(s.circ(.5, .7, r1), s.not(s.circ(.5, .7, r0)), s.rect(0, 0, 1, .7));
      return [[arc(.36, .45), 'cherry'], [arc(.28, .36), 'lemon'], [arc(.2, .28), 'matcha'], [arc(.12, .2), 'soda'],
        [s.or(s.ell(.16, .72, .14, .09), s.circ(.22, .64, .08), s.ell(.84, .72, .14, .09), s.circ(.78, .64, .08)), 'milk']]; } },
    { name: 'Panda Nap', layers: s => [
      [s.or(s.circ(.22, .26, .12), s.circ(.78, .26, .12)), 'licorice'],
      [s.ell(.5, .56, .4, .34), 'milk'],
      [s.or(s.ell(.34, .54, .1, .12), s.ell(.66, .54, .1, .12)), 'licorice'],
      [s.or(s.circ(.36, .52, .035), s.circ(.64, .52, .035)), 'milk'],
      [s.ell(.5, .7, .06, .04), 'licorice'],
      [s.or(s.ell(.24, .7, .06, .035), s.ell(.76, .7, .06, .035)), 'bubblegum'],
      [s.or(s.rect(.06, .78, .12, .99), s.ell(.18, .84, .08, .03)), 'matcha']] },
    { name: 'Macarons', layers: s => [
      [s.or(s.rrect(.18, .08, .82, .2, .06), s.rrect(.18, .24, .82, .36, .06)), 'bubblegum'],
      [s.rect(.22, .19, .78, .25), 'milk'],
      [s.or(s.rrect(.18, .4, .82, .52, .06), s.rrect(.18, .56, .82, .68, .06)), 'mint'],
      [s.rect(.22, .51, .78, .57), 'cocoa'],
      [s.or(s.rrect(.18, .72, .82, .84, .06), s.rrect(.18, .88, .82, .99, .05)), 'lilac'],
      [s.rect(.22, .83, .78, .89), 'milk']] },
    { name: 'Desk Plant', layers: s => [
      [s.or(s.ell(.3, .4, .2, .15), s.ell(.68, .34, .2, .15), s.ell(.5, .2, .14, .15), s.rect(.46, .3, .54, .62), s.line(.3, .45, .48, .6, .06), s.line(.68, .4, .52, .6, .06)), 'matcha'],
      [s.or(s.line(.16, .42, .44, .38, .035), s.line(.54, .34, .84, .32, .035), s.line(.5, .1, .5, .3, .035)), 'mint'],
      [s.poly([[.24, .6], [.76, .6], [.68, .97], [.32, .97]]), 'tangerine'],
      [s.rect(.22, .6, .78, .68), 'cocoa']] },
    { name: 'Triple Scoop', layers: s => [
      [s.poly([[.28, .58], [.72, .58], [.5, .99]]), 'tangerine'],
      [s.or(s.line(.32, .64, .52, .9, .03), s.line(.5, .62, .62, .78, .03), s.line(.68, .64, .48, .9, .03), s.line(.5, .62, .38, .78, .03)), 'cocoa'],
      [s.circ(.5, .52, .2), 'mint'],
      [s.circ(.5, .36, .18), 'bubblegum'],
      [s.circ(.5, .2, .14), 'cocoa'],
      [s.or(s.ell(.38, .6, .06, .05), s.ell(.62, .62, .05, .06)), 'mint'],
      [s.circ(.5, .06, .06), 'cherry'],
      [s.or(s.rect(.4, .3, .44, .32), s.rect(.56, .4, .6, .42), s.rect(.46, .14, .5, .16)), 'lemon']] },
    { name: 'Weekend Bag', layers: s => [
      [s.and(s.ell(.5, .34, .24, .22), s.not(s.ell(.5, .34, .17, .16)), s.rect(0, 0, 1, .38)), 'licorice'],
      [s.rrect(.12, .36, .88, .94, .08), 'grape'],
      [s.or(s.rect(.12, .5, .88, .56), s.rect(.12, .74, .88, .8)), 'lilac'],
      [s.rrect(.42, .4, .58, .5, .03), 'lemon'],
      [s.heart(.74, .68, .07), 'bubblegum']] },
    { name: 'Flamingo', layers: s => [
      [s.or(s.circ(.78, .22, .16)), 'lemon'],
      [s.or(s.rect(0, .86, 1, .89), s.rect(.1, .93, .9, .96)), 'soda'],
      [s.or(s.line(.42, .62, .4, .9, .04), s.line(.5, .62, .56, .76, .04), s.line(.56, .76, .48, .78, .04)), 'bubblegum'],
      [s.or(s.ell(.46, .54, .2, .12), s.line(.6, .5, .62, .22, .08), s.circ(.56, .18, .07)), 'bubblegum'],
      [s.ell(.42, .52, .11, .06), 'cherry'],
      [s.poly([[.5, .16], [.4, .2], [.44, .26]]), 'milk'],
      [s.poly([[.43, .22], [.4, .2], [.44, .26]]), 'licorice'],
      [s.circ(.57, .16, .02), 'licorice']] },
    { name: 'Sushi Date', layers: s => [
      [s.ell(.5, .86, .46, .1), 'soda'],
      [s.or(s.rrect(.1, .5, .46, .8, .08), s.rrect(.54, .5, .9, .8, .08)), 'milk'],
      [s.rrect(.06, .36, .5, .56, .1), 'tangerine'],
      [s.or(s.line(.16, .4, .22, .54, .03), s.line(.28, .38, .34, .54, .03), s.line(.4, .38, .44, .52, .03)), 'milk'],
      [s.rrect(.5, .36, .94, .56, .1), 'cherry'],
      [s.rect(.66, .34, .76, .8), 'licorice']] },
    { name: 'Sprinkle Donut', layers: s => [
      [s.and(s.circ(.5, .5, .42), s.not(s.circ(.5, .5, .13))), 'tangerine'],
      [s.and(s.or(s.circ(.5, .48, .34), s.circ(.24, .7, .08), s.circ(.62, .8, .07), s.circ(.8, .6, .07)), s.not(s.circ(.5, .5, .15))), 'bubblegum'],
      [s.or(s.line(.3, .3, .36, .26, .03), s.line(.66, .28, .7, .34, .03), s.line(.22, .5, .26, .56, .03)), 'lemon'],
      [s.or(s.line(.5, .22, .56, .24, .03), s.line(.74, .48, .76, .54, .03), s.line(.36, .7, .42, .72, .03)), 'soda'],
      [s.or(s.line(.4, .2, .38, .26, .03), s.line(.64, .7, .7, .68, .03), s.line(.28, .42, .3, .36, .03)), 'mint'],
      [s.or(s.line(.6, .62, .58, .68, .03), s.line(.76, .36, .8, .4, .03)), 'milk']] },
    { name: 'Sakura Sky', layers: s => [
      [s.all(), 'soda'],
      [s.or(s.line(0, .9, .5, .6, .06), s.line(.5, .6, 1, .4, .05), s.line(.5, .6, .62, .86, .04), s.line(.28, .74, .3, .3, .04)), 'cocoa'],
      [s.or(...[[.3, .26], [.56, .52], [.82, .36], [.18, .6], [.66, .82], [.42, .38]].map(([x, y]) => s.or(s.circ(x - .06, y, .05), s.circ(x + .06, y, .05), s.circ(x, y - .06, .05), s.circ(x, y + .06, .05)))), 'bubblegum'],
      [s.or(...[[.3, .26], [.56, .52], [.82, .36], [.18, .6], [.66, .82], [.42, .38]].map(([x, y]) => s.circ(x, y, .035))), 'lemon'],
      [s.or(s.ell(.16, .1, .12, .05), s.ell(.7, .12, .14, .05)), 'milk']] },
    { name: 'Moon Night', layers: s => [
      [s.all(), 'licorice'],
      [s.rect(0, .7, 1, 1), 'grape'],
      [s.and(s.circ(.62, .38, .24), s.not(s.circ(.74, .3, .2))), 'lemon'],
      [s.or(s.star(.2, .2, .07), s.star(.36, .6, .05), s.star(.86, .7, .06), s.star(.14, .82, .05)), 'milk'],
      [s.or(s.ell(.3, .78, .2, .07), s.ell(.76, .9, .22, .07)), 'lilac'],
      [s.or(s.circ(.48, .44, .02), s.ell(.54, .5, .04, .02)), 'licorice']] },
    { name: 'Birthday Cake', layers: s => [
      [s.ell(.5, .92, .46, .06), 'lilac'],
      [s.rrect(.12, .6, .88, .9, .04), 'bubblegum'],
      [s.rect(.12, .72, .88, .76), 'mint'],
      [s.rrect(.24, .38, .76, .6, .04), 'bubblegum'],
      [s.or(s.rect(.24, .38, .76, .42), s.circ(.3, .44, .04), s.circ(.44, .45, .04), s.circ(.58, .44, .04), s.circ(.7, .45, .04), s.rect(.12, .6, .88, .63), s.circ(.2, .66, .04), s.circ(.4, .66, .04), s.circ(.6, .66, .04), s.circ(.8, .66, .04)), 'milk'],
      [s.or(s.rect(.34, .2, .39, .38), s.rect(.61, .2, .66, .38)), 'soda'],
      [s.rect(.475, .16, .525, .38), 'lemon'],
      [s.or(s.ell(.365, .16, .035, .05), s.ell(.635, .16, .035, .05), s.ell(.5, .12, .035, .05)), 'tangerine']] },
  ];

  // ---------- level parameters per v1 level (difficulty curve) ----------
  // D rises with a gentle curve; every 5th level is a "Spicy" spike, the level after it relaxes.
  const difficulty = n => { const base = 1 + 8 * (1 - Math.exp(-(n - 1) / 12)); const saw = n % 5 === 0 ? 1.2 : (n % 5 === 1 && n > 1 ? -0.6 : 0); return Math.round((base + saw) * 10) / 10; };
  const SIZES = [16, 18, 18, 20, 20, 20, 22, 22, 24, 24, 24, 26, 26, 26, 28, 28, 30, 30, 32, 32];
  const spicy = n => n % 5 === 0;
  function paramsFor(n) {
    const D = difficulty(n);
    return {
      n, D, spicy: spicy(n),
      size: SIZES[Math.min(n, 20) - 1] || 32,
      queues: n <= 2 ? 2 : spicy(n) ? (n >= 15 ? 2 : 3) : n <= 8 ? 3 : 4, // spicy levels give fewer queues = fewer choices
      shooters: Math.round(5 + D * 1.6),             // target count of Purrlets (bigger ammo = more parking)
      disorder: Math.min(0.9, 0.05 + D * 0.07),      // 0 = ideal peel order, 1 = deepest colours dealt first
      hidden: n >= 7 ? Math.min(0.3, (D - 4) * 0.06) : 0, // share of mystery Purrlets
      links: n >= 12 ? (D > 7 ? 2 : 1) : 0,          // linked pairs
      // Target band for "slots needed": the fewest tray slots a perfect player needs. 5 slots exist, so 5 - need = mistakes allowed.
      need: n <= 4 ? [0, 1] : spicy(n) ? (n >= 10 ? [2, 3] : [1, 2]) : n < 10 ? [1, 1] : [1, 2],
    };
  }
  const INTRO = { 1: 'Tap a Purrlet: it rides the belt and paints matching pixels', 2: 'Leftover ammo parks in the tray', 5: 'Spicy level: colours buried under colours', 7: 'Mystery Purrlets (?) show their colour at the front', 12: 'Linked Purrlets ride together', 18: 'Full-background pictures' };
  // Seeds hand-picked from generator output (closest to the target band, readable ammo numbers)
  const V1 = /*V1*/[[1,0.1],[1,0.1],[1,0.25],[1,0.25],[1,0.4],[1,0.25],[1,0.4],[1,0.4],[1,0.4],[10,0.7],[1,0.4],[4,0.4],[10,0.55],[3,0.55],[12,0.55],[1,0.55],[7,0.55],[4,0.55],[4,0.55],[39,1]];
  const V1_NEED = /*NEED*/[1,1,1,1,1,1,1,1,1,2,1,2,2,2,3,2,2,2,2,3];

  // ---------- belt geometry ----------
  // Positions around the picture, counter-clockwise from the entry at bottom-left:
  // bottom (left→right, aims up), right (bottom→top, aims left), top (right→left, aims down), left (top→bottom, aims right).
  function beltOf(w, h) {
    const P = [];
    for (let x = 0; x < w; x++) P.push({ side: 0, i: x });
    for (let y = h - 1; y >= 0; y--) P.push({ side: 1, i: y });
    for (let x = w - 1; x >= 0; x--) P.push({ side: 2, i: x });
    for (let y = 0; y < h; y++) P.push({ side: 3, i: y });
    return P;
  }
  function target(px, w, h, pos) { // index of the first pixel the Purrlet sees from this belt spot, or -1
    const { side, i } = pos;
    if (side === 0) { for (let y = h - 1; y >= 0; y--) if (px[y * w + i]) return y * w + i; }
    else if (side === 1) { for (let x = w - 1; x >= 0; x--) if (px[i * w + x]) return i * w + x; }
    else if (side === 2) { for (let y = 0; y < h; y++) if (px[y * w + i]) return y * w + i; }
    else { for (let x = 0; x < w; x++) if (px[i * w + x]) return i * w + x; }
    return -1;
  }
  // One lap of a group of riders (1, or 2 when linked). Mutates px; returns shots fired and an optional event log.
  function lap(px, w, h, riders, log) {
    const B = beltOf(w, h), L = B.length; let shots = 0;
    for (let t = 0; t < L + (riders.length - 1) * RULES.gap; t++) {
      riders.forEach((r, k) => {
        const s = t - k * RULES.gap; if (s < 0 || s >= L || r.a <= 0) return;
        const j = target(px, w, h, B[s]);
        if (j >= 0 && px[j] === r.c) { px[j] = 0; r.a--; shots++; if (log) log.push({ t, k, s, j }); }
      });
    }
    return shots;
  }

  // ---------- peel depth: when each pixel first becomes visible from the belt if everything were cleared greedily ----------
  function peelDepth(pic) {
    const { w, h } = pic, px = pic.px.slice(), depth = new Int16Array(w * h).fill(-1), B = beltOf(w, h);
    let left = px.reduce((a, b) => a + (b ? 1 : 0), 0), r = 0;
    while (left > 0) {
      const hit = new Set(); for (const p of B) { const j = target(px, w, h, p); if (j >= 0) hit.add(j); }
      for (const j of hit) { depth[j] = r; px[j] = 0; left--; }
      r++;
    }
    return { depth, rounds: r };
  }

  // ---------- deal: split each colour into Purrlets and order them into queues ----------
  const roundTo = (v, m) => Math.max(m, Math.round(v / m) * m);
  function deal(pic, P, seed) {
    const r = mulberry32(seed), { depth, rounds } = peelDepth(pic), N = pic.w * pic.h;
    const total = pic.px.reduce((a, b) => a + (b ? 1 : 0), 0);
    const unit = roundTo(total / P.shooters, total > 240 ? 10 : 5);
    const chunks = [];
    for (let c = 1; c < PALETTE.length; c++) {
      const idx = []; for (let j = 0; j < N; j++) if (pic.px[j] === c) idx.push(j);
      if (!idx.length) continue;
      idx.sort((a, b) => depth[a] - depth[b]);
      let i = 0;
      while (i < idx.length) {
        const rem = idx.length - i;
        let s = Math.min(60, roundTo(unit * [0.5, 1, 1, 1.5, 2][Math.floor(r() * 5)], 5)); // ammo stays 5..60
        if (rem - s < unit * 0.5 && rem <= 60) s = rem; // fold a small remainder in, never above 60
        const part = idx.slice(i, i + s); i += s;
        chunks.push({ c, a: part.length, key: part.reduce((a, j) => a + depth[j], 0) / part.length });
      }
    }
    // Disorder: shuffle the ideal order by noise proportional to the picture's peel depth.
    // disorder 0 = ideal peel order, 1 = fully reversed (deepest colours first); plus a little noise.
    const mx = Math.max(...chunks.map(ch => ch.key));
    for (const ch of chunks) ch.k2 = ch.key * (1 - P.disorder) + (mx - ch.key) * P.disorder + (r() * 2 - 1) * rounds * 0.12;
    chunks.sort((a, b) => a.k2 - b.k2);
    const Q = Array.from({ length: P.queues }, () => []);
    chunks.forEach((ch, i) => { const q = r() < P.disorder * 0.5 ? Math.floor(r() * P.queues) : i % P.queues; Q[q].push({ c: ch.c, a: ch.a }); });
    // Rebalance so no queue is more than 2 longer than another.
    for (let guard = 0; guard < 50; guard++) {
      const lens = Q.map(q => q.length), mx = lens.indexOf(Math.max(...lens)), mn = lens.indexOf(Math.min(...lens));
      if (lens[mx] - lens[mn] <= 2) break; Q[mn].push(Q[mx].pop());
    }
    let id = 0; Q.forEach((q, qi) => q.forEach((s, d) => { s.id = id++; s.q = qi; s.d = d; }));
    // Mystery Purrlets: never the front of a queue.
    for (const q of Q) for (let d = 1; d < q.length; d++) if (r() < P.hidden) q[d].hidden = true;
    // Linked pairs: same depth in neighbouring queues.
    let made = 0;
    for (let tries = 0; tries < 40 && made < P.links; tries++) {
      const q = Math.floor(r() * (P.queues - 1)), d = 1 + Math.floor(r() * 4);
      const a = Q[q][d], b = Q[q + 1][d];
      if (a && b && a.link == null && b.link == null) { a.link = b.id; b.link = a.id; made++; }
    }
    return Q;
  }

  // ---------- state + moves ----------
  function fnv(px) { let h = 2166136261; for (let i = 0; i < px.length; i++) { h ^= px[i]; h = Math.imul(h, 16777619); } return h >>> 0; }
  function movesOf(L, st) {
    const M = [];
    st.qi.forEach((d, q) => {
      const s = L.queues[q][d]; if (!s) return;
      if (s.link != null) { const o = L.byId[s.link]; if (o.q < q) return; if (st.qi[o.q] !== o.d) return; M.push({ kind: 'q', qs: [q, o.q] }); }
      else M.push({ kind: 'q', qs: [q] });
    });
    st.tray.forEach((t, i) => M.push({ kind: 't', i }));
    return M;
  }
  function apply(L, st, m, log) {
    const px = st.px.slice(), qi = st.qi.slice(), tray = st.tray.map(t => ({ ...t }));
    let riders;
    if (m.kind === 'q') { riders = m.qs.map(q => { const s = L.queues[q][qi[q]]; qi[q]++; return { c: s.c, a: s.a, id: s.id }; }); }
    else { riders = [tray[m.i]]; tray.splice(m.i, 1); }
    const shots = lap(px, L.w, L.h, riders, log);
    for (const rd of riders) if (rd.a > 0) tray.push(rd);
    const left = st.left - shots;
    return { px, qi, tray, left, shots, dead: tray.length > L.tray, won: left === 0 };
  }
  const keyOf = st => fnv(st.px) + '|' + st.qi.join(',') + '|' + st.tray.map(t => t.c + ':' + t.a).sort().join(',');
  function start(L) { return { px: L.px.slice(), qi: L.queues.map(() => 0), tray: [], left: L.total }; }

  // Exhaustive-with-budget DFS, best-first ordering. Playing one Purrlet at a time is a subset of real play,
  // so any plan found here is also a real solution (the proof of solvability).
  function solve(L, budget = 4000) {
    const seen = new Set(); let nodes = 0, peak = 0;
    function dfs(st, path) {
      if (st.won) return path;
      if (++nodes > budget) return null;
      const k = keyOf(st); if (seen.has(k)) return null; seen.add(k);
      const cands = [];
      for (const m of movesOf(L, st)) {
        const nx = apply(L, st, m); if (nx.dead) continue;
        if (m.kind === 't' && nx.shots === 0) continue; // pointless
        cands.push([m, nx]);
      }
      cands.sort((a, b) => (b[1].shots - a[1].shots) || (a[1].tray.length - b[1].tray.length));
      for (const [m, nx] of cands) { const r = dfs(nx, path.concat([m])); if (r) return r; }
      return null;
    }
    const plan = dfs(start(L), []);
    if (plan) { let st = start(L); for (const m of plan) { st = apply(L, st, m); peak = Math.max(peak, st.tray.length); } }
    return { ok: !!plan, plan, nodes, exhausted: nodes > budget, peakTray: peak };
  }
  // A naive player: mostly taps queue fronts at random, sometimes a tray Purrlet that will paint something.
  function playout(L, r) {
    let st = start(L), moves = 0;
    while (!st.won) {
      const ms = movesOf(L, st).map(m => [m, apply(L, st, m)]).filter(([m, nx]) => !nx.dead && !(m.kind === 't' && nx.shots === 0));
      if (!ms.length) return { win: false, moves };
      const fresh = ms.filter(([m]) => m.kind === 'q'), pool = fresh.length && r() < 0.7 ? fresh : ms;
      st = pool[Math.floor(r() * pool.length)][1]; moves++;
    }
    return { win: true, moves };
  }
  function measure(L, seed, runs = 40) {
    const r = mulberry32(seed ^ 0xABCD); let fails = 0;
    for (let i = 0; i < runs; i++) if (!playout(L, r).win) fails++;
    return fails / runs;
  }

  function assemble(pic, Q, P) {
    const byId = []; Q.forEach(q => q.forEach(s => { byId[s.id] = s; }));
    const total = pic.px.reduce((a, b) => a + (b ? 1 : 0), 0);
    const colors = [...new Set(Array.from(pic.px).filter(Boolean))];
    return { name: pic.name, w: pic.w, h: pic.h, px: pic.px, queues: Q, byId, total, colors, tray: RULES.tray, belt: RULES.belt, P };
  }

  // Build one level: deal → prove solvable → measure → reroll until the fail rate sits in the target band.
  // Fewest tray slots a perfect player needs (0-5). 5 - need = how many careless parks the level forgives.
  function needSlots(L, budget = 3000) { for (let k = 0; k <= RULES.tray; k++) if (solve({ ...L, tray: k }, budget).ok) return k; return 99; }

  // Build one level: deal → prove solvable → score → adapt disorder and reroll until "slots needed" sits in the band.
  function build(pic, P, seed, maxTries = 16) {
    let best = null, dis = P.disorder;
    for (let t = 0; t < maxTries; t++) {
      const s = hash(seed * 131 + t);
      const L = assemble(pic, deal(pic, { ...P, disorder: dis }, s), P);
      const need = needSlots(L);
      if (need > RULES.tray) { dis *= 0.8; continue; }
      const miss = need < P.need[0] ? P.need[0] - need : need > P.need[1] ? need - P.need[1] : 0;
      const cand = { ...L, seed: s, disorder: dis, need, miss, tries: t + 1 };
      if (!best || miss < best.miss) best = cand;
      if (miss === 0) break;
      dis = need < P.need[0] ? Math.min(1, dis + 0.12) : Math.max(0, dis - 0.12);
    }
    return finish(best);
  }
  function finish(L) { L.solution = solve(L); return L; }

  // v1 levels replay tuned (seed, disorder) pairs found by tune.js, so they load instantly and never change.
  function level(n) {
    const P = paramsFor(n);
    if (n <= 20) {
      const pic = raster(PICTURES[n - 1], P.size), [seed, dis] = V1[n - 1];
      const L = assemble(pic, deal(pic, { ...P, disorder: dis }, seed), P);
      return finish(Object.assign(L, { seed, disorder: dis, need: V1_NEED[n - 1], intro: INTRO[n] || null }));
    }
    // Endless levels 21+: picture from a seed (procedural charm or recoloured library picture), then the full build loop.
    const h = hash(n); const pic = h % 3 === 0 ? sprite(h, P.size) : recolor(raster(PICTURES[h % 20], P.size), h);
    return build(pic, P, h);
  }

  // ---------- pictures from a seed: mirrored "charm" sprite ----------
  function sprite(seed, N) {
    const r = mulberry32(seed), px = new Uint8Array(N * N), cols = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], r).slice(0, 3 + Math.floor(r() * 3));
    const half = Math.ceil(N / 2), cx = (N - 1) / 2, cy = (N - 1) / 2;
    for (let y = 0; y < N; y++) for (let x = 0; x < half; x++) {
      const d = Math.hypot((x - cx) / N, (y - cy) / N);
      if (d > 0.46) continue;
      const band = Math.floor((d + (r() * 0.08)) / 0.46 * cols.length);
      const keep = d < 0.18 || r() > 0.12;
      if (keep) { px[y * N + x] = cols[Math.min(cols.length - 1, band)]; px[y * N + (N - 1 - x)] = px[y * N + x]; }
    }
    return { w: N, h: N, px, name: 'Charm #' + (seed % 10000) };
  }
  function recolor(pic, seed) {
    const r = mulberry32(seed), used = [...new Set(Array.from(pic.px).filter(Boolean))], pool = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], r);
    const map = {}; used.forEach((c, i) => { map[c] = c === C.licorice || c === C.milk ? c : pool[i]; });
    return { ...pic, px: pic.px.map(c => c ? map[c] : 0), name: pic.name + ' (remix)' };
  }
  function shuffle(a, r) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // ---------- pictures from any image (RGBA pixels) ----------
  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  function nearest(r, g, b) {
    let best = 1, bd = 1e9;
    for (let c = 1; c < PALETTE.length; c++) { const [R, G, B] = rgb(PALETTE[c].hex); const rm = (r + R) / 2; const d = (2 + rm / 256) * (r - R) ** 2 + 4 * (g - G) ** 2 + (2 + (255 - rm) / 256) * (b - B) ** 2; if (d < bd) { bd = d; best = c; } }
    return best;
  }
  // data: RGBA array of an image already drawn at N×N (the page does the canvas downscale). K = max colours kept.
  function fromRGBA(data, N, K = 6, name = 'Your picture') {
    const px = new Uint8Array(N * N), freq = {};
    for (let j = 0; j < N * N; j++) { const a = data[j * 4 + 3]; if (a < 128) continue; const c = nearest(data[j * 4], data[j * 4 + 1], data[j * 4 + 2]); px[j] = c; freq[c] = (freq[c] || 0) + 1; }
    const keep = Object.keys(freq).map(Number).sort((a, b) => freq[b] - freq[a]).slice(0, K);
    const remap = c => { if (keep.includes(c)) return c; const [r, g, b] = rgb(PALETTE[c].hex); let best = keep[0], bd = 1e9; for (const k of keep) { const [R, G, B] = rgb(PALETTE[k].hex); const d = (r - R) ** 2 + (g - G) ** 2 + (b - B) ** 2; if (d < bd) { bd = d; best = k; } } return best; };
    for (let j = 0; j < N * N; j++) if (px[j]) px[j] = remap(px[j]);
    return { w: N, h: N, px, name };
  }

  return { PALETTE, C, RULES, PICTURES, INTRO, V1, V1_NEED, raster, difficulty, paramsFor, beltOf, target, lap, peelDepth, deal, assemble, solve, measure, needSlots, build, finish, level, sprite, recolor, fromRGBA, movesOf, apply, start, mulberry32, hash };
})();
if (typeof module !== 'undefined') module.exports = PF;
