'use strict';
/* =====================================================
   戰鬥引擎：確定性（種子化）三階段推演
   同一組輸入（兩副陣容 + 戰場 + 教條 + 種子）永遠得到相同結果
   ===================================================== */
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const other = s => (s === 'A' ? 'B' : 'A');

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* ---------- 戰場事件（賽前公開，每場輪動，Meta 不會固化） ---------- */
const EVENTS = [
  { id: 'plain',  icon: '🏜', name: '荒漠平原', desc: '地面開闊：裝甲火力 +20%，艦艇火力 −30%。', mod: { armorDmg: 1.2, navalDmg: 0.7 } },
  { id: 'strait', icon: '🌊', name: '島嶼海峽', desc: '海空主導：艦艇火力 +25%，裝甲火力 −15%。', mod: { navalDmg: 1.25, armorDmg: 0.85 } },
  { id: 'storm',  icon: '⛈', name: '暴雨雷暴', desc: '能見度低：空中命中率 −15%，無人機傷害 −25%。', mod: { airHit: -0.15, droneDmg: 0.75 } },
  { id: 'urban',  icon: '🏙', name: '都會巷戰', desc: '重砲受限：火砲 −25%、裝甲 −10%，無人機 +30%。', mod: { artyDmg: 0.75, droneDmg: 1.3, armorDmg: 0.9 } },
  { id: 'em',     icon: '⚡', name: '電磁風暴', desc: '電戰效果 ×1.6；全體隱匿 +10。', mod: { ewMult: 1.6, stealthAdd: 10 } },
  { id: 'clear',  icon: '☀', name: '晴朗無風', desc: '標準環境，無任何修正。', mod: {} }
];

/* ---------- 戰術教條（賽前 3 選 1） ---------- */
const DOCTRINES = [
  { id: 'strike',    icon: '⚔', name: '先發制人', desc: '階段一、二攻擊 +12%，但承受傷害 +5%。' },
  { id: 'defense',   icon: '🛡', name: '縱深防禦', desc: '承受傷害 −12%，防空命中 +6%。' },
  { id: 'deception', icon: '📡', name: '電子欺敵', desc: '電戰值 ×1.5；敵方全體命中率 −8%。' }
];
const DOC_FX = {
  strike:    { atkEarly: 1.12, taken: 1.05, adHit: 0,    ewMult: 1,   enemyPen: 0 },
  defense:   { atkEarly: 1,    taken: 0.88, adHit: 0.06, ewMult: 1,   enemyPen: 0 },
  deception: { atkEarly: 1,    taken: 1,    adHit: 0,    ewMult: 1.5, enemyPen: 0.08 }
};

/* ---------- 隊伍建立 ---------- */
function makeTeam(ids, side) {
  return ids.map((id, i) => {
    const d = UNIT_MAP[id] || {
      name: '主力裝備', cat: 'air', cost: 1, v: 'A',
      traits: [], hp: 120, atk: 60, def: 0, st: 0, ew: 0
    };
    return {
      uid: side + i, side, id, name: d.name, cat: d.cat, cost: d.cost, v: d.v,
      traits: d.traits || [], hpMax: d.hp, hp: d.hp, atk: d.atk, def: d.def,
      stealth: d.st || 0, ew: d.ew || 0, alive: true, apsUsed: false,
      dmgDone: 0, killedBy: null
    };
  });
}

/* ---------- 主戰鬥函式 ---------- */
const DMG_SCALE = 1.0;

