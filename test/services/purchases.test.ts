import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProductId } from '../../src/app/contracts';
import { FALLBACK_PRODUCTS, ONE_TIME_PRODUCTS, PRODUCT_ORDER, STORE_PRODUCT_IDS } from '../../src/services/config';
import {
  createPurchases, failureOf, mergeProducts, MOCK_BUY_KEY, MOCK_OWNED_KEY, ownedFromCustomerInfo, productIdForStore, storeIdFor,
  type CustomerInfoLike, type PurchasesBridge, type StoreProductLike,
} from '../../src/services/purchases';

const info = (o: Partial<CustomerInfoLike> = {}): CustomerInfoLike => ({ allPurchasedProductIdentifiers: [], entitlements: { active: {} }, ...o });

beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}); vi.spyOn(console, 'info').mockImplementation(() => {}); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('product mapping', () => {
  it('covers all 7 products on both stores and maps back', () => {
    expect(PRODUCT_ORDER).toEqual(['coins_pouch', 'coins_basket', 'coins_jar', 'coins_treasure', 'cosy_bundle', 'starter_bundle', 'remove_ads']);
    for (const os of ['ios', 'android'] as const) {
      for (const id of PRODUCT_ORDER) expect(productIdForStore(os, storeIdFor(os, id))).toBe(id);
      expect(new Set(Object.values(STORE_PRODUCT_IDS[os])).size).toBe(7);
    }
    expect(FALLBACK_PRODUCTS.map(p => p.id)).toEqual(PRODUCT_ORDER);
    expect(ONE_TIME_PRODUCTS).toEqual(['cosy_bundle', 'remove_ads']); // the Starter Bundle is a consumable
  });

  it('ignores a Play ":plan" suffix and unknown products', () => {
    expect(productIdForStore('android', 'remove_ads:default')).toBe('remove_ads');
    expect(productIdForStore('ios', 'something_else')).toBeNull();
  });

  it('merges localized store prices in game order; a product the store did not return is not for sale', () => {
    const store: StoreProductLike[] = [
      { identifier: 'remove_ads', priceString: '149,00 ฿' },
      { identifier: 'coins_pouch', priceString: '35,00 ฿' },
      { identifier: 'not_ours', priceString: '1' },
    ];
    const list = mergeProducts('ios', store);
    expect(list.map(p => p.id)).toEqual(PRODUCT_ORDER);
    expect(list.find(p => p.id === 'coins_pouch')?.price).toBe('35,00 ฿');
    expect(list.find(p => p.id === 'remove_ads')?.price).toBe('149,00 ฿');
    expect(list.find(p => p.id === 'coins_jar')?.price).toBe(''); // missing in the store: never a made-up $ price
    expect(list.find(p => p.id === 'cosy_bundle')?.title).toBe('Cosy Bundle');
  });

  it('reads owned one-time products from purchases and entitlements', () => {
    expect(ownedFromCustomerInfo('ios', info({ allPurchasedProductIdentifiers: ['coins_pouch', 'cosy_bundle', 'mystery'] }))).toEqual(['cosy_bundle']);
    expect(ownedFromCustomerInfo('android', info({ nonSubscriptionTransactions: [{ productIdentifier: 'remove_ads' }, { productIdentifier: 'coins_jar' }, { productIdentifier: 'starter_bundle' }] })))
      .toEqual(['remove_ads']);
    expect(ownedFromCustomerInfo('ios', info({ allPurchasedProductIdentifiers: ['remove_ads'], entitlements: { active: { remove_ads: {}, unknown: {} } } })))
      .toEqual(['remove_ads']);
  });

  it('classifies RevenueCat errors', () => {
    expect(failureOf({ code: '1' })).toBe('cancelled');
    expect(failureOf({ code: '2', userCancelled: true })).toBe('cancelled');
    expect(failureOf({ code: '6' })).toBe('alreadyOwned');
    expect(failureOf({ code: '20' })).toBe('pending');
    expect(failureOf(new Error('boom'))).toBe('store');
  });
});

