// STUB placeholder look (pot + head) — replaced by the purrlet module. Keep the exported names and types.
import * as THREE from 'three';
import { paint } from '../../engine';

export type PurrletMood = 'idle' | 'ride' | 'nap' | 'worry' | 'dance' | 'cheer';

export interface PurrletInit {
  color: number;
  ammo: number;
  hidden?: boolean;
  reducedMotion?: boolean;
  /** Varies idle timing so cats in a row are out of step. */
  seed?: number;
}

/** A paint pot kitten. Size: about 1 world unit wide and 1.1 tall, origin at the bottom centre of the pot, facing +Z. */
export class PurrletView {
  readonly object = new THREE.Group();
  color: number;
  ammo: number;
  hidden: boolean;
  constructor(init: PurrletInit) {
    this.color = init.color; this.ammo = init.ammo; this.hidden = !!init.hidden;
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.4, 0.55, 16), new THREE.MeshToonMaterial({ color: this.hidden ? 0x777799 : paint(init.color).hex }));
    pot.position.y = 0.275;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 12), new THREE.MeshToonMaterial({ color: 0xfff4e6 }));
    head.position.y = 0.75;
    this.object.add(pot, head);
  }
  setAmmo(n: number): void { this.ammo = n; }
  /** Mystery: hidden shows a grey pot with "?"; revealing flips to the real colour (animated unless reduced motion). */
  setHidden(hidden: boolean, _animate = true): void { this.hidden = hidden; }
  setMood(_m: PurrletMood): void {}
  /** Tap-and-hop one-shot (0.45 s). */
  hop(): void {}
  /** Paint-a-pixel one-shot: squint and recoil (0.25 s). */
  shoot(): void {}
  /** Landing squash (arriving on a tray cushion). */
  land(): void {}
  /** Out of paint: jump, grow, vanish in a star burst. Resolves when gone (0.7 s). */
  async pop(): Promise<void> { this.object.visible = false; }
  setReducedMotion(_on: boolean): void {}
  update(_dt: number): void {}
  dispose(): void { this.object.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); } }); }
}

/** Load fonts / build shared textures before the first cat is shown. */
export async function warmupPurrlets(): Promise<void> {}