function resolveBattle(deckA, deckB, opts) {
  opts = opts || {};
  const seed = opts.seed == null ? (Math.random() * 4294967296) >>> 0 : opts.seed;
  const rng = mulberry32(seed);
  const ev = opts.event || EVENTS[EVENTS.length - 1];
  const m = Object.assign({ armorDmg: 1, navalDmg: 1, artyDmg: 1, droneDmg: 1, airHit: 0, ewMult: 1, stealthAdd: 0 }, ev.mod || {});
  const T = { A: makeTeam(deckA, 'A'), B: makeTeam(deckB, 'B') };
  const docs = { A: opts.docA || 'defense', B: opts.docB || 'defense' };
  const S = {
    A: Object.assign({ hitPen: 0 }, DOC_FX[docs.A]),
    B: Object.assign({ hitPen: 0 }, DOC_FX[docs.B])
  };
  S.A.hitPen = S.B.enemyPen;
  S.B.hitPen = S.A.enemyPen;

  const frames = [];
  const keys = [];
  const alive = (s, f) => T[s].filter(u => u.alive && (!f || f(u)));
  const over = () => alive('A').length === 0 || alive('B').length === 0;
  const snap = () => { const o = {}; for (const s of ['A', 'B']) for (const u of T[s]) o[u.uid] = Math.round(u.hp); return o; };
  const pushFrame = (phase, title, lines) => {
    if (!lines.length) lines = [{ side: 'N', kind: 'info', text: '本輪無有效交火。' }];
    frames.push({ phase, title, lines, hp: snap() });
  };
  const addKey = (imp, text, side) => keys.push({ frame: frames.length, imp, text, side });

  function pickTop(list) {
    if (!list.length) return null;
    if (rng() < 0.3) return list[Math.floor(rng() * list.length)];
    return list.slice().sort((a, b) => b.cost - a.cost || b.hpMax - a.hpMax)[0];
  }
  function pickN(list, n) {
    if (!list.length) return [];
    const first = pickTop(list);
    const out = [first];
    const rest = list.filter(u => u !== first);
    while (out.length < n && rest.length) out.push(rest.splice(Math.floor(rng() * rest.length), 1)[0]);
    return out;
  }
  function hitP(att, tgt, base, w, extra) {
    return base - ((tgt.stealth + m.stealthAdd) / 100) * w - S[att.side].hitPen + (extra || 0);
  }

  /* 同步結算：先全部擲骰，再統一套用傷害 */
  function volley(attacks) {
    const lines = [];
    const rolled = [];
    for (const a of attacks) {
      if (!a.tgt) continue;
      const p = clamp(a.hit, 0.08, 0.96);
      rolled.push({ a, p, ok: rng() < p, raw: a.dmg * (0.85 + rng() * 0.3) * DMG_SCALE * (S[a.att.side].atkAll || 1) });
    }
    for (const r of rolled) {
      const a = r.a, t = a.tgt, at = a.att;
      if (!t.alive) continue;
      const pct = Math.round(r.p * 100);

      // 決定軍規戰術代碼 (Brevity Code)
      let brv = 'ENGAGE';
      if (at.cat === 'air') {
        brv = (t.cat === 'air') ? (at.traits.includes('LR') ? 'FOX-3' : 'DOGFIGHT') : 'CAS';
      } else if (at.cat === 'air_defense' || at.traits.includes('AEGIS')) {
        brv = 'BIRDS AWAY';
      } else if (at.cat === 'armor') {
        brv = (at.traits.includes('TRUE_AT') ? 'HEAT 破甲' : 'SABOT 穿甲');
      } else if (at.cat === 'naval') {
        brv = at.traits.includes('SUB') ? 'TORPEDO' : 'HARPOON';
      } else if (at.cat === 'support') {
        if (at.traits.includes('SEAD')) brv = 'SEAD 壓制';
        else if (at.traits.includes('DEEP')) brv = 'DEEP 點穴';
        else if (at.traits.includes('TRUE_AT')) brv = 'DRONE 突防';
        else brv = 'ARTY 齊射';
      }

      if (!r.ok) {
        lines.push({
          side: at.side,
          kind: 'miss',
          auid: at.uid,
          tuid: t.uid,
          brevity: 'EVADED',
          text: `[EVADED 機動迴避] ${at.name} → ${t.name}：未命中（${pct}% 幾率）`,
          hpAfter: Math.round(t.hp)
        });
        continue;
      }
      if (t.traits.includes('APS') && !t.apsUsed) {
        t.apsUsed = true;
        lines.push({
          side: t.side,
          kind: 'block',
          auid: at.uid,
          tuid: t.uid,
          brevity: 'APS-BLOCK',
          text: `[APS 主動防護] ${t.name} 自動攔截 ${at.name} 首波打擊！`,
          hpAfter: Math.round(t.hp)
        });
        addKey(3, `${t.name} 的主動防護攔截了 ${at.name} 的首發攻擊`, t.side);
        continue;
      }
      const d = r.raw * (a.trueDmg ? 1 : (1 - t.def)) * S[t.side].taken;
      t.hp -= d;
      at.dmgDone += d;
      if (t.hp <= 0) {
        t.hp = 0; t.alive = false; t.killedBy = at;
        const killCode = (t.cat === 'air') ? 'SPLASH' : (t.cat === 'armor') ? 'COOK-OFF' : 'KILL';
        const killLabel = (t.cat === 'air') ? '凌空擊墜' : (t.cat === 'armor') ? '誘發殉爆' : '目標殲滅';
        lines.push({
          side: at.side,
          kind: 'kill',
          auid: at.uid,
          tuid: t.uid,
          brevity: killCode,
          dmg: Math.round(d),
          text: `[${killCode} ${killLabel}] ${at.name} 擊毀 ${t.name}！`,
          hpAfter: 0
        });
        addKey(t.cost * 2 + Math.max(0, t.cost - at.cost) * 2, `${at.name}（$${at.cost}）擊毀 ${t.name}（$${t.cost}）`, at.side);
      } else {
        lines.push({
          side: at.side,
          kind: 'hit',
          auid: at.uid,
          tuid: t.uid,
          brevity: brv,
          dmg: Math.round(d),
          text: `[${brv}] ${at.name} → ${t.name}：命中 −${Math.round(d / t.hpMax * 100)}%（剩餘 ${Math.round(t.hp / t.hpMax * 100)}% 生命）`,
          hpAfter: Math.round(t.hp)
        });
      }
    }
    return lines;
  }

  /* ===== 階段一：電子戰與先制壓制 ===== */
  const ewOf = s => alive(s).reduce((x, u) => x + u.ew, 0) * S[s].ewMult * m.ewMult;
  const ewA = ewOf('A'), ewB = ewOf('B');
  let advSide = null;
  const l1 = [{ side: 'N', kind: 'info', text: `電戰值：我方 ${ewA.toFixed(0)} ／ 敵方 ${ewB.toFixed(0)}` }];
  if (Math.abs(ewA - ewB) >= 10) {
    advSide = ewA > ewB ? 'A' : 'B';
    const ratio = clamp(Math.abs(ewA - ewB) / 50, 0, 1);
    const pen = 0.15 * ratio, boost = 0.08 * ratio;
    S[other(advSide)].hitPen += pen;
    S[advSide].atkAll = 1 + boost;
    l1.push({ side: advSide, kind: 'info', text: `${advSide === 'A' ? '我方' : '敵方'}取得電磁優勢：對手命中率 −${Math.round(pen * 100)}%，己方全體火力 +${Math.round(boost * 100)}%。` });
    if (ratio >= 0.5) addKey(4, `${advSide === 'A' ? '我方' : '敵方'}取得電磁優勢（${ewA.toFixed(0)} vs ${ewB.toFixed(0)}）`, advSide);
  } else {
    l1.push({ side: 'N', kind: 'info', text: '雙方電戰勢均力敵，無人取得電磁優勢。' });
  }
  pushFrame(1, '階段一 · 電子戰博弈', l1);

  {
    const at = [];
    for (const s of ['A', 'B']) {
      const e = other(s);
      for (const u of alive(s, x => x.traits.includes('SEAD') || x.traits.includes('DEEP'))) {
        let t;
        if (u.traits.includes('DEEP')) t = pickTop(alive(e));
        else t = pickTop(alive(e, x => x.cat === 'air_defense')) || pickTop(alive(e, x => x.cat === 'naval')) || pickTop(alive(e));
        if (!t) continue;
        at.push({ att: u, tgt: t, hit: hitP(u, t, 0.82, 0.55), dmg: u.atk * 1.5 * S[s].atkEarly });
      }
    }
    pushFrame(1, '階段一 · 先制壓制（SEAD／縱深打擊）', volley(at));
  }

  /* ===== 階段二：空防與制海 ===== */
  if (!over()) {
    // 2-1 防空攔截戰機
    const at = [];
    for (const s of ['A', 'B']) {
      const e = other(s);
      const shooters = alive(s, x => x.cat === 'air_defense' || x.traits.includes('AEGIS'));
      for (const u of shooters) {
        const t = pickTop(alive(e, x => x.cat === 'air'));
        if (!t) continue;
        const f = u.cat === 'air_defense' ? 1 : 0.55;
        const hit = hitP(u, t, 0.82 + (u.traits.includes('AA_LONG') ? 0.08 : 0) + S[s].adHit, 0.55, m.airHit);
        at.push({ att: u, tgt: t, hit, dmg: u.atk * 2.5 * f });
      }
    }
    pushFrame(2, '階段二 · 防空攔截', volley(at));
  }
  if (!over()) {
    // 2-2 空戰
    const at = [];
    for (const s of ['A', 'B']) {
      const e = other(s);
      for (const u of alive(s, x => x.cat === 'air')) {
        const t = pickTop(alive(e, x => x.cat === 'air'));
        if (!t) continue;
        const hit = hitP(u, t, 0.66 + (u.traits.includes('LR') ? 0.06 : 0) + (u.stealth - t.stealth) / 250, 0.3, m.airHit);
        at.push({ att: u, tgt: t, hit, dmg: u.atk * 1.1 * S[s].atkEarly });
      }
    }
    pushFrame(2, '階段二 · 空中格鬥', volley(at));
  }
  if (!over()) {
    // 2-3 制海
    const at = [];
    for (const s of ['A', 'B']) {
      const e = other(s);
      for (const u of alive(s, x => x.cat === 'naval')) {
        const navs = alive(e, x => x.cat === 'naval');
        const pool = navs.length ? navs : alive(e, x => x.cat === 'armor');
        const tgts = u.traits.includes('SWARM') ? pickN(pool, 2) : [pickTop(pool)];
        for (const t of tgts) {
          if (!t) continue;
          let mult = navs.length ? 1 : 0.8;
          if (t.traits.includes('SUB') && u.traits.includes('ASW')) mult *= 1.6;
          if (u.traits.includes('SUB') && !t.traits.includes('SUB')) mult *= 1.3;
          if (u.traits.includes('AMBUSH') && t.cost >= u.cost + 2) mult *= 1.25;
          if (tgts.length > 1) mult *= 0.6;
          at.push({ att: u, tgt: t, hit: hitP(u, t, 0.76, 0.45), dmg: u.atk * mult * m.navalDmg * S[s].atkEarly });
        }
      }
    }
    pushFrame(2, '階段二 · 制海對決', volley(at));
  }

  /* ===== 階段三：殲滅死鬥決戰（持續交火直至一方全殲） ===== */
  let r = 1;
  const MAX_ROUNDS = 15;
  while (!over() && r <= MAX_ROUNDS) {
    const at = [];
    const escal = 1 + Math.max(0, r - 3) * 0.2; // 輪次超過第3輪後火力升級，加速收尾
    for (const s of ['A', 'B']) {
      const e = other(s);
      const enemyAlive = alive(e);
      if (!enemyAlive.length) continue;

      const enemyArmor = alive(e, x => x.cat === 'armor');
      const enemyAir = alive(e, x => x.cat === 'air');
      const enemyNaval = alive(e, x => x.cat === 'naval');
      const ground = enemyArmor.length ? enemyArmor : enemyAlive;
      const adAlive = alive(e, x => x.cat === 'air_defense').length;
      const spot = alive(s, x => x.traits.includes('SPOT')).length ? 1.15 : 1;
      const ciws = alive(e, x => x.traits.includes('CIWS')).length > 0;

      for (const u of alive(s)) {
        if (u.cat === 'air') {
          // 戰機全力打擊地面重裝甲或殘存敵軍
          const t = pickTop(ground);
          if (!t) continue;
          const mult = u.traits.includes('CAS') ? 1.8 : 1.15;
          at.push({
            att: u, tgt: t,
            hit: hitP(u, t, 0.82 - Math.min(0.3, adAlive * 0.07), 0.15, m.airHit),
            dmg: u.atk * mult * (t.cat === 'armor' ? 1.1 : 0.8) * escal
          });
        } else if (u.cat === 'naval') {
          // 艦艇優先攻擊敵艦，若無則以巡弋飛彈/艦炮轟擊地面
          const t = enemyNaval.length ? pickTop(enemyNaval) : pickTop(ground);
          if (!t) continue;
          at.push({
            att: u, tgt: t,
            hit: hitP(u, t, 0.78, 0.25),
            dmg: u.atk * 0.85 * m.navalDmg * escal
          });
        } else if (u.cat === 'armor') {
          // 裝甲主力主炮猛轟
          const t = pickTop(ground);
          if (!t) continue;
          at.push({
            att: u, tgt: t,
            hit: hitP(u, t, 0.85, 0.2),
            dmg: u.atk * 1.45 * m.armorDmg * (t.cat === 'armor' ? 1.1 : 0.9) * escal
          });
        } else if (u.cat === 'support') {
          // 支援部隊（巡飛彈 / 火砲 / 海馬斯火箭）
          if (u.traits.includes('TRUE_AT')) {
            const ts = u.traits.includes('SWARM') ? pickN(ground, 2) : [pickTop(ground)];
            for (const t of ts) {
              if (!t) continue;
              at.push({
                att: u, tgt: t, hit: hitP(u, t, 0.78, 0.35), trueDmg: true,
                dmg: u.atk * 2.2 * (ts.length > 1 ? 0.65 : 1) * m.droneDmg * (ciws ? 0.5 : 1) * escal
              });
            }
          } else if (u.traits.includes('ARTY') || u.traits.includes('DEEP')) {
            const ts = u.traits.includes('SAT') ? pickN(ground, 2) : [pickTop(ground)];
            for (const t of ts) {
              if (!t) continue;
              at.push({
                att: u, tgt: t, hit: hitP(u, t, 0.78, 0.3),
                dmg: u.atk * 1.5 * (ts.length > 1 ? 0.75 : 1) * m.artyDmg * spot * escal
              });
            }
          }
        } else if (u.cat === 'air_defense') {
          // 防空部隊：敵有戰機則攔截，敵無戰機則以防空機炮/近防武器打擊地面部隊！
          if (enemyAir.length) {
            const t = pickTop(enemyAir);
            if (t) {
              at.push({
                att: u, tgt: t,
                hit: hitP(u, t, 0.88, 0.35, m.airHit),
                dmg: u.atk * 2.2 * escal
              });
            }
          } else {
            const t = pickTop(ground);
            if (t) {
              at.push({
                att: u, tgt: t,
                hit: 0.72,
                dmg: u.atk * 0.7 * escal
              });
            }
          }
        }
      }
    }
    pushFrame(3, `階段三 · 殲滅死鬥（第 ${r} 輪）`, volley(at));
    r++;
  }

  /* ===== 結算 ===== */
  const airPow = t => t.filter(u => u.cat === 'air').reduce((x, u) => x + u.cost * u.hp / u.hpMax, 0);
  const navPow = t => t.filter(u => u.cat === 'naval').reduce((x, u) => x + u.cost * u.hp / u.hpMax, 0);
  function calcVP(s) {
    const us = T[s], en = T[other(s)];
    const remain = us.reduce((x, u) => x + u.cost * (u.hp / u.hpMax), 0) * 4;
    const armorHp = us.filter(u => u.cat === 'armor').reduce((x, u) => x + u.hp / u.hpMax, 0);
    const armorCtl = 15 * Math.min(1, armorHp);
    const airSup = airPow(us) > airPow(en) ? 10 : 0;
    const navCtl = navPow(us) > navPow(en) ? 5 : 0;
    let upset = 0;
    for (const u of en) if (!u.alive && u.killedBy && u.killedBy.side === s) upset += Math.max(0, u.cost - u.killedBy.cost) * 2;
    upset = Math.min(12, upset);
    const control = armorCtl + airSup + navCtl;
    return { remain, armorCtl, airSup, navCtl, control, upset, total: remain + control + upset };
  }
  const vp = { A: calcVP('A'), B: calcVP('B') };
  const aDead = alive('A').length === 0, bDead = alive('B').length === 0;
  let winner, wipeout = false;
  if (aDead && !bDead) { winner = 'B'; wipeout = true; }
  else if (bDead && !aDead) { winner = 'A'; wipeout = true; }
  else {
    const d = vp.A.total - vp.B.total;
    winner = Math.abs(d) < 0.5 ? 'draw' : (d > 0 ? 'A' : 'B');
  }
  const mvp = {};
  for (const s of ['A', 'B']) mvp[s] = T[s].slice().sort((a, b) => b.dmgDone - a.dmgDone)[0];
  const key = keys.slice().sort((a, b) => b.imp - a.imp).slice(0, 4).sort((a, b) => a.frame - b.frame);

  return { seed, winner, wipeout, vp, frames, key, mvp, ev, docs, ewA, ewB, advSide, final: T };
}

