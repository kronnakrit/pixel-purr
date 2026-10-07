// The Purrlet's look: procedural parts baked per paint colour (module caches, shared by every cat), one
// shared toon material (vertex colours + baked ink outline), decal materials for the face and the count.
import * as THREE from 'three';
import { paint, COLOR_COUNT, type PaintKey } from '../../engine';
import { bake, ellipsoid, frontDecal, lathe, polarDisc, roundedPoly, slab, tube, wrapOnEllipsoid, INK, type Part, type ProfilePoint } from './geometry';
import { FACE_RECT, faceAtlas, faceUv, gradientMap, numberTexture, shadowTexture, zTexture, type Face } from './textures';

/** Mystery look: grey pot, no accessory, neutral splash. Colour index 0. */
const MYSTERY = { hex: '#6C6390', light: '#9A91C2', dark: '#463E68' };
const CREAM = '#FFF4E4';

/** Rig dimensions (world units). Origin = bottom centre of the pot, facing +Z. */
export const DIM = {
  /** Kitten group origin: the pot rim; the head pivots here. */
  neckY: 0.47,
  /** Head centre above the neck. */
  headY: 0.2,
  head: new THREE.Vector3(0.37, 0.31, 0.32),
  outline: 0.034,
  /** Pot bottom radius: the lean pivots on its front edge. */
  potBottom: 0.352,
  earPivot: new THREE.Vector3(-0.2, 0.38, -0.06),
  tailRoot: new THREE.Vector3(0.2, -0.04, -0.17),
  sweat: new THREE.Vector3(0.33, 0.43, 0.2),
} as const;

type Accessory = 'bow' | 'leaf' | 'star' | 'drop' | 'bubble' | 'flower' | 'heart';
const ACC: Record<PaintKey, Accessory> = {
  cherry: 'bow', tangerine: 'leaf', lemon: 'star', matcha: 'leaf', mint: 'drop', soda: 'bubble',
  grape: 'bow', lilac: 'flower', bubblegum: 'heart', cocoa: 'flower', milk: 'bow', licorice: 'star',
};
const ACC_FILL: Record<Accessory, string> = {
  bow: '#FF5C8A', leaf: '#5FCB5A', star: '#FFE45C', drop: '#7FD7FF', bubble: '#BDEBFF', flower: '#FFFFFF', heart: '#FF4D6D',
};

function colours(c: number) {
  const p = c === 0 ? MYSTERY : paint(c);
  return { base: new THREE.Color(p.hex), light: new THREE.Color(p.light), dark: new THREE.Color(p.dark) };
}

// ---------------------------------------------------------------- pot

/** Outer pot profile (bottom up); the lower band is the dark colour, the lip the light one. */
function potProfile(c: ReturnType<typeof colours>): ProfilePoint[] {
  const { base, light, dark } = c, mid = base.clone().lerp(light, 0.22), top = base.clone().lerp(light, 0.4);
  return [
    { r: 0, y: 0, c: dark }, { r: 0.3, y: 0, c: dark }, { r: 0.336, y: 0.008, c: dark }, { r: DIM.potBottom, y: 0.035, c: dark },
    { r: 0.361, y: 0.1, c: dark }, { r: 0.361, y: 0.1, c: base }, { r: 0.374, y: 0.2, c: base }, { r: 0.39, y: 0.32, c: mid },
    { r: 0.404, y: 0.415, c: top }, { r: 0.404, y: 0.415, c: light }, { r: 0.426, y: 0.428, c: light }, { r: 0.438, y: 0.452, c: light },
    { r: 0.438, y: 0.478, c: light }, { r: 0.428, y: 0.497, c: light }, { r: 0.41, y: 0.505, c: light }, { r: 0.388, y: 0.507, c: light },
  ];
}

/** Outer radius of the pot body at height y (for wrapping decals on its front). */
export function potRadius(y: number): number {
  const pts: [number, number][] = [[0.035, DIM.potBottom], [0.1, 0.361], [0.2, 0.374], [0.32, 0.39], [0.415, 0.404]];
  if (y <= pts[0]![0]) return pts[0]![1];
  for (let i = 1; i < pts.length; i++) {
    const [y1, r1] = pts[i]!, [y0, r0] = pts[i - 1]!;
    if (y <= y1) return r0 + (r1 - r0) * (y - y0) / (y1 - y0);
  }
  return pts[pts.length - 1]![1];
}
const potDepth = (x: number, y: number): number | null => { const r = potRadius(y); return x * x < r * r ? Math.sqrt(r * r - x * x) : null; };

