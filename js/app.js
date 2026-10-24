(function () {
'use strict';
/* =====================================================
   頂尖對戰：15元聯合作戰 — 互動介面與核心邏輯
   含：快速對戰、真人非同步幽靈對戰、BO3 征服賽、每日殘局、沙盒模擬
   ===================================================== */
const $ = s => document.querySelector(s);
const ICON = {
  air: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2 7 8 4v2l-8-2-1 5 3 2v1l-4-1-4 1v-1l3-2-1-5-8 2v-2l8-4z"/></svg>',
  armor: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 15h18l-2 4H5z"/><path d="M7 10h9l1 4H6z"/><path d="M16 11h6v2h-6z"/></svg>',
  air_defense: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c2 3 3 6 3 10l2 3v3l-3-1h-4l-3 1v-3l2-3c0-4 1-7 3-10z"/></svg>',
  naval: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 15h20l-3 5H5z"/><path d="M6 10h12v4H6z"/><path d="M10 5h4v5h-4z"/></svg>',
  support: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="14" r="2" fill="currentColor"/><path d="M6 14a6 6 0 0 1 12 0M2.5 14a9.5 9.5 0 0 1 19 0"/><path d="M12 14V6"/></svg>'
};

const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};

/* ---------- 純前端 Web Audio API 戰場真實合成音效引擎 ---------- */
const SoundEngine = {
  ctx: null,
  enabled: LS.get('db15_sound', true),
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  },
  toggle() {
    this.enabled = !this.enabled;
    const ico = $('#audioIcon');
    const btn = $('#btnAudio');
    if (ico) ico.textContent = this.enabled ? '🔊' : '🔇';
    if (btn) btn.title = this.enabled ? '戰場音效已開啟' : '戰場音效已靜音';
    toast(this.enabled ? '🔊 戰場音效已開啟' : '🔇 戰場音效已靜音');
    if (this.enabled) this.init();
    LS.set('db15_sound', this.enabled);
  },
  play(type) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      if (type === 'missile' || type === 'torpedo') {
        // 空對空/反艦飛彈破空音爆
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(280, t);
        osc.frequency.exponentialRampToValueAtTime(1200, t + 0.16);
        osc.frequency.exponentialRampToValueAtTime(140, t + 0.35);
        gain.gain.setValueAtTime(0.09, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.36);
      } else if (type === 'heavy_cannon' || type === 'cannon') {
        // 戰車滑膛砲/大口徑重砲低頻衝擊震波
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(type === 'heavy_cannon' ? 180 : 240, t);
        osc.frequency.exponentialRampToValueAtTime(32, t + 0.28);
        gain.gain.setValueAtTime(0.24, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.31);
      } else if (type === 'rocket_salvo' || type === 'swarm') {
        // 火箭彈齊射/蜂群無人機多重破空
        for (let i = 0; i < 3; i++) {
          const delay = i * 0.06;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(220 + i * 50, t + delay);
          osc.frequency.exponentialRampToValueAtTime(680, t + delay + 0.12);
          gain.gain.setValueAtTime(0.07, t + delay);
          gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.18);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(t + delay);
          osc.stop(t + delay + 0.19);
        }
      } else if (type === 'emp_pulse') {
        // 電子戰全頻干擾脈衝
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(920, t);
        osc.frequency.linearRampToValueAtTime(420, t + 0.22);
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.25);
      } else if (type === 'explosion') {
        // 戰損擊毀大爆炸重低音
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(110, t);
        osc.frequency.exponentialRampToValueAtTime(18, t + 0.42);
        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.44);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.45);
      } else if (type === 'block') {
        // 主動防護 APS 攔截反制破片音
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1300, t);
        osc.frequency.exponentialRampToValueAtTime(450, t + 0.1);
        gain.gain.setValueAtTime(0.14, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.12);
      }
    } catch (e) {}
  }
};

/* ---------- 預設社群幽靈軍武庫 ---------- */
const SEED_GHOSTS = [
  { id: 'g_falcon', callsign: '蒼鷹·艾爾文少校', title: '少校', rating: 1420, wins: 58, losses: 19, deck: ['F22','T72','PANT','TJ','PZH'], doctrine: 'strike', motto: '極致空優先手打擊，防空彈砲合一！', isUser: false },
  { id: 'g_iron', callsign: '鐵幕·伊凡上尉', title: '上尉', rating: 1310, wins: 41, losses: 22, deck: ['FA50','LEO2','PAC3','FREMM','PZH'], doctrine: 'defense', motto: '重裝豹2加上愛國者防空，固若金湯。', isUser: false },
  { id: 'g_shadow', callsign: '深海·海蓮娜少校', title: '少校', rating: 1490, wins: 64, losses: 14, deck: ['EF2K','T90','SAMPT','VA','MQ9'], doctrine: 'deception', motto: '水下核潛刺殺加電戰隱蔽，你抓不到我。', isUser: false },
  { id: 'g_swarm', callsign: '蜂群·莫里斯上尉', title: '上尉', rating: 1260, wins: 33, losses: 26, deck: ['F16V','TOYO','IRON','USV','E7'], doctrine: 'deception', motto: 'E-7 預警機搭配快艇與皮卡，極限以小博大。', isUser: false },
  { id: 'g_viper', callsign: '毒蛇·影狐中校', title: '中校', rating: 1610, wins: 88, losses: 21, deck: ['SU57','K2','HQ9L','T22','TB2'], doctrine: 'strike', motto: '重載超音速截擊加上黑豹穿插，先制點穴。', isUser: false },
  { id: 'g_aegis', callsign: '神盾·霍克上校', title: '上校', rating: 1720, wins: 104, losses: 25, deck: ['F35A','CH3','NASAMS','TJ','EA18'], doctrine: 'deception', motto: '全頻譜咆哮者干擾，雷達屏幕只剩雪花。', isUser: false }
];

function getGhostPool() {
  const p = LS.get('db15_ghost_pool', null);
  if (!p || !p.length) { LS.set('db15_ghost_pool', SEED_GHOSTS); return SEED_GHOSTS.slice(); }
  return p;
}
function saveGhostPool(p) { LS.set('db15_ghost_pool', p); }

const stats = LS.get('db15_stats', { played: 0, win: 0, streak: 0, best: 0, bo3Won: 0 });
const playerGhost = LS.get('db15_player_ghost', { rp: 1000, callsign: '新晉指揮官', rankTitle: '准尉', wins: 0, losses: 0, myGhostDeck: null });

function calcRankTitle(rp) {
  if (rp < 1100) return '准尉';
  if (rp < 1250) return '少尉';
  if (rp < 1400) return '上尉';
  if (rp < 1600) return '少校';
  if (rp < 1800) return '中校';
  if (rp < 2000) return '上校';
  return '五星上將';
}

const savedDeckA = LS.get('db15_deck_A', [null, null, null, null, null]);
const savedDeckB = LS.get('db15_deck_B', [null, null, null, null, null]);
const savedDocA = LS.get('db15_doc_A', 'strike');
const savedDocB = LS.get('db15_doc_B', 'defense');
const activeSlot = LS.get('db15_active_slot', 'A');

const state = {
  mode: 'quick',
  deckSlot: activeSlot,
  dualDecks: { A: savedDeckA, B: savedDeckB },
  dualDocs: { A: savedDocA, B: savedDocB },
  deck: (activeSlot === 'B' ? savedDeckB : savedDeckA).slice(),
  active: 0,
  flexCat: { 3: 'naval', 4: 'support' },
  doctrine: activeSlot === 'B' ? savedDocB : savedDocA,
  scout: false,
  aiArch: 'random', event: null, enemy: null, enemyName: '', enemyDoc: 'defense',
  sandEnemy: 'random', sandEvent: 'all', sandResult: null, hover: null, lastRes: null,
  /* 手機版活躍兵種分頁 */
  mobileCat: 'air',
  /* 每日殘局題目選擇 ('today' 或 DAILY_PLANS 的 id) */
  dailyPlanId: 'today',
  /* 幽靈對戰專屬 */
  ghostTarget: null,
  /* BO3 專屬 */
  bo3: {
    active: false, round: 1, winsA: 0, winsB: 0, history: [],
    rivalName: '', rivalBaseDeck: null, enemyDeck: null, enemyDoc: 'defense',
    bannedByA: null, bannedByB: null, candidateBan: null, nextEvent: null
  }
};
let playToken = 0, speed = 1, skip = false, currentActiveModal = null;

function syncActiveDeck() {
  state.dualDecks[state.deckSlot] = state.deck.slice();
  state.dualDocs[state.deckSlot] = state.doctrine;
  LS.set('db15_deck_' + state.deckSlot, state.deck);
  LS.set('db15_doc_' + state.deckSlot, state.doctrine);
  LS.set('db15_active_slot', state.deckSlot);
}

function switchDeckSlot(slot) {
  if (state.deckSlot === slot) return;
  syncActiveDeck();
  state.deckSlot = slot;
  LS.set('db15_active_slot', slot);
  state.deck = (state.dualDecks[slot] || [null, null, null, null, null]).slice();
  state.doctrine = state.dualDocs[slot] || 'strike';
  renderAll();
  toast(`已切換至【編制 ${slot}】戰備槽位`);
}

function setDoctrine(docId) {
  state.doctrine = docId;
  syncActiveDeck();
  renderCommandDeck();
  const docObj = DOCTRINES.find(d => d.id === docId);
  toast(`已啟用教條：${docObj ? docObj.name : docId}`);
}

/* ---------- 工具 ---------- */
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2400); }
function dateKey() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function dailyNo() { const d = new Date(); return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(2026, 0, 1)) / 864e5) + 1; }
const budgetLimit = () => (state.mode === 'quick' && state.scout ? BUDGET - 1 : BUDGET);
const spent = () => deckCost(state.deck.filter(Boolean));
const slotCat = i => SLOTS[i].fixed || state.flexCat[i];
const sleep = ms => new Promise(r => setTimeout(r, skip ? 0 : ms / speed));
const pick = a => a[Math.floor(Math.random() * a.length)];
const currentBanned = () => (state.mode === 'bo3' && state.bo3.bannedByB ? [state.bo3.bannedByB] : []);

/* ---------- 對手與賽事初始化 ---------- */
function setupMatch() {
  if (state.mode === 'daily') {
    const isToday = state.dailyPlanId === 'today';
    const seedNum = isToday ? hashStr('db15-' + dateKey()) : hashStr('db15-' + dateKey() + '-' + state.dailyPlanId);
    const rng = mulberry32(seedNum);
    state.event = EVENTS[Math.floor(rng() * EVENTS.length)];
    let p = null;
    if (isToday) {
      p = DAILY_PLANS[Math.floor(rng() * DAILY_PLANS.length)];
    } else {
      p = DAILY_PLANS.find(x => x.id === state.dailyPlanId) || DAILY_PLANS[0];
    }
    state.enemy = buildFromPlan(p.plan, rng);
    state.enemyName = p.name;
    state.enemyDoc = DOCTRINES[Math.floor(rng() * 3)].id;
  } else if (state.mode === 'quick') {
    const arch = state.aiArch === 'random' ? pick(ARCHETYPES) : ARCHETYPES.find(a => a.id === state.aiArch);
    state.event = pick(EVENTS);
    state.enemy = buildFromPlan(arch.plan, Math.random);
    state.enemyName = arch.name;
    state.enemyDoc = pick(DOCTRINES).id;
  } else if (state.mode === 'ghost') {
    const pool = getGhostPool();
    state.ghostTarget = state.ghostTarget || pick(pool);
    state.event = pick(EVENTS);
    state.enemy = state.ghostTarget.deck.slice();
    state.enemyName = state.ghostTarget.callsign;
    state.enemyDoc = state.ghostTarget.doctrine;
  } else if (state.mode === 'bo3') {
    if (!state.bo3.active) {
      initBo3Series();
    } else {
      state.event = state.bo3.nextEvent || pick(EVENTS);
      state.enemy = state.bo3.enemyDeck.slice();
      state.enemyName = state.bo3.rivalName;
      state.enemyDoc = state.bo3.enemyDoc;
    }
  } else { state.event = null; state.enemy = null; }
}

function initBo3Series() {
  const rival = pick(SEED_GHOSTS);
  state.bo3 = {
    active: true, round: 1, winsA: 0, winsB: 0, history: [],
    rivalName: rival.callsign, rivalBaseDeck: rival.deck.slice(),
    enemyDeck: rival.deck.slice(), enemyDoc: rival.doctrine,
    bannedByA: null, bannedByB: null, candidateBan: null,
    nextEvent: pick(EVENTS)
  };
  state.event = state.bo3.nextEvent;
  state.enemy = state.bo3.enemyDeck.slice();
  state.enemyName = state.bo3.rivalName;
  state.enemyDoc = state.bo3.enemyDoc;
}

/* ---------- 全景矩陣選兵與戰區動態軍火池 (Market Draft Pool) ---------- */
state.variants = state.variants || {};
state.marketPool = state.marketPool || null;

// 保證可解演算法：隨機產生 5 兵種各 5 筆不同價格與型號的裝備，且保證至少存在 3 組以上 <= 15 的合法陣容
function generateRandomMarketPool() {
  const cats = ['air', 'armor', 'air_defense', 'naval', 'support'];
  const pool = {};
  let attempts = 0;
  let valid = false;

  while (!valid && attempts < 120) {
    attempts++;
    cats.forEach(cat => {
      const allCatUnits = UNITS.filter(u => u.cat === cat);
      // 隨機洗牌，抽取 5 款不重複武器，並按費用與火力排序
      const shuffled = allCatUnits.slice().sort(() => Math.random() - 0.5);
      pool[cat] = shuffled.slice(0, 5).sort((a, b) => b.cost - a.cost || b.atk - a.atk);
    });

    // 檢查可解性
    if (checkPoolSolvable(pool)) {
      valid = true;
    }
  }

  state.marketPool = pool;
  return pool;
}

