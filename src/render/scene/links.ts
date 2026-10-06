// Linked pairs: a pink ribbon with a bow between two neighbouring queue cats. The strip follows both cats every
// frame (they slide, shrink and dim independently), so its vertices are rewritten in place.
import { BufferAttribute, BufferGeometry, Group, Mesh, Vector3, type Material } from 'three';
import { FlatQuad } from './flat';
import type { Projector } from './project';

const SEG = 12;
const v = new Vector3();

export class LinkView {
  readonly group = new Group();
  private readonly strip: Mesh;
  private readonly pos = new Float32Array((SEG + 1) * 2 * 3);
  private readonly bow: FlatQuad;

  constructor(stripMat: Material, bowMat: Material) {
    const g = new BufferGeometry(), uv = new Float32Array((SEG + 1) * 4), idx: number[] = [];
    for (let i = 0; i <= SEG; i++) {
      uv.set([i / SEG * 2, 0, i / SEG * 2, 1], i * 4);
      if (i < SEG) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    g.setAttribute('position', new BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new BufferAttribute(uv, 2));
    g.setIndex(idx);
    this.strip = new Mesh(g, stripMat);
    this.strip.frustumCulled = false;
    this.strip.renderOrder = 7;
    this.bow = new FlatQuad(bowMat);
    this.bow.mesh.renderOrder = 8;
    this.group.add(this.strip, this.bow.mesh);
  }

  /** Ribbon from (ax, ay) to (bx, by) in CSS px, sagging upwards, at view-ray pushes da / db; w = ribbon width. */
  set(P: Projector, ax: number, ay: number, da: number, bx: number, by: number, db: number, w: number, bow: number): void {
    const mx = (ax + bx) / 2, my = (ay + by) / 2 - Math.abs(bx - ax) * 0.16;
    for (let i = 0; i <= SEG; i++) {
      const t = i / SEG, u = 1 - t;
      const x = u * u * ax + 2 * u * t * mx + t * t * bx, y = u * u * ay + 2 * u * t * my + t * t * by;
      const tx = 2 * u * (mx - ax) + 2 * t * (bx - mx), ty = 2 * u * (my - ay) + 2 * t * (by - my), l = Math.hypot(tx, ty) || 1;
      const nx = -ty / l * w / 2, ny = tx / l * w / 2, d = da + (db - da) * t;
      for (let s = 0; s < 2; s++) {
        P.toWorld(x + (s ? nx : -nx), y + (s ? ny : -ny), d, v);
        const o = (i * 2 + s) * 3;
        this.pos[o] = v.x; this.pos[o + 1] = v.y; this.pos[o + 2] = v.z;
      }
    }
    (this.strip.geometry.getAttribute('position') as BufferAttribute).needsUpdate = true;
    const cy = 0.25 * ay + 0.5 * my + 0.25 * by;
    this.bow.set(P, mx - bow / 2, cy - bow * 0.36, bow, bow * 0.72, (da + db) / 2 - 0.5, true);
  }

  dispose(): void { this.strip.geometry.dispose(); this.bow.dispose(); }
}
