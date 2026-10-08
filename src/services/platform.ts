// Platform glue: where we run, the native splash and status bar, app pause/resume and the Android back button.
import { App } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import type { PlatformApi } from '../app/contracts';
import { errText, logger, type Os } from './env';

/** The native calls the platform needs; swapped for a fake in tests. */
export interface NativeShell {
  listen(event: 'pause' | 'resume' | 'backButton', cb: () => void): void;
  listenActive(cb: (active: boolean) => void): void;
  exitApp(): Promise<void>;
  hideSplash(): Promise<void>;
  styleStatusBar(): Promise<void>;
}

/** The bits of `document` the web fallback uses. */
export interface DocLike {
  readonly hidden: boolean;
  addEventListener(type: 'visibilitychange' | 'keydown', cb: (e: Event) => void): void;
}

export interface Platform extends PlatformApi {
  /** Returns an unsubscribe. */
  onPause(cb: (paused: boolean) => void): () => void;
  /** Handlers run newest first; the first to return true claims the press. Returns an unsubscribe. */
  onBack(cb: () => boolean): () => void;
  readonly paused: boolean;
  /** Runs the back handlers as if back was pressed (Escape on the web does the same). True when one claimed it. */
  back(): boolean;
}

const log = logger('platform');

export const capacitorShell = (): NativeShell => ({
  listen: (event, cb) => {
    const p = event === 'pause' ? App.addListener('pause', cb) : event === 'resume' ? App.addListener('resume', cb) : App.addListener('backButton', () => cb());
    p.catch(e => log.warn(`no ${event} events`, errText(e)));
  },
  listenActive: cb => { App.addListener('appStateChange', s => cb(s.isActive)).catch(e => log.warn('no appStateChange events', errText(e))); },
  exitApp: () => App.exitApp(),
  hideSplash: () => SplashScreen.hide({ fadeOutDuration: 250 }),
  async styleStatusBar() {
    // Light text over the dark purple stage, drawn over the web view (the UI pads itself with the safe-area insets).
    // Android 15+ is always edge-to-edge and rejects setOverlaysWebView; that is fine.
    await StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
    await StatusBar.setStyle({ style: Style.Dark });
  },
});

export function createPlatform(o: {
  native: boolean;
  os: Os;
  shell?: NativeShell;
  doc?: DocLike | null;
  /** Hide the splash anyway after this long if ready() never comes (a boot error must not trap the player). */
  splashFailsafeMs?: number;
}): Platform {
  const shell = o.native ? (o.shell ?? capacitorShell()) : null;
  const doc = o.doc === undefined ? (typeof document === 'undefined' ? null : document) : o.doc;
  const pauseCbs = new Set<(paused: boolean) => void>();
  const backCbs: (() => boolean)[] = [];
  let paused = false, started = false, readyP: Promise<void> | null = null;

  const setPaused = (p: boolean) => {
    if (p === paused) return; // several sources report the same change
    paused = p;
    for (const cb of [...pauseCbs]) { try { cb(p); } catch (e) { log.warn('pause handler failed', e); } }
  };

  const runBack = () => {
    for (let i = backCbs.length - 1; i >= 0; i--) {
      try { if (backCbs[i]?.()) return true; } catch (e) { log.warn('back handler failed', e); }
    }
    return false;
  };

  function start() {
    if (started) return;
    started = true;
    if (shell) {
      shell.listen('pause', () => setPaused(true));
      shell.listen('resume', () => setPaused(false));
      shell.listenActive(active => setPaused(!active)); // iOS: also control centre, calls; Android: onStop/onResume
      if (o.os === 'android') {
        // Listening replaces Capacitor's default (web history back, then exit), so exit ourselves when nobody claims it.
        shell.listen('backButton', () => { if (!runBack()) shell.exitApp().catch(e => log.warn('exitApp failed', errText(e))); });
      }
    } else if (doc) {
      doc.addEventListener('visibilitychange', () => setPaused(doc.hidden));
      doc.addEventListener('keydown', e => { if ((e as KeyboardEvent).key === 'Escape') runBack(); });
    }
  }

  if (shell && o.splashFailsafeMs) {
    setTimeout(() => { if (!readyP) { log.warn('ready() not called in time, hiding the splash'); shell.hideSplash().catch(() => {}); } }, o.splashFailsafeMs);
  }

  return {
    native: o.native,
    os: o.os,
    get paused() { return paused; },
    ready() {
      return (readyP ??= (async () => {
        start();
        if (!shell) return;
        await shell.styleStatusBar().catch(e => log.warn('status bar', errText(e)));
        await shell.hideSplash().catch(e => log.warn('splash', errText(e)));
      })());
    },
    onPause(cb) {
      start();
      pauseCbs.add(cb);
      return () => { pauseCbs.delete(cb); };
    },
    onBack(cb) {
      start();
      backCbs.push(cb);
      return () => { const i = backCbs.lastIndexOf(cb); if (i >= 0) backCbs.splice(i, 1); };
    },
    back: runBack,
    openUrl(url) {
      // On a phone, Capacitor opens any page outside the app in the system browser and keeps the game where it was.
      if (o.native) window.location.href = url;
      else window.open(url, '_blank', 'noopener');
    },
  };
}