/* ---------- 陣容驗證 / 代碼 ---------- */
function deckCost(ids) {
  return (ids || []).reduce((x, id) => x + (id && UNIT_MAP[id] ? UNIT_MAP[id].cost : 0), 0);
}

function validateDeck(ids, budget, banned) {
  budget = budget == null ? BUDGET : budget;
  banned = banned || [];
  const errs = [];
  if (!Array.isArray(ids) || ids.length !== SLOTS.length) return ['陣容槽位數量錯誤'];
  ids.forEach((id, i) => {
    if (!id) { errs.push(`${SLOTS[i].label}尚未配置`); return; }
    const u = UNIT_MAP[id];
    if (!u) { errs.push(`未知裝備：${id}`); return; }
    if (SLOTS[i].fixed && u.cat !== SLOTS[i].fixed) errs.push(`${SLOTS[i].label}只能配置${CATS[SLOTS[i].fixed].label}`);
    if (banned.includes(id)) errs.push(`${u.name} 已被戰術禁用 (BANNED)`);
  });
  const cats = ids.filter(Boolean).map(id => UNIT_MAP[id] && UNIT_MAP[id].cat).filter(Boolean);
  if (new Set(cats).size !== cats.length) errs.push('同一兵種（類型）不可重複選取');
  if (new Set(ids.filter(Boolean)).size !== ids.filter(Boolean).length) errs.push('同一裝備不可重複');
  if (deckCost(ids.filter(id => id && UNIT_MAP[id])) > budget) errs.push(`預算超標（上限 $${budget}）`);
  return errs;
}
const encodeDeck = ids => ids.join('.');
function decodeDeck(code) {
  const ids = String(code || '').trim().toUpperCase().split(/[.\-,\s]+/).filter(Boolean);
  return ids.length === SLOTS.length && ids.every(id => UNIT_MAP[id]) ? ids : null;
}

