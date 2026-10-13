// Canvas textures shared by every Purrlet: the face atlas (one cell per expression), paint-count numbers
// (one cached texture per number), the floating z, the soft ground shadow and the toon gradient map.
// Drawn with the 2D art's own SVG paths so the 3D cat keeps the design's face.
import * as THREE from 'three';
import { FONT_DISPLAY, fontsReady } from '../../fonts';

const INK = '#24193F';

// ---------------------------------------------------------------- face atlas

export const FACES = ['open', 'half', 'closed', 'squint', 'nap', 'happy', 'worry', 'wow'] as const;
export type Face = (typeof FACES)[number];

/** The face decal covers this head-local rectangle (head centre = 0,0); the atlas cells match its 2:1 aspect. */
export const FACE_RECT = { x0: -0.37, x1: 0.37, y0: -0.21, y1: 0.16 } as const;
const CELL_W = 512, CELL_H = 256, COLS = 2, ROWS = 4;
/** World units per unit of the design's 100-wide SVG cat (face only). */
const SVG = 0.0127;

/** UV rectangle [u0, v0, u1, v1] of a face cell. */
export function faceUv(f: Face): [number, number, number, number] {
  const i = FACES.indexOf(f), cx = i % COLS, cy = Math.floor(i / COLS);
  const u0 = cx / COLS, v1 = 1 - cy / ROWS;
  return [u0, v1 - 1 / ROWS, u0 + 1 / COLS, v1];
}

