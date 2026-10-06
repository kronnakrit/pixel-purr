// In-app purchases: RevenueCat on the phone (receipts, restore, both stores), a mock store on the web.
// This module only reports what happened; the app applies a product's contents with meta.applyPurchase, once.
import type { Product, ProductId, PurchasesApi } from '../app/contracts';
import { FALLBACK_PRODUCTS, ONE_TIME_PRODUCTS, PRODUCT_ORDER, REVENUECAT, STORE_PRODUCT_IDS, type NativeOs } from './config';
import { DEV, errText, localFlag, logger, setLocalFlag, sleep, withTimeout, type Os } from './env';

/** Why the last buy() did not complete, so the UI can say something kind. */
export type PurchaseFailure = 'cancelled' | 'busy' | 'alreadyOwned' | 'pending' | 'notConfigured' | 'unavailable' | 'store';

export interface Purchases extends PurchasesApi {
  readonly lastFailure: PurchaseFailure | null;
  /** 'revenuecat' on a configured phone, 'disabled' on a phone without a key, 'mock' on the web. */
  readonly mode: 'revenuecat' | 'disabled' | 'mock';
}

export interface StoreProductLike { identifier: string; priceString: string }
export interface CustomerInfoLike {
  allPurchasedProductIdentifiers: string[];
  nonSubscriptionTransactions?: { productIdentifier: string }[];
  entitlements: { active: Record<string, unknown> };
}

/** The RevenueCat calls this module makes, narrowed so tests can use a fake. Rejections carry RevenueCat's `code`. */
export interface PurchasesBridge {
  configure(apiKey: string): Promise<void>;
  getProducts(storeIds: string[]): Promise<StoreProductLike[]>;
  purchase(storeId: string): Promise<{ productIdentifier: string }>;
  restore(): Promise<CustomerInfoLike>;
  customerInfo(): Promise<CustomerInfoLike>;
}

export interface PurchasesDeps {
  native: boolean;
  os: Os;
  /** Defaults to the key for `os` in config.ts. */
  apiKey?: string;
  bridge?: () => Promise<PurchasesBridge>;
  /** Mock store switches: 'pp.mock.buy' = 'cancel' | 'fail'; 'pp.mock.owned' remembers mock one-time buys. */
  flag?: (key: string) => string | null;
  setFlag?: (key: string, value: string | null) => void;
  mockDelayMs?: number;
  track?: (name: string, params: Record<string, string | number | boolean>) => void;
}

const log = logger('purchases');
export const MOCK_BUY_KEY = 'pp.mock.buy', MOCK_OWNED_KEY = 'pp.mock.owned';

// ---------------------------------------------------------------- product id mapping

export const isOneTime = (id: ProductId) => ONE_TIME_PRODUCTS.includes(id);

export const storeIdFor = (os: NativeOs, id: ProductId): string => STORE_PRODUCT_IDS[os][id];

/** Maps a store product id back to the game's id. Play may append ":plan"; only the product part counts. */
export function productIdForStore(os: NativeOs, storeId: string): ProductId | null {
  const base = storeId.split(':')[0] ?? storeId;
  return PRODUCT_ORDER.find(id => STORE_PRODUCT_IDS[os][id] === base) ?? null;
}

/** The shop list in game order: the store's localized price where the store returned the product, else the fallback. */
export function mergeProducts(os: NativeOs, store: readonly StoreProductLike[]): Product[] {
  const byId = new Map<ProductId, StoreProductLike>();
  for (const p of store) { const id = productIdForStore(os, p.identifier); if (id) byId.set(id, p); }
  return FALLBACK_PRODUCTS.map(f => {
    const s = byId.get(f.id);
    return s?.priceString ? { ...f, price: s.priceString } : { ...f };
  });
}