describe('web mock store', () => {
  const flags = () => {
    const m = new Map<string, string>();
    return { m, flag: (k: string) => m.get(k) ?? null, setFlag: (k: string, v: string | null) => { if (v === null) m.delete(k); else m.set(k, v); } };
  };

  it('lists the fallback products and buys after 600 ms', async () => {
    vi.useFakeTimers();
    const f = flags(), track = vi.fn();
    const p = createPurchases({ native: false, os: 'web', ...f, track });
    expect(p.mode).toBe('mock');
    await p.init();
    expect((await p.products()).map(x => x.price)).toEqual(['$0.99', '$4.99', '$9.99', '$19.99', '$6.99', '$1.99', '$3.99']);
    let result: string | null = null;
    void p.buy('coins_pouch').then(r => { result = r; });
    await vi.advanceTimersByTimeAsync(599);
    expect(result).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(result).toBe('purchased');
    expect(track).toHaveBeenCalledWith('purchase', { product: 'coins_pouch', store: 'mock' });
  });

  it('follows pp.mock.buy = cancel / fail', async () => {
    const f = flags();
    const p = createPurchases({ native: false, os: 'web', ...f, mockDelayMs: 0 });
    f.m.set(MOCK_BUY_KEY, 'cancel');
    expect(await p.buy('coins_jar')).toBe('cancelled');
    expect(p.lastFailure).toBe('cancelled');
    f.m.set(MOCK_BUY_KEY, 'fail');
    expect(await p.buy('coins_jar')).toBe('failed');
    expect(p.lastFailure).toBe('store');
  });

  it('refuses a second tap while a purchase is running', async () => {
    const p = createPurchases({ native: false, os: 'web', ...flags(), mockDelayMs: 5 });
    const [a, b] = await Promise.all([p.buy('coins_basket'), p.buy('coins_basket')]);
    expect([a, b]).toEqual(['purchased', 'cancelled']);
  });

  it('remembers one-time buys for restore and refuses to sell them twice', async () => {
    const f = flags();
    const p = createPurchases({ native: false, os: 'web', ...f, mockDelayMs: 0 });
    expect(await p.restore()).toEqual([]);
    expect(await p.buy('remove_ads')).toBe('purchased');
    expect(await p.buy('coins_pouch')).toBe('purchased'); // consumables are not remembered
    expect(await p.buy('remove_ads')).toBe('failed');
    expect(p.lastFailure).toBe('alreadyOwned');
    expect(await p.restore()).toEqual(['remove_ads']);
    f.m.set(MOCK_OWNED_KEY, '{broken');
    expect(await p.restore()).toEqual([]);
  });
});

describe('phone without a RevenueCat key', () => {
  it('sells nothing and fails purchases and restore politely', async () => {
    const p = createPurchases({ native: true, os: 'ios', apiKey: '' });
    expect(p.mode).toBe('disabled');
    await p.init();
    expect(await p.products()).toEqual(FALLBACK_PRODUCTS.map(x => ({ ...x, price: '' })));
    expect(await p.buy('remove_ads')).toBe('failed');
    expect(p.lastFailure).toBe('notConfigured');
    await expect(p.restore()).rejects.toThrow();
    expect(console.warn).toHaveBeenCalled();
  });
});