/** A flat shape (x, y on the pot front) wrapped onto the pot's outer wall. */
function wrapOnPot(shape: THREE.Shape, lift: number): THREE.BufferGeometry {
  const g = new THREE.ShapeGeometry(shape, 10), pos = g.getAttribute('position') as THREE.BufferAttribute, nor: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), r = potRadius(y), a = Math.asin(THREE.MathUtils.clamp(x / r, -1, 1));
    pos.setXYZ(i, Math.sin(a) * (r + lift), y, Math.cos(a) * (r + lift));
    nor.push(Math.sin(a), 0, Math.cos(a));
  }
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.deleteAttribute('uv');
  return g;
}

const stadium = (x: number, y0: number, y1: number, w: number) => roundedPoly([[x - w / 2, y0], [x + w / 2, y0], [x + w / 2, y1], [x - w / 2, y1]], w / 2);

function buildPot(c: ReturnType<typeof colours>): THREE.BufferGeometry {
  const { base, light, dark } = c, o = DIM.outline;
  const paws: Part[] = [];
  for (const sx of [-1, 1]) {
    const px = 0.155 * sx;
    const paw = (w: number, h: number) => ellipsoid(0.088, 0.06, 0.078, w, h).translate(px, 0.505, 0.378);
    paws.push({ geo: paw(14, 8), hull: paw(10, 6), color: CREAM, outline: o });
    for (const dx of [-0.024, 0.024]) {
      const toe = new THREE.CapsuleGeometry(0.0065, 0.026, 2, 4).rotateX(-0.95).translate(px + dx, 0.535, 0.437);
      paws.push({ geo: toe, ink: true });
    }
  }
  return bake([
    { geo: lathe(potProfile(c), 32), hull: lathe(potProfile(c).filter((_, i) => [0, 3, 4, 7, 11, 12, 14].includes(i)), 24), outline: o },
    // inner edge of the rim drawn in ink, like the rim ellipse of the 2D pot
    { geo: lathe([{ r: 0.388, y: 0.507, c: INK }, { r: 0.372, y: 0.498, c: INK }, { r: 0.37, y: 0.485, c: INK }], 32), ink: true },
    { geo: lathe([{ r: 0.37, y: 0.485, c: dark }, { r: 0.367, y: 0.43, c: dark }], 32) }, // inner wall, faces inward
    { geo: lathe([{ r: 0.367, y: 0.43, c: base }, { r: 0, y: 0.43, c: base }], 24) },   // paint surface
    // paint drips from the rim and a glossy streak, like the 2D pot
    { geo: wrapOnPot(stadium(-0.2, 0.31, 0.43, 0.058), 0.003), color: light },
    { geo: wrapOnPot(stadium(0.15, 0.35, 0.43, 0.052), 0.003), color: light },
    { geo: wrapOnPot(stadium(-0.27, 0.13, 0.26, 0.034), 0.003), color: light.clone().lerp(new THREE.Color('#ffffff'), 0.55) },
    ...paws,
  ]);
}

// ---------------------------------------------------------------- head