/** One-time products the customer owns, from purchases and active entitlements, in game order. */
export function ownedFromCustomerInfo(os: NativeOs, info: CustomerInfoLike): ProductId[] {
  const owned = new Set<ProductId>();
  const storeIds = [...(info.allPurchasedProductIdentifiers ?? []), ...(info.nonSubscriptionTransactions ?? []).map(t => t.productIdentifier)];
  for (const s of storeIds) { const id = productIdForStore(os, s); if (id && isOneTime(id)) owned.add(id); }
  for (const ent of Object.keys(info.entitlements?.active ?? {})) { const id = REVENUECAT.entitlements[ent]; if (id) owned.add(id); }
  return PRODUCT_ORDER.filter(id => owned.has(id));
}

/** RevenueCat error codes (PURCHASES_ERROR_CODE) we treat specially. */
export function failureOf(e: unknown): PurchaseFailure {
  const o = (typeof e === 'object' && e) ? e as { code?: unknown; userCancelled?: unknown } : {};
  const code = String(o.code ?? '');
  if (code === '1' || o.userCancelled === true) return 'cancelled';
  if (code === '6') return 'alreadyOwned';
  if (code === '20') return 'pending';
  return 'store';
}

const fallbackList = (): Product[] => FALLBACK_PRODUCTS.map(p => ({ ...p }));

export function createPurchases(d: PurchasesDeps): Purchases {
  if (!d.native) return mockPurchases(d);
  const os: NativeOs = d.os === 'ios' ? 'ios' : 'android';
  const key = d.apiKey ?? REVENUECAT.apiKey[os];
  return key ? revenueCatPurchases(d, os, key) : disabledPurchases(os);
}

// ---------------------------------------------------------------- web mock

function mockPurchases(d: PurchasesDeps): Purchases {
  const flag = d.flag ?? localFlag, setFlag = d.setFlag ?? setLocalFlag, delay = d.mockDelayMs ?? 600;
  let busy = false, lastFailure: PurchaseFailure | null = null;
  const owned = (): ProductId[] => {
    try {
      const v: unknown = JSON.parse(flag(MOCK_OWNED_KEY) ?? '[]');
      return Array.isArray(v) ? PRODUCT_ORDER.filter(id => v.includes(id)) : [];
    } catch { return []; }
  };
  return {
    mode: 'mock',
    get lastFailure() { return lastFailure; },
    async init() { log.info('web: mock store'); },
    async products() { return fallbackList(); },
    async buy(id) {
      if (busy) { lastFailure = 'busy'; return 'cancelled'; }
      busy = true;
      try {
        await sleep(delay);
        const mode = flag(MOCK_BUY_KEY);
        if (mode === 'cancel') { lastFailure = 'cancelled'; return 'cancelled'; }
        if (mode === 'fail') { lastFailure = 'store'; return 'failed'; }
        if (isOneTime(id)) {
          const o = owned();
          if (o.includes(id)) { lastFailure = 'alreadyOwned'; return 'failed'; } // like the real stores
          setFlag(MOCK_OWNED_KEY, JSON.stringify([...o, id]));
        }
        lastFailure = null;
        d.track?.('purchase', { product: id, store: 'mock' });
        return 'purchased';
      } finally { busy = false; }
    },
    async restore() {
      await sleep(Math.min(delay, 400));
      return owned();
    },
  };
}

// ---------------------------------------------------------------- phone without a RevenueCat key

function disabledPurchases(os: NativeOs): Purchases {
  const why = `no RevenueCat API key for ${os} in src/services/config.ts (REVENUECAT.apiKey): purchases are off`;
  return {
    mode: 'disabled',
    lastFailure: 'notConfigured',
    async init() { log.warn(why); },
    async products() { return fallbackList(); },
    async buy(id) { log.warn(`buy ${id} failed:`, why); return 'failed'; },
    async restore() { log.warn('restore:', why); return []; },
  };
}

// ---------------------------------------------------------------- RevenueCat