function checkPoolSolvable(pool) {
  const cats = ['air', 'armor', 'air_defense', 'naval', 'support'];
  if (!pool[cats[0]] || !pool[cats[1]] || !pool[cats[2]] || !pool[cats[3]] || !pool[cats[4]]) return true;
  const c0 = pool[cats[0]].map(u => u.cost);
  const c1 = pool[cats[1]].map(u => u.cost);
  const c2 = pool[cats[2]].map(u => u.cost);
  const c3 = pool[cats[3]].map(u => u.cost);
  const c4 = pool[cats[4]].map(u => u.cost);

  let validCount = 0;
  for (const a of c0) {
    for (const b of c1) {
      if (a + b >= 15) continue;
      for (const c of c2) {
        if (a + b + c >= 15) continue;
        for (const d of c3) {
          if (a + b + c + d >= 15) continue;
          for (const e of c4) {
            const sum = a + b + c + d + e;
            if (sum >= 13 && sum <= 15) {
              validCount++;
              if (validCount >= 3) return true;
            }
          }
        }
      }
    }
  }
  return validCount > 0;
}

function rerollMarketPool() {
  generateRandomMarketPool();
  SoundEngine.play('equip');
  toast('🎲 已隨機調撥 5 大兵種戰區軍火選項！');
  renderAll();
}

function getVariantUnit(cat, cost) {
  const pref = state.variants[`${cat}-${cost}`] || 'A';
  return UNITS.find(u => u.cat === cat && u.cost === cost && u.v === pref) ||
         UNITS.find(u => u.cat === cat && u.cost === cost);
}

function toggleVariant(cat, cost, e) {
  if (e) e.stopPropagation();
  const allVars = UNITS.filter(u => u.cat === cat && u.cost === cost);
  if (!allVars.length) return;
  const equippedInDeck = state.deck.map(id => id ? UNIT_MAP[id] : null).find(unit => unit && unit.cat === cat && unit.cost === cost);
  const cur = equippedInDeck ? equippedInDeck.v : (state.variants[`${cat}-${cost}`] || allVars[0].v);
  const vList = allVars.map(u => u.v);
  const nextIdx = (vList.indexOf(cur) + 1) % vList.length;
  const nxt = vList[nextIdx];
  state.variants[`${cat}-${cost}`] = nxt;
  const newUnit = allVars.find(u => u.v === nxt) || allVars[0];
  if (equippedInDeck && newUnit) {
    const slotIdx = state.deck.indexOf(equippedInDeck.id);
    if (slotIdx >= 0) {
      state.deck[slotIdx] = newUnit.id;
      toast(`已切換為：${newUnit.name} (${newUnit.v}型)`);
    }
  } else if (newUnit) {
    toast(`型號已切換為：${newUnit.name} (${newUnit.v}型)`);
  }
  renderAll();
}

const CAT_TO_SLOT = { air: 0, armor: 1, air_defense: 2, naval: 3, support: 4 };

function resolveTargetSlot(u) {
  // 五大兵種嚴格一對一對應專屬槽位：
  // 0: 制空打擊 (air)
  // 1: 重裝鐵騎 (armor)
  // 2: 區域防空 (air_defense)
  // 3: 制海權威 (naval)
  // 4: 情報／長程打擊 (support)
  return CAT_TO_SLOT[u.cat] !== undefined ? CAT_TO_SLOT[u.cat] : 0;
}

function canPickForSlot(u, targetSlot) {
  if (currentBanned().includes(u.id)) return '戰術禁用';
  const expectedSlot = CAT_TO_SLOT[u.cat];
  if (targetSlot !== expectedSlot) return `限填${CATS[SLOTS[targetSlot].fixed].label}`;
  const existingIdx = state.deck.indexOf(u.id);
  if (existingIdx >= 0 && existingIdx !== targetSlot) return '已裝備';
  const others = state.deck.filter((id, k) => id && k !== targetSlot);
  const cost = deckCost(others);
  if (cost + u.cost > budgetLimit()) return '超出預算';
  return '';
}

function handleMatrixCardClick(u) {
  // 1. 若該裝備本身已在隊伍中，點擊即為卸下
  const existingIdx = state.deck.indexOf(u.id);
  if (existingIdx >= 0) {
    state.deck[existingIdx] = null;
    state.active = existingIdx;
    syncActiveDeck();
    renderAll();
    toast(`已卸下【${u.name}】`);
    return;
  }

  // 2. 若隊伍中已有同兵種同價位的異型裝備（例如選了 B型颱風，點擊該格），點擊也是卸下
  const sameTierIdx = state.deck.findIndex(id => id && UNIT_MAP[id].cat === u.cat && UNIT_MAP[id].cost === u.cost);
  if (sameTierIdx >= 0) {
    const oldU = UNIT_MAP[state.deck[sameTierIdx]];
    state.deck[sameTierIdx] = null;
    state.active = sameTierIdx;
    syncActiveDeck();
    renderAll();
    toast(`已卸下【${oldU.name}】`);
    return;
  }

  // 3. 正常裝備或替換
  const targetSlot = resolveTargetSlot(u);
  const why = canPickForSlot(u, targetSlot);
  if (why) {
    toast(`無法裝備：${why}`);
    return;
  }
  const oldId = state.deck[targetSlot];
  state.deck[targetSlot] = u.id;
  const nxt = state.deck.findIndex(x => !x);
  state.active = nxt >= 0 ? nxt : targetSlot;
  syncActiveDeck();
  renderAll();
  if (oldId) {
    toast(`已將【${UNIT_MAP[oldId].name}】替換為【${u.name}】`);
  } else {
    toast(`已配置【${u.name}】至第 ${targetSlot + 1} 槽位`);
  }
}

