// Dev harness for the services (dev/services.html): every AdsApi / PurchasesApi call as a button, the web mock
// switches (pp.mock.adsFail, pp.mock.buy) as toggles, and live views of remote config, pause state and analytics.
// window.__services exposes the live services for --eval in screenshots.
import '../fonts';
import type { ProductId, RewardedPlacement } from '../app/contracts';
import { localFlag, setLocalFlag } from './env';
import { ads, analytics, platform, purchases, remoteConfig } from './index';
import { MOCK_BUY_KEY, MOCK_OWNED_KEY } from './purchases';

const $ = (s: string) => document.querySelector<HTMLElement>(s)!;
const say = (t: string) => { $('#log').textContent = t; };
const events: string[] = [];
let owned: ProductId[] = [];

function button(label: string, on: () => unknown, cls = ''): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  b.className = cls;
  b.onclick = async () => { b.disabled = true; try { await on(); } finally { b.disabled = false; render(); } };
  return b;
}
const row = (...kids: HTMLElement[]) => { const r = document.createElement('div'); r.className = 'row'; r.append(...kids); return r; };

const PLACEMENTS: RewardedPlacement[] = ['continue', 'booster', 'doubleCoins', 'lives', 'shopCoins', 'dailyDouble'];

async function renderShop() {
  const list = await purchases.products();
  $('#shop').replaceChildren(...list.map(p => {
    const d = document.createElement('div');
    d.className = `item${owned.includes(p.id) ? ' owned' : ''}`;
    const t = document.createElement('div');
    t.innerHTML = `<b></b><i></i>`;
    t.querySelector('b')!.textContent = p.title;
    t.querySelector('i')!.textContent = p.description;
    d.append(t, button(p.price, async () => {
      say(`buying ${p.id}…`);
      const r = await purchases.buy(p.id);
      say(`buy ${p.id}: ${r}${purchases.lastFailure ? ` (${purchases.lastFailure})` : ''}`);
      if (r === 'purchased' && !owned.includes(p.id) && ['cosy_bundle', 'starter_bundle', 'remove_ads'].includes(p.id)) owned.push(p.id);
      void renderShop();
    }, 'go'));
    return d;
  }));
}

function render() {
  $('#os').textContent = `${platform.os}${platform.native ? ' · native' : ' · mocks'}`;
  const fail = localFlag('pp.mock.adsFail') === '1', buy = localFlag(MOCK_BUY_KEY) ?? 'ok';
  $('#adState').textContent = `rewarded ${ads.rewardedReady() ? 'ready' : 'not ready'} · interstitial ${ads.interstitialReady() ? 'ready' : 'not ready'}`;
  $('#storeState').textContent = `${purchases.mode} · next buy: ${buy}`;
  $('#rcState').textContent = remoteConfig.source;
  $('#rc').textContent = JSON.stringify({
    beltStepsPerSec: remoteConfig.get('beltStepsPerSec', 36),
    interstitialEnabled: remoteConfig.get('interstitialEnabled', true),
    economy: remoteConfig.get('economy', {}),
    overrides: remoteConfig.values(),
  }, null, 1);
  $('#platState').textContent = platform.paused ? 'paused' : 'running';
  $('#events').textContent = events.slice(-8).join('\n') || 'analytics events appear here';

  $('#ads').replaceChildren(
    row(...PLACEMENTS.map(p => button(p, async () => { say(`rewarded ${p}…`); say(`rewarded ${p}: ${await ads.showRewarded(p) ? 'reward earned' : 'no reward'}`); }, 'blue'))),
    row(
      button('Interstitial', async () => { say(`interstitial: ${await ads.showInterstitial() ? 'shown' : 'not shown'}`); }, 'pink'),
      button(`Ads fail: ${fail ? 'on' : 'off'}`, () => setLocalFlag('pp.mock.adsFail', fail ? null : '1'), fail ? 'on' : ''),
      ...(ads.privacyOptionsRequired ? [button('Privacy choices', () => ads.showPrivacyOptions())] : []),
    ),
  );
  $('#store').replaceChildren(row(
    ...(['ok', 'cancel', 'fail'] as const).map(m => button(`Next: ${m}`, () => setLocalFlag(MOCK_BUY_KEY, m === 'ok' ? null : m), buy === m ? 'on' : '')),
    button('Restore', async () => { owned = await purchases.restore(); say(`restored: ${owned.join(', ') || 'nothing'}`); void renderShop(); }, 'blue'),
    button('Forget mock buys', () => { setLocalFlag(MOCK_OWNED_KEY, null); owned = []; void renderShop(); }),
  ));
  $('#plat').replaceChildren(row(
    button('Back (Esc)', () => say(`back claimed: ${platform.back()}`)),
    button('ready()', async () => { await platform.ready(); say('ready: splash hidden, status bar styled (native only)'); }),
    button('Track event', () => analytics.event('dev_tap', { at: Date.now() % 1000, ok: true })),
  ));
}

analytics.setSink(e => { events.push(e.kind === 'event' ? `${e.name} ${JSON.stringify(e.params ?? {})}` : `screen ${e.name}`); render(); });
platform.onPause(p => { events.push(`app ${p ? 'paused' : 'resumed'}`); render(); });
platform.onBack(() => { say('back pressed: the lab claims it'); return true; });
Object.assign(window, { __services: { ads, purchases, remoteConfig, analytics, platform } });

render();
void (async () => {
  await remoteConfig.init();
  await Promise.all([ads.init(), purchases.init()]);
  analytics.screen('services_lab');
  await renderShop();
  render();
  say('ready');
})();
