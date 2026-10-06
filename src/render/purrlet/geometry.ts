// Procedural geometry for the Purrlet: parts are baked into one indexed geometry per moving piece with
// vertex colours, plus an inverted-hull outline (inflated, winding flipped, flagged by the `ink` attribute)
// so each piece and its plum outline cost a single draw call.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const INK = new THREE.Color('#24193F');

export interface Part {
  geo: THREE.BufferGeometry;
  /** Fill colour; omit when the part already carries a `color` attribute. */
  color?: THREE.Color | string;
  /** Outline width (world units); 0 or omitted for none. */
  outline?: number;
  /** Coarser stand-in for building the outline (toon fills hide facets; only silhouettes need them). */
  hull?: THREE.BufferGeometry;
  /** Unlit ink (outline colour), for small details like toe lines. */
  ink?: boolean;
}

/** Keeps position + normal (+ color), gives the geometry an index and an `ink` flag. */
function prepare(src: THREE.BufferGeometry, color: THREE.Color | null, ink: number): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const pos = src.getAttribute('position') as THREE.BufferAttribute;
  if (!src.getAttribute('normal')) src.computeVertexNormals();
  g.setAttribute('position', pos.clone());
  g.setAttribute('normal', (src.getAttribute('normal') as THREE.BufferAttribute).clone());
  const n = pos.count;
  if (color) {
    const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) c.set([color.r, color.g, color.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  } else g.setAttribute('color', (src.getAttribute('color') as THREE.BufferAttribute).clone());
  g.setAttribute('ink', new THREE.BufferAttribute(new Float32Array(n).fill(ink), 1));
  g.setIndex(src.index ? src.index.clone() : Array.from({ length: n }, (_, i) => i));
  return g;
}

/** Normals averaged over every vertex sharing a position, so the hull does not crack at hard edges and seams. */
function smoothNormals(g: THREE.BufferGeometry): Float32Array {
  const pos = g.getAttribute('position'), nor = g.getAttribute('normal'), n = pos.count;
  const key = (i: number) => `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`;
  const sum = new Map<string, THREE.Vector3>(), out = new Float32Array(n * 3), v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const k = key(i), s = sum.get(k) ?? new THREE.Vector3();
    s.add(v.set(nor.getX(i), nor.getY(i), nor.getZ(i))); sum.set(k, s);
  }
  for (let i = 0; i < n; i++) { const s = sum.get(key(i))!.clone().normalize(); out.set([s.x, s.y, s.z], i * 3); }
  return out;
}

/** Inverted hull: the part inflated along smooth normals with flipped winding, drawn as unlit ink. */
function hull(src: THREE.BufferGeometry, width: number): THREE.BufferGeometry {
  const g = prepare(src, INK, 1), pos = g.getAttribute('position') as THREE.BufferAttribute, sn = smoothNormals(g);
  for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i) + sn[i * 3]! * width, pos.getY(i) + sn[i * 3 + 1]! * width, pos.getZ(i) + sn[i * 3 + 2]! * width);
  const idx = g.index!.array as ArrayLike<number>, flipped: number[] = [];
  for (let i = 0; i < idx.length; i += 3) flipped.push(idx[i]!, idx[i + 2]!, idx[i + 1]!);
  g.setIndex(flipped);
  return g;
}

/** Bakes parts (and their outlines) into one geometry for the shared toon material. */
export function bake(parts: Part[]): THREE.BufferGeometry {
  const list: THREE.BufferGeometry[] = [];
  for (const p of parts) {
    const col = p.ink ? INK : p.color != null ? new THREE.Color(p.color) : null;
    list.push(prepare(p.geo, col, p.ink ? 1 : 0));
    if (p.outline) list.push(hull(p.hull ?? p.geo, p.outline));
  }
  const g = mergeGeometries(list);
  if (!g) throw new Error('purrlet: could not merge parts');
  for (const l of list) l.dispose();
  g.computeBoundingSphere();
  return g;
}

// ---------------------------------------------------------------- shapes

export const ellipsoid = (rx: number, ry: number, rz: number, ws = 16, hs = 10): THREE.BufferGeometry =>
  new THREE.SphereGeometry(1, ws, hs).scale(rx, ry, rz);