/* ---------- 渲染：緊湊戰情橫幅 (Mission Bar) ---------- */
function renderMissionBar() {
  const mb = $('#missionContent');
  if (!mb) return;
  const mode = state.mode;
  let h = '';

  if (mode === 'quick') {
    h = `<span class="mission-tag">RAPID BATTLE · 快速交鋒</span>
      <div class="mission-item">
        <span style="font-size:18px">${state.event.icon}</span>
        <div><b>${esc(state.event.name)}</b> <span class="muted" style="font-size:11.5px">(${esc(state.event.desc)})</span></div>
      </div>
      <div class="mission-item" style="margin-left:10px">
        <span class="muted">AI 風格：</span>
        <select class="select sm" id="aiSel" style="padding:3px 8px;width:auto;font-size:12px">
          <option value="random">隨機對手</option>
          ${ARCHETYPES.map(a => `<option value="${a.id}" ${state.aiArch === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
        </select>
      </div>
      <label class="check" style="margin-left:10px;font-size:12px">
        <input type="checkbox" id="scoutChk" ${state.scout ? 'checked' : ''}>
        <span>情報偵察 (預算 −$1)</span>
      </label>
      ${state.scout ? `<span class="mission-tag" style="color:var(--amber);border-color:rgba(255,179,64,.3)">偵得：${esc(state.enemyName)} · ${esc(UNIT_MAP[state.enemy[state.scoutIdx]].name)}</span>` : ''}`;
  } else if (mode === 'ghost') {
    const t = state.ghostTarget;
    h = `<span class="mission-tag">GHOST MATCH · 全球天梯</span>
      <div class="mission-item">
        <b>${esc(t.callsign)}</b>
        <span class="ghost-rank" style="font-size:11px;padding:1px 6px">${t.title} · ${t.rating} RP</span>
        <span class="muted" style="font-size:11.5px">戰績: ${t.wins}勝 ${t.losses}負 · 「${esc(t.motto)}」</span>
      </div>
      <div class="mission-actions">
        <button class="btn ghost sm" id="btnRerollGhost">換一批對手 🔄</button>
        <button class="btn amber sm" id="btnDeployGhost">部署防守部隊 🌐</button>
      </div>`;
  } else if (mode === 'bo3') {
    const b = state.bo3;
    h = `<span class="mission-tag" style="background:rgba(255,179,64,.18);color:var(--amber);border-color:rgba(255,179,64,.4);font-weight:800">🏆 BO5 征服賽 · 第 ${b.round}/5 局 (五局三勝制)</span>
      <div class="mission-item" style="background:rgba(255,255,255,.06);padding:3px 10px;border-radius:6px;border:1px solid var(--line2)">
        <span style="font-family:var(--head);font-size:16px;font-weight:800;letter-spacing:.05em">當前比分：<b style="color:var(--cyan);font-size:18px">${b.winsA}</b> <span style="color:var(--muted)">-</span> <b style="color:var(--red);font-size:18px">${b.winsB}</b></span>
        <span class="muted" style="margin-left:10px">對手：<b style="color:var(--text)">${esc(b.rivalName)}</b></span>
        ${b.bannedByA ? `<span style="color:var(--green);font-size:11.5px;margin-left:8px;font-weight:700">🚫 你已禁用敵方：${UNIT_MAP[b.bannedByA].name}</span>` : ''}
        ${b.bannedByB ? `<span style="color:var(--red);font-size:11.5px;margin-left:8px;font-weight:700">⚠️ 敵方已禁用你：${UNIT_MAP[b.bannedByB].name}</span>` : ''}
      </div>
      <div class="mission-actions">
        <button class="btn ghost sm" id="btnResetBo3" title="重置比分並配對新對手">重置系列賽 🔄</button>
      </div>`;
  } else if (mode === 'daily') {
    const k = state.dailyPlanId === 'today' ? ('db15_daily_' + dateKey()) : ('db15_daily_' + dateKey() + '_' + state.dailyPlanId);
    const rec = LS.get(k, null);
    h = `<span class="mission-tag">DAILY TACTICS · 每日殘局 #${dailyNo()}</span>
      <div class="mission-item">
        <span class="muted">選擇殘局：</span>
        <select class="select sm" id="dailyPlanSel" style="padding:3px 8px;width:auto;font-size:12px;font-weight:700">
          <option value="today" ${state.dailyPlanId === 'today' ? 'selected' : ''}>🌟 今日官方特選題目</option>
          ${DAILY_PLANS.map(dp => `<option value="${dp.id}" ${state.dailyPlanId === dp.id ? 'selected' : ''}>${dp.name} ($19超標)</option>`).join('')}
        </select>
      </div>
      <div class="mission-item" style="margin-left:8px">
        <span>對手：<b style="color:var(--amber)">$${deckCost(state.enemy)}</b>（${esc(state.enemyName)}）</span>
        <span class="muted" style="margin-left:8px">教條: ${esc(DOCTRINES.find(d => d.id === state.enemyDoc).name)}</span>
        ${rec ? `<span style="margin-left:8px" class="${rec.won ? 'badge-ok' : 'badge-no'}">${rec.won ? '✔ 已破局' : '尚未破局'} (${rec.tries}次)</span>` : ''}
      </div>`;
  } else if (mode === 'sandbox') {
    h = `<span class="mission-tag">SANDBOX · 大數據模擬</span>
      <div class="mission-item">
        <span class="muted">對手風格：</span>
        <select class="select sm" id="sandEnemy" style="padding:3px 8px;width:auto;font-size:12px">
          <option value="random">全部風格輪流</option>
          ${ARCHETYPES.map(a => `<option value="${a.id}" ${state.sandEnemy === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
        </select>
        <span class="muted" style="margin-left:8px">戰場事件：</span>
        <select class="select sm" id="sandEvent" style="padding:3px 8px;width:auto;font-size:12px">
          <option value="all">全部事件輪替</option>
          ${EVENTS.map(e => `<option value="${e.id}" ${state.sandEvent === e.id ? 'selected' : ''}>${e.name}</option>`).join('')}
        </select>
      </div>`;
  }
  mb.innerHTML = h;
}

/* ---------- 渲染：手機專屬兵種切換分頁導覽列 ---------- */
function renderMobileCatNav() {
  const nav = $('#mobileCatNav');
  if (!nav) return;
  const cats = ['air', 'armor', 'air_defense', 'naval', 'support'];
  nav.innerHTML = cats.map(cat => {
    const uInDeck = state.deck.map(id => id ? UNIT_MAP[id] : null).find(u => u && u.cat === cat);
    const isActive = (state.mobileCat || 'air') === cat;
    return `<button class="m-tab ${isActive ? 'active' : ''}" data-mobile-cat="${cat}" style="--c:${CATS[cat].color}">
      <div class="m-tab-title">${ICON[cat]} <span>${CATS[cat].short}</span></div>
      <span class="m-tab-badge ${uInDeck ? 'on' : ''}">${uInDeck ? '$' + uInDeck.cost : '−'}</span>
    </button>`;
  }).join('');
}

/* ---------- 渲染：5x5 全景矩陣看板 (Matrix Board) ---------- */
function renderMatrix() {
  renderMobileCatNav();
  const mb = $('#matrixBoard');
  if (!mb) return;
  const cats = ['air', 'armor', 'air_defense', 'naval', 'support'];
  const catSlots = { air: '制空槽', armor: '裝甲槽', air_defense: '防空槽', naval: '制海槽', support: '支援槽' };

  if (!state.marketPool) {
    generateRandomMarketPool();
  }

  mb.innerHTML = cats.map(cat => {
    const c = CATS[cat].color;
    const isMobileActive = (state.mobileCat || 'air') === cat;

    // 取得當前兵種隨機抽出的 5 筆武器選項
    let displayUnits = state.marketPool[cat] || [];

    // 確保已在隊伍中的該兵種武器必定在畫面上可見
    const equippedInDeck = state.deck.map(id => id ? UNIT_MAP[id] : null).find(unit => unit && unit.cat === cat);
    if (equippedInDeck && !displayUnits.some(u => u.id === equippedInDeck.id)) {
      displayUnits = [equippedInDeck, ...displayUnits.slice(0, 4)].sort((a, b) => b.cost - a.cost || b.atk - a.atk);
    }

    const cardsHtml = displayUnits.map(u => {
      const isEquipped = state.deck.includes(u.id);
      const isBanned = currentBanned().includes(u.id);
      const targetSlot = isEquipped ? state.deck.indexOf(u.id) : resolveTargetSlot(u);
      const why = canPickForSlot(u, targetSlot);

      return `<div class="m-card ${isEquipped ? 'sel' : ''} ${why && !isEquipped ? 'dis' : ''} ${isBanned ? 'banned' : ''}"
                   style="--c:${c}" data-id="${u.id}" data-cat="${cat}" data-cost="${u.cost}">
        ${u.img ? `<img class="m-card-photo" src="${u.img}" loading="lazy" alt="${esc(u.name)}" onerror="this.style.display='none'" />` : ''}
        <div class="m-top">
          <span class="m-cost">$${u.cost}</span>
          <div class="m-name-group">
            <div class="m-name" title="${esc(u.name)}"><span class="m-flag" style="margin-right:2px">${u.flag || ''}</span> ${esc(u.name)}</div>
            <div class="m-tag">${esc(u.tag)}</div>
          </div>
          <div class="m-actions">
            <button class="m-var-toggle" data-cat="${cat}" data-cost="${u.cost}" title="切換同價位其他型號 (A/B/C/D)">
              ${u.v}型 ▾
            </button>
            <button class="m-info-btn" data-info-id="${u.id}" title="查看裝備詳細情報">ℹ</button>
          </div>
        </div>
        <div class="m-bot">
          <div class="m-stats">
            <span>HP <b>${u.hp}</b></span>
            <span>ATK <b>${u.atk}</b></span>
            <span>${u.ew > u.st ? 'EW' : 'STH'} <b>${Math.max(u.ew, u.st)}</b></span>
          </div>
          ${why && !isEquipped ? `<span class="m-why">${why}</span>` : ''}
        </div>
      </div>`;
    }).join('');

    return `<div class="col-category ${isMobileActive ? 'mobile-active' : ''}" style="--c:${c}" data-cat="${cat}">
      <div class="cat-head">
        <div class="cat-title">${ICON[cat]} <span>${CATS[cat].label}</span></div>
        <div class="cat-sub">${CATS[cat].short} · ${catSlots[cat]}</div>
      </div>
      ${cardsHtml}
    </div>`;
  }).join('');
}

/* ---------- 懸浮詳細情報 Tooltip (真實寬屏寫真展台) ---------- */
const tooltip = $('#unitTooltip');
function showTooltip(u, x, y) {
  if (!u || !tooltip) return;
  const isBanned = currentBanned().includes(u.id);
  tooltip.innerHTML = `
    <div class="u-tt-header">
      ${u.img ? `<img class="u-tt-img" src="${u.img}" alt="${esc(u.name)}" onerror="this.style.display='none'" />` : ''}
      <div class="u-tt-overlay">
        <h4><span>${u.flag || '🌐'}</span> ${esc(u.name)} ${isBanned ? '<span style="color:var(--red);font-size:11px">(已禁)</span>' : ''}</h4>
        <div class="u-tt-sub">${esc(u.origin || '')} · $${u.cost} · ${u.v} 型 · ${esc(u.tag)}</div>
      </div>
    </div>
    <div class="u-tt-body">
      ${u.weapon ? `<div class="u-tt-weapon-box"><span>🎯 主武裝:</span> <b>${esc(u.weapon)}</b></div>` : ''}
      <p class="u-tt-desc">${esc(u.desc)}</p>
      <dl>
        <dt>耐久 HP</dt><dd>${u.hp}</dd>
        <dt>打擊 ATK</dt><dd>${u.atk}</dd>
        <dt>隱匿值</dt><dd>${u.st}</dd>
        <dt>電戰值</dt><dd>${u.ew}</dd>
        <dt>減傷防禦</dt><dd>${Math.round(u.def * 100)}%</dd>
      </dl>
      ${u.traits && u.traits.length ? `<ul>${u.traits.map(t => `<li>${esc(TRAITS[t])}</li>`).join('')}</ul>` : ''}
    </div>`;

  const pad = 18;
  const tw = 336, th = 380;
  let posX = x + pad;
  let posY = y + pad;
  if (posX + tw > window.innerWidth - 10) posX = x - tw - pad;
  if (posX < 10) posX = 10;
  if (posY + th > window.innerHeight - 10) posY = Math.max(10, window.innerHeight - th - 10);
  tooltip.style.left = `${posX}px`;
  tooltip.style.top = `${posY}px`;
  tooltip.hidden = false;
}
function hideTooltip() { if (tooltip) tooltip.hidden = true; }

/* ---------- 隊伍風格即時分析雷達 (Combat Archetype Radar) ---------- */
function analyzeDeckArchetype(deck) {
  const units = deck.filter(Boolean).map(id => UNIT_MAP[id]);
  if (units.length < 3) {
    return { name: '戰力籌備中', icon: '⚙️', desc: '請挑選至少 3 個槽位裝備', detail: '部隊尚未成型，請繼續在上方各兵種中挑選適合的作戰單位。' };
  }
  
  const totalCost = deckCost(deck.filter(Boolean));
  const avgStealth = units.reduce((s, u) => s + u.st, 0) / units.length;
  const avgHp = units.reduce((s, u) => s + u.hp, 0) / units.length;
  const avgEw = units.reduce((s, u) => s + u.ew, 0) / units.length;
  const avgAtk = units.reduce((s, u) => s + u.atk, 0) / units.length;
  
  const hasStar5 = units.some(u => u.cost === 5);
  const onesCount = units.filter(u => u.cost === 1).length;
  const airUnit = units.find(u => u.cat === 'air');
  const armorUnit = units.find(u => u.cat === 'armor');
  const adUnit = units.find(u => u.cat === 'air_defense');
  const navUnit = units.find(u => u.cat === 'naval');
  const supUnit = units.find(u => u.cat === 'support');

  // 1. 隱身刺殺流
  if (avgStealth >= 50 || (airUnit && airUnit.st >= 80)) {
    return { name: '隱匿突防刺殺流', icon: '🎯', desc: '雷達低可探測，先制狙殺高價旗艦', detail: '以高度隱匿裝備突防敵方警戒圈，第一時間點穴瓦解敵方關鍵制空與防空節點。' };
  }
  // 2. 電磁壓制流
  if (avgEw >= 36 || (supUnit && supUnit.ew >= 65)) {
    return { name: '全頻電磁干擾流', icon: '📡', desc: '奪取電磁主動權，壓制敵精準射控', detail: '以強大的電戰機與干擾莢艙阻斷敵方指揮鏈，大幅削弱敵方全體命中率與射控導引。' };
  }
  // 3. 鋼鐵重裝要塞流
  if (avgHp >= 200 || (armorUnit && armorUnit.cost === 5 && armorUnit.hp >= 300)) {
    return { name: '鋼鐵要塞推進流', icon: '🛡️', desc: '極高抗揍裝甲，地面殘局穩操勝券', detail: '依托重型主戰坦克與厚實裝甲防線，能硬抗猛烈打擊並在地面決戰階段奪取高額控制分。' };
  }
  // 4. 遠程飽和打擊流
  if (supUnit && (supUnit.traits.includes('strike') || supUnit.cost >= 4) && avgAtk >= 82) {
    return { name: '飽和火力覆蓋流', icon: '🚀', desc: '縱深火箭火砲，覆蓋式洗滅敵陣', detail: '以長程精準火箭與大口徑自走砲實施超地平線覆蓋射擊，在第一、二階段造成大量面殺傷。' };
  }
  // 5. 區域穹頂防空流
  if (adUnit && adUnit.cost >= 4) {
    return { name: '區域穹頂拒止流', icon: '🌐', desc: '長程地空飛彈，封鎖空域獵殺戰機', detail: '建構梯次密集的防空攔截網，徹底剝奪敵方空中密接支援（CAS）與戰機生存空間。' };
  }
  // 6. 旗艦刺蝟游擊流（$5 帶多個 $1）
  if (hasStar5 && onesCount >= 2) {
    return { name: '旗艦刺蝟游擊流', icon: '⚡', desc: '明星旗艦領銜，平民蜂群靈活掩護', detail: '以極致戰力的頂級旗艦作為主要戰略錨點，輔以多組廉價載具分攤傷害並提供牽制。' };
  }
  // 7. 均衡聯合作戰流
  return { name: '均衡聯合作戰流', icon: '🎖️', desc: '五大兵種平衡，適配各種突發天候', detail: '陸海空天電全維度均衡配置，無明顯兵種弱點，面對任何隨機戰場事件皆有優秀適應力。' };
}

/* ---------- 渲染：底部常駐指揮台 (Command Deck) ---------- */
function renderCommandDeck() {
  const cd = $('#commandDeck');
  if (!cd) return;
  const used = spent(), lim = budgetLimit();
  $('#budgetUsed').textContent = used;
  $('#budgetMax').textContent = lim;
  $('.budget-digits').classList.toggle('over', used > lim);
  $('#budgetMiniBar').innerHTML = Array.from({ length: lim }, (_, i) => `<i class="${i < used ? 'on' : ''}"></i>`).join('');

  // A/B 雙陣容按鈕狀態
  $('#btnDeckA')?.classList.toggle('active', state.deckSlot === 'A');
  $('#btnDeckB')?.classList.toggle('active', state.deckSlot === 'B');

  // 槽位已選計數膠囊
  const filledCount = state.deck.filter(Boolean).length;
  const pill = $('#slotsPill');
  if (pill) {
    pill.textContent = `${filledCount}/5 槽位`;
    pill.classList.toggle('ready', filledCount === 5);
  }

  // 底部 5 槽位縮影指示器（若 DOM 存在才渲染）
  const ds = $('#deckSlots');
  if (ds) {
    ds.innerHTML = SLOTS.map((s, i) => {
      const id = state.deck[i], u = id ? UNIT_MAP[id] : null;
      const cat = u ? u.cat : (s.fixed || (i === 3 ? 'naval' : 'support'));
      const isAct = i === state.active;
      return `<div class="d-slot ${u ? 'filled' : ''} ${isAct ? 'active' : ''}" data-slot="${i}" title="${u ? esc(u.name) : '點擊設定此槽位'}">
        <div class="d-slot-top">
          <span>${esc(s.label.split(' ')[0])}</span>
          ${u ? `<span class="d-slot-cost">$${u.cost}</span>` : ''}
        </div>
        <div class="d-slot-name" style="color:${u ? CATS[cat].color : 'var(--muted)'}">${u ? esc(u.name) : '未選取'}</div>
        ${u ? `<button class="d-slot-clear" data-clear-slot="${i}" title="卸下">✕</button>` : ''}
      </div>`;
    }).join('');
  }

  // 戰術教條快捷切換
  $('#docToggles').innerHTML = DOCTRINES.map(d =>
    `<button class="doc-btn ${state.doctrine === d.id ? 'on' : ''}" data-doc="${d.id}" title="${esc(d.desc)}">
      <span>${d.icon}</span> <span>${esc(d.name)}</span>
    </button>`).join('');

  // 經典陣容下拉選單清單
  $('#tplMenu').innerHTML = TEMPLATES.map((t, idx) =>
    `<button class="menu-item" data-tpl="${idx}">
      <span>${esc(t.name)}</span>
      <small>$${deckCost(t.ids)}</small>
    </button>`).join('');

  // 預算結餘 / 滿額效率標籤
  const effEl = $('#budgetEff');
  if (effEl) {
    if (used === lim) {
      effEl.textContent = '滿額 100%';
      effEl.className = 'budget-eff-tag full';
    } else if (used > lim) {
      effEl.textContent = `超標 $${used - lim}`;
      effEl.className = 'budget-eff-tag over';
    } else {
      effEl.textContent = `結餘 $${lim - used}`;
      effEl.className = 'budget-eff-tag';
    }
  }

  // 提示與開戰大按鈕
  const full = state.deck.every(Boolean);
  const errs = full ? validateDeck(state.deck, budgetLimit(), currentBanned()) : [];
  const missing = state.deck.filter(x => !x).length;
  const hintEl = $('#deckHint');
  const btnGo = $('#btnGo');
  const isReady = full && errs.length === 0;

  btnGo.disabled = !isReady;
  btnGo.classList.toggle('status-ready', isReady);
  btnGo.classList.toggle('status-missing', !isReady && missing > 0);
  btnGo.classList.toggle('status-error', !isReady && missing === 0 && errs.length > 0);

  const launchTitle = $('#launchTitle');
  const launchSub = $('#launchSub');
  const launchIcon = $('#launchIcon');

  if (launchTitle && launchSub) {
    if (isReady) {
      if (state.mode === 'sandbox') {
        if (launchIcon) launchIcon.textContent = '⚡';
        launchTitle.textContent = '開 始 300 場 模 擬';
      } else if (state.mode === 'bo3') {
        if (launchIcon) launchIcon.textContent = '🏆';
        launchTitle.textContent = `第 ${state.bo3.round} 局 開 戰 (${state.bo3.winsA}-${state.bo3.winsB})`;
      } else {
        if (launchIcon) launchIcon.textContent = '⚔️';
        launchTitle.textContent = '開 始 聯 合 作 戰';
      }
      launchSub.textContent = '陣容就緒 · SPACE / ENTER';
    } else if (errs.length > 0 && missing === 0) {
      if (launchIcon) launchIcon.textContent = '🚫';
      launchTitle.textContent = '預 算 超 額';
      launchSub.textContent = errs[0];
    } else {
      if (launchIcon) launchIcon.textContent = '⏳';
      launchTitle.textContent = `尚 缺 ${missing} 個 槽 位`;
      launchSub.textContent = '點擊上方槽位選取 · 或按 R 隨機補滿';
    }
  }

  if (hintEl) {
    if (missing > 0) {
      hintEl.textContent = `尚缺 ${missing} 個槽位`;
      hintEl.className = 'deck-hint';
    } else if (errs.length > 0) {
      hintEl.textContent = errs[0];
      hintEl.className = 'deck-hint warn';
    } else {
      hintEl.textContent = '陣容就緒，隨時可戰！';
      hintEl.className = 'deck-hint ready';
    }
  }
}

function renderHud() {
  $('#hudStats').innerHTML = `<span class="chip-stat">場次 <b>${stats.played}</b></span><span class="chip-stat">勝率 <b>${stats.played ? Math.round(stats.win / stats.played * 100) : 0}%</b></span><span class="chip-stat">連勝 <b>${stats.streak}</b></span><span class="chip-stat" title="非同步天梯軍銜">天梯 <b>${playerGhost.rankTitle}</b></span>`;
}

function renderAll() {
  renderMissionBar();
  renderMatrix();
  renderCommandDeck();
  renderHud();
}

/* ---------- 手機版專屬：裝備詳細情報抽屜 ---------- */
function openUnitDetailModal(u) {
  const modal = $('#unitDetailModal');
  const card = $('#unitSheetCard');
  if (!modal || !card) return;
  const isEquipped = state.deck.includes(u.id);
  const isBanned = currentBanned().includes(u.id);
  const targetSlot = isEquipped ? state.deck.indexOf(u.id) : resolveTargetSlot(u);
  const why = canPickForSlot(u, targetSlot);
  const c = CATS[u.cat].color;

  card.innerHTML = `
    <div class="sheet-head" style="--c:${c}">
      <div class="sheet-unit-title">
        <span style="display:inline-flex;width:20px;height:20px;color:${c}">${ICON[u.cat]}</span>
        <h3>${CATS[u.cat].label} · 詳細情報</h3>
      </div>
      <button class="sheet-close" id="btnUnitSheetClose">✕</button>
    </div>
    <div class="sheet-unit-meta" style="--c:${c}">
      <div>
        <div class="sheet-unit-name"><span>${u.flag || ''}</span> ${esc(u.name)} ${isBanned ? '<span style="color:var(--red);font-size:12px">[BANNED]</span>' : ''}</div>
        <div class="sheet-unit-tag">${esc(u.origin || '')} · ${esc(u.tag)} · <b>${u.v} 型</b></div>
      </div>
      <span class="sheet-unit-cost">$${u.cost}</span>
    </div>
    ${u.img ? `<div style="height:120px;border-radius:8px;overflow:hidden;margin:8px 0 10px;border:1px solid var(--line2);background:#020617"><img src="${u.img}" style="width:100%;height:100%;object-fit:cover" alt="${esc(u.name)}" onerror="this.parentElement.style.display='none'"/></div>` : ''}
    ${u.weapon ? `<div class="u-tt-weapon-box" style="margin-bottom:10px"><span>🎯 主武裝:</span> <b>${esc(u.weapon)}</b></div>` : ''}
    <div class="sheet-unit-desc" style="--c:${c}">${esc(u.desc)}</div>
    <div class="sheet-label">作戰參數評級</div>
    <div class="sheet-stats-grid">
      <div class="sheet-stat-box"><span>耐久 HP</span><b>${u.hp}</b></div>
      <div class="sheet-stat-box"><span>打擊 ATK</span><b>${u.atk}</b></div>
      <div class="sheet-stat-box"><span>隱匿值</span><b>${u.st}</b></div>
      <div class="sheet-stat-box"><span>電戰值</span><b>${u.ew}</b></div>
      <div class="sheet-stat-box" style="grid-column:span 2"><span>裝甲減傷</span><b>${Math.round(u.def * 100)}%</b></div>
    </div>
    ${u.traits && u.traits.length ? `
      <div class="sheet-label">特長能力 (TRAITS)</div>
      <div class="sheet-traits-list">
        ${u.traits.map(t => `<div class="sheet-trait-item"><b>▸</b>${esc(TRAITS[t])}</div>`).join('')}
      </div>` : ''}
    <div style="display:flex;gap:8px;margin-top:16px">
      <button class="btn ghost sm" id="btnSheetToggleVar" data-cat="${u.cat}" data-cost="${u.cost}" style="flex:1">
        切換為 ${u.v === 'A' ? 'B' : 'A'} 型
      </button>
      ${isEquipped ? `
        <button class="btn ghost sm" id="btnSheetEquip" data-id="${u.id}" style="flex:2;color:var(--red);border-color:rgba(255,93,110,.4)">
          從編制卸下 (回收 $${u.cost})
        </button>
      ` : `
        <button class="btn primary sm" id="btnSheetEquip" data-id="${u.id}" ${why ? 'disabled' : ''} style="flex:2">
          ${why ? `無法裝備：${why}` : `裝備至第 ${targetSlot + 1} 槽位 ($${u.cost})`}
        </button>
      `}
    </div>
  `;
  modal.hidden = false;
}

/* ---------- 手機版專屬：戰術司令部配置抽屜 ---------- */
function openDeckMoreModal() {
  const modal = $('#deckMoreModal');
  if (!modal) return;
  // 渲染教條
  $('#docSheetList').innerHTML = DOCTRINES.map(d => `
    <div class="doc-sheet-item ${state.doctrine === d.id ? 'on' : ''}" data-sheet-doc="${d.id}">
      <b><span>${d.icon}</span> ${esc(d.name)}</b>
      <small>${esc(d.desc)}</small>
    </div>
  `).join('');
  // 渲染推薦陣容
  $('#tplSheetList').innerHTML = TEMPLATES.map((t, idx) => `
    <div class="tpl-sheet-item" data-sheet-tpl="${idx}">
      <b>${esc(t.name)}</b>
      <span>$${deckCost(t.ids)} 預算</span>
    </div>
  `).join('');
  modal.hidden = false;
}

/* ---------- 互動事件綁定 ---------- */
// 手機版頂部兵種分頁切換
$('#mobileCatNav')?.addEventListener('click', e => {
  const tab = e.target.closest('[data-mobile-cat]');
  if (tab) {
    state.mobileCat = tab.dataset.mobileCat;
    renderMatrix();
  }
});

// 矩陣看板滑動手勢切換兵種 (Touch Swipe)
const CAT_SEQUENCE = ['air', 'armor', 'air_defense', 'naval', 'support'];
let touchStartX = 0, touchStartY = 0;
const boardEl = $('#matrixBoard');
if (boardEl) {
  boardEl.addEventListener('touchstart', e => {
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  }, { passive: true });

  boardEl.addEventListener('touchend', e => {
    if (e.changedTouches.length === 1) {
      const deltaX = e.changedTouches[0].clientX - touchStartX;
      const deltaY = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(deltaX) > 42 && Math.abs(deltaX) > Math.abs(deltaY) * 1.4) {
        const curIdx = CAT_SEQUENCE.indexOf(state.mobileCat || 'air');
        if (deltaX < 0 && curIdx < CAT_SEQUENCE.length - 1) {
          state.mobileCat = CAT_SEQUENCE[curIdx + 1];
          renderMatrix();
        } else if (deltaX > 0 && curIdx > 0) {
          state.mobileCat = CAT_SEQUENCE[curIdx - 1];
          renderMatrix();
        }
      }
    }
  }, { passive: true });
}

// 矩陣卡片點擊、型號切換與懸停
$('#matrixBoard').addEventListener('click', e => {
  const infoBtn = e.target.closest('.m-info-btn');
  if (infoBtn) {
    e.stopPropagation();
    const u = UNIT_MAP[infoBtn.dataset.infoId];
    if (u) openUnitDetailModal(u);
    return;
  }
  const vBtn = e.target.closest('.m-var-toggle');
  if (vBtn) {
    toggleVariant(vBtn.dataset.cat, +vBtn.dataset.cost, e);
    return;
  }
  const card = e.target.closest('.m-card');
  if (!card) return;
  const u = UNIT_MAP[card.dataset.id];
  if (u) handleMatrixCardClick(u);
});

$('#matrixBoard').addEventListener('mousemove', e => {
  const card = e.target.closest('.m-card');
  if (!card) { hideTooltip(); return; }
  const u = UNIT_MAP[card.dataset.id];
  if (u) showTooltip(u, e.clientX, e.clientY);
});
$('#matrixBoard').addEventListener('mouseleave', hideTooltip);

// 手機版裝備詳細情報抽屜事件
$('#unitDetailModal')?.addEventListener('click', e => {
  if (e.target.id === 'unitDetailModal' || e.target.id === 'btnUnitSheetClose' || e.target.closest('#btnUnitSheetClose')) {
    $('#unitDetailModal').hidden = true;
    return;
  }
  const toggleBtn = e.target.closest('#btnSheetToggleVar');
  if (toggleBtn) {
    const cat = toggleBtn.dataset.cat;
    const cost = +toggleBtn.dataset.cost;
    toggleVariant(cat, cost);
    const newU = getVariantUnit(cat, cost);
    openUnitDetailModal(newU);
    return;
  }
  const equipBtn = e.target.closest('#btnSheetEquip');
  if (equipBtn && equipBtn.dataset.id) {
    const u = UNIT_MAP[equipBtn.dataset.id];
    if (u) {
      handleMatrixCardClick(u);
      $('#unitDetailModal').hidden = true;
    }
    return;
  }
});

// 手機版戰術司令部配置抽屜事件
$('#deckMoreModal')?.addEventListener('click', e => {
  if (e.target.id === 'deckMoreModal' || e.target.id === 'btnDeckSheetClose') {
    $('#deckMoreModal').hidden = true;
    return;
  }
  const docItem = e.target.closest('[data-sheet-doc]');
  if (docItem) {
    state.doctrine = docItem.dataset.sheetDoc;
    renderCommandDeck();
    openDeckMoreModal();
    const docObj = DOCTRINES.find(d => d.id === state.doctrine);
    toast(`已切換戰術教條：${docObj.name}`);
    return;
  }
  const tplItem = e.target.closest('[data-sheet-tpl]');
  if (tplItem) {
    const t = TEMPLATES[+tplItem.dataset.sheetTpl];
    if (deckCost(t.ids) > budgetLimit()) {
      toast('此陣容超出目前預算限制');
      return;
    }
    state.deck = t.ids.slice();
    state.active = 0;
    renderAll();
    $('#deckMoreModal').hidden = true;
    toast(`已套用推薦陣容：${t.name}`);
    return;
  }
  if (e.target.id === 'sheetBtnCopy') {
    if (!state.deck.every(Boolean)) { toast('請先配置滿 5 個槽位再複製代碼'); return; }
    copyText(encodeDeck(state.deck));
    toast('陣容代碼已複製：' + encodeDeck(state.deck));
    $('#deckMoreModal').hidden = true;
    return;
  }
  if (e.target.id === 'sheetBtnImport') {
    $('#deckMoreModal').hidden = true;
    $('#codeInput').value = '';
    $('#codeErr').textContent = '';
    $('#codeModal').hidden = false;
    $('#codeInput').focus();
    return;
  }
  if (e.target.id === 'sheetBtnClear') {
    state.deck = [null, null, null, null, null];
    state.active = 0;
    renderAll();
    $('#deckMoreModal').hidden = true;
    toast('已清空所有槽位');
    return;
  }
});

// 底部指揮台點擊
$('#commandDeck').addEventListener('click', e => {
  const abBtn = e.target.closest('[data-ab]');
  if (abBtn) {
    switchDeckSlot(abBtn.dataset.ab);
    return;
  }
  const clr = e.target.closest('[data-clear-slot]');
  if (clr) {
    e.stopPropagation();
    const idx = +clr.dataset.clearSlot;
    state.deck[idx] = null;
    state.active = idx;
    syncActiveDeck();
    renderAll();
    return;
  }
  const slot = e.target.closest('[data-slot]');
  if (slot) {
    state.active = +slot.dataset.slot;
    renderCommandDeck();
    return;
  }
  const doc = e.target.closest('[data-doc]');
  if (doc) {
    state.doctrine = doc.dataset.doc;
    syncActiveDeck();
    renderCommandDeck();
    const docObj = DOCTRINES.find(d => d.id === state.doctrine);
    toast(`已切換戰術教條：${docObj ? docObj.name : state.doctrine}`);
    return;
  }
  if (e.target.closest('#btnDeckMore')) {
    openDeckMoreModal();
    return;
  }
  if (e.target.closest('#btnRand')) {
    const locked = state.deck.slice();
    const d = randomDeck(Math.random, budgetLimit(), locked) || randomDeck(Math.random, budgetLimit(), []);
    if (d) {
      state.deck = d;
      syncActiveDeck();
      renderAll();
      toast('已隨機補滿陣容');
    } else {
      toast('無法隨機補滿，請先清空或卸下高價裝備');
    }
    return;
  }
  if (e.target.closest('#btnClear')) {
    state.deck = [null, null, null, null, null];
    state.active = 0;
    syncActiveDeck();
    renderAll();
    toast('已清空所有槽位');
    return;
  }
  if (e.target.closest('#btnTplToggle')) {
    $('#tplMenu').hidden = !$('#tplMenu').hidden;
    $('#codeMenu').hidden = true;
    return;
  }
  if (e.target.closest('#btnCodeToggle')) {
    $('#codeMenu').hidden = !$('#codeMenu').hidden;
    $('#tplMenu').hidden = true;
    return;
  }
  const tplItem = e.target.closest('[data-tpl]');
  if (tplItem) {
    const ids = TEMPLATES[+tplItem.dataset.tpl].ids.slice();
    if (deckCost(ids) > budgetLimit()) { toast('此陣容超出目前預算限制'); return; }
    state.deck = ids;
    state.active = 0;
    $('#tplMenu').hidden = true;
    renderAll();
    toast('已載入推薦陣容：' + TEMPLATES[+tplItem.dataset.tpl].name);
    return;
  }
  if (e.target.closest('#btnCopyCode')) {
    $('#codeMenu').hidden = true;
    if (!state.deck.every(Boolean)) { toast('請先配置滿 5 個槽位再複製代碼'); return; }
    copyText(encodeDeck(state.deck));
    toast('陣容代碼已複製：' + encodeDeck(state.deck));
    return;
  }
  if (e.target.closest('#btnImportCode')) {
    $('#codeMenu').hidden = true;
    $('#codeInput').value = '';
    $('#codeErr').textContent = '';
    $('#codeModal').hidden = false;
    $('#codeInput').focus();
    return;
  }
  if (e.target.closest('#btnGo')) {
    state.mode === 'sandbox' ? runSandbox() : startBattle();
    return;
  }
});

// 點擊空白處關閉選單
document.addEventListener('click', e => {
  if (!e.target.closest('#tplDropdownWrap')) { const m = $('#tplMenu'); if (m) m.hidden = true; }
  if (!e.target.closest('#codeDropdownWrap')) { const m = $('#codeMenu'); if (m) m.hidden = true; }
});

// 橫幅事件代理
$('#missionBar').addEventListener('click', e => {
  if (e.target.closest('#btnRerollGhost')) {
    const pool = getGhostPool();
    state.ghostTarget = pick(pool.filter(g => g.id !== (state.ghostTarget && state.ghostTarget.id)));
    setupMatch(); renderAll(); toast('已為你配對新幽靈對手：' + state.ghostTarget.callsign); return;
  }
  if (e.target.closest('#btnDeployGhost')) {
    if (!state.deck.every(Boolean)) { toast('請先配置滿 5 個槽位再部署防衛幽靈！'); return; }
    openDeployGhostModal(); return;
  }
  if (e.target.closest('#btnResetBo3')) {
    initBo3Series(); renderAll(); toast('已重置 BO5 征服系列賽'); return;
  }
});
$('#missionBar').addEventListener('change', e => {
  if (e.target.id === 'aiSel') {
    state.aiArch = e.target.value; setupMatch();
    if (state.scout) state.scoutIdx = Math.floor(Math.random() * 5);
    renderMissionBar();
  }
  if (e.target.id === 'scoutChk') {
    state.scout = e.target.checked;
    if (state.scout) {
      state.scoutIdx = Math.floor(Math.random() * 5);
      if (spent() > budgetLimit()) { prune(); toast('情報偵察需花費 $1，已自動移除超額裝備'); }
    }
    renderAll();
  }
  if (e.target.id === 'dailyPlanSel') {
    state.dailyPlanId = e.target.value;
    setupMatch();
    renderAll();
    const planName = state.dailyPlanId === 'today' ? '今日官方特選題目' : (DAILY_PLANS.find(p => p.id === state.dailyPlanId)?.name || '');
    toast(`已切換殘局題目：${planName}`);
  }
  if (e.target.id === 'sandEnemy') state.sandEnemy = e.target.value;
  if (e.target.id === 'sandEvent') state.sandEvent = e.target.value;
});

/* ---------- 模式切換與預算修剪 ---------- */
$('#modeTabs').addEventListener('click', e => {
  const b = e.target.closest('[data-mode]'); if (!b) return;
  setMode(b.dataset.mode);
});

function setMode(m) {
  state.mode = m; state.sandResult = null; state.scout = false;
  document.querySelectorAll('.mode-btn').forEach(x => x.classList.toggle('active', x.dataset.mode === m));
  prune(); setupMatch(); renderAll();
  if (m === 'bo3') {
    toast(`🏆 已進入 BO5 征服賽：五局三勝制！配對對手【${state.bo3.rivalName}】，輸掉該局之一方可啟動戰術反制，禁用對方關鍵裝備！`);
  }
}

function prune() {
  while (spent() > budgetLimit()) {
    const idx = state.deck.map((id, i) => id ? i : -1).filter(i => i >= 0).sort((a, b) => UNIT_MAP[state.deck[b]].cost - UNIT_MAP[state.deck[a]].cost)[0];
    if (idx >= 0) state.deck[idx] = null;
    else break;
  }
}

/* ---------- 幽靈部隊部署 Modal ---------- */
function openDeployGhostModal() {
  $('#ghostCallsignInput').value = playerGhost.callsign;
  $('#ghostMottoInput').value = '立足國防，誓死捍衛！';
  $('#ghostDeployPreview').innerHTML = `<div class="ghost-card">
    <div class="ghost-top"><b>${esc(playerGhost.callsign)}</b><span class="ghost-rank">${playerGhost.rankTitle} · ${playerGhost.rp} RP</span></div>
    <div class="ghost-deck">${state.deck.map(id => `<span class="ghost-u" style="color:${CATS[UNIT_MAP[id].cat].color}">$${UNIT_MAP[id].cost} ${esc(UNIT_MAP[id].name)}</span>`).join('')}</div>
  </div>`;
  $('#ghostDeployModal').hidden = false;
}
$('#ghostDeployCancel').onclick = () => { $('#ghostDeployModal').hidden = true; };
$('#ghostDeployOk').onclick = () => {
  const callsign = $('#ghostCallsignInput').value.trim() || '無名指揮官';
  const motto = $('#ghostMottoInput').value.trim() || '立足國防，寸步不讓！';
  playerGhost.callsign = callsign;
  playerGhost.myGhostDeck = state.deck.slice();
  LS.set('db15_player_ghost', playerGhost);
  const pool = getGhostPool();
  const existingIdx = pool.findIndex(g => g.isUser);
  const myGhost = {
    id: 'user_ghost_' + Date.now(),
    callsign, title: playerGhost.rankTitle, rating: playerGhost.rp,
    wins: playerGhost.wins, losses: playerGhost.losses,
    deck: state.deck.slice(), doctrine: state.doctrine,
    motto, isUser: true
  };
  if (existingIdx >= 0) pool[existingIdx] = myGhost;
  else pool.unshift(myGhost);
  saveGhostPool(pool);
  $('#ghostDeployModal').hidden = true;
  renderAll();
  toast('🎉 成功部署防守部隊至全球幽靈防衛庫！');
};

$('#codeCancel').onclick = () => { $('#codeModal').hidden = true; };
$('#codeOk').onclick = () => {
  const ids = decodeDeck($('#codeInput').value);
  if (!ids) { $('#codeErr').textContent = '代碼格式不正確'; return; }
  const er = validateDeck(ids, budgetLimit(), currentBanned());
  if (er.length) { $('#codeErr').textContent = er[0]; return; }
  state.deck = ids; state.active = 0; $('#codeModal').hidden = true; renderAll(); toast('已匯入陣容');
};
function copyText(t) {
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).catch(() => {});
  else { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); } catch (e) {} a.remove(); }
}

