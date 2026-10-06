// Boots Pixel Purr: the real modules wired into the game controller (src/app/controller.ts).
import './fonts';
import './style.css';
import { Preferences } from '@capacitor/preferences';
import { App } from './app/controller';
import { audio } from './audio';
import { content } from './content';
import { fontsReady } from './fonts';
import { loadMeta, PRODUCTS, PROFILE_KEY, type EconomyOverrides } from './meta';
import { createGameScene } from './render';
import { ads, analytics, platform, purchases, remoteConfig } from './services';
import { createUi } from './ui';

const canvas = document.querySelector<HTMLCanvasElement>('#stage');
const root = document.querySelector<HTMLElement>('#ui');
if (!canvas || !root) throw new Error('index.html needs canvas#stage and div#ui');

const ui = createUi();
ui.mount(root);

const app = new App({
  content,
  meta: economy => loadMeta(Date.now(), economy as EconomyOverrides | undefined),
  ads, purchases, remoteConfig, analytics, platform, audio, ui,
  createScene: o => createGameScene(canvas, o),
  now: () => Date.now(),
  raf: cb => requestAnimationFrame(cb),
  products: PRODUCTS,
  fontsReady,
  resetProfile: () => Preferences.remove({ key: PROFILE_KEY }),
});

if (import.meta.env.DEV) void import('./app/debug').then(d => d.installDebug(app));

// start() boots, shows home, and calls platform.ready() (hides the native splash) after the first frame.
app.start().catch(err => {
  // A boot failure must never leave the player stuck on the splash.
  console.error('Pixel Purr failed to start', err);
  ui.loading(false);
  void platform.ready();
});
