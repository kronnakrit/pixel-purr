// Offline builder for the shipped levels 21-60 (src/content/levels-21-60.json). For each level: raster its picture
// (src/content/pictures.ts) at its grid size, take the knobs from contentParams(n), then search (seed, disorder)
// deals like tools/tune.ts: "slots needed" must sit in the level's band, the runtime solver must prove it, and the
// best deal is the one closest to the level's place on the curve (target slots needed and naive fail rate,
// target Purrlet count, round ammo numbers). Prints the difficulty table.
//
//   npx tsx tools/levels.ts            rebuild all 40 levels (parallel workers)
//   npx tsx tools/levels.ts 33 47-50   rebuild only these levels, keep the rest
//   npx tsx tools/levels.ts --table    only print the table for the current file
//   --jobs N                           worker processes (default: CPU count, max 6)
import { fork } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { fileURLToPath } from 'node:url';
import { assemble, colorsOf, countPixels, deal, fromFile, measure, needSlots, raster, solve, toFile, type Level, type LevelFileV1 } from '../src/engine';
import { contentParams, FIRST_FILE_LEVEL, isRelaxed, LAST_FILE_LEVEL } from '../src/content/params';
import { PICTURES_21_60 } from '../src/content/pictures';

const OUT = fileURLToPath(new URL('../src/content/levels-21-60.json', import.meta.url));
const SEEDS = 40, SPICY_SEEDS = 100, DISORDERS = [0.2, 0.35, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
const RUNS = 40; // naive playouts per measure

/** Where level n sits on the curve: slots needed and naive fail rate it should land near. */
export function target(n: number): { need: number; fail: number } {
  const t = (n - FIRST_FILE_LEVEL) / (LAST_FILE_LEVEL - FIRST_FILE_LEVEL), k = n % 5;
  if (isRelaxed(n)) return { need: 1, fail: 0 };
  if (k === 0) return { need: n === LAST_FILE_LEVEL ? 4 : 3, fail: 0.1 + 0.25 * t };
  return { need: k === 2 && t < 0.5 ? 1 : 2, fail: 0.1 * t * (k - 1) / 3 };
}

interface Pick { n: number; file: LevelFileV1; fail: number; score: number; tried: number }

/** Naive fail rate, measured the same way for the search and the table. */
const failRate = (L: Level, n: number): number => measure(L, n * 7919, RUNS);

function buildLevel(n: number): Pick {
  const def = PICTURES_21_60[n - FIRST_FILE_LEVEL]!, P = contentParams(n, def), pic = raster(def, P.size), T = target(n);
  let best: Pick | null = null, tried = 0;
  for (const dis of DISORDERS) {
    if (Math.abs(dis - P.disorder) > 0.5) continue;
    for (let seed = 1; seed <= (P.spicy ? SPICY_SEEDS : SEEDS); seed++) {
      tried++;
      const L = assemble(pic, deal(pic, { ...P, disorder: dis }, seed), P);
      const need = needSlots(L, 2000);
      if (need < P.need[0] || need > P.need[1]) continue;
      if (!solve(L).ok) continue; // the app proves each level once at load with the default budget
      const fail = failRate(L, n), all = L.queues.flat();
      const odd = all.filter(s => s.a % 5).length, tiny = all.filter(s => s.a < 5).length;
      const links = all.filter(s => s.link !== undefined).length / 2, hidden = all.filter(s => s.hidden).length;
      const score = -3 * Math.abs(need - T.need) - 5 * Math.abs(fail - T.fail) - 0.12 * Math.abs(all.length - P.shooters)
        - 0.15 * odd - 0.4 * tiny - 0.6 * Math.max(0, P.links - links) - 0.1 * Math.abs(hidden - P.hidden * all.length) - 0.4 * Math.abs(dis - P.disorder);
      if (!best || score > best.score) best = { n, file: toFile(n, Object.assign(L, { seed, disorder: dis, need })), fail, score, tried: 0 };
    }
  }
  if (!best) throw new Error(`level ${n} ${def.name}: no deal fits need band ${P.need.join('-')}`);
  best.tried = tried;
  return best;
}

// ---------------------------------------------------------------- table

function row(f: LevelFileV1, fail: number): string {
  const L = fromFile(f), all = L.queues.flat(), ammo = all.map(s => s.a);
  const cells = [f.n, f.name + (f.n % 5 === 0 ? ' *' : isRelaxed(f.n) ? ' ~' : ''), `${f.w}x${f.h}`, countPixels(L.px), colorsOf(L.px).length, L.queues.length, all.length,
    `${Math.min(...ammo)}-${Math.max(...ammo)}`, f.need ?? '?', fail.toFixed(2), all.filter(s => s.hidden).length, all.filter(s => s.link !== undefined).length / 2, `${f.seed}/${f.disorder}`];
  return '| ' + cells.join(' | ') + ' |';
}

function table(files: readonly LevelFileV1[], fails: ReadonlyMap<number, number>): void {
  console.log('\n| n | name | size | px | colours | queues | Purrlets | ammo | need | naive fail | mystery | links | seed/dis |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const f of files) console.log(row(f, fails.get(f.n) ?? failRate(fromFile(f), f.n)));
  console.log('\n* spicy, ~ relaxed. need = fewest tray slots a perfect player needs; naive fail = share of', RUNS, 'random-but-not-suicidal playouts that lose.');
}

// ---------------------------------------------------------------- main / workers

function parseLevels(args: string[]): number[] {
  const out: number[] = [];
  for (const a of args) {
    const [lo, hi] = a.split('-').map(Number);
    for (let n = lo!; n <= (hi ?? lo!); n++) if (n >= FIRST_FILE_LEVEL && n <= LAST_FILE_LEVEL) out.push(n);
  }
  return out;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args[0] === '--worker') { // child: build the given levels, send each pick to the parent
    for (const n of parseLevels(args.slice(1))) process.send!(buildLevel(n));
    return;
  }
  const existing: LevelFileV1[] = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) as LevelFileV1[] : [];
  if (args.includes('--table')) { table(existing, new Map()); return; }
  const ji = args.indexOf('--jobs'), jobs = ji >= 0 ? Number(args[ji + 1]) : Math.min(6, cpus().length);
  const wanted = parseLevels(args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--jobs'));
  const todo = wanted.length ? wanted : Array.from({ length: LAST_FILE_LEVEL - FIRST_FILE_LEVEL + 1 }, (_, i) => FIRST_FILE_LEVEL + i);

  const byN = new Map(existing.map(f => [f.n, f])), fails = new Map<number, number>(), t0 = Date.now();
  // Deal the slowest (biggest) levels first, round-robin over the workers.
  const order = todo.slice().sort((a, b) => PICTURES_21_60[b - FIRST_FILE_LEVEL]!.size - PICTURES_21_60[a - FIRST_FILE_LEVEL]!.size || a - b);
  const groups = Array.from({ length: Math.min(jobs, order.length) }, (_, w) => order.filter((_, i) => i % jobs === w));
  await Promise.all(groups.map(g => new Promise<void>((done, fail) => {
    const child = fork(fileURLToPath(import.meta.url), ['--worker', ...g.map(String)], { execArgv: process.execArgv });
    child.on('message', (p: Pick) => {
      byN.set(p.n, p.file); fails.set(p.n, p.fail);
      console.log(`level ${p.n} ${p.file.name}: need ${p.file.need}, fail ${p.fail.toFixed(2)}, seed ${p.file.seed}, dis ${p.file.disorder} (${p.tried} deals, ${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    });
    child.on('exit', code => (code ? fail(new Error(`worker for ${g.join(',')} exited ${code}`)) : done()));
  })));

  const files = [...byN.values()].sort((a, b) => a.n - b.n);
  for (const f of files) fromFile(f); // validates paint conservation and links before writing
  writeFileSync(OUT, '[\n' + files.map(f => JSON.stringify(f)).join(',\n') + '\n]\n');
  console.log(`wrote ${files.length} levels to ${OUT}`);
  table(files, fails);
}

main().catch(e => { console.error(e); process.exit(1); });