function accessory(kind: Accessory): Part[] {
  const fill = ACC_FILL[kind], o = DIM.outline * 0.8, d = 0.034, b = 0.012, k = 0.0112; // k: world units per design unit
  const S = (pts: [number, number][]) => pts.map(([x, y]) => [x * k, -y * k] as [number, number]);
  const shapeFrom = (draw: (s: THREE.Shape) => void) => { const s = new THREE.Shape(); draw(s); return s; };
  switch (kind) {
    case 'bow': {
      const wing = (m: number) => shapeFrom(s => { s.moveTo(0, 0); s.lineTo(-12 * k * m, 8 * k); s.quadraticCurveTo(-15.5 * k * m, 0, -12 * k * m, -8 * k); s.closePath(); });
      return [
        { geo: slab(wing(1), d, b), color: fill, outline: o }, { geo: slab(wing(-1), d, b), color: fill, outline: o },
        { geo: ellipsoid(0.042, 0.042, 0.03, 12, 8).translate(0, 0, 0.012), color: fill, outline: o },
      ];
    }
    case 'leaf': {
      const leaf = shapeFrom(s => { s.moveTo(-2 * k, -4 * k); s.quadraticCurveTo(-2 * k, 12 * k, 12 * k, 12 * k); s.quadraticCurveTo(12 * k, -4 * k, -2 * k, -4 * k); });
      return [
        { geo: slab(leaf, d, b), color: fill, outline: o },
        { geo: new THREE.CapsuleGeometry(0.006, 0.1, 1, 4).rotateZ(-Math.PI / 4).translate(0.05 * 0.62, 0.05 * 0.62, d / 2 + b), ink: true },
      ];
    }
    case 'star': {
      const pts: [number, number][] = [];
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 4.4 : 10.5; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
      return [{ geo: slab(roundedPoly(S(pts), 0.012), d, b), color: fill, outline: o }];
    }
    case 'drop': {
      const drop = shapeFrom(s => { s.moveTo(0, 11 * k); s.quadraticCurveTo(8 * k, 0, 6.4 * k, -4 * k); s.absarc(0, -4 * k, 6.4 * k, 0, Math.PI, true); s.quadraticCurveTo(-8 * k, 0, 0, 11 * k); });
      return [{ geo: slab(drop, d * 1.4, b * 1.4), color: fill, outline: o }];
    }
    case 'bubble': return [
      { geo: ellipsoid(0.075, 0.075, 0.06, 16, 10), color: fill, outline: o },
      { geo: ellipsoid(0.034, 0.034, 0.03, 10, 6).translate(0.095, 0.085, -0.01), color: fill, outline: o },
      { geo: ellipsoid(0.02, 0.02, 0.01, 8, 4).translate(-0.028, 0.03, 0.055), color: '#ffffff' },
    ];
    case 'flower': {
      const parts: Part[] = [];
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + i * 2 * Math.PI / 5;
        parts.push({ geo: ellipsoid(0.05, 0.05, 0.026, 10, 6).translate(Math.cos(a) * 0.066, Math.sin(a) * 0.066, 0), color: fill, outline: o });
      }
      parts.push({ geo: ellipsoid(0.04, 0.04, 0.03, 10, 6).translate(0, 0, 0.012), color: '#FFD43B', outline: o });
      return parts;
    }
    case 'heart': {
      const heart = shapeFrom(s => { s.moveTo(0, -8 * k); s.bezierCurveTo(-12 * k, 0, -9 * k, 10 * k, 0, 5 * k); s.bezierCurveTo(9 * k, 10 * k, 12 * k, 0, 0, -8 * k); });
      return [{ geo: slab(heart, d * 1.2, b), color: fill, outline: o }];
    }
  }
}

/** Paint blob outline for the splash on the head: five soft lobes. */
const blob = (r: number) => polarDisc(a => r * (1 + 0.14 * Math.cos(5 * a + 0.6) + 0.08 * Math.sin(3 * a + 1)), 4, 40);
const dot = (r: number) => polarDisc(() => r, 2, 14);

function buildHead(c: number): THREE.BufferGeometry {
  const col = colours(c), R = DIM.head, o = DIM.outline, hy = DIM.headY;
  const at = (g: THREE.BufferGeometry) => g.translate(0, hy, 0);
  const parts: Part[] = [
    { geo: at(ellipsoid(R.x, R.y, R.z, 26, 16)), hull: at(ellipsoid(R.x, R.y, R.z, 20, 12)), color: CREAM, outline: o },
    // body stub inside the pot, seen when the kitten pops up
    { geo: ellipsoid(0.285, 0.2, 0.25, 14, 8).translate(0, -0.02, 0), hull: ellipsoid(0.285, 0.2, 0.25, 10, 6).translate(0, -0.02, 0), color: CREAM, outline: o },
    { geo: at(wrapOnEllipsoid(blob(0.085), R, new THREE.Vector3(0.5, 0.78, 0.4), 0.004)), color: col.base },
    { geo: at(wrapOnEllipsoid(dot(0.026), R, new THREE.Vector3(0.84, 0.36, 0.42), 0.004)), color: col.base },
    { geo: at(wrapOnEllipsoid(dot(0.016), R, new THREE.Vector3(0.7, 0.52, 0.48), 0.004)), color: col.base },
  ];
  // whiskers, three-quarter weight so they read as fine lines
  for (const sx of [-1, 1]) for (const [y, a] of [[-0.035, 0.2], [-0.085, -0.2]] as const) {
    const w = new THREE.CapsuleGeometry(0.0055, 0.1, 1, 4).rotateZ(Math.PI / 2 + a * sx).translate(sx * 0.405, hy + y, 0.075);
    parts.push({ geo: w, ink: true });
  }
  if (c !== 0) {
    const kind = ACC[paint(c).key];
    const m = new THREE.Matrix4().compose(new THREE.Vector3(-0.255, hy + 0.225, 0.085),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.25, 0.1, 0.32)), new THREE.Vector3(0.85, 0.85, 0.85));
    for (const p of accessory(kind)) parts.push({ ...p, geo: p.geo.applyMatrix4(m) });
  }
  return bake(parts);
}

