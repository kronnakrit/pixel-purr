import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAnalytics } from '../../src/services/analytics';
import { createPlatform, type DocLike, type NativeShell } from '../../src/services/platform';

beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

function fakeShell() {
  const on = new Map<string, () => void>();
  let active: (a: boolean) => void = () => {};
  const shell = {
    listen: vi.fn((e: 'pause' | 'resume' | 'backButton', cb: () => void) => { on.set(e, cb); }),
    listenActive: vi.fn((cb: (a: boolean) => void) => { active = cb; }),
    exitApp: vi.fn(async () => {}),
    hideSplash: vi.fn(async () => {}),
    styleStatusBar: vi.fn(async () => {}),
  } satisfies NativeShell;
  return { shell, fire: (e: string) => on.get(e)?.(), active: (a: boolean) => active(a) };
}

describe('platform (native)', () => {
  it('reports the platform', () => {
    const p = createPlatform({ native: true, os: 'ios', shell: fakeShell().shell });
    expect([p.native, p.os]).toEqual([true, 'ios']);
  });

  it('ready() styles the status bar and hides the splash once', async () => {
    const f = fakeShell();
    const p = createPlatform({ native: true, os: 'android', shell: f.shell });
    await Promise.all([p.ready(), p.ready()]);
    expect(f.shell.styleStatusBar).toHaveBeenCalledTimes(1);
    expect(f.shell.hideSplash).toHaveBeenCalledTimes(1);
  });

  it('ready() never throws when a plugin fails', async () => {
    const f = fakeShell();
    f.shell.hideSplash.mockRejectedValueOnce(new Error('no splash'));
    f.shell.styleStatusBar.mockRejectedValueOnce(new Error('Android 16'));
    await expect(createPlatform({ native: true, os: 'android', shell: f.shell }).ready()).resolves.toBeUndefined();
  });

  it('hides the splash anyway if the app never becomes ready', async () => {
    vi.useFakeTimers();
    const f = fakeShell();
    createPlatform({ native: true, os: 'ios', shell: f.shell, splashFailsafeMs: 10_000 });
    await vi.advanceTimersByTimeAsync(9_999);
    expect(f.shell.hideSplash).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(f.shell.hideSplash).toHaveBeenCalledTimes(1);
  });

  it('merges pause, resume and app-state events into one change stream', () => {
    const f = fakeShell();
    const p = createPlatform({ native: true, os: 'ios', shell: f.shell });
    const seen: boolean[] = [];
    p.onPause(v => seen.push(v));
    f.active(false); // control centre pulled down
    f.fire('pause'); // then backgrounded: no duplicate
    f.fire('resume');
    f.active(true);
    expect(seen).toEqual([true, false]);
    expect(p.paused).toBe(false);
  });

  it('back button: newest handler first, the first true claims it, unclaimed exits the app', () => {
    const f = fakeShell();
    const p = createPlatform({ native: true, os: 'android', shell: f.shell });
    const order: string[] = [];
    p.onBack(() => { order.push('screen'); return false; });
    const offModal = p.onBack(() => { order.push('modal'); return true; });
    f.fire('backButton');
    expect(order).toEqual(['modal']);
    expect(f.shell.exitApp).not.toHaveBeenCalled();
    offModal();
    f.fire('backButton');
    expect(order).toEqual(['modal', 'screen']);
    expect(f.shell.exitApp).toHaveBeenCalledTimes(1);
  });

  it('a throwing back handler does not stop the chain', () => {
    const f = fakeShell();
    const p = createPlatform({ native: true, os: 'android', shell: f.shell });
    p.onBack(() => true);
    p.onBack(() => { throw new Error('oops'); });
    expect(p.back()).toBe(true);
  });

  it('iOS has no back button listener', () => {
    const f = fakeShell();
    createPlatform({ native: true, os: 'ios', shell: f.shell }).onBack(() => true);
    expect(f.shell.listen.mock.calls.map(c => c[0])).toEqual(['pause', 'resume']);
  });
});

describe('platform (web)', () => {
  function fakeDoc() {
    const on = new Map<string, (e: Event) => void>();
    const doc = { hidden: false, addEventListener: (t: string, cb: (e: Event) => void) => { on.set(t, cb); } };
    return { doc: doc as DocLike & { hidden: boolean }, fire: (t: string, e: Partial<KeyboardEvent> = {}) => on.get(t)?.(e as Event) };
  }

  it('pauses on visibilitychange and maps Escape to back', async () => {
    const d = fakeDoc();
    const p = createPlatform({ native: false, os: 'web', doc: d.doc });
    expect(p.native).toBe(false);
    await p.ready(); // no-op on the web
    const seen: boolean[] = [];
    p.onPause(v => seen.push(v));
    d.doc.hidden = true; d.fire('visibilitychange');
    d.doc.hidden = false; d.fire('visibilitychange');
    expect(seen).toEqual([true, false]);
    const back = vi.fn(() => true);
    p.onBack(back);
    d.fire('keydown', { key: 'Enter' });
    d.fire('keydown', { key: 'Escape' });
    expect(back).toHaveBeenCalledTimes(1);
  });
});

describe('analytics', () => {
  it('logs in dev and forwards to the sink', () => {
    const log = vi.fn(), sink = vi.fn();
    const a = createAnalytics({ dev: true, log });
    a.event('level_start', { level: 3, spicy: false });
    a.setSink(sink);
    a.screen('home');
    a.event('bad name!');
    expect(log).toHaveBeenCalledTimes(3);
    expect(log.mock.calls[2]?.join(' ')).toContain('invalid names');
    expect(sink.mock.calls).toEqual([[{ kind: 'screen', name: 'home' }], [{ kind: 'event', name: 'bad name!' }]]);
  });

  it('is silent in release builds until a sink is plugged in, and a failing sink is harmless', () => {
    const log = vi.fn();
    const a = createAnalytics({ dev: false, log });
    a.event('win', { level: 1 });
    expect(log).not.toHaveBeenCalled();
    a.setSink(() => { throw new Error('firebase down'); });
    expect(() => a.event('win', { level: 2 })).not.toThrow();
    const sink = vi.fn();
    a.setSink(sink);
    const params = { level: 3 };
    a.event('win', params);
    params.level = 99; // the sink got a copy
    expect(sink).toHaveBeenCalledWith({ kind: 'event', name: 'win', params: { level: 3 } });
    a.setSink(null);
    a.event('win');
    expect(sink).toHaveBeenCalledTimes(1);
  });
});