/* ---------- 沙盒 ---------- */
function runSandbox() {
  const archs = state.sandEnemy === 'random' ? ARCHETYPES : [ARCHETYPES.find(a => a.id === state.sandEnemy)];
  const per = Math.ceil(300 / archs.length);
  const total = { n: 0, win: 0, lose: 0, draw: 0, sumA: 0, sumB: 0, byEvent: {} };
  EVENTS.forEach(e => { total.byEvent[e.id] = { win: 0, n: 0 }; });
  archs.forEach((a, k) => {
    const r = simulate(state.deck, buildFromPlan(a.plan, mulberry32(k + 3)), per, { docA: state.doctrine, seed: 99 + k, event: state.sandEvent === 'all' ? null : EVENTS.find(e => e.id === state.sandEvent) });
    ['n', 'win', 'lose', 'draw', 'sumA', 'sumB'].forEach(f => { total[f] += r[f]; });
    EVENTS.forEach(e => { total.byEvent[e.id].win += r.byEvent[e.id].win; total.byEvent[e.id].n += r.byEvent[e.id].n; });
  });
  state.sandResult = total; renderSide();
}

/* ---------- 戰鬥啟動 ---------- */
function startBattle() {
  const deck = state.deck.slice();
  if (validateDeck(deck, budgetLimit(), currentBanned()).length) return;
  const seed = state.mode === 'daily' ? hashStr(dateKey() + deck.join('.') + state.doctrine) : (Math.random() * 4294967296) >>> 0;
  const res = resolveBattle(deck, state.enemy, { seed, event: state.event, docA: state.doctrine, docB: state.enemyDoc });
  state.lastRes = res;
  showBattle(res);
}