/** Left ear (mirror x for the right), built around its pivot so it can twitch and droop. */
function buildEar(c: number, side: 1 | -1): THREE.BufferGeometry {
  const col = colours(c), o = DIM.outline, p = DIM.earPivot, hy = DIM.headY;
  const outer = roundedPoly([[-0.352, 0.0], [-0.305, 0.475], [-0.03, 0.215]], 0.05);
  const inner = roundedPoly([[-0.292, 0.11], [-0.27, 0.385], [-0.125, 0.245]], 0.035);
  const place = (geo: THREE.BufferGeometry, z: number) => mirror(geo.translate(-p.x, hy - p.y, z), side);
  return bake([
    { geo: place(slab(outer, 0.05, 0.024), 0), color: CREAM, outline: o },
    { geo: place(flat(inner), 0.053), color: col.light }, // flat: it sits on the ear's front face
  ]);
}

/** A 2D shape as a flat, front-facing patch. */
function flat(shape: THREE.Shape): THREE.BufferGeometry {
  const g = new THREE.ShapeGeometry(shape, 5);
  g.deleteAttribute('uv');
  return g;
}

/** Mirror in x; a negative scale turns triangles inside out, so swap two corners of each. */
function mirror(g: THREE.BufferGeometry, side: 1 | -1): THREE.BufferGeometry {
  if (side > 0) return g;
  g.scale(-1, 1, 1);
  const idx = g.index ? Array.from(g.index.array) : Array.from({ length: g.getAttribute('position').count }, (_, i) => i);
  for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]!; idx[i + 1] = idx[i + 2]!; idx[i + 2] = t; }
  g.setIndex(idx);
  return g;
}

function buildTail(): THREE.BufferGeometry {
  const r = DIM.tailRoot, P = (x: number, y: number, z: number) => new THREE.Vector3(x - r.x, y - r.y, z - r.z);
  // rises behind the head on the right and curls outward at the tip, so it never reads as a mug handle
  const curve = new THREE.CatmullRomCurve3([P(0.2, -0.04, -0.17), P(0.37, 0.0, -0.17), P(0.47, 0.13, -0.15), P(0.49, 0.29, -0.13),
    P(0.52, 0.4, -0.12), P(0.585, 0.435, -0.11), P(0.625, 0.385, -0.1)]);
  return bake([{ geo: tube(curve, 0.05, 0.04, 28, 8), hull: tube(curve, 0.05, 0.04, 18, 6), color: CREAM, outline: DIM.outline }]);
}

function buildSweat(): THREE.BufferGeometry {
  const prof: ProfilePoint[] = [], c = new THREE.Color('#9BE0FF');
  for (let i = 0; i <= 14; i++) { // round bottom, pointed top
    const t = i / 14, a = Math.PI * t;
    prof.push({ r: 0.07 * Math.sin(a) ** (t > 0.5 ? 1.8 : 1), y: -0.072 * Math.cos(a) + (t > 0.5 ? 0.09 * (t - 0.5) : 0), c });
  }
  return bake([{ geo: lathe(prof, 12), outline: DIM.outline * 0.8 }, { geo: ellipsoid(0.016, 0.024, 0.01, 6, 4).translate(-0.026, -0.03, 0.063), color: '#ffffff' }]);
}

// ---------------------------------------------------------------- caches

export interface Look { pot: THREE.BufferGeometry; head: THREE.BufferGeometry; earL: THREE.BufferGeometry; earR: THREE.BufferGeometry }
const looks = new Map<number, Look>();
/** Per-colour geometry (0 = mystery). Built on first use, shared by every cat of that colour. */
export function lookFor(c: number): Look {
  let l = looks.get(c);
  if (!l) { l = { pot: buildPot(colours(c)), head: buildHead(c), earL: buildEar(c, 1), earR: buildEar(c, -1) }; looks.set(c, l); }
  return l;
}
export const allColours = (): number[] => [0, ...Array.from({ length: COLOR_COUNT }, (_, i) => i + 1)];

let tailGeo: THREE.BufferGeometry | null = null, sweatGeo: THREE.BufferGeometry | null = null;
export const tailGeometry = () => (tailGeo ??= buildTail());
export const sweatGeometry = () => (sweatGeo ??= buildSweat());

