// Full-screen pages: the shop and the Sticker Book. They carry their own header (back, title, coin chip).
import type { ProductId, ShopActions, ShopState } from '../app/contracts';
import type { Picture } from '../engine/picture';
import { BOOSTER_KEYS } from '../app/contracts';
import { boosterArt, coinPile, pictureCanvas, purrlet, star, videoGlyph } from './art';
import type { Ctx } from './ctx';
import { art, h, linkBtn, otext, pill, setDisabled } from './dom';
import { formatNumber, rewardItems } from './format';
import type { Modals } from './modal';
import { pageHead } from './panel';

const PACKS: readonly { id: ProductId; name: string; coins: number }[] = [
  { id: 'coins_pouch', name: 'Pouch', coins: 1000 },
  { id: 'coins_basket', name: 'Basket', coins: 5500 },
  { id: 'coins_jar', name: 'Treat Jar', coins: 12000 },
  { id: 'coins_treasure', name: 'Treasure', coins: 28000 },
];
const ONE_TIME: readonly ProductId[] = ['cosy_bundle', 'starter_bundle', 'remove_ads'];

export function shopPage(m: Modals, ctx: Ctx, s: ShopState, act: ShopActions): Promise<void> {
  const owned = new Set<ProductId>(s.owned);
  let busy = false, noAds = s.removeAds, videoReady = s.videoReady;
  return m.show<void>({
    label: 'Shop', kind: 'page', back: done => { if (!busy) done(); },
    build: done => {
      // '' = the store has no price for it right now: not for sale
      const price = (id: ProductId) => s.products.find(p => p.id === id)?.price || null;
      const buttons: { b: HTMLButtonElement; id: ProductId | null }[] = [];

      // one button per product; owned one-time products show "Owned"
      const buyBtn = (id: ProductId, size: 'm' | 's', label?: string) => {
        const pr = price(id);
        const b = pill(label ?? pr ?? '—', 'green', () => void run(id), { size, aria: pr ? `Buy for ${pr}` : 'Not available' });
        buttons.push({ b, id });
        return b;
      };

      // Cosy Bundle
      const cosyItems = rewardItems(s.rewards.cosy_bundle ?? {});
      const bundle = h('div', 'pp-bundle',
        h('div', 'pp-bundle-shine'),
        h('div', 'pp-bundle-l', otext('Cosy Bundle', 'pp-bundle-t', 'h3'), h('p', 'pp-bundle-sub', cosyLine(cosyItems)),
          h('div', 'pp-bundle-bs', ...BOOSTER_KEYS.map(k => art(boosterArt(k, 44))))),
        h('div', 'pp-bundle-r', art(purrlet(9, { label: 'Bubblegum Purrlet' }), 'pp-bundle-cat'), buyBtn('cosy_bundle', 'm')));

      const packs = h('div', 'pp-packs', ...PACKS.map((p, i) => {
        const n = s.rewards[p.id]?.coins ?? p.coins;
        return h('div', 'pp-pack', art(coinPile(i + 1, 92), 'pp-pack-art'), otext(p.name, 'pp-pack-t', 'h3'),
          otext(`${formatNumber(n)} coins`, 'pp-pack-n pp-gold', 'p'), buyBtn(p.id, 's'));
      }));

      const extra: HTMLElement[] = [];
      if (s.products.some(p => p.id === 'remove_ads')) {
        extra.push(h('div', 'pp-shoprow', h('div', 'pp-shoprow-l', otext('Remove Ads', 'pp-pack-t', 'h3'), h('p', 'pp-sub', 'Optional videos stay')), buyBtn('remove_ads', 's')));
      }
      const video = pill(`+${formatNumber(s.videoCoins)} coins with video`, 'blue', () => void runVideo(), { size: 'm', icon: videoGlyph(28), disabled: !videoReady });
      const noVideo = h('p', 'pp-note', 'No video right now');
      // Restore sits at the top, where it is seen without scrolling (the stores ask for it to be easy to find)
      const restore = linkBtn('Restore purchases', () => void runRestore(), 'pp-restore');
      const spinner = h('div', 'pp-spin-wrap', h('div', 'pp-spin'), h('p', 'pp-sub', 'One moment…'));
      spinner.setAttribute('role', 'status');

      const body = h('div', 'pp-pbody', h('div', 'pp-restore-row', restore), bundle, packs, ...extra, h('div', 'pp-actions', video, noVideo));
      const page = h('div', 'pp-pagebox', pageHead(ctx, 'Shop', () => { if (!busy) done(); }), body, spinner);

      function sync() {
        videoReady = act.videoReady();
        for (const { b, id } of buttons) {
          if (!id) continue;
          // Remove Ads is part of the Cosy Bundle: never sell it to someone who has no ads already
          const has = ONE_TIME.includes(id) && (owned.has(id) || (id === 'remove_ads' && noAds));
          b.classList.toggle('pp-owned', has);
          const t = b.querySelector('.pp-pill-t');
          if (t) t.textContent = has ? 'Owned' : price(id) ?? '—';
          setDisabled(b, busy || has || !price(id));
        }
        setDisabled(video, busy || !videoReady);
        noVideo.hidden = videoReady;
        setDisabled(restore, busy);
        page.classList.toggle('pp-isbusy', busy);
      }
      async function run(id: ProductId) {
        if (busy) return;
        busy = true; sync();
        try {
          if (await act.buy(id) && ONE_TIME.includes(id)) { owned.add(id); if (s.rewards[id]?.removeAds) noAds = true; }
        } catch { /* the controller reports failures */ }
        busy = false; sync();
      }
      async function runVideo() {
        if (busy) return;
        busy = true; sync();
        try { await act.video(); } catch { /* reported by the controller */ }
        busy = false; sync();
      }
      async function runRestore() {
        if (busy) return;
        busy = true; sync();
        try {
          for (const id of await act.restore()) { owned.add(id); if (s.rewards[id]?.removeAds) noAds = true; }
        } catch { /* reported by the controller */ }
        busy = false; sync();
      }
      sync();
      // a video can become available (or run out) while the shop is open
      const poll = setInterval(() => { if (!page.isConnected) clearInterval(poll); else if (!busy && act.videoReady() !== videoReady) sync(); }, 1000);
      return page;
    },
  });
}