function teamHtml(units, side) {
  return `<h3><span>${side === 'A' ? '我 方 ▸ 友軍編組' : '敵 方 ▸ ' + esc(state.enemyName)}</span><span style="font-size:11px;font-family:var(--mono);color:var(--cyan)">$15 BUDGET</span></h3>` + units.map(u => {
    const uData = UNIT_MAP[u.id];
    const imgSrc = uData?.img || `assets/units/${u.id}.jpg`;
    return `<div class="bu" id="bu-${u.uid}" style="--c:${CATS[u.cat].color}">
      <div class="bu-top">
        <div class="bu-thumb"><img src="${imgSrc}" alt="${esc(u.name)}" /></div>
        <div class="bu-meta-col">
          <div class="bu-name-row">
            <span class="bu-flag">${uData?.flag || ''}</span>
            <span class="bu-name-txt">${esc(u.name)}</span>
          </div>
          <div class="bu-cat-sub" style="color:${CATS[u.cat].color}">${CATS[u.cat].short} · ${CATS[u.cat].label}</div>
        </div>
        <span class="bu-cost">$${u.cost}</span>
      </div>
      <div class="hpbar"><u id="hp-${u.uid}"></u></div>
      <div class="bu-hp" id="hpt-${u.uid}">${u.hpMax} / ${u.hpMax}</div>
    </div>`;
  }).join('');
}
function setHp(uid, hp, max) {
  const u = $('#hp-' + uid); if (!u) return;
  const p = hp / max;
  u.style.width = Math.max(0, p * 100) + '%';
  u.className = p < 0.25 ? 'low' : p < 0.55 ? 'mid' : '';
  $('#hpt-' + uid).textContent = Math.round(hp) + ' / ' + max;
  const row = $('#bu-' + uid);
  if (hp <= 0) row.classList.add('dead');
}

/* =====================================================
   左右兩翼全景實況大圖即時切換系統 (Split-Screen Hero Panoramic Engine)
   ===================================================== */
function setSideHero(side, unit, action, subtext) {
  if (!unit) return;
  const img = $('#teamBgImg' + side);
  const nameEl = $('#heroUnitName' + side);
  const statusEl = $('#heroStatus' + side);
  const colEl = $('#team' + side);

  // 1. 本地照片瞬發切換（0 延遲）
  const targetSrc = unit.img || `assets/units/${unit.id}.jpg`;
  if (img) {
    img.src = targetSrc;
  }

  // 2. HUD 軍規浮水印文字
  if (nameEl) {
    nameEl.innerHTML = `<span style="margin-right:4px">${unit.flag || ''}</span> <strong>${esc(unit.name)}</strong>`;
  }
  if (statusEl) {
    if (action === 'fire') {
      statusEl.innerHTML = `<span style="color:#38bdf8;font-weight:700">⚡ [OPEN FIRE] ${esc(subtext || unit.weapon || '火力齊射')}</span>`;
    } else if (action === 'hit') {
      statusEl.innerHTML = `<span style="color:#f43f5e;font-weight:700">💥 [TARGET HIT] ${esc(subtext || '承受打擊')}</span>`;
    } else {
      statusEl.innerHTML = `<span style="color:#94a3b8">📡 [ACTIVE PATROL] ${esc(subtext || '戰場全景巡航')}</span>`;
    }
  }

  // 3. 整側區域高光/震動特效
  if (colEl) {
    const flashClass = action === 'fire' ? 'fire-flash' : 'hit-flash';
    colEl.classList.remove('fire-flash', 'hit-flash');
    void colEl.offsetWidth;
    colEl.classList.add(flashClass);
    setTimeout(() => colEl.classList.remove(flashClass), 350);
  }
}

