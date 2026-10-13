// The player's saved state (MetaApi): coins, lives timer, boosters, progress, Sticker Book, daily gift, settings,
// purchases and ad bookkeeping. Time always comes in as `now` (ms since epoch) so the rules are testable and
// keep working while the app is closed: lives and gifts are computed from stored timestamps, never from timers.
import {
  BOOSTER_KEYS, type BoosterKey, type IntroKey, type LivesInfo, type MetaApi, type ProductId, type Reward, type Settings,
  type StoreTransaction,
} from '../app/contracts';
import { cleanReward, copyReward, mergeEconomy, PRODUCTS, unlockOrder, type EconomyOverrides } from './economy';
import { cleanSettings, DELIVERED_KEEP, localDay, PENDING_DAYS, PROFILE_KEY, repairProfile, type Profile } from './profile';
import { preferencesStorage, type MetaStorage } from './storage';

export { DEFAULT_ECONOMY, PRODUCTS, PRODUCT_IDS, mergeEconomy, type EconomyOverrides } from './economy';
export { DEFAULT_SETTINGS, PROFILE_KEY, localDay, type Profile } from './profile';
export { memoryStorage, preferencesStorage, type MetaStorage } from './storage';

/** Saves wait this long after the last change, so a burst of changes (a win: coins, sticker, level) is one write. */
export const SAVE_DELAY_MS = 300;

/** MetaApi plus a few extras the controller and dev pages may use. */
export interface Meta extends MetaApi {
  /** Can the player start a level now (a life left or unlimited lives)? */
  hasLife(now: number): boolean;
  /** Restores a one-time product's lasting part (Remove Ads) without granting its coins or boosters again. */
  restorePurchase(id: ProductId): Reward;
  /** Called after every change with a short reason, e.g. 'coins:win' or 'settings'. Returns an unsubscribe. */
  onChange(cb: (reason: string) => void): () => void;
  /** A copy of the profile as it would be saved (debugging, tests). */
  snapshot(): Profile;
  /** `now` defaults to the clock; it only matters for unlimited-lives rewards. */
  grant(r: Reward, reason: string, now?: number): void;
  applyPurchase(id: ProductId, txn?: string | null, now?: number): Reward;
}

/**
 * Load the saved profile (or a fresh one) and return the live meta state.
 * `economy` holds remote-config overrides merged over DEFAULT_ECONOMY; `storage` defaults to Capacitor Preferences.
 */