const headDepth = (x: number, y: number): number => {
  const R = DIM.head, k = 1 - (x / R.x) ** 2 - (y / R.y) ** 2;
  return k > 0 ? R.z * Math.sqrt(k) : 0;
};
const faceGeos = new Map<Face, THREE.BufferGeometry>();
/** Face decal for an expression: the same grid on the head front, pointing at another atlas cell. */
export function faceGeometry(f: Face): THREE.BufferGeometry {
  let g = faceGeos.get(f);
  if (!g) {
    const r = FACE_RECT;
    g = frontDecal(headDepth, r.x0, r.x1, r.y0, r.y1, 18, 9, 0.003, faceUv(f)).translate(0, DIM.headY, 0);
    faceGeos.set(f, g);
  }
  return g;
}

/** Number decal rectangle on the pot front (2:1, like the number textures); big, so counts read at belt size. */
const NUM = { x0: -0.32, x1: 0.32, y0: 0.05, y1: 0.37 };
let numberGeo: THREE.BufferGeometry | null = null;
export const numberGeometry = () => (numberGeo ??= frontDecal(potDepth, NUM.x0, NUM.x1, NUM.y0, NUM.y1, 10, 2, 0.004));

let shadowGeo: THREE.BufferGeometry | null = null;
export const shadowGeometry = () => (shadowGeo ??= new THREE.PlaneGeometry(1.05, 1.05).rotateX(-Math.PI / 2));

// ---------------------------------------------------------------- materials

let toon: THREE.MeshToonMaterial | null = null;
/** Shade colour multiplier for the darkest toon band (a cool lavender, like the stage's bounce light). */
const SHADE = new THREE.Color(0.7, 0.66, 0.86);

/** The one material for every cat body part: toon-lit vertex colours; vertices flagged `ink` draw unlit plum.
 *  The toon band follows the scene's first directional light, but the brightness is normalised so the
 *  fills stay the art's colours (lit band = exact colour) whatever the scene's light intensities are. */
export function toonMaterial(): THREE.MeshToonMaterial {
  if (toon) return toon;
  const m = new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: gradientMap() });
  m.onBeforeCompile = s => {
    s.uniforms.uInk = { value: INK };
    s.uniforms.uShade = { value: SHADE };
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float ink;\nvarying float vInk;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvInk = ink;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uInk;\nuniform vec3 uShade;\nvarying float vInk;')
      .replace('#include <opaque_fragment>', `
        #if NUM_DIR_LIGHTS > 0
          vec3 ppSun = directionalLights[0].direction;
        #else
          vec3 ppSun = normalize(vec3(-0.4, 0.6, 0.7));
        #endif
        float ppBand = texture2D(gradientMap, vec2(dot(normal, ppSun) * 0.5 + 0.5, 0.5)).r;
        outgoingLight = mix(diffuseColor.rgb * mix(uShade, vec3(1.0), ppBand), uInk, step(0.5, vInk));
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'purrlet-toon-ink';
  toon = m;
  return m;
}

const decal = (map: THREE.Texture) => new THREE.MeshBasicMaterial({
  map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
});
let faceMat: THREE.MeshBasicMaterial | null = null;
export const faceMaterial = () => (faceMat ??= decal(faceAtlas()));

const numberMats = new Map<string, THREE.MeshBasicMaterial>();
/** Material for a paint count (or "?"), cached per label. */
export function numberMaterial(label: string): THREE.MeshBasicMaterial {
  let m = numberMats.get(label);
  if (!m) { m = decal(numberTexture(label)); numberMats.set(label, m); }
  return m;
}

let shadowMat: THREE.MeshBasicMaterial | null = null;
export const shadowMaterial = () => (shadowMat ??= new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }));

let zMat: THREE.MeshBasicMaterial | null = null;
export const zMaterial = () => (zMat ??= new THREE.MeshBasicMaterial({ map: zTexture(), vertexColors: true, transparent: true, depthWrite: false }));

/** Frees every shared geometry and material (call only when no cat is alive). */
export function disposeLooks(): void {
  for (const l of looks.values()) { l.pot.dispose(); l.head.dispose(); l.earL.dispose(); l.earR.dispose(); }
  looks.clear();
  for (const g of faceGeos.values()) g.dispose();
  faceGeos.clear();
  for (const m of numberMats.values()) m.dispose();
  numberMats.clear();
  for (const x of [tailGeo, sweatGeo, numberGeo, shadowGeo, toon, faceMat, shadowMat, zMat]) x?.dispose();
  tailGeo = sweatGeo = numberGeo = shadowGeo = null; toon = null; faceMat = shadowMat = zMat = null;
}