/* ---------- AI 風格與陣容生成（嚴格五大兵種各 1 件） ---------- */
const ARCHETYPES = [
  { id: 'armor',    name: '鋼鐵洪流', desc: '重金投入裝甲與火砲，主打地面決戰。', plan: [['air', 2], ['armor', 5], ['air_defense', 3], ['naval', 2], ['support', 3]] },
  { id: 'air',      name: '空優信徒', desc: '頂級空優戰機搭配精準打擊，空中壓制一切。', plan: [['air', 5], ['armor', 2], ['air_defense', 2], ['naval', 3], ['support', 3]] },
  { id: 'hedgehog', name: '防禦刺蝟', desc: '超遠程防空加潛艦，專打防守反擊。',   plan: [['air', 2], ['armor', 3], ['air_defense', 5], ['naval', 3], ['support', 2]] },
  { id: 'balanced', name: '聯合作戰', desc: '各兵種均衡配置，沒有明顯弱點。',   plan: [['air', 3], ['armor', 3], ['air_defense', 3], ['naval', 3], ['support', 3]] },
  { id: 'naval',    name: '海上霸權', desc: '以萬噸大驅為核心，海空聯動。',     plan: [['air', 3], ['armor', 2], ['air_defense', 2], ['naval', 5], ['support', 3]] },
  { id: 'ew',       name: '電戰蜂群', desc: '預警機搭配無人機與快艇，以小博大。', plan: [['air', 2], ['armor', 3], ['air_defense', 2], ['naval', 3], ['support', 5]] }
];
/* 每日挑戰：對手預算 $19（五大兵種各 1 件超標配置），玩家僅 $15 */
const DAILY_PLANS = [
  { id: 'fleet',   name: '超標空海艦隊', desc: '5元五代戰機＋4元神盾驅逐艦制海，海空雙重壓迫。', plan: [['air', 5], ['armor', 4], ['air_defense', 4], ['naval', 3], ['support', 3]] },
  { id: 'armor',   name: '超標裝甲集群', desc: '5元主戰坦克領軍衝鋒，重型遠程火砲密集覆蓋。', plan: [['air', 4], ['armor', 5], ['air_defense', 3], ['naval', 4], ['support', 3]] },
  { id: 'fortress',name: '超標防空堡壘', desc: '5元遠程地對空防空網，全面禁絕中高空空襲。', plan: [['air', 4], ['armor', 3], ['air_defense', 5], ['naval', 4], ['support', 3]] },
  { id: 'ew',      name: '超標電戰蜂群', desc: '5元高階電戰機雜訊致盲，搭配無人機長程引導。', plan: [['air', 3], ['armor', 4], ['air_defense', 4], ['naval', 3], ['support', 5]] },
  { id: 'stealth', name: '超標匿蹤刺客', desc: '5元隱匿空優戰機搭配潛艦突襲，雷達難以捕捉。', plan: [['air', 5], ['armor', 3], ['air_defense', 3], ['naval', 4], ['support', 4]] },
  { id: 'battleship',name:'超標海上堡壘', desc: '5元萬噸萬能巡洋艦，全頻譜打擊與海空統治。', plan: [['air', 4], ['armor', 3], ['air_defense', 3], ['naval', 5], ['support', 4]] },
  { id: 'artillery',name:'超標末日火雨', desc: '5元大口徑火箭砲縱深齊射，首輪火力毀滅性打擊。', plan: [['air', 3], ['armor', 4], ['air_defense', 3], ['naval', 4], ['support', 5]] },
  { id: 'ironcurtain',name:'超標鐵幕聯軍', desc: '均衡高階配置，全兵種堅韌抗揍無死角。', plan: [['air', 4], ['armor', 4], ['air_defense', 4], ['naval', 4], ['support', 3]] }
];

