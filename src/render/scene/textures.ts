// Canvas-drawn textures for the flat parts of the play field (belt frame, dock, tray, ribbons, rings).
// Drawn in the design page's colours at device resolution, so the 3D field matches the 2D art kit.
import { CanvasTexture, ClampToEdgeWrapping, LinearFilter, RepeatWrapping, SRGBColorSpace } from 'three';
import { FONT_DISPLAY } from '../../fonts';
import { BELT } from './layout';

export const INK = '#24193F';

type Ctx = CanvasRenderingContext2D;

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(2, Math.round(w)); c.height = Math.max(2, Math.round(h));
  return c;
}

export function canvasTexture(c: HTMLCanvasElement, repeatU = false): CanvasTexture {
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.minFilter = LinearFilter; t.magFilter = LinearFilter; t.generateMipmaps = false;
  t.wrapS = repeatU ? RepeatWrapping : ClampToEdgeWrapping;
  return t;
}

export function rrect(g: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

const vgrad = (g: Ctx, y0: number, y1: number, a: string, b: string) => {
  const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, a); gr.addColorStop(1, b); return gr;
};

/** Height of the belt's chunky side under the frame, as a fraction of the block side. */
export const BELT_SIDE = 0.03;

/** The belt frame around the board: lavender rim, lane, inner rim and the dark board panel, with its side below.
 *  Canvas: s wide, s * (1 + BELT_SIDE) tall (device px). */
export function drawBelt(c: HTMLCanvasElement): void {
  const g = c.getContext('2d')!, s = c.width;
  g.clearRect(0, 0, s, c.height);
  rrect(g, 0, BELT_SIDE * s, s, s, BELT.outerR * s); g.fillStyle = '#3A2F86'; g.fill();
  rrect(g, 0, BELT_SIDE * s * 0.45, s, s, BELT.outerR * s); g.fillStyle = '#5B4FB4'; g.fill();
  const ring = (inset: number, r: number, fill: string | CanvasGradient) => { const i = inset * s; rrect(g, i, i, s - 2 * i, s - 2 * i, r * s); g.fillStyle = fill; g.fill(); };
  ring(0, BELT.outerR, vgrad(g, 0, s, '#BBB2F8', '#776CCD'));
  // glossy highlight along the top of the outer rim
  g.save(); rrect(g, 0.012 * s, 0.01 * s, s - 0.024 * s, s * 0.5, (BELT.outerR - 0.01) * s); g.clip();
  g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 0.008 * s; rrect(g, 0.012 * s, 0.012 * s, s - 0.024 * s, s - 0.024 * s, (BELT.outerR - 0.012) * s); g.stroke();
  g.restore();
  ring(BELT.laneBorder, BELT.outerR - BELT.laneBorder, '#463C8E');
  ring(BELT.laneFill, BELT.outerR - BELT.laneFill, vgrad(g, 0, s, '#6155B4', '#54499F'));
  ring(BELT.rim - 0.004, 0.066, 'rgba(36,25,63,.35)');
  ring(BELT.rim, 0.062, vgrad(g, 0, s, '#B7AEF6', '#857AD8'));
  ring(BELT.panel, BELT.panelR, '#2C2366');
  // soft inner shadow at the top of the panel
  const p = BELT.panel * s;
  g.save(); rrect(g, p, p, s - 2 * p, s - 2 * p, BELT.panelR * s); g.clip();
  g.fillStyle = vgrad(g, p, p + 0.06 * s, 'rgba(10,6,30,.45)', 'rgba(10,6,30,0)'); g.fillRect(p, p, s - 2 * p, 0.06 * s);
  g.restore();
}

/** One chevron tile pointing along +u (the way round). */
export function drawChevron(c: HTMLCanvasElement): void {
  const g = c.getContext('2d')!, w = c.width, h = c.height;
  g.clearRect(0, 0, w, h);
  g.strokeStyle = '#9086E6'; g.lineWidth = h * 0.16; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(w * 0.42, h * 0.2); g.lineTo(w * 0.58, h * 0.5); g.lineTo(w * 0.42, h * 0.8); g.stroke();
}

/** Blue coil dock (vertical, entry at the bottom-left). */
export function drawDock(c: HTMLCanvasElement, xray: boolean): void {
  const g = c.getContext('2d')!, w = c.width, h = c.height, lw = w * 0.09;
  g.clearRect(0, 0, w, h);
  rrect(g, lw, lw + h * 0.035, w - 2 * lw, h - 2 * lw - h * 0.03, w * 0.28); g.fillStyle = INK; g.fill();
  rrect(g, lw, lw, w - 2 * lw, h - 2 * lw - h * 0.03, w * 0.28);
  g.fillStyle = xray ? vgrad(g, 0, h, '#9BFFF6', '#2BC4D6') : vgrad(g, 0, h, '#86BCFF', '#3D6FE0'); g.fill();
  g.lineWidth = lw; g.strokeStyle = '#2B2470'; g.stroke();
  for (let i = 0; i < 5; i++) {
    rrect(g, w * 0.24, h * (0.15 + i * 0.145), w * 0.52, h * 0.075, h * 0.037);
    g.fillStyle = xray ? '#E8FFFD' : '#DCE9FF'; g.fill();
  }
}