function revenueCatPurchases(d: PurchasesDeps, os: NativeOs, apiKey: string): Purchases {
  let b: PurchasesBridge | null = null, initP: Promise<void> | null = null, cached: Product[] | null = null;
  let busy = false, lastFailure: PurchaseFailure | null = null;
  const storeIds = PRODUCT_ORDER.map(id => storeIdFor(os, id));

  const init = () => (initP ??= (async () => {
    try {
      const bridge = await (d.bridge ?? (() => loadRevenueCatBridge()))();
      await bridge.configure(apiKey);
      b = bridge;
      log.info('RevenueCat configured');
    } catch (e) { log.warn('RevenueCat configure failed', errText(e)); }
  })());

  return {
    mode: 'revenuecat',
    get lastFailure() { return lastFailure; },
    init,
    async products() {
      await init();
      if (cached) return cached.map(p => ({ ...p }));
      if (!b) return fallbackList();
      const store = await withTimeout(b.getProducts(storeIds), 8000, null);
      if (!store?.length) { log.warn('the store returned no products; showing fallback prices'); return fallbackList(); }
      const missing = PRODUCT_ORDER.filter(id => !store.some(p => productIdForStore(os, p.identifier) === id));
      if (missing.length) log.warn('not in the store yet:', missing.join(', '));
      cached = mergeProducts(os, store);
      return cached.map(p => ({ ...p }));
    },
    async buy(id) {
      if (busy) { lastFailure = 'busy'; return 'cancelled'; } // a second tap must not start a second payment
      busy = true;
      try {
        await init();
        if (!b) { lastFailure = 'unavailable'; return 'failed'; }
        if (isOneTime(id)) {
          // Already owned on this store account (e.g. after a reinstall): Restore brings it back without paying again
          // and without granting the bundle's coins twice.
          const info = await withTimeout(b.customerInfo(), 5000, null);
          if (info && ownedFromCustomerInfo(os, info).includes(id)) { lastFailure = 'alreadyOwned'; log.info(`${id} already owned: use Restore`); return 'failed'; }
        }
        const r = await b.purchase(storeIdFor(os, id));
        const got = productIdForStore(os, r.productIdentifier);
        if (got !== id) log.warn(`asked for ${id}, the store reported ${r.productIdentifier}`);
        lastFailure = null;
        d.track?.('purchase', { product: id, store: os });
        return 'purchased';
      } catch (e) {
        lastFailure = failureOf(e);
        if (lastFailure !== 'cancelled') log.warn(`buy ${id} failed (${lastFailure})`, errText(e));
        return lastFailure === 'cancelled' ? 'cancelled' : 'failed';
      } finally { busy = false; }
    },
    async restore() {
      await init();
      if (!b) return [];
      try {
        const owned = ownedFromCustomerInfo(os, await b.restore());
        log.info('restored', owned);
        return owned;
      } catch (e) { log.warn('restore failed', errText(e)); return []; }
    },
  };
}

/** Adapts @revenuecat/purchases-capacitor (v13) to PurchasesBridge. Loaded on demand so the web build never imports it. */
export async function loadRevenueCatBridge(): Promise<PurchasesBridge> {
  const { Purchases, PRODUCT_CATEGORY, LOG_LEVEL } = await import('@revenuecat/purchases-capacitor');
  type StoreProduct = Awaited<ReturnType<typeof Purchases.getProducts>>['products'][number];
  const cache = new Map<string, StoreProduct>();
  const fetch = async (ids: string[]) => {
    // NON_SUBSCRIPTION matters on Android, where getProducts defaults to subscriptions.
    const { products } = await Purchases.getProducts({ productIdentifiers: ids, type: PRODUCT_CATEGORY.NON_SUBSCRIPTION });
    for (const p of products) cache.set(p.identifier, p);
    return products;
  };
  return {
    async configure(apiKey) {
      if (DEV) await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG }).catch(() => {});
      await Purchases.configure({ apiKey });
    },
    getProducts: fetch,
    async purchase(storeId) {
      const product = cache.get(storeId) ?? (await fetch([storeId])).find(p => p.identifier === storeId);
      if (!product) throw new Error(`product "${storeId}" is not available in the store`);
      const r = await Purchases.purchaseStoreProduct({ product });
      return { productIdentifier: r.productIdentifier };
    },
    restore: async () => (await Purchases.restorePurchases()).customerInfo,
    customerInfo: async () => (await Purchases.getCustomerInfo()).customerInfo,
  };
}
