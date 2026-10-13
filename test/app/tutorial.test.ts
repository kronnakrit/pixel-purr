// Level 1-4 hints: when each appears, where it points and what makes it go away.
import { describe, expect, it } from 'vitest';
import { TUTORIAL_TEXT } from '../../src/app/tutorial';
import { CHERRY, Harness, make, RING, SODA } from './fakes';

async function boot(n: number, level?: () => ReturnType<typeof make>, o: { cleared?: boolean } = {}): Promise<Harness> {
  const h = new Harness();
  h.meta.level = o.cleared ? n + 1 : n;
  for (const k of ['basics', 'tray'] as const) h.meta.seen.add(k);
  if (n >= 4) { h.meta.unlocked = ['slot']; h.meta.boosters.slot = 1; }
  if (level) h.content.custom.set(n, level);
  await h.start();
  h.app.debugPlay(n);
  await h.until(() => h.running);
  return h;
}

describe('tutorial', () => {
  it('level 1 points at a queue front until the first launch', async () => {
    const h = await boot(1);
    const q = h.content.getLevel(1).solution!.plan![0]!;
    expect(q.kind).toBe('q');
    const target = { kind: 'queue', q: q.kind === 'q' ? q.qs[0] : -1 };
    expect(h.scene.highlighted).toEqual(target);
    expect(h.ui.tut).toEqual({ text: TUTORIAL_TEXT.tap, at: h.scene.screenPoint(target as never) });
    expect(h.session!.tutorial!.showing).toBe('queue');
    await h.run(2000); // it waits for the player
    expect(h.ui.tut).not.toBeNull();
    h.scene.tap(target as never);
    expect(h.ui.tut).toBeNull();
    expect(h.scene.highlighted).toBeNull();
    await h.until(() => h.game.riders.length === 0);
    expect(h.ui.tut).toBeNull(); // only once
  });

  it('level 2 points at the first napping Purrlet once one parks, until it is sent again', async () => {
    const h = await boot(2, () => make(RING, [[[CHERRY, 1]], [[SODA, 8]]], 5, 2));
    expect(h.ui.tut).toBeNull();
    await h.launch(0); // the cherry can't see its pixel yet: it parks
    expect(h.game.tray).toHaveLength(1);
    expect(h.ui.tut).toEqual({ text: TUTORIAL_TEXT.tray, at: { x: 60, y: 560 } });
    expect(h.scene.highlighted).toEqual({ kind: 'tray', i: 0 });
    await h.launch(1); // the hint stays while the soda ring is painted
    expect(h.session!.tutorial!.showing).toBe('tray');
    h.scene.tap({ kind: 'tray', i: 0 });
    expect(h.ui.tut).toBeNull();
    expect(h.scene.highlighted).toBeNull();
  });

  it('level 4 points at Extra Cushion the first time the tray holds 4, and hides once it is used', async () => {
    const cherries: [number, number][] = [[CHERRY, 1], [CHERRY, 1], [CHERRY, 1], [CHERRY, 1]];
    const h = await boot(4, () => make(RING, [cherries, [[SODA, 8]]], 5, 4));
    for (let i = 0; i < 3; i++) await h.launch(0);
    expect(h.game.tray).toHaveLength(3);
    expect(h.ui.tut).toBeNull();
    await h.launch(0);
    expect(h.ui.tut).toEqual({ text: TUTORIAL_TEXT.cushion, at: { x: 40, y: 780 } });
    expect(h.scene.highlighted).toBeNull();
    h.ui.hud.boosterCb('slot');
    expect(h.ui.tut).toBeNull();
    expect(h.game.trayCap).toBe(6);
  });

  it('level 4 hint also goes when the tray drops below 4', async () => {
    const cherries: [number, number][] = [[CHERRY, 1], [CHERRY, 1], [CHERRY, 1], [CHERRY, 1]];
    const h = await boot(4, () => make(RING, [cherries, [[SODA, 8]]], 5, 4));
    for (let i = 0; i < 4; i++) await h.launch(0);
    expect(h.session!.tutorial!.showing).toBe('cushion');
    h.scene.tap({ kind: 'tray', i: 0 });
    expect(h.ui.tut).toBeNull();
  });

  it('level 3 has no hints, and a level already cleared shows none', async () => {
    const h3 = await boot(3);
    expect(h3.session!.tutorial).toBeNull();
    const h1 = await boot(1, undefined, { cleared: true });
    expect(h1.session!.tutorial).toBeNull();
    expect(h1.ui.tutCalls).toBe(0);
  });

  it('hides when the attempt ends', async () => {
    const h = await boot(1);
    expect(h.ui.tut).not.toBeNull();
    h.ui.hud.pauseCb();
    await h.until(() => h.ui.isOpen('pause'));
    h.ui.answer('pause', 'home');
    await h.until(() => h.ui.count('home') === 2);
    expect(h.ui.tut).toBeNull();
    expect(h.scene.highlighted).toBeNull();
  });
});