export async function loadMeta(now: number, economy?: EconomyOverrides, storage: MetaStorage = preferencesStorage()): Promise<Meta> {
  const e = mergeEconomy(economy);
  let stored: string | null = null, readOk = true;
  try { stored = await storage.get(PROFILE_KEY); } catch (err) { readOk = false; console.warn('meta: could not read the profile', err); }
  let raw: unknown = null;
  if (stored !== null) {
    try { raw = JSON.parse(stored); } catch {
      console.warn('meta: saved profile is not JSON, starting fresh');
      storage.set(`${PROFILE_KEY}.corrupt`, stored).catch(() => {}); // kept for support, never read by the game
    }
  }
  const p = repairProfile(raw, now, e);
  const regenMs = e.lifeRegenMin * 60_000;
  const listeners = new Set<(reason: string) => void>();

  // ---------------------------------------------------------------- saving

  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastSaved = stored;
  let writes: Promise<void> = Promise.resolve();
  /** Writes go one after another, so an older snapshot can never land after a newer one. */
  const flush = (): Promise<void> => {
    if (timer !== null) { clearTimeout(timer); timer = null; }
    const json = JSON.stringify(p);
    if (json === lastSaved) return writes;
    writes = writes
      .then(() => storage.set(PROFILE_KEY, json))
      .then(() => { lastSaved = json; }, err => { console.warn('meta: save failed', err); });
    return writes;
  };
  const schedule = () => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; void flush(); }, SAVE_DELAY_MS);
  };
  const changed = (reason: string) => {
    schedule();
    for (const cb of listeners) {
      try { cb(reason); } catch (err) { console.warn('meta: listener failed', err); }
    }
  };
  // A fresh or repaired profile is written back so the next launch reads clean data. After a failed read the real
  // profile may still be there, so only actual changes this session may overwrite it.
  if (readOk && JSON.stringify(p) !== stored) schedule();
  // The OS may kill a backgrounded app before the debounce fires.
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void flush(); });
  }

  // ---------------------------------------------------------------- lives

  /** Lives at `now`, the regen clock's new anchor, and ms to the next life (null when full). */
  const livesNow = (now: number) => {
    const max = e.maxLives;
    if (p.lives >= max) return { lives: max, at: p.livesAt, next: null };
    const from = Math.min(p.livesAt, now); // the phone's clock moved back: restart the wait instead of stalling
    const gained = Math.floor((now - from) / regenMs);
    const lives = Math.min(max, p.lives + gained);
    if (lives >= max) return { lives, at: now, next: null };
    const at = from + gained * regenMs;
    return { lives, at, next: at + regenMs - now };
  };
  const settleLives = (now: number) => { const l = livesNow(now); p.lives = l.lives; p.livesAt = l.at; };
  const unlimited = (now: number) => p.unlimitedUntil !== null && p.unlimitedUntil > now;
  const extendUnlimited = (minutes: number, now: number) => {
    p.unlimitedUntil = Math.max(now, p.unlimitedUntil ?? 0) + minutes * 60_000;
  };

  // ---------------------------------------------------------------- rewards

  /** Adds a reward's contents without notifying; callers report one change for the whole action. */
  const addReward = (r: Reward, now: number) => {
    if (r.coins) p.coins += r.coins;
    if (r.boosters) for (const k of BOOSTER_KEYS) p.boosters[k] += r.boosters[k] ?? 0;
    if (r.unlimitedLivesMin) extendUnlimited(r.unlimitedLivesMin, now);
    if (r.removeAds) p.removeAds = true;
  };

  const daily = (now: number) => {
    const today = localDay(now), last = p.daily.lastDay;
    // Claimed today, or the clock went back to before the last claim: nothing new until a later day.
    const claimed = last !== null && today <= last;
    const streak = claimed ? p.daily.streak : last === today - 1 ? p.daily.streak + 1 : 1;
    const day = Math.max(1, Math.min(streak, e.daily.length));
    return { available: !claimed, day, streak, today, reward: cleanReward(e.daily[day - 1]) };
  };

  const restoreOneTime = (id: ProductId): Reward => {
    const prod = PRODUCTS[id];
    if (!prod?.oneTime) return {};
    if (!p.owned.includes(id)) p.owned.push(id);
    const r: Reward = prod.reward.removeAds ? { removeAds: true } : {};
    addReward(r, 0);
    changed(`restore:${id}`);
    return r;
  };

  // ---------------------------------------------------------------- the api

  const meta: Meta = {
    get settings() { return { ...p.settings }; },
    updateSettings(patch: Partial<Settings>) {
      const s = cleanSettings({ ...p.settings, ...patch }, p.settings);
      if (JSON.stringify(s) === JSON.stringify(p.settings)) return;
      p.settings = s;
      changed('settings');
    },
    economy: e,

    get level() { return p.level; },
    get coins() { return p.coins; },
    addCoins(n: number, reason: string) {
      const k = Math.floor(n);
      if (!Number.isFinite(k) || k <= 0) return; // spending goes through spendCoins, which checks the balance
      p.coins += k;
      changed(`coins:${reason}`);
    },
    spendCoins(n: number, reason: string) {
      const k = Math.ceil(n);
      if (!Number.isFinite(k) || k < 0 || k > p.coins) return false;
      if (k === 0) return true;
      p.coins -= k;
      changed(`spend:${reason}`);
      return true;
    },

    lives(now: number): LivesInfo {
      const l = livesNow(now);
      return { lives: l.lives, max: e.maxLives, nextInMs: l.next, unlimitedUntil: unlimited(now) ? p.unlimitedUntil : null };
    },
    hasLife(now: number) { return unlimited(now) || livesNow(now).lives > 0; },
    beginAttempt(n: number) {
      if (p.attempt === n) return;
      p.attempt = n;
      changed('attempt');
    },
    endAttempt() {
      if (p.attempt === null) return;
      p.attempt = null;
      changed('attempt:end');
    },
    spendLife(now: number) {
      if (unlimited(now)) return;
      settleLives(now);
      if (p.lives <= 0) return;
      if (p.lives >= e.maxLives) p.livesAt = now; // the regen clock starts with the first missing life
      p.lives--;
      changed('life');
    },
    refillLives(now: number) {
      p.lives = e.maxLives;
      p.livesAt = now;
      changed('refill');
    },
    addLives(n: number, now: number) {
      const k = Math.floor(n);
      if (!(k > 0) || unlimited(now)) return;
      settleLives(now);
      if (p.lives >= e.maxLives) return;
      p.lives = Math.min(e.maxLives, p.lives + k);
      if (p.lives >= e.maxLives) p.livesAt = now;
      changed('lives:add');
    },
    grantUnlimitedLives(minutes: number, now: number) {
      if (!(minutes > 0) || !Number.isFinite(minutes)) return;
      extendUnlimited(minutes, now);
      changed('unlimited');
    },

    boosterCount: (k: BoosterKey) => p.boosters[k] ?? 0,
    isBoosterUnlocked: (k: BoosterKey) => p.unlocked.includes(k),
    useBooster(k: BoosterKey) {
      if (!(p.boosters[k] > 0)) return false;
      p.boosters[k]--;
      changed(`booster:${k}`);
      return true;
    },
    unlockBoostersUpTo(n: number) {
      const fresh = unlockOrder(e).filter(k => e.boosters[k].unlock <= n && !p.unlocked.includes(k));
      for (const k of fresh) { p.unlocked.push(k); p.boosters[k] += e.freeBoostersOnUnlock; }
      if (fresh.length) changed('unlock');
      return fresh;
    },

    completeLevel(n: number, spicy: boolean, _now: number) {
      if (!Number.isInteger(n) || n < 1) return { coins: 0, firstClear: false };
      const coins = spicy ? e.spicyWinCoins : e.winCoins;
      p.coins += coins;
      const firstClear = !p.stickers.includes(n);
      if (firstClear) { p.stickers.push(n); p.stickers.sort((a, b) => a - b); }
      p.level = Math.max(p.level, n + 1);
      changed('coins:win');
      return { coins, firstClear };
    },
    stickers: () => [...p.stickers],
    hasSeenIntro: (k: IntroKey) => p.intros.includes(k),
    markIntroSeen(k: IntroKey) {
      if (p.intros.includes(k)) return;
      p.intros.push(k);
      changed('intro');
    },

    dailyGift(now: number) {
      const g = daily(now);
      return { available: g.available, day: g.day, reward: g.reward };
    },
    claimDailyGift(now: number, doubled: boolean) {
      const g = daily(now);
      if (!g.available) return {};
      const r = g.reward;
      if (doubled) { // the video doubles everything in the gift
        if (r.coins) r.coins *= 2;
        if (r.boosters) for (const k of BOOSTER_KEYS) if (r.boosters[k]) r.boosters[k] *= 2;
        if (r.unlimitedLivesMin) r.unlimitedLivesMin *= 2;
      }
      p.daily = { lastDay: g.today, streak: g.streak };
      addReward(r, now);
      changed('coins:daily');
      return copyReward(r);
    },

    grant(r: Reward, reason: string, now: number = Date.now()) {
      const c = cleanReward(r);
      addReward(c, now);
      changed(`grant:${reason}`);
    },
    get removeAds() { return p.removeAds; },
    owns: (id: ProductId) => p.owned.includes(id),
    applyPurchase(id: ProductId, txn?: string | null, now: number = Date.now()) {
      const prod = PRODUCTS[id];
      if (!prod) return {}; // unknown id from a store callback
      if (txn) {
        if (p.delivered.includes(txn)) return {};
        p.delivered = [...p.delivered, txn].slice(-DELIVERED_KEEP);
      }
      p.pending = p.pending.filter(x => x.id !== id); // it went through after all
      // A one-time product delivered again (store retry, restore on the same device) never pays out twice.
      if (prod.oneTime && p.owned.includes(id)) return restoreOneTime(id);
      if (prod.oneTime) p.owned.push(id);
      const r = copyReward(prod.reward);
      addReward(r, now);
      changed(`coins:purchase:${id}`);
      return r;
    },
    restorePurchase: restoreOneTime,
    notePendingPurchase(id: ProductId, now: number) {
      if (!PRODUCTS[id] || p.pending.some(x => x.id === id)) return;
      p.pending.push({ id, at: now });
      changed('purchase:pending');
    },
    settlePurchases(list: readonly StoreTransaction[], now: number) {
      const out: { id: ProductId; reward: Reward }[] = [];
      const keep = now - PENDING_DAYS * 86_400_000;
      const before = p.pending.length;
      p.pending = p.pending.filter(x => x.at >= keep);
      for (const w of [...p.pending]) {
        // a transaction for that product, from about when the player tried (store clocks differ a little)
        const t = list.find(x => x.id === w.id && x.at >= w.at - 10 * 60_000 && !p.delivered.includes(x.txn));
        if (!t) continue;
        out.push({ id: w.id, reward: meta.applyPurchase(w.id, t.txn, now) });
      }
      if (!out.length && p.pending.length !== before) changed('purchase:expired');
      return out;
    },

    mayShowInterstitial({ level, afterLoss, now }) {
      if (p.removeAds || afterLoss || level < e.interstitial.fromLevel) return false;
      // A clock that moved back counts as "too soon": the fair choice is no ad.
      return p.ads.lastAt === null || now - p.ads.lastAt >= e.interstitial.minGapSec * 1000;
    },
    recordInterstitial(now: number) {
      p.ads.count++;
      p.ads.lastAt = now;
      changed('interstitial');
    },
    takeRemoveAdsOfferMoment() {
      if (p.ads.removeAdsOffered || p.removeAds || p.ads.count < e.removeAdsAfterInterstitials) return false;
      p.ads.removeAdsOffered = true;
      changed('offer:removeAds');
      return true;
    },
    takeStarterOfferMoment(levelJustWon: number) {
      if (p.starterOffered || p.owned.includes('starter_bundle') || !(levelJustWon >= e.starterBundleAfterLevel)) return false;
      p.starterOffered = true;
      changed('offer:starter');
      return true;
    },

    save: flush,
    onChange(cb) { listeners.add(cb); return () => { listeners.delete(cb); }; },
    snapshot: () => JSON.parse(JSON.stringify(p)) as Profile,
  };
  // The app was closed during an attempt: that counts as leaving the level, which costs a life.
  if (p.attempt !== null) {
    meta.spendLife(now);
    meta.endAttempt();
  }
  return meta;
}
