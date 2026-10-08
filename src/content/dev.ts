// Dev contact sheet (dev/content.html): every level picture as candy cubes plus a 1:1 thumbnail, to check that
// each one reads at its grid size. Query: from, to (level range, default 21-100), cell (px per pixel, default 6),
// stats=1 (also builds each level and prints its queues; slow for endless levels), recipe=1 (draw 21-100 straight
// from the recipes in pictures*.ts instead of the level files, to iterate on a picture before regenerating).
import '../fonts';
import { PALETTE, colorsOf, countPixels, raster, type Picture } from '../engine';
import { BOARD, drawPicture } from '../editor/draw';
import { content } from './index';
import { FIRST_FILE_LEVEL, LAST_FILE_LEVEL } from './params';
import { FILE_PICTURES } from './recipes';

const q = new URLSearchParams(location.search);
const from = Number(q.get('from') ?? 21), to = Number(q.get('to') ?? LAST_FILE_LEVEL), cell = Number(q.get('cell') ?? 6);
const stats = q.get('stats') === '1', recipe = q.get('recipe') === '1';

function drawCubes(cv: HTMLCanvasElement, pic: Picture, c: number): void {
  cv.width = pic.w * c; cv.height = pic.h * c;
  const g = cv.getContext('2d')!;
  g.fillStyle = BOARD; g.fillRect(0, 0, cv.width, cv.height);
  drawPicture(g, pic, 0, 0, c, false);
}

function drawFlat(cv: HTMLCanvasElement, pic: Picture): void {
  cv.width = pic.w; cv.height = pic.h;
  const g = cv.getContext('2d')!, img = g.createImageData(pic.w, pic.h);
  pic.px.forEach((c, j) => {
    const hex = PALETTE[c]?.hex ?? '#2A2058';
    img.data.set([parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 255], j * 4);
  });
  g.putImageData(img, 0, 0);
}

const grid = document.getElementById('grid')!;
for (let n = from; n <= to; n++) {
  const def = recipe ? FILE_PICTURES[n - FIRST_FILE_LEVEL] : undefined;
  const pic = def ? raster(def, def.size) : content.levelPicture(n);
  const meta = def ? { name: def.name, spicy: n % 5 === 0 } : content.levelMeta(n);
  const card = document.createElement('div'), big = document.createElement('canvas'), small = document.createElement('canvas');
  card.className = 'card' + (meta.spicy ? ' spicy' : '');
  drawCubes(big, pic, cell); drawFlat(small, pic);
  const row = document.createElement('div');
  row.className = 'row'; row.append(big, small);
  let info = `${pic.w}×${pic.h} · ${countPixels(pic.px)} px · ${colorsOf(pic.px).length} colours`;
  if (stats) {
    const L = content.getLevel(n), all = L.queues.flat();
    info += `<br>${all.length} Purrlets · ${L.queues.length} queues · need ${L.need ?? '?'} · ${all.filter(s => s.hidden).length} mystery · ${all.filter(s => s.link !== undefined).length / 2} links`;
  }
  card.innerHTML = `<b>${n} ${meta.name}</b>`;
  card.append(row);
  const i = document.createElement('i'); i.innerHTML = info; card.append(i);
  grid.append(card);
}