export interface ProfilePoint { r: number; y: number; c: THREE.Color }

/** Lathe around Y with per-point colours. Repeat a point with a new colour for a crisp colour band
 *  (zero-length segments are skipped when computing normals). Profile runs bottom-up on the outside. */
export function lathe(profile: ProfilePoint[], segs = 40): THREE.BufferGeometry {
  const n = profile.length, pos: number[] = [], nor: number[] = [], col: number[] = [], idx: number[] = [];
  const tangent = (i: number): [number, number] => {
    let a = i - 1, b = i + 1;
    while (a >= 0 && same(profile[a]!, profile[i]!)) a--;
    while (b < n && same(profile[b]!, profile[i]!)) b++;
    const p = profile[Math.max(a, 0)]!, q = profile[Math.min(b, n - 1)]!;
    const dr = q.r - p.r, dy = q.y - p.y, l = Math.hypot(dr, dy) || 1;
    return [dr / l, dy / l];
  };
  for (let j = 0; j <= segs; j++) {
    const a = (j / segs) * Math.PI * 2, s = Math.sin(a), c = Math.cos(a);
    for (let i = 0; i < n; i++) {
      const p = profile[i]!, [tr, ty] = tangent(i);
      pos.push(p.r * s, p.y, p.r * c);
      nor.push(ty * s, -tr, ty * c); // outward normal of the profile, swept
      col.push(p.c.r, p.c.g, p.c.b);
    }
  }
  for (let j = 0; j < segs; j++) for (let i = 0; i < n - 1; i++) {
    const a = j * n + i, b = (j + 1) * n + i;
    if (same(profile[i]!, profile[i + 1]!)) continue;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}
const same = (a: ProfilePoint, b: ProfilePoint) => Math.abs(a.r - b.r) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;

/** Tapered tube along a curve with round caps. */
export function tube(curve: THREE.Curve<THREE.Vector3>, r0: number, r1: number, segs = 20, radial = 8): THREE.BufferGeometry {
  const frames = curve.computeFrenetFrames(segs, false), pos: number[] = [], nor: number[] = [], idx: number[] = [];
  const p = new THREE.Vector3(), nv = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    curve.getPointAt(i / segs, p);
    const r = THREE.MathUtils.lerp(r0, r1, i / segs), N = frames.normals[i]!, B = frames.binormals[i]!;
    for (let k = 0; k <= radial; k++) {
      const a = (k / radial) * Math.PI * 2;
      nv.copy(N).multiplyScalar(Math.cos(a)).addScaledVector(B, Math.sin(a)).normalize();
      pos.push(p.x + nv.x * r, p.y + nv.y * r, p.z + nv.z * r); nor.push(nv.x, nv.y, nv.z);
    }
  }
  for (let i = 0; i < segs; i++) for (let k = 0; k < radial; k++) {
    const a = i * (radial + 1) + k, b = a + radial + 1;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  const cap = (t: number, r: number) => new THREE.SphereGeometry(r, radial, Math.max(4, radial / 2)).translate(...curve.getPointAt(t).toArray());
  const merged = mergeGeometries([g, cap(0, r0), cap(1, r1)].map(x => { x.deleteAttribute('uv'); return x; }));
  return merged!;
}

/** Extruded rounded 2D shape (cookie-cutter look, like the 2D art), centred on z = 0. */
export function slab(shape: THREE.Shape, depth: number, bevel: number, curveSegs = 5): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, curveSegments: curveSegs, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.9, bevelSegments: 2,
  });
  g.translate(0, 0, -depth / 2);
  g.deleteAttribute('uv');
  return g;
}

/** Rounded polygon through the given corners (radius r at every corner). */
export function roundedPoly(pts: [number, number][], r: number): THREE.Shape {
  const s = new THREE.Shape(), n = pts.length;
  const at = (i: number) => new THREE.Vector2(...pts[(i + n) % n]!);
  for (let i = 0; i < n; i++) {
    const p = at(i), a = at(i - 1).sub(p), b = at(i + 1).sub(p);
    const ra = Math.min(r, a.length() / 2), rb = Math.min(r, b.length() / 2);
    const p0 = p.clone().add(a.normalize().multiplyScalar(ra)), p1 = p.clone().add(b.normalize().multiplyScalar(rb));
    if (i === 0) s.moveTo(p0.x, p0.y); else s.lineTo(p0.x, p0.y);
    s.quadraticCurveTo(p.x, p.y, p1.x, p1.y);
  }
  s.closePath();
  return s;
}

