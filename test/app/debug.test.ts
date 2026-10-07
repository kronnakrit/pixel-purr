// window.__pp: the dev hooks automated reviewers drive the real app with.
import { describe, expect, it } from 'vitest';
import { installDebug } from '../../src/app/debug';
import { Harness, make, quickWin, SODA } from './fakes';

describe('__pp', () => {
  it('reports state, jumps to a level, autoplays it at speed and adds coins', async () => {
    const h = new Harness({ rate: 36 });
    h.content.custom.set(7, () => make(Array.from({ length: 6 }, () => '6'.repeat(6)), [[[SODA, 18]], [[SODA, 18]]], 5, 7));
    h.meta.seen.add('mystery');
    const target: { __pp?: ReturnType<typeof installDebug> } = {};
    const pp = installDebug(h.app, target);
    expect(target.__pp).toBe(pp);
    await h.start();
    expect(pp.state()).toMatchObject({ screen: 'home', modal: null, session: null, profile: { level: 1, coins: 300 } });

    expect(pp.play(7)).toBe(true);
    await h.until(() => h.running);
    expect(pp.state().session).toMatchObject({ level: 7, status: 'playing', running: true, left: 36, queues: [1, 1] });

    expect(pp.speed(10)).toBe(10);
    const done = pp.autoplay();
    let result: string | null = null;
    void done.then(r => { result = r; });
    await h.until(() => result !== null, 20_000);
    expect(result).toBe('won');
    await h.until(() => h.ui.count('home') === 2);
    expect(pp.state().profile).toMatchObject({ level: 8, coins: 320 });

    expect(pp.addCoins(1000)).toBe(1320);
    expect(h.ui.hud.coins).toBe(1320);
  });

  it('tap() launches a queue the way a finger does, and refuses when nothing can go', async () => {
    const h = new Harness();
    h.content.custom.set(1, () => make(['66', '66'], [[[SODA, 2]], [[SODA, 2]]], 5, 1));
    h.meta.seen.add('basics');
    const pp = installDebug(h.app, {});
    await h.start();
    expect(pp.tap('queue', 0)).toBe(false); // nothing running yet
    await h.playFromHome();
    expect(pp.tap('queue', 0)).toBe(true);
    expect(pp.tap('queue', 1)).toBe(false); // the belt entry is not clear yet
    expect(pp.tap('tray', 0)).toBe(false);
    expect(pp.state().session).toMatchObject({ riders: 1, queues: [0, 1] });
  });

  it('autoplay asked before the level starts runs once it does', async () => {
    const h = new Harness();
    h.meta.level = 3;
    h.content.custom.set(3, () => quickWin(3));
    const pp = installDebug(h.app, {});
    await h.start();
    expect(await pp.autoplay()).toBe('queued');
    h.ui.answer('home', 'play');
    await h.until(() => h.ui.count('home') === 2);
    expect(h.meta.level).toBe(4);
  });

  it('play(n) refuses while a card is open, and win()/lose() need a running attempt', async () => {
    const h = new Harness();
    h.meta.level = 3;
    h.content.custom.set(3, () => quickWin(3));
    const pp = installDebug(h.app, {});
    await h.start();
    expect(pp.win()).toBe(false);
    await h.playFromHome();
    h.ui.hud.pauseCb();
    await h.until(() => h.ui.isOpen('pause'));
    expect(pp.play(5)).toBe(false);
    expect(pp.lose()).toBe(false);
    expect(pp.state().modal).toBe('pause');
  });

  it('resetProfile loads a fresh profile through the meta loader', async () => {
    let wiped = 0;
    const h = new Harness({ deps: { resetProfile: async () => { wiped++; } } });
    const pp = installDebug(h.app, {});
    await h.start();
    h.meta.coins = 5000;
    expect(await pp.resetProfile()).toBe(true);
    expect(wiped).toBe(1);
    expect(h.log.filter(e => e === 'meta.load')).toHaveLength(2);
    await h.until(() => h.ui.count('home') === 2);
  });
});