async function showBattle(res) {
  const token = ++playToken; skip = false;
  $('#viewBuild').hidden = true;
  $('#missionBar').hidden = true;
  $('#commandDeck').hidden = true;
  hideTooltip();
  $('#viewBattle').hidden = false;
  $('#resultModal').hidden = true;
  $('#btnSpeed').hidden = false;
  $('#btnSkip').hidden = false;
  $('#btnReopenResult').hidden = true;
  $('#btnBattleExit').hidden = true;
  const fxLayer = $('#combatFxLayer');
  if (fxLayer) fxLayer.innerHTML = '';
  const radarEl = $('.radar');
  if (radarEl) radarEl.classList.remove('emp-active');

  window.scrollTo({ top: 0 });
  const T = res.final;
  
  // 注入左右部隊卡片列表（保留背景層）
  const uBoxA = $('#teamUnitsA'), uBoxB = $('#teamUnitsB');
  if (uBoxA) uBoxA.innerHTML = teamHtml(T.A, 'A');
  if (uBoxB) uBoxB.innerHTML = teamHtml(T.B, 'B');

  // 初始化左右全景大圖（預設各取第一順位旗艦裝備）
  const firstA = res.final.A[0], firstB = res.final.B[0];
  const uA = firstA ? UNIT_MAP[firstA.id] : null, uB = firstB ? UNIT_MAP[firstB.id] : null;
  if (uA) setSideHero('A', uA, 'patrol', uA.weapon || '主力戰備部署');
  if (uB) setSideHero('B', uB, 'patrol', uB.weapon || '敵前沿雷達戒備');

  // 初始化中央火控態勢橫幅
  const sAtk = $('#stripAttacker'), sTgt = $('#stripTarget'), sVec = $('#stripVector');
  if (sAtk && uA) sAtk.textContent = `${uA.flag} ${uA.name}`;
  if (sTgt && uB) sTgt.textContent = `${uB.flag} ${uB.name}`;
  if (sVec) sVec.textContent = '⚡ 雷達對峙掃描 ➔';

  const maxHp = {}; [...T.A, ...T.B].forEach(u => { maxHp[u.uid] = u.hpMax; });
  $('#battleLog').innerHTML = '';
  $('#phaseTitle').textContent = '戰 場 就 緒';
  const dn = d => DOCTRINES.find(x => x.id === d).name;
  let metaHtml = `<span class="chip-stat">${res.ev.icon} <b>${esc(res.ev.name)}</b></span><span class="chip-stat">我方教條 <b>${dn(res.docs.A)}</b></span><span class="chip-stat">敵方教條 <b>${dn(res.docs.B)}</b></span>`;
  if (state.mode === 'bo3') {
    metaHtml = `<span class="chip-stat" style="color:var(--amber)">BO5 第 ${state.bo3.round}/5 局 (${state.bo3.winsA} - ${state.bo3.winsB})</span>` + metaHtml;
  }
  $('#battleMeta').innerHTML = metaHtml;
  document.querySelectorAll('.ph').forEach(p => p.className = 'ph');
  await sleep(700 / speed);
  let curPhase = 0, sec = 0;
  const log = $('#battleLog');
  for (const f of res.frames) {
    if (token !== playToken) return;
    if (f.phase !== curPhase) {
      document.querySelectorAll('.ph').forEach(p => { const n = +p.dataset.p; p.className = 'ph' + (n < f.phase ? ' done' : n === f.phase ? ' on' : ''); });
      curPhase = f.phase;
      if (curPhase === 1 && radarEl) radarEl.classList.add('emp-active');
      else if (radarEl) radarEl.classList.remove('emp-active');
    }
    sec++;
    const timerEl = $('#camTimer');
    if (timerEl) timerEl.textContent = `00:${String(sec).padStart(2, '0')}`;
    $('#phaseTitle').textContent = f.title;
    const h = document.createElement('div'); h.className = 'head'; h.textContent = '▌' + f.title;
    log.prepend(h);
    for (const ln of f.lines) {
      if (token !== playToken) return;
      const d = document.createElement('div');
      d.className = `s${ln.side} ${ln.kind}`; d.textContent = ln.text;
      // 反敘倒序插入：最新戰況出現在最上方
      log.prepend(d);
      log.scrollTop = 0;
      if (ln.tuid) {
        setHp(ln.tuid, ln.hpAfter, maxHp[ln.tuid]);
      }
      playFx(ln);
      if (!skip) {
        const waitTime = ln.kind === 'miss' ? 140 : ln.kind === 'kill' ? 320 : 220;
        await sleep(waitTime / speed);
      }
    }
    Object.keys(f.hp).forEach(uid => setHp(uid, f.hp[uid], maxHp[uid]));
    if (!skip) await sleep(400 / speed);
  }
  if (token !== playToken) return;
  if (radarEl) radarEl.classList.remove('emp-active');
  document.querySelectorAll('.ph').forEach(p => p.className = 'ph done');
  $('#phaseTitle').textContent = '交 戰 結 束';
  finishBattle(res);
}

function playFx(ln) {
  if (skip) return;
  const fxLayer = $('#combatFxLayer');
  if (!fxLayer) return;

  const aEl = ln.auid ? $('#bu-' + ln.auid) : null;
  const tEl = ln.tuid ? $('#bu-' + ln.tuid) : null;

  const aId = ln.auid ? ln.auid.split('-')[0] : null;
  const tId = ln.tuid ? ln.tuid.split('-')[0] : null;
  const aUnit = aId ? UNIT_MAP[aId] : null;
  const tUnit = tId ? UNIT_MAP[tId] : null;

  // 1. 即時動態切換左右兩半邊全景巨幕大圖與中央火控態勢！
  if (aUnit && tUnit) {
    const sAtk = $('#stripAttacker'), sTgt = $('#stripTarget'), sVec = $('#stripVector');
    if (ln.side === 'A') {
      // 我方開火攻擊 ➔ 左邊為攻擊武器大圖，右邊為受擊目標大圖
      setSideHero('A', aUnit, 'fire', aUnit.weapon);
      setSideHero('B', tUnit, 'hit', ln.text);
      if (sAtk) sAtk.textContent = `${aUnit.flag} ${aUnit.name}`;
      if (sTgt) sTgt.textContent = `${tUnit.flag} ${tUnit.name}`;
      if (sVec) sVec.textContent = `⚡ [${aUnit.weapon ? aUnit.weapon.split(' ')[0] : '開火'}] ➔`;
    } else {
      // 敵方開火攻擊 ➔ 右邊為攻擊武器大圖，左邊為受擊目標大圖
      setSideHero('B', aUnit, 'fire', aUnit.weapon);
      setSideHero('A', tUnit, 'hit', ln.text);
      if (sAtk) sAtk.textContent = `${tUnit.flag} ${tUnit.name}`;
      if (sTgt) sTgt.textContent = `${aUnit.flag} ${aUnit.name}`;
      if (sVec) sVec.textContent = `⚡ [${aUnit.weapon ? aUnit.weapon.split(' ')[0] : '突襲'}] ➔`;
    }

    // 動態經緯度模擬
    const camCoords = $('#camCoords');
    if (camCoords && Math.random() < 0.35) {
      const minN = (18 + Math.random() * 0.9).toFixed(2);
      const minE = (34 + Math.random() * 0.9).toFixed(2);
      camCoords.textContent = `LAT 24°${minN}'N LON 120°${minE}'E`;
    }
  }

  // 2. 觸發開火音效
  if (aUnit) {
    SoundEngine.play(aUnit.sfx || 'missile');
  }

  // 3. 卡片高亮連動
  if (aEl) {
    aEl.classList.remove('active-attacker');
    void aEl.offsetWidth;
    aEl.classList.add('active-attacker');
    setTimeout(() => aEl.classList.remove('active-attacker'), 350 / speed);
  }
  if (tEl) {
    tEl.classList.remove('active-target');
    void tEl.offsetWidth;
    tEl.classList.add('active-target');
    setTimeout(() => tEl.classList.remove('active-target'), 350 / speed);
  }

  // 2. 觸發開火音效
  if (aUnit) {
    SoundEngine.play(aUnit.sfx || 'missile');
  }

  // 3. 開火方微後座力發光動畫
  if (aEl) {
    const recoilClass = ln.side === 'A' ? 'fire-recoil-a' : 'fire-recoil-b';
    aEl.classList.remove('fire-recoil-a', 'fire-recoil-b');
    void aEl.offsetWidth;
    aEl.classList.add(recoilClass);
    setTimeout(() => aEl.classList.remove(recoilClass), 300 / speed);
  }

  if (!tEl) return;

  const layerRect = fxLayer.getBoundingClientRect();
  const tRect = tEl.getBoundingClientRect();
  const tx = tRect.left + tRect.width / 2 - layerRect.left;
  const ty = tRect.top + tRect.height / 2 - layerRect.top;

  // 4. 戰術飛彈／實體彈道高速穿梭動畫（依兵種武器樣式特化）
  if (aEl) {
    const aRect = aEl.getBoundingClientRect();
    const ax = (ln.side === 'A' ? aRect.right - 10 : aRect.left + 10) - layerRect.left;
    const ay = aRect.top + aRect.height / 2 - layerRect.top;

    const dx = tx - ax, dy = ty - ay;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;

    let trailClass = '';
    if (aUnit) {
      if (aUnit.sfx === 'heavy_cannon' || aUnit.sfx === 'cannon') trailClass = 'cannon-shell';
      else if (aUnit.sfx === 'rocket_salvo') trailClass = 'rocket-barrage';
      else if (aUnit.sfx === 'torpedo') trailClass = 'torpedo-trail';
      else if (aUnit.sfx === 'swarm') trailClass = 'swarm-drone';
    }

    const proj = document.createElement('div');
    proj.className = `fx-projectile ${ln.side === 'A' ? 'fx-side-a' : 'fx-side-b'}`;
    proj.style.transform = `translate(${ax}px, ${ay}px) rotate(${angle}deg)`;
    proj.innerHTML = `<div class="fx-missile ${trailClass}" style="width:${Math.min(54, Math.max(18, dist * 0.18))}px;"></div>`;
    fxLayer.appendChild(proj);

    const dur = Math.max(70, 200 / speed);
    const startTime = performance.now();

    function step(now) {
      if (skip || !proj.parentElement) { proj.remove(); return; }
      const p = Math.min(1, (now - startTime) / dur);
      const curX = ax + dx * p;
      const curY = ay + dy * p;
      proj.style.transform = `translate(${curX}px, ${curY}px) rotate(${angle}deg)`;
      if (p < 1) {
        requestAnimationFrame(step);
      } else {
        proj.remove();
        triggerImpact();
      }
    }
    requestAnimationFrame(step);
  } else {
    triggerImpact();
  }

  // 5. 命中受擊、爆炸衝擊波與浮動戰鬥數字
  function triggerImpact() {
    if (skip) return;
    if (ln.kind === 'kill') {
      tEl.classList.remove('hit-shake', 'kill-blast');
      void tEl.offsetWidth;
      tEl.classList.add('kill-blast', 'destroyed-badge');
      spawnExplosion(tx, ty);
      spawnFloater(tx, ty, '💥 擊毀!', 'kill');
      SoundEngine.play('explosion');
    } else if (ln.kind === 'hit') {
      tEl.classList.remove('hit-shake');
      void tEl.offsetWidth;
      tEl.classList.add('hit-shake');
      spawnExplosion(tx, ty);
      const dmgText = ln.dmg ? `−${ln.dmg}` : `命中!`;
      spawnFloater(tx, ty, dmgText, 'hit');
      SoundEngine.play('heavy_cannon');
    } else if (ln.kind === 'block') {
      spawnShield(tx, ty);
      spawnFloater(tx, ty, '🛡️ APS 攔截', 'block');
      SoundEngine.play('block');
    } else if (ln.kind === 'miss') {
      spawnFloater(tx, ty, 'MISS', 'miss');
    }
  }

  function spawnExplosion(x, y) {
    const boom = document.createElement('div');
    boom.className = 'fx-explosion';
    boom.style.left = x + 'px'; boom.style.top = y + 'px';
    fxLayer.appendChild(boom);
    setTimeout(() => boom.remove(), 380 / speed);
  }

  function spawnShield(x, y) {
    const shield = document.createElement('div');
    shield.className = 'fx-shield';
    shield.style.left = x + 'px'; shield.style.top = y + 'px';
    fxLayer.appendChild(shield);
    setTimeout(() => shield.remove(), 420 / speed);
  }

  function spawnFloater(x, y, text, type) {
    const fl = document.createElement('div');
    fl.className = `fx-floater ${type}`;
    fl.textContent = text;
    fl.style.left = x + 'px'; fl.style.top = y + 'px';
    fxLayer.appendChild(fl);
    setTimeout(() => fl.remove(), 680 / speed);
  }
}

$('#btnSkip').onclick = () => {
  skip = true;
  const fx = $('#combatFxLayer');
  if (fx) fx.innerHTML = '';
  const r = $('.radar');
  if (r) r.classList.remove('emp-active');
};
$('#btnSpeed').onclick = () => { speed = speed === 1 ? 2 : speed === 2 ? 4 : 1; $('#btnSpeed').textContent = '速度 ×' + speed; };
$('#btnReopenResult').onclick = () => {
  if (currentActiveModal) currentActiveModal.hidden = false;
  else $('#resultModal').hidden = false;
};
$('#btnBattleExit').onclick = () => { closeBattle(); setupMatch(); renderAll(); };

/* ---------- 戰鬥結算與 BO3 / 幽靈處理 ---------- */
function finishBattle(res) {
  const won = res.winner === 'A', draw = res.winner === 'draw';
  if (state.mode !== 'sandbox') {
    stats.played++;
    if (won) { stats.win++; stats.streak++; stats.best = Math.max(stats.best, stats.streak); }
    else if (!draw) stats.streak = 0;
    LS.set('db15_stats', stats);
  }

  /* 幽靈天梯積分結算 */
  if (state.mode === 'ghost') {
    if (won) {
      playerGhost.rp += 25; playerGhost.wins++;
      if (state.ghostTarget) state.ghostTarget.losses++;
      toast(`🎖 天梯勝利！獲得 +25 RP (目前: ${playerGhost.rp} RP)`);
    } else if (!draw) {
      playerGhost.rp = Math.max(800, playerGhost.rp - 15); playerGhost.losses++;
      if (state.ghostTarget) state.ghostTarget.wins++;
      toast(`天梯失利：−15 RP (目前: ${playerGhost.rp} RP)`);
    }
    playerGhost.rankTitle = calcRankTitle(playerGhost.rp);
    LS.set('db15_player_ghost', playerGhost);
    saveGhostPool(getGhostPool());
  }

  if (state.mode === 'daily') {
    const k = state.dailyPlanId === 'today' ? ('db15_daily_' + dateKey()) : ('db15_daily_' + dateKey() + '_' + state.dailyPlanId);
    const r = LS.get(k, { won: false, tries: 0 });
    r.tries++; r.won = r.won || won; LS.set(k, r);
  }

  renderHud();

  /* BO3 系列賽邏輯分流 */
  if (state.mode === 'bo3') {
    handleBo3RoundEnd(res);
  } else {
    showResult(res);
  }
}

