// Offline tuner: for each v1 level, search (seed, disorder) pairs and keep the one whose
// "slots needed" sits in the level's band with the highest naive-player fail rate for spicy levels
// (lowest for relaxed ones). Writes the table into gen.js. Run: node tune.js
const fs = require('fs');
const PF = require('./gen.cjs');
const V1 = [], NEED = [];
for (let n = 1; n <= 20; n++) {
  const P = PF.paramsFor(n), pic = PF.raster(PF.PICTURES[n - 1], P.size);
  let best = null;
  for (let seed = 1; seed <= 40; seed++) for (const dis of [0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1]) {
    if (Math.abs(dis - P.disorder) > 0.6) continue;
    const L = PF.assemble(pic, PF.deal(pic, { ...P, disorder: dis }, seed), P);
    const need = PF.needSlots(L, 2000);
    if (need > 5 || need < P.need[0] || need > P.need[1]) continue;
    const trap = PF.measure(L, seed, 30);
    const ammo = L.queues.flat().map(s => s.a), odd = ammo.filter(a => a % 5).length; // prefer round ammo numbers
    const score = (P.spicy ? trap : -trap) * 4 + need * (P.spicy ? 2 : 0.3) - odd * 0.15 - Math.abs(dis - P.disorder);
    if (!best || score > best.score) best = { seed, dis, need, trap, score };
  }
  if (!best) { console.log(n, 'NO FIT'); process.exit(1); }
  V1.push([best.seed, best.dis]); NEED.push(best.need);
  console.log(n, PF.PICTURES[n - 1].name, 'need', best.need, 'fail', best.trap.toFixed(2), 'seed', best.seed, 'dis', best.dis);
}
let s = fs.readFileSync('gen.cjs', 'utf8');
s = s.replace(/const V1 = \/\*V1\*\/\[.*?\];/, 'const V1 = /*V1*/' + JSON.stringify(V1) + ';')
     .replace(/const V1_NEED = \/\*NEED\*\/\[.*?\];/, 'const V1_NEED = /*NEED*/' + JSON.stringify(NEED) + ';');
fs.writeFileSync('gen.cjs', s);