function buildFromPlan(plan, rng) {
  const ids = [];
  for (const [cat, cost] of plan) {
    const c = UNITS.filter(u => u.cat === cat && u.cost === cost && !ids.includes(u.id));
    ids.push(c[Math.floor(rng() * c.length)].id);
  }
  return ids;
}

/* 隨機補滿（嚴格五大兵種各 1 槽位，杜絕兵種重複） */
function randomDeck(rng, budget, locked) {
  budget = budget == null ? BUDGET : budget;
  locked = locked || [];
  for (let attempt = 0; attempt < 300; attempt++) {
    const ids = [];
    let spent = 0, ok = true;
    for (let i = 0; i < SLOTS.length && ok; i++) {
      if (locked[i]) {
        ids.push(locked[i]); spent += UNIT_MAP[locked[i]].cost;
      }
    }
    if (spent > budget) return null;
    for (let i = 0; i < SLOTS.length; i++) {
      if (locked[i]) continue;
      let rest = 0;
      for (let j = i + 1; j < SLOTS.length; j++) if (!locked[j]) rest++;
      const maxCost = Math.min(5, budget - spent - rest);
      if (maxCost < 1) { ok = false; break; }
      const cat = SLOTS[i].fixed;
      const cand = UNITS.filter(u => u.cat === cat && u.cost <= maxCost && !ids.includes(u.id) && !locked.includes(u.id));
      if (!cand.length) { ok = false; break; }
      const total = cand.reduce((x, u) => x + u.cost, 0);
      let r = rng() * total, pick = cand[0];
      for (const u of cand) { r -= u.cost; if (r <= 0) { pick = u; break; } }
      ids[i] = pick.id; spent += pick.cost;
    }
    if (ok) {
      const out = [];
      for (let i = 0; i < SLOTS.length; i++) out.push(locked[i] || ids[i]);
      if (validateDeck(out, budget).length === 0) return out;
    }
  }
  return null;
}

