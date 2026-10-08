// The 40 pictures for levels 21-60 (cosy treats, comforts and cute animals), in level order, as shape recipes
// (see src/engine/picture.ts). Shapes and order are level data: after changing one, rerun `npx tsx tools/levels.ts`.
import type { Layer } from '../engine/picture';
import { blush, dots, eyes, face, pair, sleepy, sparkle, stars, streak, zee, type ContentPicture } from './shapes';

export type { ContentPicture } from './shapes';

export const PICTURES_21_60: readonly ContentPicture[] = [
  // 21 (relaxed)
  { name: 'Iced Coffee', size: 24, layers: s => [
    [s.line(.58, .3, .72, .03, .08), 'bubblegum'],
    [s.poly([[.2, .3], [.8, .3], [.7, .96], [.3, .96]]), 'cocoa'],
    [s.poly([[.2, .3], [.8, .3], [.78, .46], [.22, .46]]), 'milk'],
    [s.or(s.rrect(.29, .52, .46, .67, .03), s.rrect(.52, .62, .69, .77, .03)), 'mint'],
    [s.or(s.ell(.5, .29, .33, .07), s.rect(.15, .27, .85, .33)), 'lilac'],
    [s.heart(.48, .82, .075), 'milk']] },
  // 22
  { name: 'Butter Croissant', size: 24, layers: s => {
    // Five flaky segments, tips first, each with a cocoa rim so the seams show.
    const SEG = [[.11, .66, .085, .12], [.89, .66, .085, .12], [.29, .54, .14, .19], [.71, .54, .14, .19], [.5, .44, .19, .23]] as const;
    const out: Layer[] = [];
    for (const [x, y, rx, ry] of SEG) out.push([s.ell(x, y, rx + .045, ry + .045), 'cocoa'], [s.ell(x, y, rx, ry), 'tangerine']);
    out.push([s.or(s.ell(.44, .28, .06, .035), s.ell(.25, .42, .03, .045), s.ell(.75, .42, .03, .045)), 'lemon']);
    return [...out, ...face(s, .5, .46, .075, .038)]; } },
  // 23
  { name: 'Onigiri Pal', size: 24, layers: s => {
    const rice = s.and(s.ell(.5, .56, .42, .4), s.poly([[.5, 0], [1.04, .98], [-.04, .98]]));
    return [
      [s.ell(.5, .92, .46, .07), 'soda'],
      [rice, 'milk'],
      [s.and(rice, s.rect(.33, .7, .67, 1)), 'licorice'],
      ...face(s, .5, .5, .1, .035),
      [s.circ(.5, .31, .065), 'cherry']]; } },
  // 24
  { name: 'Cherry Pair', size: 24, layers: s => [
    [s.or(s.line(.3, .6, .5, .14, .05), s.line(.72, .64, .5, .14, .05)), 'matcha'],
    [s.poly([[.5, .14], [.62, .04], [.86, .08], [.74, .18]]), 'matcha'],
    [s.line(.52, .13, .8, .09, .03), 'mint'],
    [s.or(s.circ(.3, .7, .2), s.circ(.72, .72, .2)), 'cherry'],
    [s.or(s.ell(.2, .62, .035, .055), s.ell(.62, .64, .035, .055)), 'milk'],
    [s.or(eyes(s, .32, .72, .065, .036), eyes(s, .74, .74, .065, .036)), 'licorice']] },
  // 25 (spicy)
  { name: 'Tea Time', size: 26, layers: s => {
    const body = s.ell(.48, .64, .3, .27);
    return [
      [s.and(s.circ(.18, .6, .15), s.not(s.circ(.18, .6, .075))), 'soda'],
      [s.or(s.line(.66, .68, .9, .42, .1), s.ell(.9, .41, .055, .04)), 'soda'],
      [body, 'soda'],
      [s.and(body, s.rect(0, .62, 1, .69)), 'milk'],
      [s.or(s.heart(.36, .5, .045), s.heart(.6, .5, .045), s.heart(.38, .79, .045), s.heart(.58, .79, .045)), 'bubblegum'],
      [s.or(s.ell(.48, .38, .21, .06), s.and(s.ell(.48, .38, .14, .12), s.rect(0, 0, 1, .38))), 'lilac'],
      [s.circ(.48, .23, .05), 'cherry'],
      [s.or(s.line(.92, .32, .87, .24, .045), s.line(.87, .24, .92, .15, .045)), 'milk']]; } },
  // 26 (relaxed)
  { name: 'Love Letter', size: 24, layers: s => [
    [s.rect(.08, .34, .92, .86), 'milk'],
    [s.or(s.line(.08, .86, .42, .6, .05), s.line(.92, .86, .58, .6, .05)), 'lilac'],
    [s.poly([[.08, .34], [.92, .34], [.5, .66]]), 'lilac'],
    [s.heart(.5, .62, .1), 'cherry'],
    [s.or(s.heart(.22, .16, .06), s.heart(.76, .12, .05), s.heart(.86, .24, .035)), 'bubblegum']] },
  // 27
  { name: 'Book Stack', size: 26, layers: s => [
    [s.rrect(.08, .74, .9, .94, .02), 'soda'],
    [s.rect(.8, .77, .87, .91), 'milk'],
    [s.rrect(.16, .56, .84, .74, .02), 'bubblegum'],
    [s.rect(.2, .59, .27, .71), 'milk'],
    [s.rrect(.1, .4, .8, .56, .02), 'matcha'],
    [s.rect(.71, .43, .77, .53), 'milk'],
    [s.or(s.rect(.16, .74, .2, .94), s.rect(.7, .74, .74, .94), s.rect(.34, .56, .38, .74), s.rect(.18, .4, .22, .56), s.rect(.6, .4, .64, .56)), 'lemon'],
    [s.circ(.46, .28, .11), 'cherry'],
    [s.or(s.line(.47, .18, .5, .1, .04), s.ell(.57, .13, .07, .035)), 'matcha'],
    [s.ell(.42, .24, .025, .035), 'milk']] },
  // 28
  { name: 'Cosy Ramen', size: 26, layers: s => {
    const bowl = s.or(s.and(s.circ(.5, .5, .42), s.rect(0, .54, 1, 1)), s.rect(.34, .88, .66, .96));
    return [
      [s.or(s.line(.12, .3, .1, .2, .045), s.line(.1, .2, .14, .1, .045), s.line(.28, .26, .26, .16, .045), s.line(.26, .16, .3, .06, .045)), 'milk'],
      [s.or(s.line(.52, .06, .84, .52, .045), s.line(.64, .04, .92, .48, .045)), 'cocoa'],
      [s.rect(.18, .3, .3, .54), 'licorice'],
      [s.ell(.5, .54, .42, .08), 'tangerine'],
      [s.or(s.line(.66, .28, .63, .54, .035), s.line(.71, .3, .7, .54, .035)), 'lemon'],
      [s.ell(.38, .5, .1, .07), 'milk'],
      [s.circ(.38, .51, .04), 'lemon'],
      [s.circ(.57, .5, .075), 'milk'],
      [s.circ(.57, .5, .04), 'cherry'],
      [bowl, 'cherry'],
      [s.and(bowl, s.rect(0, .66, 1, .72)), 'milk']]; } },
  // 29
  { name: 'Lo-fi Beats', size: 26, layers: s => [
    [s.and(s.circ(.5, .56, .4), s.not(s.circ(.5, .56, .31)), s.rect(0, 0, 1, .6)), 'grape'],
    [s.and(s.circ(.5, .56, .4), s.not(s.circ(.5, .56, .34)), s.rect(.32, 0, .68, .3)), 'lilac'],
    [s.or(s.rrect(.06, .5, .28, .88, .08), s.rrect(.72, .5, .94, .88, .08)), 'bubblegum'],
    [s.or(s.rrect(.25, .55, .34, .83, .04), s.rrect(.66, .55, .75, .83, .04)), 'lilac'],
    [s.or(s.ell(.12, .6, .025, .05), s.ell(.78, .6, .025, .05)), 'milk'],
    [s.or(s.ell(.44, .74, .05, .04), s.rect(.46, .52, .49, .74), s.line(.475, .53, .56, .58, .035)), 'soda'],
    [s.or(s.ell(.6, .86, .04, .03), s.rect(.62, .7, .645, .86)), 'lemon']] },
  // 30 (spicy)
  { name: 'Prickly Pal', size: 26, layers: s => [
    [s.or(s.rrect(.14, .34, .3, .58, .08), s.rect(.2, .5, .4, .58), s.rrect(.7, .24, .86, .5, .08), s.rect(.6, .42, .8, .5)), 'matcha'],
    [s.rrect(.33, .14, .67, .74, .17), 'matcha'],
    [s.or(s.line(.42, .56, .42, .7, .03), s.line(.58, .56, .58, .7, .03), s.line(.22, .4, .22, .52, .03), s.line(.78, .3, .78, .44, .03)), 'mint'],
    [dots(s, [[.37, .3], [.63, .28], [.36, .62], [.64, .64], [.5, .66], [.16, .44], [.84, .36]], .018), 'milk'],
    ...face(s, .5, .38, .075, .032),
    [s.or(s.circ(.44, .12, .05), s.circ(.56, .12, .05), s.circ(.5, .06, .05), s.circ(.5, .17, .045)), 'bubblegum'],
    [s.circ(.5, .12, .05), 'milk'],
    [s.poly([[.26, .72], [.74, .72], [.67, .97], [.33, .97]]), 'soda'],
    [s.rect(.22, .7, .78, .78), 'milk']] },
  // 31 (relaxed)
  { name: 'Ice Lolly', size: 24, layers: s => {
    const body = s.and(s.rrect(.25, .08, .75, .74, .2), s.not(s.circ(.76, .12, .1)));
    return [
      [s.rrect(.43, .66, .57, .96, .06), 'cocoa'],
      [body, 'bubblegum'],
      [s.and(body, s.rect(0, .56, 1, 1)), 'mint'],
      [s.or(s.ell(.36, .76, .045, .07), s.ell(.62, .74, .035, .05)), 'mint'],
      [s.rrect(.3, .16, .35, .44, .02), 'milk'],
      [eyes(s, .52, .42, .09, .04), 'licorice'],
      [blush(s, .52, .5, .16, .05), 'cherry']]; } },
  // 32
  { name: 'Watermelon', size: 26, layers: s => {
    const half = (r: number) => s.and(s.circ(.5, .26, r), s.rect(0, .26, 1, 1));
    return [
      [half(.47), 'matcha'],
      [half(.41), 'mint'],
      [half(.37), 'cherry'],
      [dots(s, [[.22, .36], [.78, .36], [.34, .56], [.66, .56]], .025), 'licorice'],
      ...face(s, .5, .38, .09, .034)]; } },
  // 33
  { name: 'Monstera', size: 28, layers: s => {
    const LEAVES = [[.25, .43, .2, .13], [.75, .37, .2, .13], [.5, .16, .16, .12]] as const;
    // Monstera splits: notches cut in from both edges towards the midrib.
    const slits = s.or(...LEAVES.flatMap(([x, y, rx, ry]) => [-.45, .1].flatMap(k => [
      s.line(x + k * rx, y - ry * 1.1, x + k * rx + .03, y - ry * .35, .035), s.line(x + (k + .3) * rx, y + ry * 1.1, x + (k + .3) * rx - .03, y + ry * .35, .035)])));
    return [
      [s.or(s.line(.5, .66, .3, .44, .045), s.line(.5, .66, .7, .38, .045), s.line(.5, .66, .5, .24, .045)), 'matcha'],
      [s.and(s.or(...LEAVES.map(([x, y, rx, ry]) => s.ell(x, y, rx, ry))), s.not(slits)), 'matcha'],
      [s.or(...LEAVES.map(([x, y, rx]) => s.line(x - rx * .75, y, x + rx * .75, y, .03))), 'mint'],
      [s.poly([[.27, .66], [.73, .66], [.66, .97], [.34, .97]]), 'lilac'],
      [s.rect(.25, .64, .75, .7), 'grape'],
      ...face(s, .5, .8, .085, .036)]; } },
  // 34
  { name: 'Lipstick', size: 26, layers: s => [
    [s.or(sparkle(s, .82, .24, .07), sparkle(s, .2, .46, .05)), 'milk'],
    [s.rrect(.32, .56, .68, .95, .04), 'grape'],
    [s.rect(.37, .6, .41, .9), 'lilac'],
    [s.rect(.37, .36, .63, .5), 'lemon'],
    [s.rect(.3, .49, .7, .58), 'lemon'],
    [s.or(s.poly([[.39, .38], [.61, .38], [.61, .12], [.39, .24]])), 'cherry'],
    [s.heart(.8, .76, .06), 'bubblegum']] },
  // 35 (spicy)
  { name: 'Lemon Slice', size: 28, layers: s => {
    const cut = s.or(...Array.from({ length: 4 }, (_, i) => { const a = i * Math.PI / 4; return s.line(.5 - .4 * Math.cos(a), .54 - .4 * Math.sin(a), .5 + .4 * Math.cos(a), .54 + .4 * Math.sin(a), .04); }));
    return [
      [s.or(s.ell(.78, .12, .11, .05), s.line(.66, .16, .58, .14, .03)), 'matcha'],
      [s.circ(.5, .54, .42), 'lemon'],
      [s.circ(.5, .54, .37), 'milk'],
      [s.and(s.circ(.5, .54, .33), s.not(cut), s.not(s.circ(.5, .54, .06))), 'lemon'],
      [s.or(s.ell(.4, .38, .025, .04), s.ell(.66, .44, .025, .04)), 'milk']]; } },
  // 36 (relaxed)
  { name: 'Balloon Pals', size: 26, layers: s => [
    [s.or(s.line(.28, .5, .5, .9, .03), s.line(.72, .48, .5, .9, .03), s.line(.5, .42, .5, .9, .03)), 'licorice'],
    [s.or(s.ell(.5, .21, .14, .17), s.poly([[.47, .42], [.53, .42], [.5, .37]])), 'lemon'],
    [s.or(s.ell(.24, .34, .14, .17), s.poly([[.21, .55], [.27, .55], [.24, .5]])), 'cherry'],
    [s.or(s.ell(.76, .32, .14, .17), s.poly([[.73, .53], [.79, .53], [.76, .48]])), 'soda'],
    [s.or(s.ell(.21, .24, .03, .06), s.ell(.67, .22, .03, .06), s.ell(.45, .13, .03, .05)), 'milk'],
    [s.or(s.ell(.43, .86, .07, .05), s.ell(.57, .86, .07, .05)), 'bubblegum'],
    [s.circ(.5, .86, .03), 'cherry']] },
  // 37
  { name: 'Avo Toast', size: 28, layers: s => [
    [s.or(s.ell(.5, .3, .42, .2), s.rrect(.12, .3, .88, .94, .05)), 'cocoa'],
    [s.or(s.ell(.5, .31, .37, .16), s.rrect(.16, .3, .84, .9, .04)), 'tangerine'],
    [s.or(s.ell(.5, .6, .27, .2), s.circ(.3, .46, .09), s.circ(.7, .48, .09), s.circ(.36, .76, .09), s.circ(.66, .76, .08)), 'mint'],
    [dots(s, [[.28, .58], [.74, .62], [.4, .82], [.6, .4], [.34, .4]], .025), 'matcha'],
    [s.or(s.ell(.54, .6, .15, .11), s.circ(.44, .55, .07)), 'milk'],
    [s.circ(.55, .6, .06), 'lemon'],
    [dots(s, [[.26, .7], [.72, .4], [.76, .74], [.3, .36]], .03), 'cherry']] },
  // 38
  { name: 'Froggy', size: 26, layers: s => [
    [s.or(s.ell(.5, .62, .4, .3), s.circ(.3, .36, .15), s.circ(.7, .36, .15)), 'matcha'],
    [s.or(s.circ(.3, .36, .095), s.circ(.7, .36, .095)), 'milk'],
    [s.or(s.circ(.32, .38, .05), s.circ(.68, .38, .05)), 'licorice'],
    [s.ell(.5, .82, .22, .1), 'mint'],
    [s.and(s.ell(.5, .58, .15, .08), s.not(s.ell(.5, .54, .15, .08))), 'licorice'],
    [blush(s, .5, .64, .26, .055), 'bubblegum'],
    [s.poly([[.4, .26], [.4, .14], [.45, .2], [.5, .12], [.55, .2], [.6, .14], [.6, .26]]), 'lemon']] },
  // 39
  { name: 'Umbrella', size: 28, layers: s => {
    const scallops = s.or(...[.14, .32, .5, .68, .86].map(x => s.circ(x, .63, .09)));
    const dome = s.and(s.circ(.5, .56, .42), s.rect(0, 0, 1, .56), s.not(scallops));
    return [
      [s.or(s.line(.5, .5, .5, .84, .05), s.and(s.circ(.4, .84, .1), s.not(s.circ(.4, .84, .05)), s.rect(0, .84, 1, 1))), 'cocoa'],
      [dome, 'cherry'],
      [s.and(dome, s.or(s.poly([[.5, .14], [.23, .62], [.41, .62]]), s.poly([[.5, .14], [.59, .62], [.77, .62]]))), 'milk'],
      [s.or(s.rect(.48, .06, .52, .16), s.circ(.5, .06, .03)), 'lemon'],
      [s.or(s.ell(.12, .74, .03, .05), s.ell(.88, .7, .03, .05), s.ell(.72, .88, .03, .05), s.ell(.2, .92, .03, .05), s.ell(.9, .9, .03, .05)), 'soda']]; } },
  // 40 (spicy)
  { name: 'Gift Box', size: 28, layers: s => [
    [s.rect(.16, .46, .84, .93), 'mint'],
    [s.rect(.16, .46, .84, .5), 'matcha'],
    [dots(s, [[.26, .58], [.74, .58], [.3, .82], [.7, .82], [.26, .7], [.74, .7]], .035), 'milk'],
    [s.rect(.12, .35, .88, .47), 'mint'],
    [s.or(s.rect(.44, .35, .56, .93)), 'bubblegum'],
    [s.or(s.ell(.34, .25, .14, .09), s.ell(.66, .25, .14, .09)), 'bubblegum'],
    [s.or(s.ell(.34, .25, .06, .035), s.ell(.66, .25, .06, .035), s.circ(.5, .29, .055)), 'cherry'],
    [s.or(s.rrect(.7, .1, .84, .2, .02), s.line(.66, .22, .72, .18, .02)), 'lemon']] },
  // 41 (relaxed)
  { name: 'Tulip Bunch', size: 28, layers: s => {
    const tulip = (cx: number, cy: number) => s.or(s.and(s.ell(cx, cy, .1, .12), s.rect(0, cy - .03, 1, 1)),
      s.poly([[cx - .1, cy], [cx - .1, cy - .14], [cx - .04, cy - .07], [cx, cy - .16], [cx + .04, cy - .07], [cx + .1, cy - .14], [cx + .1, cy]]));
    return [
      [s.or(s.line(.28, .32, .46, .7, .04), s.line(.5, .22, .5, .7, .04), s.line(.72, .32, .54, .7, .04), s.ell(.2, .56, .1, .04), s.ell(.8, .56, .1, .04)), 'matcha'],
      [tulip(.28, .3), 'cherry'],
      [tulip(.5, .2), 'lemon'],
      [tulip(.72, .3), 'bubblegum'],
      [s.poly([[.24, .56], [.76, .56], [.58, .97], [.42, .97]]), 'lilac'],
      [s.or(s.ell(.42, .68, .08, .05), s.ell(.58, .68, .08, .05), s.circ(.5, .68, .035)), 'soda']]; } },
  // 42
  { name: 'Calm Candle', size: 28, layers: s => [
    [s.rrect(.2, .38, .8, .95, .09), 'lilac'],
    [s.rrect(.26, .44, .74, .9, .05), 'bubblegum'],
    [s.rect(.18, .36, .82, .42), 'grape'],
    [s.rrect(.32, .58, .68, .8, .03), 'milk'],
    [s.heart(.5, .7, .065), 'bubblegum'],
    [s.rect(.48, .3, .52, .44), 'licorice'],
    [s.or(s.ell(.5, .22, .08, .1), s.poly([[.42, .2], [.58, .2], [.5, .04]])), 'tangerine'],
    [s.ell(.5, .24, .05, .065), 'lemon']] },
  // 43
  { name: 'Nail Polish', size: 28, layers: s => [
    [s.or(sparkle(s, .82, .26, .07), sparkle(s, .16, .2, .05)), 'lemon'],
    [s.rrect(.38, .06, .62, .38, .04), 'grape'],
    [s.rect(.42, .1, .46, .34), 'lilac'],
    [s.rect(.34, .36, .66, .45), 'milk'],
    [s.rrect(.2, .43, .8, .95, .12), 'cherry'],
    [s.rrect(.27, .52, .34, .84, .03), 'bubblegum'],
    [s.heart(.54, .7, .08), 'milk']] },
  // 44
  { name: 'Hammy', size: 28, layers: s => [
    [s.or(s.circ(.25, .24, .1), s.circ(.75, .24, .1)), 'tangerine'],
    [s.or(s.circ(.25, .24, .055), s.circ(.75, .24, .055)), 'bubblegum'],
    [s.ell(.5, .58, .4, .34), 'tangerine'],
    [s.or(s.ell(.5, .78, .26, .16), s.ell(.5, .55, .14, .09)), 'milk'],
    [eyes(s, .5, .42, .14, .036), 'licorice'],
    [s.ell(.5, .52, .035, .025), 'bubblegum'],
    [blush(s, .5, .52, .26, .055), 'bubblegum'],
    [s.ell(.5, .76, .07, .1), 'cocoa'],
    [s.line(.5, .7, .5, .82, .025), 'milk'],
    [pair(s, .5, .7, .1, .05, .04), 'tangerine']] },
  // 45 (spicy)
  { name: 'Macaron Tower', size: 30, layers: s => {
    const ROWS: readonly (readonly [number, readonly number[]])[] = [[.66, [.22, .5, .78]], [.44, [.36, .64]], [.22, [.5]]];
    const COLS = ['bubblegum', 'mint', 'lilac', 'lemon'] as const;
    const out: Layer[] = [[s.ell(.5, .92, .46, .05), 'soda']];
    let k = 0;
    for (const [y, xs] of ROWS) for (const x of xs) {
      out.push([s.rrect(x - .12, y, x + .12, y + .19, .07), COLS[k++ % 4]!]);
      out.push([s.rect(x - .1, y + .083, x + .1, y + .11), 'milk']);
    }
    out.push([s.circ(.5, .16, .05), 'cherry']);
    return out; } },
  // 46 (relaxed)
  { name: 'Comfy Sneaker', size: 26, layers: s => [
    [s.or(s.poly([[.1, .44], [.38, .44], [.52, .58], [.84, .6], [.94, .74], [.1, .74]]), s.rrect(.08, .3, .36, .6, .06)), 'soda'],
    [s.and(s.ell(.86, .72, .12, .12), s.rect(0, .6, 1, .74)), 'milk'],
    [s.or(s.line(.38, .48, .46, .44, .035), s.line(.44, .53, .52, .49, .035), s.line(.5, .58, .58, .54, .035)), 'milk'],
    [s.line(.2, .66, .62, .64, .05), 'lemon'],
    [s.rect(.06, .34, .12, .52), 'cherry'],
    [s.rrect(.06, .72, .96, .86, .05), 'milk'],
    [s.rect(.06, .81, .96, .84), 'lilac']] },
  // 47 (full background)
  { name: 'Rain Cloud', size: 30, bg: true, layers: s => [
    [s.all(), 'lilac'],
    [s.or(...([[8, 21], [12, 24], [17, 21], [22, 24], [10, 27], [15, 26], [20, 27]] as const).map(([x, y]) => streak(s, x, y))), 'soda'],
    [s.or(s.circ(.32, .42, .16), s.circ(.52, .32, .2), s.circ(.72, .42, .15), s.rrect(.14, .4, .88, .6, .09)), 'milk'],
    ...face(s, .5, .44, .09, .035),
    [s.or(sparkle(s, .12, .14, .05), sparkle(s, .88, .12, .04)), 'milk']] },
  // 48
  { name: 'Perfume', size: 28, layers: s => [
    [s.or(sparkle(s, .14, .3, .06), sparkle(s, .84, .5, .05)), 'lemon'],
    [s.line(.6, .2, .78, .22, .04), 'grape'],
    [s.ell(.84, .23, .08, .1), 'bubblegum'],
    [s.rrect(.22, .36, .78, .92, .1), 'lilac'],
    [s.rrect(.28, .5, .72, .86, .07), 'bubblegum'],
    [s.rrect(.3, .42, .35, .62, .02), 'milk'],
    [s.rect(.4, .28, .6, .38), 'lemon'],
    [s.rrect(.36, .1, .64, .29, .05), 'grape'],
    [s.heart(.5, .68, .07), 'milk']] },
  // 49
  { name: 'Fox Cub', size: 28, layers: s => [
    [s.or(s.poly([[.08, .48], [.14, .06], [.44, .3]]), s.poly([[.92, .48], [.86, .06], [.56, .3]])), 'tangerine'],
    [s.or(s.poly([[.16, .34], [.17, .14], [.34, .28]]), s.poly([[.84, .34], [.83, .14], [.66, .28]])), 'cocoa'],
    [s.or(s.ell(.5, .48, .36, .26), s.poly([[.1, .48], [.9, .48], [.5, .92]])), 'tangerine'],
    [s.or(s.poly([[.12, .5], [.46, .6], [.5, .92]]), s.poly([[.88, .5], [.54, .6], [.5, .92]])), 'milk'],
    [eyes(s, .5, .48, .15, .035), 'licorice'],
    [s.ell(.5, .84, .05, .035), 'licorice'],
    [blush(s, .5, .6, .24, .05), 'bubblegum']] },
  // 50 (spicy)
  { name: 'Handbag', size: 30, layers: s => {
    const body = s.poly([[.16, .4], [.84, .4], [.92, .92], [.08, .92]]);
    const quilt = s.or(...[-.6, -.3, 0, .3, .6].flatMap(o => [s.line(.1 + o, .92, .5 + o, .4, .03), s.line(.9 - o, .92, .5 - o, .4, .03)]));
    return [
      [s.and(s.ell(.5, .4, .25, .24), s.not(s.ell(.5, .4, .18, .17)), s.rect(0, 0, 1, .42)), 'lemon'],
      [body, 'bubblegum'],
      [s.and(body, quilt), 'milk'],
      [s.poly([[.15, .4], [.85, .4], [.83, .6], [.5, .7], [.17, .6]]), 'cherry'],
      [s.rrect(.43, .6, .57, .72, .03), 'lemon'],
      [s.circ(.5, .66, .02), 'cherry']]; } },
  // 51 (relaxed)
  { name: 'Sun Hat', size: 28, layers: s => [
    [s.ell(.5, .62, .46, .17), 'lemon'],
    [s.and(s.ell(.5, .62, .4, .13), s.not(s.ell(.5, .62, .36, .105))), 'tangerine'],
    [s.and(s.ell(.5, .56, .25, .3), s.rect(0, 0, 1, .6)), 'lemon'],
    [s.and(s.ell(.5, .56, .255, .305), s.rect(0, .46, 1, .56)), 'bubblegum'],
    [s.or(s.poly([[.68, .52], [.84, .66], [.76, .7]]), s.poly([[.7, .52], [.9, .58], [.86, .64]])), 'bubblegum'],
    [s.or(s.circ(.32, .48, .045), s.circ(.4, .48, .045), s.circ(.36, .44, .045), s.circ(.36, .53, .045)), 'milk'],
    [s.circ(.36, .485, .025), 'tangerine']] },
  // 52
  { name: 'Bunny', size: 28, layers: s => [
    [s.or(s.ell(.36, .24, .085, .21), s.ell(.64, .24, .085, .21)), 'milk'],
    [s.or(s.ell(.36, .26, .04, .14), s.ell(.64, .26, .04, .14)), 'bubblegum'],
    [s.ell(.5, .6, .31, .26), 'milk'],
    ...face(s, .5, .56, .11, .035),
    [s.ell(.5, .64, .035, .025), 'bubblegum'],
    [s.or(s.poly([[.62, .12], [.76, .06], [.74, .18]]), s.poly([[.62, .12], [.5, .04], [.52, .16]]), s.circ(.62, .12, .03)), 'lilac'],
    [s.poly([[.56, .74], [.7, .84], [.34, .98]]), 'tangerine'],
    [s.or(s.line(.64, .78, .72, .66, .04), s.line(.66, .8, .8, .74, .04)), 'matcha']] },
  // 53 (full background)
  { name: 'Beach Ball', size: 30, bg: true, layers: s => {
    const ball = s.circ(.46, .58, .25);
    return [
      [s.all(), 'soda'],
      [s.rect(0, .5, 1, .7), 'mint'],
      [s.rect(0, .7, 1, 1), 'lemon'],
      [s.circ(.84, .14, .08), 'tangerine'],
      [s.or(s.ell(.22, .16, .12, .04), s.ell(.3, .12, .07, .04)), 'milk'],
      [s.ell(.5, .86, .22, .045), 'tangerine'],
      [ball, 'cherry'],
      [s.and(ball, s.ell(.46, .58, .17, .3)), 'milk'],
      [s.and(ball, s.ell(.46, .58, .07, .3)), 'soda'],
      [s.and(ball, s.circ(.46, .36, .08)), 'milk'],
      [s.ell(.36, .48, .03, .05), 'milk']]; } },
  // 54
  { name: 'Goldfish', size: 30, layers: s => {
    const bowl = s.and(s.circ(.5, .56, .4), s.rect(0, .26, 1, 1));
    return [
      [bowl, 'soda'],
      [s.and(bowl, s.rect(0, .86, 1, 1)), 'lilac'],
      [dots(s, [[.34, .88], [.5, .9], [.64, .87]], .03), 'milk'],
      [s.or(s.line(.26, .86, .22, .66, .035), s.line(.3, .86, .32, .7, .035), s.line(.74, .86, .78, .62, .035)), 'matcha'],
      [s.or(s.ell(.5, .54, .15, .11), s.poly([[.6, .54], [.78, .42], [.78, .66]])), 'tangerine'],
      [s.poly([[.46, .45], [.54, .42], [.52, .5]]), 'tangerine'],
      [s.ell(.42, .51, .045, .055), 'licorice'],
      [dots(s, [[.32, .38], [.28, .3], [.36, .44]], .025), 'milk'],
      [s.rrect(.22, .18, .78, .28, .04), 'lilac']]; } },
  // 55 (spicy, full background)
  { name: 'Toe Beans', size: 30, bg: true, layers: s => [
    [s.all(), 'grape'],
    [s.or(s.heart(.12, .14, .05), s.heart(.88, .86, .05), s.heart(.86, .16, .04), s.heart(.14, .84, .04)), 'lilac'],
    [s.or(s.ell(.5, .63, .3, .26), s.circ(.24, .37, .1), s.circ(.4, .25, .1), s.circ(.6, .25, .1), s.circ(.76, .37, .1)), 'milk'],
    [s.or(s.ell(.5, .66, .17, .13), s.ell(.24, .37, .06, .07), s.ell(.4, .25, .06, .07), s.ell(.6, .25, .06, .07), s.ell(.76, .37, .06, .07)), 'bubblegum'],
    [s.or(s.ell(.44, .62, .035, .025), s.ell(.38, .21, .015, .02)), 'milk']] },
  // 56 (relaxed)
  { name: 'Sleepy Kitty', size: 28, layers: s => {
    const head = s.ell(.5, .58, .37, .28), earL = s.poly([[.14, .5], [.18, .14], [.42, .34]]), earR = s.poly([[.86, .5], [.82, .14], [.58, .34]]);
    return [
      [s.rrect(.04, .74, .96, .97, .1), 'lilac'],
      [s.or(head, earL, earR), 'milk'],
      [s.or(s.poly([[.2, .4], [.21, .22], [.34, .34]]), s.poly([[.8, .4], [.79, .22], [.66, .34]])), 'bubblegum'],
      [s.and(s.or(head, earR), s.circ(.78, .3, .17)), 'tangerine'],
      [sleepy(s, .5, .6, .15, .055), 'licorice'],
      [blush(s, .5, .68, .25, .055), 'bubblegum'],
      [s.ell(.5, .67, .035, .025), 'bubblegum'],
      [zee(s, .5, .13, .075), 'soda']]; } },
  // 57 (full background)
  { name: 'Hot Air Balloon', size: 32, bg: true, layers: s => {
    const env = s.or(s.circ(.5, .36, .27), s.poly([[.25, .44], [.75, .44], [.58, .7], [.42, .7]]));
    return [
      [s.all(), 'soda'],
      [s.or(s.ell(.14, .24, .1, .045), s.ell(.2, .2, .06, .04), s.ell(.86, .6, .1, .045), s.ell(.8, .56, .06, .04), s.ell(.2, .86, .14, .05)), 'milk'],
      [env, 'cherry'],
      [s.and(env, s.ell(.5, .4, .17, .36), s.not(s.ell(.5, .4, .07, .36))), 'lemon'],
      [s.and(env, s.rect(0, .62, 1, .66)), 'bubblegum'],
      [s.or(s.line(.43, .7, .45, .8, .035), s.line(.57, .7, .55, .8, .035)), 'cocoa'],
      [s.rrect(.42, .79, .58, .9, .02), 'cocoa']]; } },
  // 58
  { name: 'Ringed Planet', size: 30, layers: s => {
    const ring = (y0: number, y1: number) => s.and(s.ell(.5, .54, .47, .13), s.not(s.ell(.5, .52, .36, .07)), s.rect(0, y0, 1, y1));
    const planet = s.circ(.5, .5, .27);
    return [
      [ring(0, .52), 'lilac'],
      [planet, 'tangerine'],
      [s.and(planet, s.or(s.rect(0, .32, 1, .36), s.rect(0, .7, 1, .74))), 'lemon'],
      ...face(s, .5, .46, .1, .03),
      [ring(.52, 1), 'lilac'],
      [stars(s, [[.12, .16, .06], [.86, .2, .05], [.84, .84, .06]]), 'lemon'],
      [s.or(sparkle(s, .18, .82, .04), sparkle(s, .66, .08, .03)), 'milk']]; } },
  // 59 (full background)
  { name: 'Rocket Trip', size: 32, bg: true, layers: s => {
    const body = s.or(s.ell(.5, .46, .14, .3), s.rect(.38, .5, .62, .7));
    return [
      [s.all(), 'grape'],
      [stars(s, [[.14, .14, .05], [.84, .3, .04], [.2, .62, .035], [.86, .86, .05]]), 'lemon'],
      [s.or(sparkle(s, .74, .1, .03), sparkle(s, .12, .86, .03), sparkle(s, .32, .3, .025)), 'milk'],
      [s.circ(.82, .58, .07), 'bubblegum'],
      [s.poly([[.4, .7], [.6, .7], [.5, .97]]), 'tangerine'],
      [s.poly([[.45, .7], [.55, .7], [.5, .86]]), 'lemon'],
      [s.or(s.poly([[.38, .5], [.38, .72], [.26, .76], [.28, .6]]), s.poly([[.62, .5], [.62, .72], [.74, .76], [.72, .6]])), 'cherry'],
      [body, 'milk'],
      [s.and(body, s.rect(0, 0, 1, .26)), 'cherry'],
      [s.circ(.5, .44, .085), 'cherry'],
      [s.circ(.5, .44, .055), 'soda'],
      [s.rect(.44, .66, .56, .7), 'cherry']]; } },
  // 60 (spicy, full background)
  { name: 'Star Wand', size: 32, bg: true, layers: s => [
    [s.all(), 'lilac'],
    [s.or(sparkle(s, .14, .16, .05), sparkle(s, .86, .72, .05), sparkle(s, .2, .56, .035), sparkle(s, .9, .16, .035)), 'milk'],
    [s.or(s.heart(.76, .9, .05), s.heart(.1, .36, .035)), 'bubblegum'],
    [s.line(.2, .94, .5, .5, .08), 'grape'],
    [s.or(s.line(.26, .86, .3, .88, .04), s.line(.34, .74, .38, .76, .04), s.line(.42, .62, .46, .64, .04)), 'milk'],
    [s.or(s.ell(.36, .62, .07, .04), s.ell(.48, .66, .07, .04)), 'bubblegum'],
    [s.star(.58, .38, .34), 'tangerine'],
    [s.star(.58, .39, .27), 'lemon'],
    ...face(s, .58, .42, .07, .03)] },
];
