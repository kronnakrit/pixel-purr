// A textured quad drawn exactly over a CSS rect: lying on the ground (belt, tray, rings) or facing the camera (glows).
import { BufferAttribute, BufferGeometry, Mesh, Vector3, type Material } from 'three';
import type { Rect } from './layout';
import type { Projector } from './project';

const v = new Vector3();

export class FlatQuad {
  readonly mesh: Mesh;
  private readonly pos = new Float32Array(12);

  constructor(material: Material) {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(this.pos, 3));
    geo.setAttribute('uv', new BufferAttribute(new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]), 2));
    geo.setIndex([0, 2, 1, 2, 3, 1]);
    this.mesh = new Mesh(geo, material);
    this.mesh.frustumCulled = false;
  }

  /** Lie on the ground plane over rect, `depth` along the view ray (negative = towards the camera). */
  place(P: Projector, r: Rect, depth = 0): this { return this.set(P, r.x, r.y, r.w, r.h, depth, false); }

  /** A camera-facing card over the rect whose corners all sit at view depth `abs`. */
  face(P: Projector, x: number, y: number, w: number, h: number, abs: number): this {
    return this.set(P, x, y, w, h, abs - P.viewDepth(y + h), true);
  }

  /** Corners TL, TR, BL, BR. With `facing`, every corner shares the view depth of the bottom edge plus depth. */
  set(P: Projector, x: number, y: number, w: number, h: number, depth: number, facing: boolean): this {
    const base = P.viewDepth(y + h);
    for (let i = 0; i < 4; i++) {
      const cx = i & 1 ? x + w : x, cy = i & 2 ? y + h : y;
      P.toWorld(cx, cy, facing ? depth + base - P.viewDepth(cy) : depth, v);
      this.pos[i * 3] = v.x; this.pos[i * 3 + 1] = v.y; this.pos[i * 3 + 2] = v.z;
    }
    (this.mesh.geometry.getAttribute('position') as BufferAttribute).needsUpdate = true;
    return this;
  }

  dispose(): void { this.mesh.geometry.dispose(); }
}