/* ---------- BO3 系列賽輪次推進 ---------- */
function handleBo3RoundEnd(res) {
  const won = res.winner === 'A', draw = res.winner === 'draw';
  const bo3 = state.bo3;
  if (won) bo3.winsA++;
  else if (!draw) bo3.winsB++;

  bo3.history.push({
    round: bo3.round, winner: res.winner,
    scoreA: res.vp.A.total, scoreB: res.vp.B.total,
    event: res.ev, deckA: state.deck.slice(), deckB: state.enemy.slice()
  });

  // 判斷是否有人獲得 3 勝 (BO5 系列賽獲勝)
  if (bo3.winsA >= 3 || bo3.winsB >= 3) {
    showBo3SeriesResult(bo3.winsA >= 3);
    return;
  }

  // 尚未結束，準備進入下一局 (至多第 5 局)
  const nextRound = bo3.round + 1;
  const nextEvent = pick(EVENTS.filter(e => e.id !== res.ev.id));
  bo3.nextEvent = nextEvent;

  if (won) {
    // 電腦在上一局失利，觸發電腦智能戰術反制！
    // 智慧判定條件：
    // 條件 1：若玩家 MVP 輸出爆發 (cost >= 3 且擊殺或輸出驚人)，優先 BAN MVP
    // 條件 2：若玩家配置了頂級 $5 明星武器，BAN 該 $5 核心
    // 條件 3：若玩家造成關鍵電子戰優勢，BAN 玩家的電戰/防空關鍵單位
    const playerMvp = res.mvp.A;
    let banId = null;
    let banReason = '';
    
    if (playerMvp && playerMvp.cost >= 4 && playerMvp.dmgDone > 100) {
      banId = playerMvp.id;
      banReason = `輸出高達 ${Math.round(playerMvp.dmgDone)} 傷害`;
    } else {
      const star5 = state.deck.find(id => UNIT_MAP[id].cost === 5);
      if (star5) {
        banId = star5;
        banReason = '戰略核心 $5 旗艦裝備';
      } else if (playerMvp && playerMvp.cost >= 3) {
        banId = playerMvp.id;
        banReason = '全場最具威脅戰術核心';
      } else {
        banId = state.deck[0];
        banReason = '主力部隊';
      }
    }
    
    bo3.bannedByB = banId;
    
    // 電腦自身進行陣容微調
    bo3.enemyDeck = refitEnemyDeck(state.enemy, state.deck, nextEvent);

    showResult(res, {
      bo3NextText: `進入第 ${nextRound} 局（戰術反制）`,
      bo3Callback: () => {
        closeBattle();
        bo3.round = nextRound;
        setupMatch();
        // 如果玩家當前卡槽中正好有被敵方 Ban 的單位，強制卸下該單位
        const bannedIdx = state.deck.indexOf(banId);
        if (bannedIdx >= 0) {
          state.deck[bannedIdx] = null;
          state.active = bannedIdx;
        }
        renderAll();
        toast(`⚠️ 電腦失利啟動反制！鎖定你上一局【${banReason}】，禁用了【${UNIT_MAP[banId].name}】！`);
      }
    });
  } else {
    // 玩家在上一局失利，賦予玩家戰術反制特權（跳出 Ban 選單）
    showResult(res, {
      bo3NextText: `啟動戰術反制 (BAN 敵方裝備)`,
      bo3Callback: () => {
        closeBattle();
        openBo3CounterModal(res.final.B, nextRound, nextEvent);
      }
    });
  }
}

function refitEnemyDeck(currentEnemyDeck, playerDeck, nextEvent) {
  // 電腦依據戰場事件或玩家高費單位進行微調
  const newDeck = currentEnemyDeck.slice();
  const playerAir = playerDeck.some(id => UNIT_MAP[id].cat === 'air' && UNIT_MAP[id].cost >= 4);
  if (playerAir) {
    // 強化防空槽位
    const adUnits = UNITS.filter(u => u.cat === 'air_defense' && u.cost >= 3);
    if (adUnits.length) newDeck[2] = pick(adUnits).id;
  }
  return newDeck;
}