function cosyLine(items: ReturnType<typeof rewardItems>): string {
  const b = items.find(i => i.kind === 'booster'), c = items.find(i => i.kind === 'coins');
  const parts = [items.some(i => i.kind === 'noAds') ? 'No ads' : null, b && b.kind === 'booster' ? `${b.n} of each booster` : null, c && c.kind === 'coins' ? `${formatNumber(c.n)} coins` : null];
  return parts.filter(Boolean).join(' + ');
}

// ---------------------------------------------------------------- Sticker Book

export function stickerPage(m: Modals, ctx: Ctx, items: { n: number; name: string; picture: Picture }[]): Promise<void> {
  let raf = 0;
  return m.show<void>({
    label: 'Sticker Book', kind: 'page', back: done => done(),
    cleanup: () => cancelAnimationFrame(raf),
    build: done => {
      const count = h('div', 'pp-chip pp-stickcount', art(star(42), 'pp-chip-ic'), otext(formatNumber(items.length), 'pp-chip-n', 'span'));
      count.setAttribute('aria-label', `${items.length} stickers`);
      const body = h('div', 'pp-pbody');
      if (!items.length) {
        body.append(h('div', 'pp-empty', art(purrlet(8, { mood: 'nap', label: 'Napping Purrlet' }), 'pp-empty-cat'),
          otext('No stickers yet', 'pp-title', 'p'), h('p', 'pp-sub', 'Finish a level and its picture joins your Sticker Book.')));
      } else {
        const grid = h('div', 'pp-stickers');
        grid.setAttribute('role', 'list');
        body.append(grid);
        // build cards a few per frame so a long book opens instantly
        let i = 0;
        const batch = () => {
          for (const end = Math.min(items.length, i + 18); i < end; i++) {
            const it = items[i]!;
            const card = h('div', 'pp-sticker', h('div', 'pp-sticker-pic', pictureCanvas(it.picture, 84)), h('p', 'pp-sticker-t', h('b', '', String(it.n)), ` ${it.name}`));
            card.setAttribute('role', 'listitem');
            grid.append(card);
          }
          if (i < items.length) raf = requestAnimationFrame(batch);
        };
        batch();
      }
      return h('div', 'pp-pagebox', pageHead(ctx, 'Sticker Book', () => done(), count), body);
    },
  });
}