describe('RevenueCat', () => {
  function fakeBridge(o: { owned?: string[]; purchaseError?: unknown; products?: StoreProductLike[]; configureError?: unknown } = {}) {
    const purchased: string[] = [];
    const bridge = {
      configure: vi.fn(async (_key: string) => { if (o.configureError) throw o.configureError; }),
      getProducts: vi.fn(async (ids: string[]) => (o.products ?? ids.map(id => ({ identifier: id, priceString: `€${id.length}` })))),
      purchase: vi.fn(async (storeId: string) => {
        if (o.purchaseError) throw o.purchaseError;
        purchased.push(storeId);
        return { productIdentifier: storeId };
      }),
      restore: vi.fn(async () => info({ allPurchasedProductIdentifiers: [...(o.owned ?? []), ...purchased] })),
      customerInfo: vi.fn(async () => info({ allPurchasedProductIdentifiers: [...(o.owned ?? []), ...purchased] })),
      onCustomerInfo: vi.fn((_cb: (i: CustomerInfoLike) => void) => {}),
    } satisfies PurchasesBridge;
    return bridge;
  }
  const make = (b: PurchasesBridge, os: 'ios' | 'android' = 'android') =>
    createPurchases({ native: true, os, apiKey: os === 'ios' ? 'appl_test' : 'goog_test', bridge: async () => b });

  it('configures once with the key and lists localized prices', async () => {
    const b = fakeBridge();
    const p = make(b);
    expect(p.mode).toBe('revenuecat');
    await Promise.all([p.init(), p.init()]);
    expect(b.configure).toHaveBeenCalledTimes(1);
    expect(b.configure).toHaveBeenCalledWith('goog_test');
    const list = await p.products();
    expect(list.find(x => x.id === 'coins_treasure')?.price).toBe('€14');
    expect(b.getProducts).toHaveBeenCalledWith([...PRODUCT_ORDER]);
    await p.products();
    expect(b.getProducts).toHaveBeenCalledTimes(1); // cached for the session
  });

  it('sells nothing when the store returns nothing, and asks again next time', async () => {
    const b = fakeBridge({ products: [] });
    const p = make(b);
    expect((await p.products()).map(x => x.price)).toEqual(FALLBACK_PRODUCTS.map(() => ''));
    b.getProducts.mockImplementation(async (ids: string[]) => ids.map(id => ({ identifier: id, priceString: '฿35' })));
    expect((await p.products()).every(x => x.price === '฿35')).toBe(true);
  });

  it('reports store transactions at start-up, on store updates and on resume, with the last purchase id', async () => {
    const b = fakeBridge();
    const txns = [{ productIdentifier: 'coins_basket', transactionIdentifier: 'T1', purchaseDateMillis: 1000 }, { productIdentifier: 'nope', transactionIdentifier: 'T2', purchaseDateMillis: 1 }];
    b.customerInfo.mockImplementation(async () => info({ nonSubscriptionTransactions: txns }));
    b.purchase.mockImplementation(async (storeId: string) => ({ productIdentifier: storeId, transactionId: 'T9' }));
    let resume = () => {};
    const p = createPurchases({ native: true, os: 'android', apiKey: 'goog_test', bridge: async () => b, onResume: cb => { resume = cb; } });
    const seen: unknown[] = [];
    p.onTransactions(l => seen.push(l));
    await p.init();
    await vi.waitFor(() => expect(seen).toHaveLength(1));
    expect(seen[0]).toEqual([{ id: 'coins_basket', txn: 'T1', at: 1000 }]);
    b.onCustomerInfo.mock.calls[0]![0](info({ nonSubscriptionTransactions: [] }));
    expect(seen).toHaveLength(2);
    resume();
    await vi.waitFor(() => expect(seen).toHaveLength(3));
    expect(await p.buy('coins_pouch')).toBe('purchased');
    expect(p.lastTransaction).toBe('T9');
  });

  it('buys, maps cancel and failure codes', async () => {
    const ok = fakeBridge();
    expect(await make(ok).buy('coins_jar')).toBe('purchased');
    expect(ok.purchase).toHaveBeenCalledWith('coins_jar');

    const cancel = make(fakeBridge({ purchaseError: Object.assign(new Error('cancelled'), { code: '1', userCancelled: true }) }));
    expect(await cancel.buy('coins_jar')).toBe('cancelled');

    const pending = make(fakeBridge({ purchaseError: { code: '20', message: 'pending' } }));
    expect(await pending.buy('coins_jar')).toBe('failed');
    expect(pending.lastFailure).toBe('pending');
  });

  it('never sells a one-time product the account already owns (restore instead)', async () => {
    const b = fakeBridge({ owned: ['cosy_bundle'] });
    const p = make(b, 'ios');
    expect(await p.buy('cosy_bundle')).toBe('failed');
    expect(p.lastFailure).toBe('alreadyOwned');
    expect(b.purchase).not.toHaveBeenCalled();
    expect(await p.buy('coins_pouch')).toBe('purchased'); // consumables can be bought again and again
    expect(await p.buy('coins_pouch')).toBe('purchased');
  });

  it('ignores a double tap while the store sheet is open', async () => {
    const b = fakeBridge();
    const p = make(b);
    const [x, y] = await Promise.all([p.buy('remove_ads'), p.buy('remove_ads')]);
    expect([x, y]).toEqual(['purchased', 'cancelled']);
    expect(b.purchase).toHaveBeenCalledTimes(1);
  });

  it('restores one-time products only', async () => {
    const p = make(fakeBridge({ owned: ['coins_pouch', 'remove_ads', 'starter_bundle'] }));
    expect(await p.restore()).toEqual(['remove_ads']);
  });

  it('survives a configure failure', async () => {
    const p = make(fakeBridge({ configureError: new Error('bad key') }));
    expect((await p.products()).length).toBe(7);
    expect(await p.buy('coins_pouch')).toBe('failed');
    expect(p.lastFailure).toBe('unavailable');
    await expect(p.restore()).rejects.toThrow();
  });

  it('a restore that fails rejects, so the player is not told they own nothing', async () => {
    const b = fakeBridge();
    b.restore.mockRejectedValueOnce(new Error('network'));
    await expect(make(b).restore()).rejects.toThrow('network');
  });
});
