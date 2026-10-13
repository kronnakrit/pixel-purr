import type { PictureDef } from './picture';

// The 20 v1 pictures (cute, everyday treats and comforts), in level order.
// Order and shapes are part of the level data: changing one changes that level, so rerun `npm run tune` after.
const BLOSSOMS = [[.3, .26], [.56, .52], [.82, .36], [.18, .6], [.66, .82], [.42, .38]] as const; // Sakura Sky flowers

export const PICTURES: readonly PictureDef[] = [
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
    const arc = (r0: number, r1: number) => s.and(s.circ(.5, .7, r1), s.not(s.circ(.5, .7, r0)), s.rect(0, 0, 1, .7));
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
    [s.or(...BLOSSOMS.map(([x, y]) => s.or(s.circ(x - .06, y, .05), s.circ(x + .06, y, .05), s.circ(x, y - .06, .05), s.circ(x, y + .06, .05)))), 'bubblegum'],
    [s.or(...BLOSSOMS.map(([x, y]) => s.circ(x, y, .035))), 'lemon'],
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
