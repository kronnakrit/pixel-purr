// Offline tuner for the 20 launch levels. For each level, search (seed, disorder) pairs and keep the one whose
// "slots needed" sits in the level's band, with the highest naive-player fail rate on spicy levels (lowest on
// relaxed ones). Writes the V1 / V1_NEED tables into src/engine/level.ts. Run: npm run tune
// Rerun whenever a picture, the curve or the generator changes, then `npm test` to refresh expectations.
import { readFileSync, writeFileSync } from 'node:fs';
import { assemble, deal, measure, needSlots, paramsFor, PICTURES, raster } from '../src/engine';

const V1: [number, number][] = [], NEED: number[] = [];
for (let n = 1; n <= PICTURES.length; n++) {
  const P = paramsFor(n), pic = raster(PICTURES[n - 1]!, P.size);
  let best: { seed: number; dis: number; need: number; trap: number; score: number } | null = null;
  for (let seed = 1; seed <= 40; seed++) for (const dis of [0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1]) {
    if (Math.abs(dis - P.disorder) > 0.6) continue;
    const L = assemble(pic, deal(pic, { ...P, disorder: dis }, seed), P);
    const need = needSlots(L, 2000);
    if (need > 5 || need < P.need[0] || need > P.need[1]) continue;
    const trap = measure(L, seed, 30);
    const odd = L.queues.flat().filter(s => s.a % 5).length; // prefer round ammo numbers
    const score = (P.spicy ? trap : -trap) * 4 + need * (P.spicy ? 2 : 0.3) - odd * 0.15 - Math.abs(dis - P.disorder);
    if (!best || score > best.score) best = { seed, dis, need, trap, score };
  }
  if (!best) { console.error(n, PICTURES[n - 1]!.name, 'NO FIT'); process.exit(1); }
  V1.push([best.seed, best.dis]); NEED.push(best.need);
  console.log(n, PICTURES[n - 1]!.name, 'need', best.need, 'fail', best.trap.toFixed(2), 'seed', best.seed, 'dis', best.dis);
}
const file = new URL('../src/engine/level.ts', import.meta.url);
const src = readFileSync(file, 'utf8')
  .replace(/\/\*V1\*\/\[.*?\];/, '/*V1*/' + JSON.stringify(V1) + ';')
  .replace(/\/\*NEED\*\/\[.*?\];/, '/*NEED*/' + JSON.stringify(NEED) + ';');
writeFileSync(file, src);