/** Display text in white Lilita One with the plum outline, centred. */
export function drawLabel(c: HTMLCanvasElement, text: string): void {
  const g = c.getContext('2d')!, w = c.width, h = c.height, size = h * 0.72;
  g.clearRect(0, 0, w, h);
  g.font = `${size}px ${FONT_DISPLAY}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round'; g.lineWidth = size * 0.22; g.strokeStyle = INK;
  g.strokeText(text, w / 2, h * 0.54); g.fillStyle = '#fff'; g.fillText(text, w / 2, h * 0.54);
}

/** Tray panel with n cushions; cushions from index `cap0` on are Extra Cushions (dashed gold). Sizes in device px. */
export function drawTray(c: HTMLCanvasElement, n: number, extraFrom: number, cs: number, gap: number, pad: number): void {
  const g = c.getContext('2d')!, w = c.width, h = c.height, sh = pad * 0.35;
  g.clearRect(0, 0, w, h);
  rrect(g, 0, sh, w, h - sh, pad * 1.6); g.fillStyle = 'rgba(18,10,42,.55)'; g.fill();
  rrect(g, 0, 0, w, h - sh, pad * 1.6); g.fillStyle = '#2A2058'; g.fill();
  for (let i = 0; i < n; i++) {
    const x = pad + i * (cs + gap), y = pad - sh / 2, extra = i >= extraFrom;
    rrect(g, x, y, cs, cs, cs * 0.25); g.fillStyle = extra ? '#3E3482' : '#1C1540'; g.fill();
    g.lineWidth = cs * (extra ? 0.05 : 0.035); g.strokeStyle = extra ? '#FFD43B' : '#3B3070';
    if (extra) g.setLineDash([cs * 0.11, cs * 0.075]);
    g.stroke(); g.setLineDash([]);
    rrect(g, x + cs * 0.08, y + cs * 0.05, cs * 0.84, cs * 0.12, cs * 0.06); g.fillStyle = 'rgba(0,0,0,.25)'; g.fill();
  }
}

/** Tutorial ring: a soft gold ellipse lying on the ground. */
export function drawRing(c: HTMLCanvasElement): void {
  const g = c.getContext('2d')!, s = c.width;
  g.clearRect(0, 0, s, s);
  g.save(); g.translate(s / 2, s / 2); g.scale(1, 0.5);
  for (const [lw, col] of [[s * 0.11, 'rgba(255,212,59,.28)'], [s * 0.05, '#FFD43B'], [s * 0.018, '#FFF6C8']] as const) {
    g.beginPath(); g.arc(0, 0, s * 0.4, 0, Math.PI * 2); g.lineWidth = lw; g.strokeStyle = col; g.stroke();
  }
  g.restore();
}

/** Soft round glow, white (tinted by the material). */
export function drawGlow(c: HTMLCanvasElement): void {
  const g = c.getContext('2d')!, s = c.width;
  const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, s, s);
}

/** Linked-pair ribbon strip (u along the ribbon): pink with a plum edge and white stitches. */
export function drawRibbon(c: HTMLCanvasElement): void {
  const g = c.getContext('2d')!, w = c.width, h = c.height;
  g.fillStyle = INK; g.fillRect(0, 0, w, h);
  g.fillStyle = vgrad(g, h * 0.18, h * 0.82, '#FF9AD4', '#E0529F'); g.fillRect(0, h * 0.18, w, h * 0.64);
  g.fillStyle = 'rgba(255,255,255,.9)';
  for (let x = w * 0.1; x < w; x += w / 3) { rrect(g, x, h * 0.44, w * 0.14, h * 0.12, h * 0.06); g.fill(); }
}

export function drawBow(c: HTMLCanvasElement): void {
  const g = c.getContext('2d')!, w = c.width, h = c.height;
  g.clearRect(0, 0, w, h);
  g.save(); g.translate(w / 2, h / 2); const k = w / 30; g.scale(k, k);
  g.lineJoin = 'round'; g.lineWidth = 2.2; g.strokeStyle = INK; g.fillStyle = '#FF7EC8';
  g.beginPath(); g.moveTo(0, 0); g.lineTo(-11, -7.5); g.quadraticCurveTo(-13.5, 0, -11, 7.5); g.closePath();
  g.moveTo(0, 0); g.lineTo(11, -7.5); g.quadraticCurveTo(13.5, 0, 11, 7.5); g.closePath();
  g.fill(); g.stroke();
  g.beginPath(); g.arc(0, 0, 3.8, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.ellipse(-7, -3, 2.4, 1.3, -0.4, 0, Math.PI * 2); g.fill();
  g.restore();
}
