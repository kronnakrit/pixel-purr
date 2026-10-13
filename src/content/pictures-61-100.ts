// The 40 pictures for levels 61-100 (a cosy year: sweet mornings, self-care Sunday, garden friends, seaside, cosy
// autumn, snow days, a weekend trip and dreamland), in level order, as shape recipes (see src/engine/picture.ts and
// the shared bits in shapes.ts). Shapes and order are level data: after changing one, rerun
// `npx tsx tools/levels.ts 61-100`.
import type { Layer } from '../engine/picture';
import { blush, dots, eyes, face, pair, sparkle, stars, type ContentPicture } from './shapes';

export const PICTURES_61_100: readonly ContentPicture[] = [
  // 61 (relaxed)
  { name: 'Strawberry Milk', size: 26, layers: s => {
    const p = (c: number, r: number, w = 1, h = 1) => s.rect(c / 26, r / 26, (c + w) / 26, (r + h) / 26);
    return [
      [s.or(s.poly([[.16, .42], [.6, .42], [.7, .2], [.26, .2]]), s.rect(.16, .42, .6, .95), s.poly([[.26, .2], [.7, .2], [.7, .12], [.26, .12]])), 'bubblegum'],
      [s.or(s.poly([[.6, .42], [.78, .34], [.78, .89], [.6, .95]]), s.poly([[.6, .42], [.78, .34], [.71, .19]])), 'cherry'],
      // Milk bands: round the fin, across the front, and slanting along the side to split the gable from the wall.
      [s.or(s.rect(.16, .4, .6, .44), s.rect(.26, .19, .72, .22), s.and(s.line(.6, .42, .78, .34, .04), s.rect(.6, 0, .78, 1))), 'milk'],
      [s.rrect(.19, .61, .57, .93, .04), 'milk'],
      [s.or(p(6, 18, 8, 2), p(7, 20, 6), p(8, 21, 4), p(9, 22, 2)), 'cherry'],
      [s.or(p(9, 16, 2), p(7, 17, 6)), 'matcha'],
      [s.or(p(8, 19), p(11, 19), p(9, 21)), 'milk'],
      [eyes(s, .38, .52, .09, .038), 'licorice'],
      [blush(s, .38, .59, .16, .045), 'cherry'],
      [s.or(sparkle(s, .096, .2, .05), sparkle(s, .904, .135, .04)), 'milk']]; } },
  // 62
  { name: 'Pancake Stack', size: 26, layers: s => {
    const p = (c: number, r: number, w = 1, h = 1) => s.rect(c / 26, r / 26, (c + w) / 26, (r + h) / 26);
    const out: Layer[] = [[s.or(p(1, 22, 24), p(3, 23, 20), p(7, 24, 12)), 'lilac']];
    // Three fluffy pancakes, bottom first: golden crust top and bottom, a creamy band round the side.
    for (const [r, c0, c1] of [[17, 1, 25], [12, 3, 23], [7, 2, 24]] as const)
      out.push([s.rrect(c0 / 26, r / 26, c1 / 26, (r + 5) / 26, .085), 'tangerine'], [p(c0 + 1, r + 1, c1 - c0 - 2, 3), 'lemon']);
    out.push(
      // Syrup cap reaching the rim, and two drips of different lengths ending in round drops.
      [s.or(p(4, 6, 18), p(2, 7, 22), p(5, 8, 2, 2), p(4, 10, 4), p(5, 11, 2), p(19, 8, 2, 4), p(18, 12, 4), p(19, 13, 2)), 'cocoa'],
      [s.or(s.rrect(.37, .17, .63, .24, .02), p(14, 6)), 'lemon'],
      [eyes(s, .5, .538, .115, .032), 'licorice'],
      [blush(s, .5, .596, .212, .05), 'bubblegum']);
    return out; } },
  // 63
  { name: 'Sunny Egg', size: 26, layers: s => [
    [s.or(s.circ(.5, .52, .3), s.circ(.3, .36, .16), s.circ(.68, .3, .18), s.circ(.78, .6, .17), s.circ(.38, .76, .17), s.circ(.2, .6, .14)), 'milk'],
    [s.circ(.5, .5, .21), 'tangerine'],
    [s.circ(.48, .48, .18), 'lemon'],
    [s.rect(11 / 26, 9 / 26, 13 / 26, 10 / 26), 'milk'],
    [eyes(s, .5, .46, .08, .032), 'licorice'],
    [blush(s, .5, .56, .115, .04), 'bubblegum'],
    [s.or(s.rect(11 / 26, 15 / 26, 12 / 26, 16 / 26), s.rect(12 / 26, 16 / 26, 14 / 26, 17 / 26), s.rect(14 / 26, 15 / 26, 15 / 26, 16 / 26)), 'licorice'],
    [sparkle(s, .135, .135, .05), 'lemon'],
    [s.heart(.865, .85, .055), 'bubblegum']] },
  // 64
  { name: 'Dango', size: 26, layers: s => {
    // Three dumplings 6 px apart on the same pixel phase (x, y in pixels), so every ball and face rasterises the same.
    const B = [[7.5, 18.5, 'matcha', 'bubblegum'], [13.5, 12.5, 'milk', 'cherry'], [19.5, 6.5, 'bubblegum', 'cherry']] as const;
    const out: Layer[] = [[s.line(.06, .94, .93, .07, .075), 'cocoa']];
    for (const [x, y, ball] of B) out.push([s.circ(x / 26, y / 26, .175), ball]);
    out.push([s.or(...B.map(([x, y]) => eyes(s, x / 26, (y - .5) / 26, 1.5 / 26, .032))), 'licorice']);
    for (const [x, y, , cheek] of B) out.push([blush(s, x / 26, (y + 2) / 26, 2.5 / 26, .04), cheek]);
    out.push([s.or(sparkle(s, .173, .173, .05), sparkle(s, .827, .827, .05)), 'milk']);
    return out; } },
  // 65 (spicy)
  { name: 'Cherry Pie', size: 28, layers: s => {
    const p = (c: number, r: number, w = 1, h = 1) => s.rect(c / 28, r / 28, (c + w) / 28, (r + h) / 28);
    const fill = s.ell(.5, .571, .37, .22);
    const V = [9, 14, 19].map(k => k / 28), H = [12, 16, 20].map(k => k / 28), w = .036;
    return [
      [s.and(s.ell(.5, .66, .48, .27), s.rect(0, .58, 1, 1)), 'soda'],
      [s.ell(.5, .571, .46, .29), 'tangerine'],
      [fill, 'cherry'],
      [s.and(fill, s.or(...V.map(x => s.rect(x - w, 0, x + w, 1)), ...H.map(y => s.rect(0, y - w, 1, y + w)))), 'lemon'],
      [s.or(p(14, 2), p(15, 1), p(16, 1, 3), p(17, 2, 3)), 'matcha'],
      [s.circ(13.5 / 28, 5.5 / 28, .085), 'cherry'],
      [p(12, 4), 'milk'],
      [s.or(s.ell(.5, .305, .14, .025), s.ell(.5, .27, .08, .025)), 'milk']]; } },
  // 66 (relaxed)
  { name: 'Bath Duck', size: 26, layers: s => {
    const body = s.or(s.ell(.52, .64, .38, .2), s.ell(.3, .52, .1, .06), s.poly([[.6, .5], [.88, .36], [.93, .38], [.9, .62], [.7, .72]]));
    return [
      [s.or(s.circ(.84, .17, .09), s.circ(.654, .077, .065)), 'soda'],
      [s.or(body, s.circ(.36, .34, .21)), 'lemon'],
      [s.poly([[.44, .6], [.58, .67], [.76, .61], [.82, .52], [.68, .57], [.52, .57]]), 'tangerine'],
      [s.rrect(.03, .35, .2, .47, .05), 'tangerine'],
      [s.ell(.308, .288, .045, .06), 'licorice'],
      [s.ell(.442, .462, .06, .03), 'bubblegum'],
      [s.or(s.rect(.77, .12, .84, .15), s.rect(.77, .12, .8, .19), s.rect(.62, .04, .65, .07), s.rect(.27, .23, .3, .26)), 'milk'],
      [s.or(s.rect(0, .77, 1, .96), ...[4, 10, 16, 22].map(x => s.circ(x / 26, .769, .077))), 'soda']]; } },
  // 67
  { name: 'Hand Mirror', size: 28, layers: s => {
    const glass = s.ell(.5, .46, .26, .24);
    return [
      [s.or(s.rrect(.43, .74, .57, .98, .06), s.poly([[.38, .72], [.62, .72], [.57, .82], [.43, .82]])), 'lilac'],
      [s.ell(.5, .46, .35, .32), 'lilac'],
      [glass, 'soda'],
      [s.and(glass, s.or(s.line(.3, .58, .52, .26, .09), s.line(.52, .54, .62, .4, .07))), 'milk'],
      [s.rect(.4, .77, .6, .84), 'lemon'],
      [s.or(s.poly([[.5, .125], [.21, .02], [.21, .23]]), s.ell(.21, .125, .055, .105), s.poly([[.5, .125], [.79, .02], [.79, .23]]), s.ell(.79, .125, .055, .105), s.line(.45, .13, .4, .27, .07), s.line(.55, .13, .6, .27, .07)), 'bubblegum'],
      [s.circ(.5, .125, .055), 'cherry'],
      [s.heart(.8382, .8457, .075), 'bubblegum'],
      [sparkle(s, .196, .84, .05), 'lemon']]; } },
  // 68
  { name: 'Bubble Bath', size: 28, layers: s => {
    const tub = s.and(s.poly([[.1, .6], [.9, .6], [.86, .86], [.14, .86]]), s.rrect(.1, .5, .9, .86, .1));
    const bubbles = s.or(s.circ(.125, .232, .085), s.circ(.893, .143, .065));
    return [
      [s.or(s.poly([[.18, .84], [.29, .84], [.24, .93], [.23, .97], [.1, .97], [.15, .9]]), s.poly([[.82, .84], [.71, .84], [.76, .93], [.77, .97], [.9, .97], [.85, .9]])), 'lilac'],
      [tub, 'mint'],
      [s.rect(.07, .59, .93, .64), 'lilac'],
      [s.and(s.or(s.ell(.5, .48, .32, .27), s.poly([[.286, .321], [.286, .071], [.482, .232]]), s.poly([[.714, .321], [.714, .071], [.518, .232]])), s.rect(0, 0, 1, .536)), 'tangerine'],
      [s.or(s.poly([[.321, .268], [.321, .143], [.436, .225]]), s.poly([[.679, .268], [.679, .143], [.564, .225]])), 'bubblegum'],
      [s.or(eyes(s, .5, .339, .107, .045), s.rect(.43, .39, .47, .42), s.rect(.53, .39, .57, .42), s.rect(.46, .43, .54, .46)), 'licorice'],
      [pair(s, .5, .429, .143, .04, .03), 'bubblegum'],
      [s.or(s.rect(.07, .53, .93, .6), ...[5, 11, 17, 23].map(x => s.circ(x / 28, .536, .057))), 'milk'],
      [bubbles, 'lilac'],
      [s.or(s.rect(.08, .18, .1, .21), s.rect(.86, .11, .89, .14)), 'milk']]; } },
  // 69
  { name: 'Hair Bow', size: 26, layers: s => {
    const loops = s.or(s.poly([[.5, .42], [.14, .14], [.14, .7]]), s.ell(.16, .42, .12, .28), s.poly([[.5, .42], [.86, .14], [.86, .7]]), s.ell(.84, .42, .12, .28));
    return [
      [s.or(s.poly([[.38, .44], [.56, .44], [.5, .56], [.43, .92], [.35, .92], [.315, .85], [.28, .92], [.2, .92]]), s.poly([[.62, .44], [.44, .44], [.5, .56], [.57, .92], [.65, .92], [.685, .85], [.72, .92], [.8, .92]])), 'cherry'],
      [loops, 'cherry'],
      [s.and(loops, dots(s, [[.115, .308], [.269, .308], [.269, .5], [.154, .577], [.885, .308], [.731, .308], [.731, .5], [.846, .577]], .045)), 'milk'],
      [s.rrect(.4, .32, .6, .54, .03), 'bubblegum'],
      [s.rect(.44, .36, .47, .48), 'milk'],
      [sparkle(s, .481, .135, .08), 'lemon']]; } },
  // 70 (spicy, full background)
  { name: 'Lotus Pond', size: 30, bg: true, layers: s => {
    const petal = (tx: number, ty: number, w: number, bx = .5, by = .66) => {
      const dx = tx - bx, dy = ty - by, l = Math.hypot(dx, dy), px = -dy / l * w, py = dx / l * w;
      return s.poly([[bx, by], [bx + dx * .35 + px, by + dy * .35 + py], [bx + dx * .7 + px * .8, by + dy * .7 + py * .8], [tx, ty], [bx + dx * .7 - px * .8, by + dy * .7 - py * .8], [bx + dx * .35 - px, by + dy * .35 - py]]);
    };
    const top = s.rect(0, 0, 1, .71);
    return [
      [s.all(), 'soda'],
      [s.or(...([[.25, .083], [.14, .95], [.84, .95]] as const).map(([x, y]) => s.rect(x - .1, y - .017, x + .1, y + .017))), 'mint'],
      [s.and(s.ell(.5, .8, .44, .15), s.not(s.poly([[.7, .8], [.97, .72], [.97, .88]]))), 'matcha'],
      [s.and(top, s.or(petal(.5, .12, .13), petal(.22, .24, .12), petal(.78, .24, .12), petal(.07, .48, .09), petal(.93, .48, .09), petal(.14, .62, .08, .5, .68), petal(.86, .62, .08, .5, .68))), 'bubblegum'],
      [s.and(top, s.or(petal(.37, .3, .07, .5, .62), petal(.63, .3, .07, .5, .62))), 'lilac'],
      [s.ell(.5, .483, .075, .055), 'lemon'],
      [dots(s, [[.9, .367], [.067, .7]], .035), 'lemon'],
      [s.or(sparkle(s, .817, .083, .065), sparkle(s, .083, .25, .055)), 'milk']]; } },
  // 71 (relaxed)
  { name: 'Toadstool', size: 26, layers: s => {
    const cap = s.and(s.ell(.5, .52, .46, .42), s.rect(0, 0, 1, .52));
    return [
      [s.or(s.ell(.5, .93, .44, .06), s.poly([[.07, .94], [.12, .78], [.18, .94]]), s.poly([[.82, .94], [.88, .78], [.93, .94]])), 'matcha'],
      [s.or(s.rrect(.29, .44, .71, .92, .12), s.ell(.5, .89, .25, .07)), 'milk'],
      [eyes(s, .5, .635, .077, .035), 'licorice'],
      [s.or(s.rect(.35, .735, .42, .8), s.rect(.58, .735, .65, .8)), 'bubblegum'],
      [cap, 'cherry'],
      [s.and(cap, s.or(s.circ(.27, .31, .075), s.circ(.54, .21, .065), s.circ(.75, .355, .08), s.circ(.48, .43, .05), s.circ(.12, .47, .045))), 'milk']]; } },
  // 72
  { name: 'Ladybug', size: 26, layers: s => {
    const shell = s.circ(.5, .6, .37);
    return [
      [s.or(s.line(.42, .2, .27, .077, .05), s.line(.58, .2, .73, .077, .05), s.circ(7 / 26, 2 / 26, .045), s.circ(19 / 26, 2 / 26, .045)), 'cocoa'],
      [shell, 'cherry'],
      [s.and(shell, s.or(s.rect(.48, .2, .52, .92), dots(s, [[.29, .52], [.71, .52], [.31, .77], [.69, .77]], .07))), 'licorice'],
      [s.or(s.rect(4 / 26, 15 / 26, 5 / 26, 17 / 26), s.rect(5 / 26, 16 / 26, 6 / 26, 18 / 26)), 'milk'],
      [s.ell(.5, .3, .24, .16), 'cocoa'],
      [eyes(s, .5, 6.5 / 26, 2 / 26, .035), 'licorice'],
      [dots(s, [[10.5 / 26, 5.5 / 26], [15.5 / 26, 5.5 / 26]], .015), 'milk'],
      [s.or(s.rect(8 / 26, 8 / 26, 10 / 26, 10 / 26), s.rect(16 / 26, 8 / 26, 18 / 26, 10 / 26)), 'bubblegum']]; } },
  // 73
  { name: 'Snail Pal', size: 28, layers: s => {
    const SP = Array.from({ length: 41 }, (_, i) => { const t = i / 40, a = t * 2.6 * Math.PI + 1.2, r = .04 + .18 * t; return [.62 + r * Math.cos(a), .455 + r * Math.sin(a)] as const; });
    const spiral = s.or(...SP.slice(1).map(([x, y], i) => s.line(SP[i]![0], SP[i]![1], x, y, .065)));
    const shell = s.circ(.62, .455, .3);
    const px = (x: number, y: number, w = 1, h = 1) => s.rect(x / 28, y / 28, (x + w) / 28, (y + h) / 28);
    return [
      [s.or(s.rrect(.06, .69, .8, .89, .1), s.poly([[.6, .69], [.78, .69], [.98, .84], [.78, .89], [.6, .89]])), 'mint'],
      [shell, 'lilac'],
      [s.and(shell, spiral), 'grape'],
      [s.ell(.46, .285, .045, .07), 'milk'],
      [s.or(s.ell(.21, .555, .16, .22), s.rect(.06, .635, .36, .835), px(2, 4, 2, 7), px(8, 4, 2, 7)), 'mint'],
      [s.or(s.circ(3 / 28, 5 / 28, .06), s.circ(9 / 28, 5 / 28, .06)), 'mint'],
      [eyes(s, .21, 15 / 28, .064, .035), 'licorice'],
      [blush(s, .21, 18 / 28, .115, .05), 'bubblegum'],
      [s.or(px(4, 17), px(7, 17), px(5, 18, 2)), 'licorice']]; } },
  // 74
  { name: 'Bee Buddy', size: 28, layers: s => {
    const wing = (cx: number, cy: number, rx: number, ry: number, a: number) => s.poly(Array.from({ length: 20 }, (_, i) => {
      const t = i * Math.PI / 10, x = rx * Math.cos(t), y = ry * Math.sin(t);
      return [cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)] as [number, number]; }));
    const body = s.ell(.5, .62, .38, .27);
    return [
      [s.or(wing(.47, .23, .12, .16, .5), wing(.71, .3, .11, .14, 1.1), s.ell(.57, .3, .04, .065)), 'mint'],
      [s.or(wing(.47, .23, .06, .1, .5), wing(.71, .3, .055, .08, 1.1)), 'milk'],
      [s.or(s.line(.26, .48, .143, .179, .05), s.line(.34, .45, .321, .143, .05)), 'cocoa'],
      [s.or(s.circ(4 / 28, 5 / 28, .04), s.circ(9 / 28, 4 / 28, .04)), 'bubblegum'],
      [body, 'lemon'],
      [s.and(body, s.or(s.rect(.46, .39, .55, .86), s.rect(.64, .42, .73, .82))), 'licorice'],
      [s.poly([[.86, .57], [.98, .63], [.86, .69]]), 'cocoa'],
      [eyes(s, 8 / 28, 16.5 / 28, 2 / 28, .035), 'licorice'],
      [s.and(body, blush(s, 8 / 28, 18.5 / 28, .12, .035)), 'bubblegum']]; } },
  // 75 (spicy)
  { name: 'Watering Can', size: 30, layers: s => {
    const body = s.rrect(.06, .44, .58, .9, .1);
    return [
      [s.and(s.ell(.32, .46, .23, .2), s.not(s.ell(.32, .46, .15, .12)), s.rect(0, 0, 1, .46)), 'soda'],
      [s.line(.5, .8, .79, .4, .08), 'soda'],
      [s.poly([[.73, .4], [.83, .48], [.98, .33], [.84, .19]]), 'soda'],
      [s.line(.86, .22, .96, .33, .065), 'lemon'],
      [sparkle(s, 3.5 / 30, 5.5 / 30, .05), 'milk'],
      [body, 'soda'],
      [s.rrect(.1, .4, .54, .46, .02), 'lemon'],
      [dots(s, [[.15, .8], [.483, .8]], .04), 'milk'],
      [s.heart(.317, .66, .12), 'milk'],
      [s.heart(.317, .66, .07), 'bubblegum'],
      [dots(s, [[28 / 30, 14 / 30], [25 / 30, 16 / 30], [29 / 30, 18 / 30]], .03), 'soda'],
      [s.or(s.rect(.8, .84, .867, .97), s.ell(.72, .92, .07, .035)), 'matcha'],
      [s.or(s.circ(.753, .767, .065), s.circ(.913, .767, .065), s.circ(.833, .687, .065), s.circ(.833, .847, .065)), 'cherry'],
      [s.rect(.8, .733, .867, .8), 'lemon']]; } },
  // 76 (relaxed)
  { name: 'Seashell', size: 26, layers: s => {
    // Seven ribs fanning out from the hinge, every other one pink; a round cap on each makes the scalloped rim.
    const at = (deg: number, r: number) => [.5 + r * Math.cos(deg * Math.PI / 180), .92 + r * Math.sin(deg * Math.PI / 180)] as const;
    const fan = (a0: number, a1: number) => s.poly([[.5, .92], at(a0, 1), at(a1, 1)]), A = [-126, -114, -102, -90, -78, -66, -54];
    const p = (x: number, y: number, w = 1, h = 1) => s.rect(x / 26, y / 26, (x + w) / 26, (y + h) / 26);
    const shell = s.and(s.or(s.and(s.circ(.5, .92, .66), fan(-132, -48)), ...A.map(a => s.circ(...at(a, .66), .075))), s.rect(0, 0, 1, 20 / 26));
    return [
      [shell, 'lilac'],
      [s.and(shell, s.not(s.circ(.5, .92, .52)), s.or(...A.filter((_, i) => i % 2).map(a => fan(a - 6, a + 6)))), 'bubblegum'],
      // The hinge ears flare out to a flat bottom.
      [s.or(p(8, 20, 10), p(7, 21, 12)), 'bubblegum'],
      [s.or(eyes(s, .5, 14.5 / 26, 2 / 26, .045), p(11, 16), p(14, 16), p(12, 17, 2)), 'licorice'],
      [s.or(p(7, 15, 2, 2), p(17, 15, 2, 2)), 'bubblegum'],
      [s.or(sparkle(s, .1, .1, .06), sparkle(s, .904, .135, .05), s.circ(23 / 26, 22 / 26, .08)), 'milk'],
      [p(23, 22), 'lilac']]; } },
  // 77
  { name: 'Crab Pal', size: 28, layers: s => {
    const claw = (x: number, y: number, k: number) => s.and(s.circ(x, y, .12), s.not(s.poly([[x, y], [x + k * .03, y - .2], [x + k * .2, y - .07]])));
    // Legs on whole pixels, mirrored: a 2-px bar out from the body with a 1-px foot at its tip.
    const p = (x: number, y: number, w: number, h: number) => s.or(s.rect(x / 28, y / 28, (x + w) / 28, (y + h) / 28), s.rect((28 - x - w) / 28, y / 28, (28 - x) / 28, (y + h) / 28));
    return [
      [s.or(p(1, 14, 5, 2), p(1, 16, 2, 1), p(1, 18, 5, 2), p(1, 20, 2, 1), p(3, 22, 7, 2), p(3, 24, 2, 1)), 'cherry'],
      [s.or(s.line(.3, .52, .18, .32, .07), s.line(.7, .52, .82, .32, .07), claw(.17, .26, -1), claw(.83, .26, 1)), 'cherry'],
      [s.or(s.line(.42, .46, .4, .28, .045), s.line(.58, .46, .6, .28, .045)), 'cherry'],
      [s.ell(.5, .615, .32, .215), 'cherry'],
      [s.or(s.circ(.4, .24, .07), s.circ(.6, .24, .07), s.ell(.3, .52, .05, .03)), 'milk'],
      [s.or(s.circ(.41, .25, .04), s.circ(.59, .25, .04)), 'licorice'],
      [s.and(s.ell(.5, .62, .1, .07), s.not(s.ell(.5, .58, .1, .07))), 'licorice'],
      [blush(s, .5, .64, .21, .065), 'bubblegum'],
      [s.or(s.circ(25 / 28, 2 / 28, .045), s.circ(3 / 28, 2 / 28, .045)), 'soda']]; } },
  // 78 (full background)
  { name: 'Little Whale', size: 30, bg: true, layers: s => {
    // p() puts a shape on whole pixels of the 30 grid; a wave crest is a little 3-px arch.
    const p = (x: number, y: number, w = 1, h = 1) => s.rect(x / 30, y / 30, (x + w) / 30, (y + h) / 30);
    const crest = (x: number, y: number) => s.or(p(x + 1, y), p(x, y + 1), p(x + 2, y + 1));
    const arc = (x: number) => s.and(s.circ(x, .25, .09), s.not(s.circ(x, .27, .05)), s.rect(0, 0, 1, .27));
    return [
      [s.all(), 'lilac'],
      [s.or(s.ell(.62, .12, .1, .04), s.ell(.68, .09, .06, .035)), 'milk'],
      [s.or(p(8, 7, 2, 2), arc(.18), arc(.42)), 'milk'],
      [s.or(s.circ(3 / 30, .3, .03), s.circ(17 / 30, .3, .03)), 'soda'],
      [s.or(s.ell(.42, .58, .34, .24), s.poly([[.6, .44], [.7, .68], [.88, .38], [.84, .34]]), s.line(.86, .36, .76, .23, .09), s.line(.86, .36, .95, .25, .09)), 'soda'],
      ...face(s, 8.5 / 30, 15.5 / 30, 2.5 / 30, .035),
      [s.rect(0, .7, 1, 1), 'mint'],
      [s.or(crest(1, 19), crest(22, 19), crest(5, 23), crest(18, 23), crest(11, 26), crest(25, 26), crest(1, 27)), 'milk']]; } },
  // 79
  { name: 'Sailboat', size: 28, layers: s => {
    const sail = s.poly([[.54, .22], [.54, .6], [.88, .6]]), p = (x: number) => x / 28;
    return [
      [s.rect(.48, .06, .52, .66), 'tangerine'],
      [s.or(s.rect(p(15), p(2), p(17), p(5)), s.rect(p(17), p(3), p(19), p(4))), 'cherry'],
      [sail, 'milk'],
      [s.and(sail, s.or(s.rect(0, p(9), 1, p(11)), s.rect(0, p(13), 1, p(15)))), 'cherry'],
      [s.poly([[.46, .3], [.46, .6], [.18, .6]]), 'milk'],
      [s.poly([[.1, .64], [.9, .64], [.76, .82], [.24, .82]]), 'tangerine'],
      ...face(s, .5, 19.5 / 28, 3 / 28, .035),
      // A clean 2-row band of sea with a 3-px crest every 7 px, mirrored around the middle.
      [s.or(s.rect(p(1), p(24), p(27), p(26)), ...[2, 9, 16, 23].map(x => s.rect(p(x), p(23), p(x + 3), p(24)))), 'soda']]; } },
  // 80 (spicy, full background)
  { name: 'Lighthouse', size: 32, bg: true, layers: s => {
    const tower = s.poly([[.41, .36], [.59, .36], [.64, .84], [.36, .84]]), p = (x: number) => x / 32;
    return [
      [s.all(), 'grape'],
      [s.rect(0, .55, 1, .66), 'bubblegum'],
      [s.and(s.circ(5 / 32, 14.5 / 32, .085), s.not(s.circ(.21, .43, .07))), 'milk'],
      [s.or(s.poly([[.5, .26], [0, .14], [0, .33]]), s.poly([[.5, .26], [1, .14], [1, .33]])), 'lemon'],
      [s.star(.86, .44, .06), 'lemon'],
      [s.or(sparkle(s, p(26.5), p(2.5), .05), sparkle(s, p(5.5), p(2.5), .05)), 'milk'],
      [s.rect(0, .64, 1, 1), 'soda'],
      [s.or(s.rect(.06, p(23), .2, p(24)), s.rect(.78, p(24), .94, p(25)), s.rect(.04, p(27), .14, p(28))), 'milk'],
      [tower, 'milk'],
      [s.and(tower, s.or(s.rect(0, .44, 1, .52), s.rect(0, .6, 1, .68), s.rect(0, .76, 1, .84))), 'cherry'],
      // Arched door, on whole pixels so it stands on the rocks.
      [s.or(s.rect(p(14), p(23), p(18), p(27)), s.rect(p(15), p(22), p(17), p(23))), 'grape'],
      [s.rect(.36, .32, .64, .37), 'cherry'],
      [s.rect(.4, .2, .6, .32), 'lemon'],
      [s.rect(p(15), p(7), p(17), p(9)), 'milk'],
      [s.or(s.and(s.ell(.5, .2, .13, .1), s.rect(0, 0, 1, .2)), s.circ(.5, .08, .03)), 'cherry'],
      [s.or(s.ell(.5, .98, .26, .14), s.ell(.27, .97, .12, .09), s.ell(.73, .97, .12, .09), s.ell(.1, 1, .08, .07), s.ell(.9, 1, .08, .07)), 'cocoa']]; } },
  // 81 (relaxed)
  { name: 'Maple Leaf', size: 26, layers: s => {
    // Right half of the leaf outline from the top tip down to the stem, mirrored for the left half.
    const R = [[.5, .03], [.62, .2], [.72, .13], [.68, .37], [.84, .24], [.87, .33], [.98, .34], [.79, .49], [.93, .57], [.66, .66], [.8, .75], [.6, .69], [.53, .77]] as const;
    return [
      [s.line(.5, .7, .5, .96, .07), 'cocoa'],
      [s.poly([...R, ...R.slice(1).reverse().map(([x, y]) => [1 - x, y] as const)]), 'cherry'],
      [s.or(s.ell(.5, .49, .27, .19), s.poly([[.42, .34], [.5, .25], [.58, .34]])), 'tangerine'],
      // Closed, content eyes: a little u of four pixels each.
      [s.or(...[8, 14].map(c => s.or(s.rect(c / 26, 11 / 26, (c + 1) / 26, 12 / 26), s.rect((c + 3) / 26, 11 / 26, (c + 4) / 26, 12 / 26), s.rect((c + 1) / 26, 12 / 26, (c + 3) / 26, 13 / 26)))), 'licorice'],
      [s.or(s.rect(.27, .54, .38, .57), s.rect(.62, .54, .73, .57)), 'bubblegum']]; } },
  // 82
  { name: 'Acorn', size: 26, layers: s => {
    const cap = s.or(s.rrect(.1, .3, .9, .46, .08), s.and(s.ell(.5, .36, .36, .22), s.rect(0, 0, 1, .36)));
    // Criss-cross lines through pixel centres (x + y and x - y a multiple of 6) so they cross on whole pixels.
    const hatch = s.or(...[-12, -6, 0, 6, 12, 18].flatMap(k => { const c = .5 + k / 26; return [s.line(c - 1, 1, c + 1, -1, .035), s.line(1 / 26 - c, -1, 2 + 1 / 26 - c, 1, .035)]; }));
    return [
      [s.or(s.ell(.5, .6, .28, .3), s.poly([[.36, .78], [.64, .78], [.5, .96]])), 'tangerine'],
      [s.or(s.rect(.27, .47, .34, .53), s.rect(.27, .53, .3, .57)), 'lemon'],
      [s.line(.5, .2, .53, .07, .08), 'cocoa'],
      [s.and(s.circ(.7, -.1, .25), s.circ(.7, .3, .25)), 'matcha'],
      [cap, 'cocoa'],
      // The lattice stays inside the cap so a solid cocoa rim runs all round it.
      [s.and(cap, hatch, s.rect(0, 0, 1, .41), s.or(s.rrect(.19, .31, .81, .41, .06), s.ell(.5, .37, .3, .16))), 'tangerine'],
      ...face(s, .5, .615, .1154, .035)]; } },
  // 83
  { name: 'Hedgehog', size: 28, layers: s => {
    // Point at angle d (degrees) on an ellipse round the body centre; the back zigzags between the body outline and the spike tips.
    const pt = (d: number, rx: number, ry: number) => [.44 + rx * Math.cos(d * Math.PI / 180), .6 - ry * Math.sin(d * Math.PI / 180)] as const;
    const back = s.poly([[.44, .62], ...Array.from({ length: 15 }, (_, i) => pt(192 - i * 12, i % 2 ? .45 : .35, i % 2 ? .4 : .27))]);
    return [
      [s.or(s.ell(.44, .6, .34, .26), back, s.rect(.32, .8, .42, .93), s.rect(.46, .8, .56, .93)), 'cocoa'],
      // Little ^ quill marks following the back, pixel (c, r) at the point.
      [s.or(...([[4, 15], [7, 13], [11, 12]] as const).map(([c, r]) => s.or(s.rect(c / 28, r / 28, (c + 1) / 28, (r + 1) / 28), s.rect((c - 1) / 28, (r + 1) / 28, (c + 2) / 28, (r + 2) / 28)))), 'tangerine'],
      // Face with a pointed snout and a little round ear (pink inside), nose at the tip.
      [s.or(s.ell(.68, .66, .16, .15), s.poly([[.74, .56], [.9, .64], [.97, .7], [.9, .76], [.74, .8]]), s.circ(.589, .482, .055)), 'milk'],
      [s.rect(.575, .47, .6, .495), 'bubblegum'],
      [s.rect(.857, .643, .929, .714), 'licorice'],
      [eyes(s, .714, .643, .0714, .035), 'licorice'],
      [s.or(s.rect(.571, .714, .643, .75), s.rect(.786, .714, .857, .75)), 'bubblegum'],
      // An apple caught on the spikes, with an autumn leaf.
      [s.circ(.33, .28, .11), 'cherry'],
      [s.line(.31, .08, .31, .17, .036), 'cocoa'],
      [s.poly([[.32, .1], [.4, .04], [.5, .05], [.42, .11]]), 'tangerine'],
      [s.ell(.27, .24, .025, .04), 'milk']]; } },
  // 84
  { name: 'Pumpkin', size: 28, layers: s => {
    // Lobes back to front, each with a cocoa rim so the ribs show.
    const LOBES = [[.24, .62, .18, .26], [.76, .62, .18, .26], [.38, .62, .18, .3], [.62, .62, .18, .3], [.5, .62, .16, .31]] as const;
    const out: Layer[] = [
      [s.or(s.line(.5, .36, .5, .16, .08), s.and(s.circ(.58, .17, .11), s.not(s.circ(.58, .17, .05)), s.rect(0, 0, 1, .17)), s.line(.66, .15, .67, .22, .05)), 'matcha'],
      // A pointed leaf drooping from the stem.
      [s.poly([[.45, .29], [.3, .27], [.18, .2], [.12, .13], [.24, .12], [.37, .18]]), 'matcha']];
    for (const [x, y, rx, ry] of LOBES) out.push([s.and(s.ell(x, y, rx + .03, ry + .03), s.rect(0, 0, 1, .925)), 'cocoa'], [s.ell(x, y, rx, ry), 'tangerine']);
    out.push([s.ell(.28, .52, .03, .07), 'lemon']);
    return [...out,
      [s.or(eyes(s, .5, .607, .0714, .035), s.rect(.464, .68, .536, .71)), 'licorice'],
      [s.or(s.rect(.357, .679, .429, .75), s.rect(.571, .679, .643, .75)), 'bubblegum']]; } },
  // 85 (spicy)
  { name: 'Autumn Owl', size: 30, layers: s => {
    const body = s.or(s.ell(.5, .5, .3, .33), s.poly([[.2, .34], [.21, .08], [.4, .26]]), s.poly([[.8, .34], [.79, .08], [.6, .26]]));
    const wings = s.or(s.ell(.21, .62, .08, .19), s.ell(.79, .62, .08, .19));
    const belly = s.ell(.5, .725, .17, .125);
    // A pointed leaf: the lens where two circles offset by (dx, dy) either side of (x, y) overlap; it points across the offset.
    const leaf = (x: number, y: number, dx: number, dy: number, r = .106) => s.and(s.circ(x - dx, y - dy, r), s.circ(x + dx, y + dy, r));
    // A little "v" feather mark, 4 pixels wide, with its top row at pixel row r.
    const vee = (r: number) => s.or(s.rect(13 / 30, r / 30, 14 / 30, (r + 1) / 30), s.rect(16 / 30, r / 30, 17 / 30, (r + 1) / 30), s.rect(14 / 30, (r + 1) / 30, 16 / 30, (r + 2) / 30));
    return [
      [s.or(s.line(.02, .89, .98, .85, .08), s.line(.84, .86, .94, .74, .05)), 'cocoa'],
      [body, 'lilac'],
      [wings, 'bubblegum'],
      [s.and(wings, s.or(s.rect(0, .58, 1, .61), s.rect(0, .66, 1, .69), s.rect(0, .74, 1, .77)), s.not(s.rect(.25, 0, .75, 1))), 'lilac'],
      [belly, 'milk'],
      [s.or(vee(19), vee(22)), 'lilac'],
      // Eye discs centred on whole pixels (11/30, 19/30) so the pupils come out round.
      [s.or(s.circ(.367, .39, .14), s.circ(.633, .39, .14)), 'milk'],
      [s.or(s.circ(.367, .4, .1), s.circ(.633, .4, .1)), 'licorice'],
      [s.or(s.rect(.3, .333, .367, .4), s.rect(.567, .333, .633, .4)), 'milk'],
      [s.poly([[.43, .49], [.57, .49], [.5, .6]]), 'tangerine'],
      [s.or(s.ell(.42, .85, .05, .03), s.ell(.58, .85, .05, .03)), 'tangerine'],
      [s.or(leaf(.1, .117, .06, .06, .13), s.line(.017, .22, .04, .2, .034)), 'cherry'],
      [s.or(leaf(.95, .64, .05, 0), leaf(.05, .77, .05, 0)), 'tangerine'],
      [s.or(s.line(.95, .6, .95, .74, .03), s.line(.05, .73, .05, .84, .03)), 'cocoa']]; } },
  // 86 (relaxed)
  { name: 'Mitten', size: 26, layers: s => [
    [s.or(sparkle(s, .135, .173, .05), sparkle(s, .904, .25, .05), sparkle(s, .135, .79, .04)), 'soda'],
    [s.or(s.rrect(.3, .08, .8, .7, .23), s.line(.36, .58, .19, .37, .18)), 'cherry'],
    [s.heart(.56, .36, .13), 'milk'],
    [s.rect(.27, .655, .85, .92), 'milk'],
    [s.or(...[.365, .442, .519, .596, .673, .75].map(x => s.rect(x - .018, .7, x + .018, .9))), 'bubblegum']] },
  // 87
  { name: 'Snowman', size: 28, layers: s => [
    [s.or(s.line(.27, .604, .08, .424, .05), s.line(.14, .474, .1, .364, .04), s.line(.73, .604, .92, .424, .05), s.line(.86, .474, .9, .364, .04)), 'cocoa'],
    [s.or(s.circ(.5, .709, .25), s.circ(.5, .384, .18)), 'milk'],
    [s.or(s.and(s.circ(.5, .284, .17), s.rect(0, 0, 1, .264)), s.rrect(.29, .214, .71, .274, .03)), 'soda'],
    [s.circ(.5, .107, .07), 'milk'],
    [s.or(s.rrect(.29, .534, .71, .604, .03), s.rrect(.58, .564, .68, .764, .02)), 'bubblegum'],
    [eyes(s, .5, .354, .08, .035), 'licorice'],
    [dots(s, [[.5, .679], [.5, .821]], .035), 'licorice'],
    [s.poly([[.47, .404], [.47, .464], [.55, .464], [.61, .414], [.61, .394]]), 'tangerine'],
    [blush(s, .5, .484, .14, .05), 'bubblegum']] },
  // 88 (full background)
  { name: 'Penguin', size: 30, bg: true, layers: s => [
    [s.all(), 'soda'],
    [s.or(s.rect(0, .86, 1, 1), s.ell(.2, .88, .3, .07), s.ell(.85, .87, .25, .05)), 'milk'],
    [s.or(dots(s, [[.1, .1], [.733, .067], [.9, .533], [.067, .7]], .025), sparkle(s, .15, .45, .04), sparkle(s, .85, .183, .04)), 'milk'],
    [s.or(s.line(.28, .52, .17, .72, .1), s.line(.72, .52, .83, .72, .1)), 'licorice'],
    [s.or(s.ell(.5, .66, .25, .24), s.circ(.5, .35, .22), s.rect(.3, .44, .7, .53)), 'licorice'],
    [s.or(s.ell(.43, .39, .09, .11), s.ell(.57, .39, .09, .11), s.ell(.5, .7, .16, .17)), 'milk'],
    [eyes(s, .5, .38, .07, .035), 'licorice'],
    [blush(s, .5, .46, .11, .05), 'bubblegum'],
    [s.rect(.467, .433, .533, .5), 'tangerine'],
    [s.or(s.ell(.4, .9, .08, .04), s.ell(.6, .9, .08, .04)), 'tangerine'],
    [s.or(s.rrect(.28, .53, .72, .59, .03), s.rrect(.3, .55, .4, .75, .02)), 'cherry']] },
  // 89
  { name: 'Hot Cocoa', size: 28, layers: s => {
    // A steam wisp one pixel wide, wiggling up from pixel (x, y).
    const wisp = (x: number, y: number) => s.or(...([[0, 0], [0, 1], [1, 2], [1, 3], [0, 4], [0, 5]] as const).map(([dx, dy]) => s.rect((x + dx) / 28, (y - dy) / 28, (x + dx + 1) / 28, (y - dy + 1) / 28)));
    return [
      [s.or(wisp(8, 6), wisp(12, 6), wisp(16, 6)), 'milk'],
      [s.ell(.46, .93, .38, .05), 'lilac'],
      [s.and(s.circ(.76, .64, .14), s.not(s.circ(.76, .64, .07))), 'mint'],
      [s.or(s.rrect(.18, .41, .74, .92, .1), s.ell(.46, .41, .28, .085)), 'mint'],
      [s.ell(.464, .4, .24, .075), 'cocoa'],
      [s.or(s.rrect(.25, .29, .36, .39, .02), s.rrect(.54, .29, .64, .39, .02)), 'milk'],
      [s.rrect(.39, .29, .5, .39, .02), 'bubblegum'],
      ...face(s, .464, .625, .107, .036)]; } },
  // 90 (spicy, full background)
  { name: 'Snow Globe', size: 32, bg: true, layers: s => {
    const globe = s.circ(.5, .42, .33);
    return [
      [s.all(), 'grape'],
      [s.or(sparkle(s, .109, .109, .04), sparkle(s, .891, .203, .04), sparkle(s, .078, .641, .03), sparkle(s, .922, .672, .03)), 'milk'],
      [globe, 'soda'],
      [s.and(globe, s.or(s.rect(0, .64, 1, 1), s.ell(.36, .64, .2, .06))), 'milk'],
      [s.rect(.45, .54, .55, .65), 'cocoa'],
      [s.or(s.poly([[.5, .19], [.37, .38], [.63, .38]]), s.poly([[.5, .27], [.32, .55], [.68, .55]])), 'matcha'],
      [dots(s, [[.453, .328], [.547, .422], [.422, .516], [.578, .516]], .02), 'cherry'],
      [s.or(s.rect(14 / 32, 5 / 32, 18 / 32, 6 / 32), s.rect(15 / 32, 4 / 32, 17 / 32, 7 / 32)), 'lemon'],
      [dots(s, [[.703, .266], [.766, .391], [.734, .484], [.641, .172], [.359, .297], [.297, .422]], .02), 'milk'],
      [s.and(globe, s.not(s.circ(.52, .44, .31)), s.rect(0, 0, .46, .46)), 'milk'],
      [s.rect(.3, .72, .7, .79), 'cherry'],
      [s.poly([[.24, .78], [.76, .78], [.84, .94], [.16, .94]]), 'cherry'],
      [dots(s, [[.312, .859], [.437, .859], [.562, .859], [.687, .859]], .035), 'lemon']]; } },
  // 91 (relaxed)
  { name: 'Instant Camera', size: 26, layers: s => {
    const p = (c: number, r: number, w = 1, h = 1) => s.rect(c / 26, r / 26, (c + w) / 26, (r + h) / 26);
    const body = s.rrect(2 / 26, 3 / 26, 24 / 26, 18 / 26, .08);
    return [
      [p(7, 18, 12, 8), 'milk'],
      [p(8, 19, 10, 5), 'soda'],
      [s.or(p(10, 20, 2), p(14, 20, 2), p(10, 21, 6), p(11, 22, 4), p(12, 23, 2)), 'cherry'],
      [s.rrect(16 / 26, 1 / 26, 22 / 26, 4 / 26, .03), 'milk'],
      [s.rrect(4 / 26, 1 / 26, 8 / 26, 4 / 26, .02), 'cherry'],
      [body, 'milk'],
      [s.and(body, p(0, 9, 26, 2)), 'cherry'],
      [s.and(body, p(0, 11, 26, 2)), 'lemon'],
      [s.and(body, p(0, 13, 26, 2)), 'soda'],
      [p(17, 2, 4, 2), 'lemon'],
      [p(4, 4, 3, 2), 'licorice'],
      [s.circ(.5, 10 / 26, .22), 'licorice'],
      [s.circ(.5, 10 / 26, .15), 'soda'],
      [s.circ(.5, 10 / 26, .08), 'licorice'],
      [p(10, 7, 2, 2), 'milk'],
      [p(7, 17, 12), 'licorice']]; } },
  // 92
  { name: 'Bicycle', size: 28, layers: s => {
    const p = (c: number, r: number, w = 1, h = 1) => s.rect(c / 28, r / 28, (c + w) / 28, (r + h) / 28);
    const R = [6 / 28, 20 / 28] as const, F = [22 / 28, 20 / 28] as const, B = [.5, 20 / 28] as const, S = [9.5 / 28, 11.5 / 28] as const, H = [17 / 28, 11.5 / 28] as const;
    const wheel = (c: readonly [number, number]) => s.and(s.circ(c[0], c[1], .19), s.not(s.circ(c[0], c[1], .125)));
    return [
      [s.or(s.line(R[0], 20.5 / 28, B[0], 20.5 / 28, .04), s.line(...R, ...S, .05), s.line(...B, ...S, .05), s.line(...S, ...H, .04), s.line(...S, 8.5 / 28, 9 / 28, .05),
        s.line(...B, ...H, .05), s.line(...H, ...F, .05), s.line(...H, 16.5 / 28, 7.5 / 28, .05)), 'mint'],
      [s.or(wheel(R), wheel(F)), 'lilac'],
      [s.or(p(13, 19, 2, 2), p(6, 8, 5), p(13, 7, 4), p(13, 8)), 'cocoa'],
      [s.or(p(5, 19, 2, 2), p(21, 19, 2, 2)), 'milk'],
      [s.rrect(18 / 28, 9 / 28, 26 / 28, 14 / 28, .03), 'cocoa'],
      [s.or(p(18, 10, 8), p(18, 12, 8)), 'lemon'],
      [s.or(p(18, 8, 9), p(21, 6, 3, 2)), 'mint'],
      [s.or(sparkle(s, 19.5 / 28, 7.5 / 28, .04), sparkle(s, 25.5 / 28, 7.5 / 28, .04)), 'bubblegum'],
      [sparkle(s, 22.5 / 28, 5.5 / 28, .04), 'lemon'],
      [s.or(p(19, 7), p(22, 5), p(25, 7)), 'milk']]; } },
  // 93
  { name: 'Camper Van', size: 28, layers: s => {
    const p = (c: number, r: number, w = 1, h = 1) => s.rect(c / 28, r / 28, (c + w) / 28, (r + h) / 28);
    const body = s.rrect(.04, .29, .96, .82, .08), board = s.ell(.5, 4.5 / 28, .4, .05);
    return [
      [s.or(p(5, 6, 18), p(6, 7, 2), p(20, 7, 2)), 'cocoa'],
      [board, 'lemon'],
      [s.and(board, p(6, 4, 16)), 'bubblegum'],
      [body, 'milk'],
      [s.and(body, s.rect(0, .5, 1, 1)), 'bubblegum'],
      [s.or(p(3, 9, 5, 4), p(10, 9, 5, 4), p(17, 9, 5, 4), p(24, 9, 2, 4)), 'soda'],
      [s.or(p(13, 15, 2, 2), p(13, 19, 2, 2), p(11, 17, 2, 2), p(15, 17, 2, 2)), 'milk'],
      [s.or(p(13, 17, 2, 2), p(25, 15, 2, 2)), 'lemon'],
      [p(1, 22, 26), 'milk'],
      [s.or(s.circ(.25, 23 / 28, .107), s.circ(.75, 23 / 28, .107)), 'cocoa'],
      [s.or(p(6, 22, 2, 2), p(20, 22, 2, 2)), 'lemon']]; } },
  // 94 (full background)
  { name: 'Ferris Wheel', size: 30, bg: true, layers: s => {
    const X = .5, Y = .4, R = .34, at = (i: number, r: number) => [X + r * Math.cos(i * Math.PI / 3), Y + r * Math.sin(i * Math.PI / 3)] as const;
    const p = (c: number, r: number, w = 1, h = 1) => s.rect(c / 30, r / 30, (c + w) / 30, (r + h) / 30);
    const out: Layer[] = [
      [s.all(), 'tangerine'],
      [s.rect(0, 0, 1, .59), 'bubblegum'],
      [s.rect(0, 0, 1, .3), 'grape'],
      [s.or(sparkle(s, 2.5 / 30, 2.5 / 30, .04), sparkle(s, 27.5 / 30, 2.5 / 30, .04)), 'milk'],
      [s.or(s.line(X, Y, .19, .95, .055), s.line(X, Y, .81, .95, .055), s.rect(.1, .93, .9, 1)), 'milk'],
      [s.or(...[0, 1, 2].map(i => s.line(...at(i, R), ...at(i + 3, R), .05))), 'milk'],
      [s.and(s.circ(X, Y, R + .03), s.not(s.circ(X, Y, R - .04))), 'milk'],
      [s.circ(X, Y, .075), 'milk'],
      [s.circ(X, Y, .04), 'lemon']];
    const COLS = ['lemon', 'soda', 'mint', 'lemon', 'soda', 'mint'] as const;
    for (let i = 0; i < 6; i++) {
      const [x, y] = at(i, R), c = Math.round(x * 30), r = Math.round(y * 30) + 1;
      out.push([p(c - 1, r - 1, 2), 'milk'], [s.or(p(c - 2, r, 4, 3), p(c - 1, r + 3, 2)), COLS[i]!]);
    }
    return out; } },
  // 95 (spicy, full background)
  { name: 'Starry Camp', size: 32, bg: true, layers: s => {
    const p = (c: number, r: number, w = 1, h = 1) => s.rect(c / 32, r / 32, (c + w) / 32, (r + h) / 32);
    const X = 11.5 / 32, tent = s.poly([[X - .37, .95], [X, .27], [X + .37, .95]]);
    return [
      [s.all(), 'grape'],
      [s.or(sparkle(s, 4.5 / 32, 4.5 / 32, .04), sparkle(s, 19.5 / 32, 3.5 / 32, .04), sparkle(s, 29.5 / 32, 14.5 / 32, .04)), 'lemon'],
      [s.or(p(9, 1), p(2, 14), p(21, 10), p(17, 13), p(25, 18), p(7, 9)), 'milk'],
      [s.or(p(26, 1, 3), p(27, 2, 3), p(28, 3, 3, 4), p(27, 7, 3), p(26, 8, 3)), 'lemon'],
      [tent, 'soda'],
      [s.poly([[X - .2, .95], [X, .45], [X + .2, .95]]), 'lemon'],
      [s.poly([[X - .11, .95], [X, .62], [X + .11, .95]]), 'tangerine'],
      [p(11, 5, 1, 5), 'cocoa'],
      [p(12, 5, 4, 3), 'tangerine'],
      [s.ell(X, 1.12, 1.1, .27), 'matcha'],
      [s.or(p(23, 28, 2), p(28, 28, 2), p(25, 29, 3), p(23, 30, 2), p(28, 30, 2)), 'cocoa'],
      [s.or(p(26, 22), p(24, 23), p(26, 23), p(28, 23), p(24, 24, 5, 4), p(25, 28, 3)), 'tangerine'],
      [s.or(p(26, 25), p(25, 26, 3, 2)), 'lemon']]; } },
  // 96 (relaxed)
  { name: 'Cloud Lamb', size: 26, layers: s => {
    const puff = s.or(s.ell(.5, .55, .27, .21), s.circ(.5, .31, .12), s.circ(.29, .36, .125), s.circ(.71, .36, .125), s.circ(.2, .55, .11), s.circ(.8, .55, .11),
      s.circ(.25, .68, .1), s.circ(.75, .68, .1), s.circ(.39, .74, .1), s.circ(.61, .74, .1));
    return [
      [s.or(s.rrect(.34, .74, .44, .96, .04), s.rrect(.56, .74, .66, .96, .04)), 'lilac'],
      [s.or(s.line(.2, .52, .03, .62, .1), s.line(.8, .52, .97, .62, .1)), 'lilac'],
      [puff, 'milk'],
      [s.ell(.5, .605, .17, .18), 'lilac'],
      [s.or(s.circ(.42, .45, .05), s.circ(.5, .43, .05), s.circ(.58, .45, .05)), 'milk'],
      [eyes(s, .5, .58, .077, .036), 'licorice'],
      [s.or(s.rect(.35, .655, .42, .73), s.rect(.58, .655, .65, .73)), 'bubblegum'],
      [s.or(sparkle(s, .135, .135, .05), sparkle(s, .865, .096, .05)), 'lemon']]; } },
  // 97
  { name: 'Unicorn', size: 28, layers: s => {
    const strand = (pts: [number, number][], w: number) => s.or(...pts.slice(1).map((p, i) => s.line(pts[i]![0], pts[i]![1], p[0], p[1], w)));
    const horn = s.poly([[.35, .3], [.49, .23], [.27, .01]]);
    return [
      [horn, 'lemon'],
      [s.and(horn, s.or(s.rect(0, .107, .36, .143), s.rect(.36, .179, .43, .214))), 'milk'],
      [s.or(s.circ(.52, .43, .2), s.ell(.28, .6, .16, .13), s.poly([[.4, .27], [.7, .45], [.44, .73], [.14, .52]]), s.poly([[.46, .56], [.7, .42], [.82, 1], [.42, 1]])), 'milk'],
      [strand([[.72, .17], [.85, .26], [.92, .44], [.93, .64], [.95, .84], [.97, 1]], .09), 'bubblegum'],
      [strand([[.68, .22], [.79, .3], [.84, .46], [.86, .64], [.88, .82], [.9, 1]], .09), 'lilac'],
      [strand([[.44, .27], [.62, .26], [.72, .35], [.76, .49], [.78, .66], [.8, .84], [.82, 1]], .1), 'mint'],
      [s.poly([[.5, .26], [.57, .02], [.67, .24]]), 'milk'],
      [s.rect(.39, .36, .46, .46), 'licorice'],
      [s.rect(.395, .36, .425, .39), 'milk'],
      [s.ell(.4, .54, .06, .035), 'bubblegum'],
      [s.circ(.2, .62, .025), 'licorice'],
      [s.or(sparkle(s, .125, .125, .05), sparkle(s, .161, .875, .05)), 'lemon']]; } },
  // 98
  { name: 'Magic Potion', size: 28, layers: s => {
    const inner = s.circ(.5, .62, .26);
    return [
      [s.or(s.circ(.5, .615, .325), s.rect(.41, .22, .59, .4), s.rrect(.37, .2, .63, .27, .03)), 'lilac'],
      [s.or(inner, s.rect(.46, .28, .54, .42)), 0],
      [s.and(s.circ(.5, .62, .33), s.not(inner), s.rect(.16, .4, .3, .64)), 'milk'],
      [s.or(s.rect(.39, .06, .61, .1), s.rect(.43, .1, .57, .21)), 'cocoa'],
      [s.and(inner, s.rect(0, .52, 1, 1)), 'mint'],
      [dots(s, [[.357, .714], [.536, .821], [.679, .679]], .04), 'milk'],
      [dots(s, [[.464, .429], [.607, .464]], .04), 'mint'],
      [s.or(dots(s, [[.429, .607], [.571, .607]], .04), s.poly([[.39, .62], [.61, .62], [.5, .73]])), 'bubblegum'],
      [s.or(sparkle(s, .161, .304, .075), sparkle(s, .911, .804, .05)), 'lemon'],
      [s.star(.84, .24, .07), 'lemon']]; } },
  // 99
  { name: 'Teddy Bear', size: 30, layers: s => [
    [s.or(s.circ(.25, .15, .09), s.circ(.75, .15, .09)), 'cocoa'],
    [s.or(s.rect(.2, .1, .3, .2), s.rect(.7, .1, .8, .2)), 'tangerine'],
    [s.or(s.ell(.5, .72, .25, .22), s.line(.29, .6, .19, .76, .12), s.line(.71, .6, .81, .76, .12)), 'cocoa'],
    [s.or(s.ell(.267, .873, .12, .1), s.ell(.733, .873, .12, .1)), 'cocoa'],
    [s.or(s.ell(.267, .883, .06, .055), s.ell(.733, .883, .06, .055)), 'tangerine'],
    [s.ell(.5, .34, .27, .21), 'cocoa'],
    [s.ell(.5, .45, .13, .085), 'milk'],
    [s.or(s.rect(.47, .4, .53, .465), s.rect(.435, .465, .465, .5), s.rect(.535, .465, .565, .5)), 'licorice'],
    [eyes(s, .5, .31, .13, .038), 'licorice'],
    [s.or(s.rect(.27, .37, .33, .43), s.rect(.67, .37, .73, .43)), 'bubblegum'],
    [s.or(s.circ(.35, .283, .012), s.circ(.617, .283, .012)), 'milk'],
    [s.or(s.rect(.33, .56, .4, .73), s.rect(.6, .56, .67, .73), s.rect(.33, .6, .47, .7), s.rect(.53, .6, .67, .7), s.rect(.33, .633, .67, .666)), 'soda'],
    [s.or(dots(s, [[.433, .8], [.567, .8]], .04), s.poly([[.39, .803], [.61, .803], [.5, .923]])), 'bubblegum']] },
  // 100 (spicy, full background)
  { name: 'Dream Castle', size: 32, bg: true, layers: s => [
    [s.all(), 'soda'],
    [stars(s, [[.08, .1, .075], [.92, .1, .075]]), 'lemon'],
    [s.or(sparkle(s, .328, .266, .035), sparkle(s, .672, .266, .035), sparkle(s, .047, .578, .035), sparkle(s, .953, .641, .035)), 'milk'],
    [s.or(s.rect(.12, .43, .26, .74), s.rect(.74, .43, .88, .74), s.rect(.26, .53, .74, .74), s.rect(.4, .31, .6, .74)), 'lilac'],
    [s.or(s.poly([[.08, .44], [.3, .44], [.19, .19]]), s.poly([[.7, .44], [.92, .44], [.81, .19]]), s.poly([[.36, .33], [.64, .33], [.5, .12]])), 'bubblegum'],
    [s.or(s.rect(.19, .06, .215, .215), s.rect(.785, .06, .81, .215), s.rect(.47, .03, .498, .16)), 'lilac'],
    [s.or(s.poly([[.22, .04], [.32, .109], [.22, .178]]), s.poly([[.78, .04], [.68, .109], [.78, .178]]), s.poly([[.5, .01], [.6, .078], [.5, .146]])), 'bubblegum'],
    [s.or(s.rrect(.16, .53, .22, .65, .03), s.rrect(.78, .53, .84, .65, .03), s.rrect(.29, .56, .35, .66, .03), s.rrect(.65, .56, .71, .66, .03), s.circ(.5, .44, .045)), 'lemon'],
    [s.or(s.circ(.5, .62, .06), s.rect(.44, .62, .56, .7)), 'grape'],
    [s.or(s.rect(0, .76, 1, .86), dots(s, [[.05, .79], [.266, .79], [.5, .79], [.734, .79], [.95, .79]], .1),
      dots(s, [[.1875, .89], [.40625, .89], [.59375, .89], [.8125, .89]], .07)), 'milk'],
    [s.or(sparkle(s, .047, .953, .035), sparkle(s, .953, .953, .035)), 'lemon']] },
];
