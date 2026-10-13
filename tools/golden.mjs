// Writes test/fixtures/golden.json from the design-page generator (tools/reference/gen.cjs).
// The TypeScript engine must reproduce these levels exactly. Run: npm run golden
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const PF = require('./reference/gen.cjs');

const pxStr = px => Array.from(px, c => c.toString(36)).join('');
const dump = L => ({
  name: L.name, w: L.w, h: L.h, px: pxStr(L.px), total: L.total, seed: L.seed, disorder: L.disorder, need: L.need,
  queues: L.queues.map(q => q.map(s => ({ id: s.id, c: s.c, a: s.a, ...(s.hidden ? { hidden: true } : {}), ...(s.link != null ? { link: s.link } : {}) }))),
  solution: { ok: L.solution.ok, plan: L.solution.plan, nodes: L.solution.nodes, peakTray: L.solution.peakTray },
});
const out = { v1: [], endless: [] };
for (let n = 1; n <= 20; n++) out.v1.push(dump(PF.level(n)));
for (const n of [21, 22, 23, 30, 47]) out.endless.push({ n, ...dump(PF.level(n)) });
writeFileSync(new URL('../test/fixtures/golden.json', import.meta.url), JSON.stringify(out));
console.log('v1', out.v1.map(l => `${l.name}:${l.solution.ok ? 'ok' : 'FAIL'}`).join(' '));
console.log('endless', out.endless.map(l => `${l.n} ${l.name} need ${l.need} ${l.solution.ok ? 'ok' : 'FAIL'}`).join(', '));