function drawFace(ctx: CanvasRenderingContext2D, f: Face): void {
  const P = (d: string) => new Path2D(d);
  const line = (d: string, w: number) => { ctx.lineWidth = w; ctx.stroke(P(d)); };
  ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // blush first so it sits under everything
  ctx.fillStyle = 'rgba(255,111,168,0.55)';
  for (const x of [28.5, 71.5]) { ctx.beginPath(); ctx.ellipse(x, 53.2, 5.4, 3.2, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = INK;
  const eyes = (ry: number, glint: boolean) => {
    for (const x of [38.6, 61.4]) { ctx.beginPath(); ctx.ellipse(x, 45.2, 4.8, ry, 0, 0, Math.PI * 2); ctx.fill(); }
    if (!glint) return;
    ctx.fillStyle = '#fff';
    for (const x of [37.1, 59.9]) { ctx.beginPath(); ctx.arc(x, 42.8, 2.05, 0, Math.PI * 2); ctx.fill(); }
    for (const x of [40.1, 62.9]) { ctx.beginPath(); ctx.arc(x, 47.6, 0.95, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = INK;
  };
  const smile = () => line('M46.6 54.6 q1.7 2.7 3.4 0 q1.7 2.7 3.4 0', 2.3);
  const open = () => { ctx.fill(P('M46.6 54.4 q3.4 6.4 6.8 0 Z')); ctx.fillStyle = '#FF7EA8'; ctx.fill(P('M48.2 57.4 q1.8 1.4 3.6 0 q-1.8 -1 -3.6 0 Z')); ctx.fillStyle = INK; line('M46.6 54.4 q3.4 6.4 6.8 0 Z', 1.2); };
  switch (f) {
    case 'open': eyes(6, true); smile(); break;
    case 'half': eyes(3, false); smile(); break;
    case 'closed': line('M34.2 45.6 q4.4 2.2 8.8 0 M56.8 45.6 q4.4 2.2 8.8 0', 3.2); smile(); break;
    case 'squint': line('M34.2 41 l8.4 4.2 l-8.4 4.2 M65.8 41 l-8.4 4.2 l8.4 4.2', 3.6); open(); break;
    case 'nap': line('M34 44.6 q4.6 5 9.2 0 M56.8 44.6 q4.6 5 9.2 0', 3.3); smile(); break;
    case 'happy': line('M34 47.4 q4.6 -6.2 9.2 0 M56.8 47.4 q4.6 -6.2 9.2 0', 3.4); open(); break;
    case 'worry':
      eyes(5.2, true);
      line('M33.6 37.6 q4.4 -2.6 8.2 -0.8 M66.4 37.6 q-4.4 -2.6 -8.2 -0.8', 2.4);
      line('M45.8 56.2 q1.4 -1.6 2.8 0 q1.4 1.6 2.8 0 q1.4 -1.6 2.8 0', 2.1);
      break;
    case 'wow': eyes(6.2, true); ctx.beginPath(); ctx.ellipse(50, 56, 2.2, 2.6, 0, 0, Math.PI * 2); ctx.fill(); break;
  }
  // nose on top of the mouth line
  ctx.fillStyle = '#FF7EA8'; ctx.lineWidth = 1.1;
  const nose = P('M47.2 50.8 h5.6 l-2.8 3 Z'); ctx.fill(nose); ctx.stroke(nose);
}

let faceTex: THREE.CanvasTexture | null = null;
export function faceAtlas(): THREE.CanvasTexture {
  if (faceTex) return faceTex;
  const cv = document.createElement('canvas'); cv.width = CELL_W * COLS; cv.height = CELL_H * ROWS;
  const ctx = cv.getContext('2d')!, s = CELL_W / ((FACE_RECT.x1 - FACE_RECT.x0) / SVG);
  FACES.forEach((f, i) => {
    const ox = (i % COLS) * CELL_W, oy = Math.floor(i / COLS) * CELL_H;
    // SVG point (50, 46) is the head centre; y grows down in both the SVG and the canvas.
    ctx.setTransform(s, 0, 0, s, ox + CELL_W / 2 - 50 * s, oy + (FACE_RECT.y1 / SVG) * s - 46 * s);
    drawFace(ctx, f);
  });
  faceTex = finish(new THREE.CanvasTexture(cv));
  return faceTex;
}

// ---------------------------------------------------------------- numbers

const numbers = new Map<string, { tex: THREE.CanvasTexture; cv: HTMLCanvasElement }>();
let fontsOk = false;

function drawNumber(cv: HTMLCanvasElement, label: string): void {
  const ctx = cv.getContext('2d')!, mystery = label === '?';
  ctx.clearRect(0, 0, cv.width, cv.height);
  const size = mystery ? 112 : label.length > 2 ? 88 : 112;
  ctx.font = `${size}px ${FONT_DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = size * 0.24; ctx.strokeStyle = INK;
  const y = cv.height / 2 + size * 0.06;
  ctx.strokeText(label, cv.width / 2, y);
  ctx.fillStyle = mystery ? '#C9C2EA' : '#fff';
  ctx.fillText(label, cv.width / 2, y);
}

/** Paint count (or "?") texture, cached per label. Redrawn once the bundled font has loaded. */
export function numberTexture(label: string): THREE.CanvasTexture {
  let e = numbers.get(label);
  if (!e) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
    drawNumber(cv, label);
    e = { cv, tex: finish(new THREE.CanvasTexture(cv)) };
    numbers.set(label, e);
    if (!fontsOk) void loadFonts();
  }
  return e.tex;
}

let fontPromise: Promise<void> | null = null;
export function loadFonts(): Promise<void> {
  fontPromise ??= fontsReady().then(() => {
    fontsOk = true;
    for (const [label, e] of numbers) { drawNumber(e.cv, label); e.tex.needsUpdate = true; }
    if (zTex) { drawZ(zTex.image as HTMLCanvasElement); zTex.needsUpdate = true; }
  });
  return fontPromise;
}

// ---------------------------------------------------------------- z, shadow, gradient

let zTex: THREE.CanvasTexture | null = null;
function drawZ(cv: HTMLCanvasElement): void {
  const ctx = cv.getContext('2d')!;
  ctx.clearRect(0, 0, 64, 64);
  ctx.font = `52px ${FONT_DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = 11; ctx.strokeStyle = INK; ctx.strokeText('z', 32, 34);
  ctx.fillStyle = '#fff'; ctx.fillText('z', 32, 34);
}
export function zTexture(): THREE.CanvasTexture {
  if (zTex) return zTex;
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  drawZ(cv);
  zTex = finish(new THREE.CanvasTexture(cv));
  if (!fontsOk) void loadFonts();
  return zTex;
}

let shadowTex: THREE.CanvasTexture | null = null;
export function shadowTexture(): THREE.CanvasTexture {
  if (shadowTex) return shadowTex;
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const ctx = cv.getContext('2d')!, g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(18,11,42,0.5)'); g.addColorStop(0.55, 'rgba(18,11,42,0.32)'); g.addColorStop(1, 'rgba(18,11,42,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  shadowTex = finish(new THREE.CanvasTexture(cv));
  return shadowTex;
}

let gradient: THREE.DataTexture | null = null;
/** Three-step toon ramp (shadow, mid, lit) over dot(normal, sun) from -1 to 1: lit above 0.25, shadow below -0.5. */
export function gradientMap(): THREE.DataTexture {
  if (gradient) return gradient;
  gradient = new THREE.DataTexture(new Uint8Array([0, 0, 120, 120, 120, 255, 255, 255]), 8, 1, THREE.RedFormat);
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
  gradient.generateMipmaps = false;
  gradient.needsUpdate = true;
  return gradient;
}

function finish(t: THREE.CanvasTexture): THREE.CanvasTexture {
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

export function disposeTextures(): void {
  faceTex?.dispose(); faceTex = null;
  for (const e of numbers.values()) e.tex.dispose();
  numbers.clear();
  zTex?.dispose(); zTex = null;
  shadowTex?.dispose(); shadowTex = null;
  gradient?.dispose(); gradient = null;
}