/* ---------- 推薦陣容（嚴格五大兵種各 1 件） ---------- */
const TEMPLATES = [
  { name: '均衡聯合', note: '無弱點的通用配置', ids: ['F35A', 'K2', 'NASAMS', 'KILO', 'FPV'] },
  { name: '空優突襲', note: '$5 戰機＋電戰壓制', ids: ['F22', 'T72', 'PANT', 'TJ', 'EA18'] },
  { name: '鋼鐵洪流', note: '重裝甲＋火砲地面流', ids: ['FA50', 'LEO2', 'NASAMS', 'TJ', 'PZH'] },
  { name: '防空刺蝟', note: '長程防空＋潛艦伏擊', ids: ['F16V', 'T90', 'SAMPT', 'U212', 'TB2'] },
  { name: '以小博大', note: '無人機與快艇游擊', ids: ['M2K', 'STRY', 'IRON', 'USV', 'E7'] }
];

/* ---------- 批次模擬（沙盒／平衡工具） ---------- */
function simulate(deckA, deckB, n, opts) {
  opts = opts || {};
  const out = { n, win: 0, lose: 0, draw: 0, sumA: 0, sumB: 0, byEvent: {} };
  EVENTS.forEach(e => { out.byEvent[e.id] = { win: 0, n: 0 }; });
  const rng = mulberry32((opts.seed || 12345) >>> 0);
  for (let i = 0; i < n; i++) {
    const ev = opts.event || EVENTS[i % EVENTS.length];
    const docA = opts.docA || DOCTRINES[Math.floor(rng() * 3)].id;
    const docB = opts.docB || DOCTRINES[Math.floor(rng() * 3)].id;
    const r = resolveBattle(deckA, deckB, { seed: Math.floor(rng() * 4294967296), event: ev, docA, docB });
    if (r.winner === 'A') { out.win++; out.byEvent[ev.id].win++; }
    else if (r.winner === 'B') out.lose++;
    else out.draw++;
    out.byEvent[ev.id].n++;
    out.sumA += r.vp.A.total; out.sumB += r.vp.B.total;
  }
  return out;
}