/** A flat star-shaped region (radius r(angle) around the origin) as a fine polar mesh: rings x segments,
 *  so it can be bent onto a curved surface without its triangles cutting under it. */
export function polarDisc(r: (a: number) => number, rings = 6, segs = 48): THREE.BufferGeometry {
  const pos: number[] = [0, 0, 0], idx: number[] = [];
  for (let i = 1; i <= rings; i++) for (let j = 0; j < segs; j++) {
    const a = (j / segs) * Math.PI * 2, rr = r(a) * i / rings;
    pos.push(Math.cos(a) * rr, Math.sin(a) * rr, 0);
  }
  const v = (i: number, j: number) => (i === 0 ? 0 : 1 + (i - 1) * segs + (j % segs));
  for (let j = 0; j < segs; j++) idx.push(0, v(1, j), v(1, j + 1));
  for (let i = 1; i < rings; i++) for (let j = 0; j < segs; j++) idx.push(v(i, j), v(i + 1, j), v(i + 1, j + 1), v(i, j), v(i + 1, j + 1), v(i, j + 1));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

/** A flat geometry (in its xy plane) wrapped onto an ellipsoid: laid in the tangent plane at `dir`,
 *  projected radially onto the surface and lifted. Used for the paint splash on the head. */
export function wrapOnEllipsoid(flat: THREE.BufferGeometry, radii: THREE.Vector3, dir: THREE.Vector3, lift: number, up = new THREE.Vector3(0, 1, 0)): THREE.BufferGeometry {
  const g = flat, pos = g.getAttribute('position') as THREE.BufferAttribute;
  const c = onEllipsoid(radii, dir), n = ellipsoidNormal(radii, c);
  const tx = new THREE.Vector3().crossVectors(up, n).normalize(), ty = new THREE.Vector3().crossVectors(n, tx);
  const nor: number[] = [], p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.copy(c).addScaledVector(tx, pos.getX(i)).addScaledVector(ty, pos.getY(i));
    const q = onEllipsoid(radii, p), nn = ellipsoidNormal(radii, q);
    q.addScaledVector(nn, lift);
    pos.setXYZ(i, q.x, q.y, q.z); nor.push(nn.x, nn.y, nn.z);
  }
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  if (g.getAttribute('uv')) g.deleteAttribute('uv');
  return g;
}

/** The point on an ellipsoid (centred at 0) in direction d. */
export function onEllipsoid(r: THREE.Vector3, d: THREE.Vector3): THREE.Vector3 {
  const k = 1 / Math.sqrt((d.x / r.x) ** 2 + (d.y / r.y) ** 2 + (d.z / r.z) ** 2);
  return d.clone().multiplyScalar(k);
}
export function ellipsoidNormal(r: THREE.Vector3, p: THREE.Vector3): THREE.Vector3 {
  return new THREE.Vector3(p.x / (r.x * r.x), p.y / (r.y * r.y), p.z / (r.z * r.z)).normalize();
}

/** A decal grid projected along +Z onto a surface given by depth(x, y) (null = beyond the silhouette).
 *  UVs span the rectangle [x0,x1] x [y0,y1] mapped to [u0,u1] x [v0,v1]. */
export function frontDecal(depth: (x: number, y: number) => number | null, x0: number, x1: number, y0: number, y1: number,
  nx: number, ny: number, lift: number, uv: [number, number, number, number] = [0, 0, 1, 1]): THREE.BufferGeometry {
  const pos: number[] = [], uvs: number[] = [], idx: number[] = [], [u0, v0, u1, v1] = uv;
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const x = x0 + (x1 - x0) * i / nx, y = y0 + (y1 - y0) * j / ny;
    pos.push(x, y, (depth(x, y) ?? 0) + lift);
    uvs.push(u0 + (u1 - u0) * i / nx, v0 + (v1 - v0) * j / ny);
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + nx + 1;
    idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  return g;
}
