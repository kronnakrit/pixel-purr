// Contact sheet for the hand-made level pictures: renders recipes to a PNG (five per row, each scaled to the same
// board width like on the phone) and prints a legend with the checks a level picture must pass. Use it while drawing
// a pack, before running tools/levels.ts.
//
//   npx tsx tools/pictures.ts sheet.png                 every picture 21-100
//   npx tsx tools/pictures.ts sheet.png 61-70           only these levels
//   npx tsx tools/pictures.ts sheet.png --module draft.ts --first 61
//                                                       a draft module's BATCH (ContentPicture[]), numbered from 61
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';
import { colorsOf, countPixels, PALETTE, raster, type Picture } from '../src/engine';
import { BOARD } from '../src/editor/draw';
import { FIRST_FILE_LEVEL, LAST_FILE_LEVEL } from '../src/content/params';
import { FILE_PICTURES } from '../src/content/recipes';
import type { ContentPicture } from '../src/content/shapes';

const TILE = 384, PAD = 16, COLS = 5;

const hex = (h: string): [number, number, number] => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];

function png(w: number, h: number, rgb: Uint8Array): Buffer {
  const chunk = (type: string, data: Buffer): Buffer => {
    const len = Buffer.alloc(4), body = Buffer.concat([Buffer.from(type, 'latin1'), data]), crc = Buffer.alloc(4);
    len.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) Buffer.from(rgb.buffer, rgb.byteOffset + y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** Draw the pictures as candy cubes (fill, light top-left edge, dark bottom-right edge) on the board colour. */
function sheet(pics: readonly Picture[]): { w: number; h: number; rgb: Uint8Array } {
  const rows = Math.ceil(pics.length / COLS), w = COLS * (TILE + PAD) + PAD, h = rows * (TILE + PAD) + PAD;
  const rgb = new Uint8Array(w * h * 3).fill(0x16);
  const rect = (x0: number, y0: number, x1: number, y1: number, c: readonly number[]) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) rgb.set(c, (y * w + x) * 3);
  };
  const board = hex(BOARD);
  pics.forEach((p, i) => {
    const ox = PAD + (i % COLS) * (TILE + PAD), oy = PAD + Math.floor(i / COLS) * (TILE + PAD);
    rect(ox, oy, ox + TILE, oy + TILE, board);
    const cell = Math.floor(TILE / p.w), mx = ox + Math.floor((TILE - cell * p.w) / 2), my = oy + Math.floor((TILE - cell * p.h) / 2);
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
      const paint = PALETTE[p.px[y * p.w + x]!];
      if (!paint) continue;
      const x0 = mx + x * cell, y0 = my + y * cell;
      rect(x0, y0, x0 + cell, y0 + cell, hex(paint.dark));
      rect(x0, y0, x0 + cell - 2, y0 + cell - 2, hex(paint.light));
      rect(x0 + 2, y0 + 2, x0 + cell - 2, y0 + cell - 2, hex(paint.hex));
    }
  });
  return { w, h, rgb };
}

async function main(): Promise<void> {
  const a = process.argv.slice(2), out = a[0];
  if (!out) throw new Error('usage: npx tsx tools/pictures.ts out.png [from-to] [--module draft.ts --first n]');
  const opt = (k: string) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : undefined; };
  let defs: readonly ContentPicture[], first: number;
  const mod = opt('module');
  if (mod) {
    const m = await import(pathToFileURL(resolve(mod)).href) as { BATCH?: ContentPicture[]; default?: ContentPicture[] };
    defs = m.BATCH ?? m.default ?? [];
    first = Number(opt('first') ?? 1);
  } else {
    const range = a.slice(1).find(s => /^\d+(-\d+)?$/.test(s)) ?? `${FIRST_FILE_LEVEL}-${LAST_FILE_LEVEL}`;
    const [lo, hi] = range.split('-').map(Number);
    first = lo!;
    defs = FILE_PICTURES.slice(lo! - FIRST_FILE_LEVEL, (hi ?? lo!) - FIRST_FILE_LEVEL + 1);
  }
  if (!defs.length) throw new Error('no pictures to draw');

  const pics = defs.map(d => raster(d, d.size)), known = new Map(FILE_PICTURES.map(d => [d.name, d]));
  let bad = 0;
  pics.forEach((p, i) => {
    const d = defs[i]!, n = first + i, cols = colorsOf(p.px), counts = new Map<number, number>();
    for (const c of p.px) if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
    const warn: string[] = [];
    if (cols.length < 3 || cols.length > 7) warn.push(`needs 3-7 colours, has ${cols.length}`);
    if (d.size < 24 || d.size > 32) warn.push(`size ${d.size} is outside 24-32`);
    if (d.bg && !p.px.every(c => c > 0)) warn.push('marked bg but has empty pixels');
    for (const [c, k] of counts) if (k < 5) warn.push(`${PALETTE[c]!.key} has only ${k} px`);
    const other = known.get(d.name);
    if (other && other !== d) warn.push(`name "${d.name}" is already used`);
    bad += warn.length;
    const mix = [...counts].sort((x, y) => y[1] - x[1]).map(([c, k]) => `${PALETTE[c]!.key} ${k}`).join(', ');
    console.log(`${n}${n % 5 === 0 ? '*' : n % 5 === 1 ? '~' : ' '} ${d.name.padEnd(18)} ${d.size}x${d.size}${d.bg ? ' bg' : '   '} ${String(countPixels(p.px)).padStart(4)} px  ${mix}${warn.length ? '  !! ' + warn.join('; ') : ''}`);
  });
  const s = sheet(pics);
  writeFileSync(out, png(s.w, s.h, s.rgb));
  console.log(`wrote ${out}: ${pics.length} pictures, ${COLS} per row (* spicy, ~ relaxed)${bad ? `, ${bad} warnings` : ''}`);
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