/* 玩家戰術反制 Modal */
function openBo3CounterModal(enemyFinalTeam, nextRound, nextEvent) {
  const bo3 = state.bo3;
  $('#bo3CounterTitle').textContent = `第 ${bo3.round} 局失利：啟動緊急戰術反制`;
  $('#bo3CounterDesc').textContent = `你擁有最高反制特權：點選並指定禁用敵方上一局的 1 件裝備，逼迫對手於第 ${nextRound} 局撤換！`;
  
  bo3.candidateBan = enemyFinalTeam[0].id;
  $('#bo3BanGrid').innerHTML = enemyFinalTeam.map((u, idx) => {
    return `<div class="bo3-ban-card ${idx === 0 ? 'selected' : ''}" data-ban="${u.id}">
      <div class="u-name">${esc(u.name)}</div>
      <div class="u-cost">$${u.cost} · ${CATS[u.cat].label}</div>
      <div class="muted" style="font-size:11px;margin-top:4px">輸出傷害: ${Math.round(u.dmgDone)}</div>
    </div>`;
  }).join('');

  $('#bo3NextInfo').innerHTML = `<div class="panel" style="padding:10px">
    <b>第 ${nextRound} 局戰場情報：</b> ${nextEvent.icon} ${esc(nextEvent.name)}（${esc(nextEvent.desc)}）
  </div>`;

  $('#bo3CounterModal').hidden = false;

  $('#bo3BanGrid').onclick = e => {
    const card = e.target.closest('.bo3-ban-card'); if (!card) return;
    document.querySelectorAll('.bo3-ban-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    bo3.candidateBan = card.dataset.ban;
  };
}

$('#bo3CounterConfirm').onclick = () => {
  const bo3 = state.bo3;
  const bannedId = bo3.candidateBan;
  bo3.bannedByA = bannedId;
  $('#bo3CounterModal').hidden = true;
  bo3.round++;
  
  // 替換敵方被 Ban 的裝備
  const banIdx = bo3.enemyDeck.indexOf(bannedId);
  if (banIdx >= 0) {
    const slotFixed = SLOTS[banIdx].fixed;
    const cat = slotFixed || UNIT_MAP[bannedId].cat;
    const alternatives = UNITS.filter(u => u.cat === cat && u.id !== bannedId && !bo3.enemyDeck.includes(u.id));
    if (alternatives.length) bo3.enemyDeck[banIdx] = pick(alternatives).id;
  }

  setupMatch();
  renderAll();
  toast(`🎯 戰術反制生效：已成功禁用敵方的【${UNIT_MAP[bannedId].name}】！請調整陣容應戰。`);
};

/* BO3 系列賽冠軍結算 */
function showBo3SeriesResult(isPlayerWon) {
  const bo3 = state.bo3;
  if (isPlayerWon) {
    stats.bo3Won = (stats.bo3Won || 0) + 1;
    LS.set('db15_stats', stats);
  }
  currentActiveModal = $('#bo3SeriesModal');
  $('#bo3SeriesCard').innerHTML = `
    <button class="modal-x" id="bo3CloseX" title="關閉彈窗並檢視戰場情形">✕</button>
    <div class="trophy-banner">
      <div class="tag">CONQUEST SERIES CHAMPIONSHIP</div>
      <h2>${isPlayerWon ? `🏆 榮獲 BO5 系列賽總冠軍！(${bo3.winsA} - ${bo3.winsB})` : `系列賽惜敗 (${bo3.winsA} - ${bo3.winsB})`}</h2>
      <p class="muted" style="margin-top:6px">${isPlayerWon ? '恭喜你在殘酷的戰術禁用與兵種相剋博弈中奪得 3 勝大獲全勝！' : '敵方指揮官在關鍵局完成了針對性反制。再接再厲！'}</p>
    </div>
    <div class="bo3-timeline">
      ${bo3.history.map(h => `<div class="bo3-round-row">
        <span><b>第 ${h.round}/5 局</b> · ${h.event.icon} ${h.event.name}</span>
        <span>我方 ${h.scoreA.toFixed(0)} : ${h.scoreB.toFixed(0)} 敵方</span>
        <b style="color:${h.winner === 'A' ? 'var(--green)' : 'var(--red)'}">${h.winner === 'A' ? '勝 利 ✔' : '敗 北 ✘'}</b>
      </div>`).join('')}
    </div>
    <div class="res-actions">
      <button class="btn primary" id="bo3NewSeries">重啟新一輪 BO5 征服賽</button>
      <button class="btn" id="bo3Review">檢視戰場情形 🔍</button>
      <button class="btn ghost" id="bo3Close">返回大廳</button>
    </div>
  `;
  $('#bo3SeriesModal').hidden = false;

  const reviewBo3Battlefield = () => {
    $('#bo3SeriesModal').hidden = true;
    $('#btnSpeed').hidden = true;
    $('#btnSkip').hidden = true;
    $('#btnReopenResult').hidden = false;
    $('#btnBattleExit').hidden = false;
    toast('🔍 已進入戰場檢視：可自由滾動日誌與檢視部隊殘局，點擊右上角【查看結算】可隨時重開報告');
  };

  $('#bo3Review').onclick = reviewBo3Battlefield;
  $('#bo3CloseX').onclick = reviewBo3Battlefield;
  $('#bo3SeriesModal').onclick = (e) => {
    if (e.target === $('#bo3SeriesModal')) reviewBo3Battlefield();
  };

  $('#bo3NewSeries').onclick = () => { $('#bo3SeriesModal').hidden = true; closeBattle(); initBo3Series(); renderAll(); };
  $('#bo3Close').onclick = () => { $('#bo3SeriesModal').hidden = true; closeBattle(); state.bo3.active = false; setMode('quick'); };
}

/* ---------- 戰鬥結算彈窗 ---------- */
function showResult(res, bo3Custom) {
  const won = res.winner === 'A', draw = res.winner === 'draw';
  const A = res.vp.A, B = res.vp.B;
  const f = x => x.toFixed(1);
  const row = (n, a, b) => `<tr><td>${n}</td><td class="${a > b ? 'win' : ''}">${f(a)}</td><td class="${b > a ? 'win' : ''}">${f(b)}</td></tr>`;
  const why = buildWhy(res);
  
  let headerText = won ? '勝 利' : draw ? '平 手' : '敗 北';
  let subtitle = `${esc(res.ev.icon + ' ' + res.ev.name)}`;
  if (state.mode === 'daily') subtitle += ' · 每日殘局 #' + dailyNo();
  else if (state.mode === 'ghost') subtitle += ` · 幽靈對戰 (${state.ghostTarget.callsign})`;
  else if (state.mode === 'bo3') subtitle += ` · BO3 第 ${state.bo3.round} 局 (比分 ${state.bo3.winsA} - ${state.bo3.winsB})`;

  $('#resultCard').innerHTML = `
    <button class="modal-x" id="rCloseX" title="關閉彈窗並檢視戰場情形">✕</button>
    <div class="res-banner ${won ? 'win' : draw ? 'lose' : 'lose'} ${draw ? 'draw' : ''}">
      <div class="tag">${res.wipeout ? 'DECISIVE · 全殲' : 'STRATEGIC POINTS · 戰略積分'}</div>
      <h2>${headerText}</h2>
      <div class="muted">${subtitle}</div>
    </div>
    <div class="res-grid">
      <div><h3 style="font-family:var(--head);letter-spacing:.14em;color:var(--muted);font-size:13px;margin-bottom:6px">積分明細</h3>
      <table class="vp-tbl"><tr><th></th><th>我方</th><th>敵方</th></tr>
        ${row('殘餘戰力（Σ費用×血量%×4）', A.remain, B.remain)}${row('戰線控制（裝甲/空優/海權）', A.control, B.control)}${row('以小博大（越級擊殺）', A.upset, B.upset)}
        <tr class="tot"><td>總分</td><td class="${A.total > B.total ? 'win' : ''}">${f(A.total)}</td><td class="${B.total > A.total ? 'win' : ''}">${f(B.total)}</td></tr></table></div>
      <div><h3 style="font-family:var(--head);letter-spacing:.14em;color:var(--muted);font-size:13px;margin-bottom:6px">戰局轉折點</h3>
      <ul class="why">${res.key.length ? res.key.map(k => `<li class="${k.side === 'A' ? 'good' : 'bad'}">${esc(k.text)}</li>`).join('') : '<li>雙方僵持，沒有決定性的轉折。</li>'}</ul></div>
    </div>
    <h3 style="font-family:var(--head);letter-spacing:.14em;color:var(--muted);font-size:13px;margin-bottom:6px">為什麼會這樣？</h3>
    <ul class="why">${why.map(w => `<li class="${w.t}">${esc(w.s)}</li>`).join('')}</ul>
    <div class="res-actions">
      ${bo3Custom ? `<button class="btn amber" id="rBo3Next">${esc(bo3Custom.bo3NextText)}</button>` : `<button class="btn primary" id="rRematch">${state.mode === 'daily' ? '調整陣容再挑戰' : '再戰一場'}</button>`}
      <button class="btn" id="rReview">檢視戰場情形 🔍</button>
      <button class="btn ghost" id="rEdit">返回編輯陣容</button>
    </div>`;

  currentActiveModal = $('#resultModal');
  $('#resultModal').hidden = false;

  const reviewBattlefield = () => {
    $('#resultModal').hidden = true;
    $('#btnSpeed').hidden = true;
    $('#btnSkip').hidden = true;
    $('#btnReopenResult').hidden = false;
    $('#btnBattleExit').hidden = false;
    toast('🔍 已進入戰場檢視：可自由滾動日誌與檢視部隊殘局，點擊右上角【查看結算】可隨時重開報告');
  };

  $('#rReview').onclick = reviewBattlefield;
  $('#rCloseX').onclick = reviewBattlefield;
  $('#resultModal').onclick = (e) => {
    if (e.target === $('#resultModal')) reviewBattlefield();
  };

  if (bo3Custom) {
    $('#rBo3Next').onclick = bo3Custom.bo3Callback;
  } else {
    $('#rRematch').onclick = () => {
      closeBattle();
      if (state.mode !== 'daily') {
        setupMatch();
        if (state.scout) state.scoutIdx = Math.floor(Math.random() * 5);
        renderAll();
        if (state.deck.every(Boolean)) startBattle(); else toast('請先補齊陣容');
      }
    };
  }

  $('#rEdit').onclick = () => { closeBattle(); setupMatch(); renderAll(); };
}

function buildWhy(res) {
  const A = res.vp.A, B = res.vp.B, out = [];
  const won = res.winner === 'A';
  if (res.advSide) {
    const big = Math.abs(res.ewA - res.ewB) >= 25, mine = res.advSide === 'A';
    out.push({ t: mine ? 'good' : 'bad', s: `電戰：我方 ${res.ewA.toFixed(0)} vs 敵方 ${res.ewB.toFixed(0)}，${mine ? (big ? '你掌握了電磁優勢，敵方命中率明顯下降。' : '你略占電戰優勢，效果有限。') : (big ? '敵方掌握電磁優勢，你的攻擊更難命中。' : '敵方略占電戰優勢，影響有限。')}` });
  } else {
    out.push({ t: '', s: `電戰：我方 ${res.ewA.toFixed(0)} vs 敵方 ${res.ewB.toFixed(0)}，雙方電磁權互不相讓。` });
  }
  const dRemain = A.remain - B.remain;
  out.push({ t: dRemain >= 0 ? 'good' : 'bad', s: `殘餘戰力${dRemain >= 0 ? '領先' : '落後'} ${Math.abs(dRemain).toFixed(1)} 分——${dRemain >= 0 ? '你的部隊保存得更完整。' : '你的主力損失較大。'}` });
  if (A.control !== B.control) out.push({ t: A.control > B.control ? 'good' : 'bad', s: `戰線控制 ${A.control.toFixed(0)} vs ${B.control.toFixed(0)}：${A.control > B.control ? '你掌握了裝甲／空優／海權的優勢。' : '對手在裝甲、空優或海權取得更多控制。'}` });
  const m = res.mvp[won ? 'A' : 'B'];
  out.push({ t: '', s: `${won ? '我方' : '敵方'}火力王：${m.name}（累計傷害 ${Math.round(m.dmgDone)}）` });
  if (!won && res.winner !== 'draw') {
    const air = res.final.A.find(u => u.cat === 'air');
    if (air && !air.alive) out.push({ t: 'bad', s: '建議：你的戰機被擊落，下次可考慮高隱匿戰機，或先壓制對方防空。' });
    else out.push({ t: 'bad', s: '建議：嘗試調整教條，或針對對手風格換成能剋制它的兵種（點擊裝備可查看特性）。' });
  }
  return out;
}

function shareText(res) {
  const won = res.winner === 'A';
  const names = state.deck.map(id => UNIT_MAP[id].name).join('｜');
  return `【頂尖對戰】${state.mode === 'daily' ? '每日殘局 #' + dailyNo() : state.mode === 'ghost' ? '幽靈對戰' : '快速對戰'} ${won ? '勝利 ✅' : res.winner === 'draw' ? '平手 ⚖' : '敗北 ❌'}\n戰場：${res.ev.name}　積分 ${res.vp.A.total.toFixed(0)} : ${res.vp.B.total.toFixed(0)}\n我的 $${deckCost(state.deck)} 陣容：${names}\n陣容代碼：${encodeDeck(state.deck)}\n你能用 $15 做得更好嗎？`;
}

function closeBattle() {
  playToken++;
  $('#resultModal').hidden = true;
  $('#viewBattle').hidden = true;
  $('#viewBuild').hidden = false;
  $('#missionBar').hidden = false;
  $('#commandDeck').hidden = false;
  $('#btnSpeed').hidden = false;
  $('#btnSkip').hidden = false;
  $('#btnReopenResult').hidden = true;
  $('#btnBattleExit').hidden = true;
}

/* ---------- 戰術海報生成 ---------- */
function downloadPoster(res) {
  const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#07101c'); bg.addColorStop(1, '#0c1a2b'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(61,224,255,.1)'; g.lineWidth = 1;
  for (let x = 0; x < W; x += 54) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  for (let y = 0; y < H; y += 54) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  const won = res.winner === 'A';
  g.textBaseline = 'alphabetic';
  g.fillStyle = '#3de0ff'; g.font = '700 26px "JetBrains Mono",monospace'; g.fillText('TOP CLASH 15 · COMBINED ARMS', 70, 100);
  g.fillStyle = '#dbe7f5'; g.font = '900 64px "Noto Sans TC",sans-serif'; g.fillText('頂尖對戰', 70, 180);
  g.fillStyle = won ? '#5dffb0' : res.winner === 'draw' ? '#ffb340' : '#ff5d6e'; g.font = '900 150px "Noto Sans TC",sans-serif';
  g.fillText(won ? '勝 利' : res.winner === 'draw' ? '平 手' : '敗 北', 70, 370);
  g.fillStyle = '#7f93ab'; g.font = '500 30px "Noto Sans TC",sans-serif';
  g.fillText(`${res.ev.name} ｜ 積分 ${res.vp.A.total.toFixed(0)} : ${res.vp.B.total.toFixed(0)} ｜ ${state.mode === 'daily' ? '每日殘局 #' + dailyNo() : dateKey()}`, 70, 430);
  let y = 500;
  state.deck.forEach((id, i) => {
    const u = UNIT_MAP[id]; const col = CATS[u.cat].color;
    g.fillStyle = 'rgba(255,255,255,.05)'; roundRect(g, 70, y, 940, 120, 18); g.fill();
    g.fillStyle = col; g.fillRect(70, y, 8, 120);
    g.fillStyle = '#7f93ab'; g.font = '600 24px "JetBrains Mono",monospace'; g.fillText(CATS[u.cat].short + ' · ' + SLOTS[i].label, 110, y + 40);
    g.fillStyle = '#dbe7f5'; g.font = '700 42px "Noto Sans TC",sans-serif'; g.fillText(u.name, 110, y + 90);
    g.fillStyle = '#ffb340'; g.font = '700 56px Rajdhani,"Noto Sans TC",sans-serif'; g.textAlign = 'right'; g.fillText('$' + u.cost, 980, y + 82); g.textAlign = 'left';
    y += 138;
  });
  g.fillStyle = '#3de0ff'; g.font = '700 30px "JetBrains Mono",monospace'; g.fillText('CODE  ' + encodeDeck(state.deck), 70, y + 50);
  g.fillStyle = '#7f93ab'; g.font = '500 26px "Noto Sans TC",sans-serif'; g.fillText('用 $15 組出你的聯合作戰陣容，來挑戰我！', 70, y + 100);
  const a = document.createElement('a'); a.download = 'defense-budget-15.png'; a.href = c.toDataURL('image/png'); a.click();
  toast('海報已下載');
}
function roundRect(g, x, y, w, h, r) {
  if (typeof g.roundRect === 'function') {
    g.beginPath();
    g.roundRect(x, y, w, h, r);
    return;
  }
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/* ---------- 遊戲說明 ---------- */
function showHelp() {
  $('#helpCard').innerHTML = `<button class="btn ghost sm x" id="helpClose">關閉 ✕</button><h2>遊戲說明</h2><p class="muted">用 $15 預算組建五個作戰槽位，與對手進行一分鐘的聯合作戰推演。</p>
  <h3>一、組隊規則</h3><ul><li>五大專屬槽位（制空、裝甲、防空、制海、支援各選 1 件，同一兵種不可重複選取）。</li><li>總預算 $15，無 $5 裝備數量限制（可自由配置多個 $5 單位，只要總預算不超標）；同一裝備不可重複。</li><li>每件裝備有 A（精準科技）與 B（重火力）兩種風格，$5 的戰力約為 $1 的 6 倍（明星溢價）。</li></ul>
  <h3>二、五大遊戲模式</h3><ul>
    <li><b>快速對戰</b>：對戰 6 種 AI 風格，每場事件與對手皆不同。</li>
    <li><b>幽靈對戰 🌐</b>：非同步挑戰其他真人玩家部署的防衛陣容，升級你的天梯軍銜（准尉 ➔ 上將），亦可部署自己的影子陣容！</li>
    <li><b>BO5 征服賽 🏆</b>：五局三勝制！敗方享有「戰術反制」特權，指定禁用敵方上一局的 1 件裝備，考驗臨場反制與更換配裝。</li>
    <li><b>每日殘局</b>：對手擁有 $19 超標陣容，你只有 $15，全球同題破局。</li>
    <li><b>沙盒模擬</b>：一鍵模擬 300 場，查看勝率與各事件表現。</li>
  </ul>
  <h3>三、三階段推演與勝負</h3><ul><li>階段一：電戰值比拼（壓制敵命中率），SEAD／縱深打擊先制點穴。</li><li>階段二：防空攔截戰機（×2.5 傷害）➔ 空戰 ➔ 制海互射。</li><li>階段三：地面決戰，存活戰機密接轟炸（CAS ×1.7），火砲無人機持續支援。</li><li>積分判定：殘餘戰力 ＋ 戰線控制（裝甲/空優/海權）＋ 以小博大擊殺。</li></ul>
  <h3>四、戰術教條（賽前 3 選 1）</h3><ul>
    <li><b>⚔ 先發制人</b>：階段一、二攻擊火力 <b>+12%</b>，但承受傷害 <b>+5%</b>（適合長程精準刺殺、速攻斬首）。</li>
    <li><b>🛡 縱深防禦</b>：全隊承受傷害 <b>−12%</b>，防空攔截敵機命中率 <b>+6%</b>（適合重裝甲抗揍與陣地戰）。</li>
    <li><b>📡 電子欺敵</b>：電戰值 <b>×1.5 倍</b>（更容易奪取電磁優勢），並使敵方全體命中率 <b>−8%</b>（適合迴避流與反制高命中昂貴大殺器）。</li>
  </ul>`;
  $('#helpModal').hidden = false;
  $('#helpClose').onclick = () => { $('#helpModal').hidden = true; LS.set('db15_seen', 1); };
}
$('#btnHelp').onclick = showHelp;
/* ---------- 深色 / 淺色主題管理 ---------- */
function applyTheme(theme, showNotice = false) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  const iconEl = $('#themeIcon');
  const btn = $('#btnTheme');
  if (iconEl) iconEl.textContent = theme === 'light' ? '🌙' : '☀️';
  if (btn) btn.title = theme === 'light' ? '切換為深色模式 (夜間指揮所)' : '切換為淺色模式 (日間戰情室)';
  LS.set('db15_theme', theme);
  if (showNotice) {
    toast(theme === 'light' ? '已切換為日間戰情室 (淺色模式)' : '已切換為夜間指揮中心 (深色模式)');
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || state.theme || 'dark';
  const next = current === 'light' ? 'dark' : 'light';
  applyTheme(next, true);
}

$('#btnTheme')?.addEventListener('click', toggleTheme);
$('#btnAudio')?.addEventListener('click', () => SoundEngine.toggle());

document.addEventListener('keydown', e => {
  // 輸入框打字時不觸發快捷鍵
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

  if (e.key === 'Escape') {
    $('#helpModal').hidden = true;
    $('#codeModal').hidden = true;
    $('#ghostDeployModal').hidden = true;
    $('#bo3CounterModal').hidden = true;
    $('#bo3SeriesModal').hidden = true;
    if ($('#unitDetailModal')) $('#unitDetailModal').hidden = true;
    if ($('#deckMoreModal')) $('#deckMoreModal').hidden = true;
    return;
  }

  // 1. 空白鍵 Space 或 Enter：開戰或跳過動畫／確認結算
  if (e.code === 'Space' || e.key === 'Enter') {
    const viewBattle = $('#viewBattle');
    if (viewBattle && !viewBattle.hidden) {
      e.preventDefault();
      const resModal = $('#resultModal');
      if (resModal && !resModal.hidden) {
        const nextBtn = $('#btnNextRound') || $('#resClose') || $('#resReplay');
        if (nextBtn) nextBtn.click();
      } else {
        const btnSkip = $('#btnSkip');
        if (btnSkip) btnSkip.click();
      }
      return;
    }
    const btnGo = $('#btnGo');
    if (btnGo && !btnGo.disabled && (!viewBattle || viewBattle.hidden)) {
      e.preventDefault();
      btnGo.click();
      return;
    }
  }

  // 2. R 鍵：隨機補滿
  if (e.key === 'r' || e.key === 'R') {
    const btnRand = $('#btnRand');
    if (btnRand && !btnRand.disabled) {
      e.preventDefault();
      btnRand.click();
    }
    return;
  }

  // 3. C 鍵：清空所有槽位
  if (e.key === 'c' || e.key === 'C') {
    const btnClear = $('#btnClear');
    if (btnClear && !btnClear.disabled) {
      e.preventDefault();
      btnClear.click();
    }
    return;
  }

  // 4. Q 鍵：切換編制 A / B
  if (e.key === 'q' || e.key === 'Q') {
    e.preventDefault();
    const nextSlot = state.deckSlot === 'A' ? 'B' : 'A';
    switchDeckSlot(nextSlot);
    return;
  }

  // 5. 數字鍵 1、2、3：切換戰術教條
  if (e.key === '1') {
    setDoctrine('strike');
    return;
  }
  if (e.key === '2') {
    setDoctrine('defense');
    return;
  }
  if (e.key === '3') {
    setDoctrine('electronic');
    return;
  }

  // 6. D 鍵：調撥戰區軍火池 (隨機產生 5 兵種不同選項)
  if (e.key === 'd' || e.key === 'D') {
    e.preventDefault();
    rerollMarketPool();
    return;
  }
});

$('#btnRerollMarket')?.addEventListener('click', rerollMarketPool);

/* ---------- 啟動 ---------- */
state.scoutIdx = 0;
const savedTheme = LS.get('db15_theme', null);
const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
// 預設為淺色系 (日間戰情室)
const initialTheme = savedTheme || 'light';
applyTheme(initialTheme, false);

const savedSound = LS.get('db15_sound', true);
SoundEngine.enabled = savedSound;
if ($('#audioIcon')) $('#audioIcon').textContent = savedSound ? '🔊' : '🔇';

setupMatch();
renderAll();
if (!LS.get('db15_seen', 0)) showHelp();
window.__db15 = { state, startBattle, setMode, getGhostPool, applyTheme, toggleTheme };
})();
