// 平衡模擬工具：node tools/balance.js
const fs = require('fs'), path = require('path');
const code = ['data.js', 'engine.js'].map(f => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8')).join('\n');
const E = new Function(code + '\nreturn {UNITS,UNIT_MAP,ARCHETYPES,EVENTS,DOCTRINES,TEMPLATES,SLOTS,resolveBattle,buildFromPlan,randomDeck,simulate,mulberry32,validateDeck};')();

const rng = E.mulberry32(777);
// 1. 驗證推薦陣容
E.TEMPLATES.forEach(t => { const er = E.validateDeck(t.ids); if (er.length) console.log('模板無效', t.name, er); });

// 2. AI 風格循環賽
console.log('\n=== AI 風格循環賽（每組 300 場，列為先手視角勝率）===');
const decks = E.ARCHETYPES.map(a => E.buildFromPlan(a.plan, E.mulberry32(5)));
const head = ['風格'.padEnd(8)].concat(E.ARCHETYPES.map(a => a.name.padEnd(6))).join(' ');
console.log(head, ' 平均');
E.ARCHETYPES.forEach((a, i) => {
  const row = []; let tot = 0, cnt = 0;
  E.ARCHETYPES.forEach((b, j) => {
    if (i === j) { row.push('  -   '); return; }
    const r = E.simulate(decks[i], decks[j], 300, { seed: i * 100 + j });
    const wr = (r.win + r.draw / 2) / r.n; tot += wr; cnt++;
    row.push((wr * 100).toFixed(0).padStart(4) + '% ');
  });
  console.log(a.name.padEnd(8), row.join(' '), (tot / cnt * 100).toFixed(0) + '%');
});

// 3. 單位勝率（隨機合法陣容對戰）
console.log('\n=== 單位勝率（隨機陣容 N=6000 場）===');
const stat = {}; E.UNITS.forEach(u => stat[u.id] = { w: 0, n: 0 });
let draws = 0, wipes = 0, total = 6000;
for (let i = 0; i < total; i++) {
  const a = E.randomDeck(rng), b = E.randomDeck(rng);
  const r = E.resolveBattle(a, b, { seed: Math.floor(rng() * 4e9), event: E.EVENTS[i % 6], docA: E.DOCTRINES[i % 3].id, docB: E.DOCTRINES[(i + 1) % 3].id });
  if (r.winner === 'draw') draws++;
  if (r.wipeout) wipes++;
  a.forEach(id => { stat[id].n++; stat[id].w += r.winner === 'A' ? 1 : r.winner === 'draw' ? .5 : 0; });
  b.forEach(id => { stat[id].n++; stat[id].w += r.winner === 'B' ? 1 : r.winner === 'draw' ? .5 : 0; });
}
const rows = E.UNITS.map(u => ({ id: u.id, name: u.name, cat: u.cat, cost: u.cost, wr: stat[u.id].w / Math.max(1, stat[u.id].n), n: stat[u.id].n }));
['air', 'armor', 'air_defense', 'naval', 'support'].forEach(c => {
  console.log('-- ' + c);
  rows.filter(r => r.cat === c).sort((a, b) => b.cost - a.cost).forEach(r => console.log(('$' + r.cost + ' ' + r.name).padEnd(26), (r.wr * 100).toFixed(1) + '%', '  n=' + r.n));
});
console.log('\n平手率', (draws / total * 100).toFixed(1) + '%', ' 全殲率', (wipes / total * 100).toFixed(1) + '%');
const byCost = {}; rows.forEach(r => { (byCost[r.cost] = byCost[r.cost] || []).push(r.wr); });
Object.keys(byCost).sort().forEach(c => console.log('$' + c + ' 平均勝率', (byCost[c].reduce((a, b) => a + b, 0) / byCost[c].length * 100).toFixed(1) + '%'));
const wrs = rows.map(r => r.wr);
console.log('最強', (Math.max(...wrs) * 100).toFixed(1) + '%', ' 最弱', (Math.min(...wrs) * 100).toFixed(1) + '%');
