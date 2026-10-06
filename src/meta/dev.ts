// Dev harness for the saved profile (dev/meta.html): live state through the real Capacitor Preferences storage
// (localStorage on the web), every MetaApi action as a button, and a simulated clock to test lives regen, daily
// streaks and ad gaps without waiting. window.__meta exposes the live Meta, window.__clock the simulated now.
import '../fonts';
import { Preferences } from '@capacitor/preferences';
import { BOOSTER_KEYS, type Reward } from '../app/contracts';
import { loadMeta, PRODUCT_IDS, PROFILE_KEY, type Meta } from './index';

const OFFSET_KEY = 'pp.dev.clockOffset';
let offset = Number(localStorage.getItem(OFFSET_KEY)) || 0;
const now = () => Date.now() + offset;

const $ = (s: string) => document.querySelector<HTMLElement>(s)!;
const button = (label: string, cls: string, on: () => void, disabled = false) => {
  const b = document.createElement('button');
  b.textContent = label;
  b.className = cls;
  b.disabled = disabled;
  b.onclick = () => { on(); render(); };
  return b;
};
const mmss = (ms: number) => `${Math.floor(ms / 60_000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
const say = (text: string) => { $('#log').textContent = text; };
const rewardText = (r: Reward) => [
  r.coins ? `${r.coins} coins` : '',
  ...Object.entries(r.boosters ?? {}).map(([k, n]) => `${n} ${k}`),
  r.unlimitedLivesMin ? `${r.unlimitedLivesMin} min ∞ lives` : '',
  r.removeAds ? 'no ads' : '',
].filter(Boolean).join(', ') || 'nothing';

const meta: Meta = await loadMeta(now());
declare global { interface Window { __meta: Meta; __clock: () => number } }
window.__meta = meta;
window.__clock = now;
meta.onChange(() => setTimeout(showStored, 400)); // after the debounced write

async function showStored() {
  const { value } = await Preferences.get({ key: PROFILE_KEY });
  $('#json').textContent = value ? JSON.stringify(JSON.parse(value), null, 1) : '(nothing saved yet)';
  $('#saved').textContent = value ? `${value.length} bytes saved` : 'not saved';
}

function travel(ms: number) {
  offset += ms;
  localStorage.setItem(OFFSET_KEY, String(offset));
}

function render() {
  const t = now(), l = meta.lives(t), d = meta.dailyGift(t);
  $('#clock').textContent = new Date(t).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  const stat = (k: string, v: string) => `<div class="stat"><i>${k}</i><b>${v}</b></div>`;
  $('#stats').innerHTML = [
    stat('Level', String(meta.level)),
    stat('Coins', meta.coins.toLocaleString('en')),
    stat('Lives', l.unlimitedUntil ? `∞ ${mmss(l.unlimitedUntil - t)}` : `${l.lives}/${l.max}`),
    stat('Next life', l.nextInMs === null ? 'full' : mmss(l.nextInMs)),
    stat('Stickers', String(meta.stickers().length)),
    stat('No ads', meta.removeAds ? 'yes' : 'no'),
  ].join('');

  const lvl = meta.level, spicy = lvl % 5 === 0;
  $('#player').replaceChildren(
    button(`Win L${lvl}${spicy ? ' 🌶' : ''}`, 'go', () => {
      const r = meta.completeLevel(lvl, spicy, now());
      const unlocked = meta.unlockBoostersUpTo(meta.level);
      const starter = meta.takeStarterOfferMoment(lvl);
      say(`+${r.coins} coins${r.firstClear ? ', new sticker' : ''}${unlocked.length ? `, unlocked ${unlocked.join(', ')}` : ''}${starter ? ', STARTER OFFER' : ''}`);
    }),
    button('Spend life', '', () => meta.spendLife(now())),
    button(`Refill (${meta.economy.refillLivesCost})`, '', () => {
      if (meta.spendCoins(meta.economy.refillLivesCost, 'refill')) meta.refillLives(now()); else say('not enough coins');
    }),
    button('+30 min ∞', 'pink', () => meta.grantUnlimitedLives(30, now())),
    button('+100 coins', '', () => meta.addCoins(100, 'dev')),
  );

  $('#time').replaceChildren(
    button('+5 min', 'blue', () => travel(5 * 60_000)),
    button('+30 min', 'blue', () => travel(30 * 60_000)),
    button('+3 h', 'blue', () => travel(3 * 3_600_000)),
    button('+1 day', 'blue', () => travel(86_400_000)),
    button('+2 days', 'blue', () => travel(2 * 86_400_000)),
    button('Real time', 'off', () => travel(-offset)),
  );

  $('#boosters').replaceChildren(...BOOSTER_KEYS.map(k => {
    const b = meta.economy.boosters[k];
    const label = `${b.name} ${meta.boosterCount(k)}${meta.isBoosterUnlocked(k) ? '' : ` · L${b.unlock}`}`;
    return button(label, meta.isBoosterUnlocked(k) ? '' : 'off', () => { if (!meta.useBooster(k)) say(`no ${b.name} left`); });
  }));

  $('#dailyNote').textContent = `day ${d.day} · ${rewardText(d.reward)} · ${d.available ? 'ready' : 'claimed today'}`;
  $('#daily').replaceChildren(
    button('Claim', 'go', () => say(`daily: ${rewardText(meta.claimDailyGift(now(), false))}`), !d.available),
    button('Claim ×2 (video)', 'pink', () => say(`daily: ${rewardText(meta.claimDailyGift(now(), true))}`), !d.available),
  );

  const ads = meta.snapshot().ads;
  const may = meta.mayShowInterstitial({ level: meta.level, afterLoss: false, now: t });
  $('#adsNote').textContent = `${ads.count} interstitials · ${may ? 'may show now' : 'not now'}`;
  $('#shop').replaceChildren(
    ...PRODUCT_IDS.map(id => button(id.replace('coins_', '').replace('_', ' '), meta.owns(id) ? 'off' : '', () => {
      say(`${id}: ${rewardText(meta.applyPurchase(id, now()))}`);
    })),
    button('Show interstitial', 'blue', () => {
      if (!meta.mayShowInterstitial({ level: meta.level, afterLoss: false, now: now() })) { say('policy says no'); return; }
      meta.recordInterstitial(now());
      say(meta.takeRemoveAdsOfferMoment() ? 'interstitial, then REMOVE ADS OFFER' : 'interstitial shown');
    }),
  );

  const s = meta.settings;
  $('#settings').replaceChildren(
    ...(['sound', 'music', 'vibration'] as const).map(k => button(k, s[k] ? 'go' : 'off', () => meta.updateSettings({ [k]: !s[k] }))),
    button(`motion: ${s.reduceMotion}`, 'blue', () => {
      const next = { system: 'on', on: 'off', off: 'system' } as const;
      meta.updateSettings({ reduceMotion: next[s.reduceMotion] });
    }),
    button('Reset profile', 'pink', () => {
      // Flush first so no pending debounced write can bring the old profile back after the removal.
      void meta.save().then(() => Preferences.remove({ key: PROFILE_KEY })).then(() => { localStorage.removeItem(OFFSET_KEY); location.reload(); });
    }),
  );
}

render();
void showStored();
setInterval(render, 1000);
