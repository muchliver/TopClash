(function () {
'use strict';
/* =====================================================
   頂尖對戰：15元聯合作戰 — 互動介面與核心邏輯
   含：快速對戰、真人非同步幽靈對戰、BO3 征服賽、精選對戰、沙盒模擬
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

/* ---------- 軍規級純前端 Web Audio API 程序化物理音效合成引擎 (Procedural Military SFX) ---------- */
const SoundEngine = {
  ctx: null,
  masterComp: null,
  noiseBuffer: null,
  enabled: LS.get('db15_sound', true),

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      // 1. 母帶級動態壓限器：防止多武器交火頻率疊加造成數位破音與耳朵刺痛
      this.masterComp = this.ctx.createDynamicsCompressor();
      this.masterComp.threshold.setValueAtTime(-10, this.ctx.currentTime);
      this.masterComp.knee.setValueAtTime(24, this.ctx.currentTime);
      this.masterComp.ratio.setValueAtTime(8, this.ctx.currentTime);
      this.masterComp.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.masterComp.release.setValueAtTime(0.2, this.ctx.currentTime);
      this.masterComp.connect(this.ctx.destination);

      // 2. 生成高品質粉紅噪聲 (Pink Noise Buffer) 供氣流、噴氣尾焰、火藥與爆炸使用
      const bufferSize = this.ctx.sampleRate * 2;
      this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        data[i] = (b0 + b1 + b2 + white * 0.08) * 0.4;
      }
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

  // 播放具備真實戰場物理衝擊的軍武音效 (side: 'A' 為我方左側, 'B' 為敵方右側)
  play(type, side = 'A') {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || !this.noiseBuffer) return;

    try {
      const t = this.ctx.currentTime;
      const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
      if (panner) {
        panner.pan.setValueAtTime(side === 'A' ? -0.22 : 0.22, t);
        panner.connect(this.masterComp);
      }
      const outNode = panner || this.masterComp;

      if (type === 'heavy_cannon') {
        // 【120mm/125mm 戰車滑膛砲實彈射擊】
        // 層次 1：0~12ms 爆燃裂帛瞬態破空音 (Transient Crack)
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(1400, t);
        noiseFilter.frequency.exponentialRampToValueAtTime(260, t + 0.15);
        noiseFilter.Q.setValueAtTime(3.2, t);
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.55, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(outNode);
        noise.start(t);
        noise.stop(t + 0.2);

        // 層次 2：38Hz 次低音胸膛後座力重擊 (Sub-Bass Chest Thud)
        const sub = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(160, t);
        sub.frequency.exponentialRampToValueAtTime(36, t + 0.26);
        subGain.gain.setValueAtTime(0.75, t);
        subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        sub.connect(subGain);
        subGain.connect(outNode);
        sub.start(t);
        sub.stop(t + 0.36);

      } else if (type === 'cannon') {
        // 【30mm 機砲 / 鏈砲點射 (高穿透金屬雙連發)】
        for (let i = 0; i < 2; i++) {
          const delay = i * 0.08;
          const noise = this.ctx.createBufferSource();
          noise.buffer = this.noiseBuffer;
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(2100, t + delay);
          filter.frequency.exponentialRampToValueAtTime(500, t + delay + 0.07);
          filter.Q.setValueAtTime(2.8, t + delay);
          const gain = this.ctx.createGain();
          gain.gain.setValueAtTime(0.35, t + delay);
          gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.08);
          noise.connect(filter);
          filter.connect(gain);
          gain.connect(outNode);
          noise.start(t + delay);
          noise.stop(t + delay + 0.09);

          const thud = this.ctx.createOscillator();
          const thudGain = this.ctx.createGain();
          thud.type = 'triangle';
          thud.frequency.setValueAtTime(180, t + delay);
          thud.frequency.exponentialRampToValueAtTime(55, t + delay + 0.08);
          thudGain.gain.setValueAtTime(0.38, t + delay);
          thudGain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.09);
          thud.connect(thudGain);
          thudGain.connect(outNode);
          thud.start(t + delay);
          thud.stop(t + delay + 0.1);
        }

      } else if (type === 'missile') {
        // 【超音速巡弋/空空飛彈噴射尾焰 + 空氣呼嘯都卜勒破空】
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(320, t);
        filter.frequency.exponentialRampToValueAtTime(1700, t + 0.16);
        filter.frequency.exponentialRampToValueAtTime(420, t + 0.38);
        filter.Q.setValueAtTime(4.2, t);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.04, t);
        gain.gain.linearRampToValueAtTime(0.42, t + 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(outNode);
        noise.start(t);
        noise.stop(t + 0.42);

      } else if (type === 'rocket_salvo') {
        // 【海馬斯 / 多管火箭飽和齊射 (多發呼嘯)】
        for (let i = 0; i < 3; i++) {
          const delay = i * 0.065;
          const noise = this.ctx.createBufferSource();
          noise.buffer = this.noiseBuffer;
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(260 + i * 40, t + delay);
          filter.frequency.exponentialRampToValueAtTime(1200 + i * 150, t + delay + 0.12);
          filter.frequency.exponentialRampToValueAtTime(350, t + delay + 0.24);
          filter.Q.setValueAtTime(3.5, t + delay);
          const gain = this.ctx.createGain();
          gain.gain.setValueAtTime(0.05, t + delay);
          gain.gain.linearRampToValueAtTime(0.28, t + delay + 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.26);
          noise.connect(filter);
          filter.connect(gain);
          gain.connect(outNode);
          noise.start(t + delay);
          noise.stop(t + delay + 0.28);
        }

      } else if (type === 'torpedo') {
        // 【重型反潛魚雷水下低頻推進】
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(240, t);
        filter.frequency.exponentialRampToValueAtTime(65, t + 0.4);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.45, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(outNode);
        noise.start(t);
        noise.stop(t + 0.44);

      } else if (type === 'swarm') {
        // 【自殺無人機蜂群高速掠空 (高頻無刷馬達與氣流)】
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(820, t);
        osc.frequency.linearRampToValueAtTime(1420, t + 0.16);
        osc.frequency.linearRampToValueAtTime(640, t + 0.32);
        gain.gain.setValueAtTime(0.02, t);
        gain.gain.linearRampToValueAtTime(0.22, t + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
        osc.connect(gain);
        gain.connect(outNode);
        osc.start(t);
        osc.stop(t + 0.35);

      } else if (type === 'explosion') {
        // 【戰損毀滅大爆炸 (高空破片裂帛 + 80Hz 低通重型滾動巨響 + 40Hz 次低音)】
        // 衝擊波裂帛與破片
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1400, t);
        filter.frequency.exponentialRampToValueAtTime(70, t + 0.6);
        filter.Q.setValueAtTime(2.2, t);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.85, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.68);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(outNode);
        noise.start(t);
        noise.stop(t + 0.7);

        // 核心殉爆次低音震顫 (Sub-Bass Rumble)
        const sub = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(120, t);
        sub.frequency.exponentialRampToValueAtTime(28, t + 0.55);
        subGain.gain.setValueAtTime(0.9, t);
        subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        sub.connect(subGain);
        subGain.connect(outNode);
        sub.start(t);
        sub.stop(t + 0.62);

      } else if (type === 'hit_impact') {
        // 【裝甲受擊金屬貫穿衝擊音】
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(2600, t);
        filter.frequency.exponentialRampToValueAtTime(400, t + 0.12);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.45, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(outNode);
        noise.start(t);
        noise.stop(t + 0.15);

      } else if (type === 'block') {
        // 【主動防護系統 APS 空中金屬破片硬殺攔截】
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(2600, t);
        osc.frequency.exponentialRampToValueAtTime(750, t + 0.09);
        gain.gain.setValueAtTime(0.42, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        osc.connect(gain);
        gain.connect(outNode);
        osc.start(t);
        osc.stop(t + 0.11);

      } else if (type === 'emp_pulse') {
        // 【電子戰全頻段電磁脈衝過載雜訊】
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(3200, t);
        filter.frequency.exponentialRampToValueAtTime(280, t + 0.28);
        filter.Q.setValueAtTime(6.0, t);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.28, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(outNode);
        noise.start(t);
        noise.stop(t + 0.32);

      } else if (type === 'equip') {
        // 【軍械卡榫上膛點擊聲 (Click-Clack)】
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1900, t);
        osc.frequency.exponentialRampToValueAtTime(650, t + 0.04);
        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        osc.connect(gain);
        gain.connect(outNode);
        osc.start(t);
        osc.stop(t + 0.06);

      } else if (type === 'victory') {
        // 【軍事勝利凱旋和弦 (F4 -> A4 -> C5)】
        [349.23, 440.0, 523.25].forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, t + idx * 0.08);
          gain.gain.setValueAtTime(0.16, t + idx * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.08 + 0.7);
          osc.connect(gain);
          gain.connect(outNode);
          osc.start(t + idx * 0.08);
          osc.stop(t + idx * 0.08 + 0.75);
        });
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
  quickSubMode: 'ai', // 'ai' (預設 AI 演習) 或 'ghost' (全球名將異步幽靈)
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
  /* 精選對戰題目選擇 ('today' 或 DAILY_PLANS 的 id) */
  dailyPlanId: 'today',
  /* 幽靈對戰專屬 */
  ghostTarget: null,
  /* BO3 專屬 */
  bo3: {
    active: false, round: 1, winsA: 0, winsB: 0, history: [],
    rivalName: '', rivalBaseDeck: null, enemyDeck: null, enemyDoc: 'defense',
    bannedByA: null, bannedByB: null, candidateBan: null, nextEvent: null
  },
  /* 線上真人雙人對戰狀態 (WebRTC Online PvP) */
  isOnlinePvp: false,
  pvpMyReady: false,
  pvpOpponentReady: false,
  pvpOpponentDeck: null,
  pvpOpponentDoc: 'defense'
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
    const isRandomTier = state.dailyPlanId === 'random_tier';
    const seedNum = isToday ? hashStr('db15-' + dateKey()) : (isRandomTier ? ((Math.random() * 4294967296) >>> 0) : hashStr('db15-' + dateKey() + '-' + state.dailyPlanId));
    const rng = mulberry32(seedNum);
    state.event = EVENTS[Math.floor(rng() * EVENTS.length)];
    let p = null;
    if (isToday) {
      // 今日官方特選：依據當日種子決定難度階梯 ($19 ~ $25 均勻隨機)
      p = DAILY_PLANS[Math.floor(rng() * DAILY_PLANS.length)];
    } else if (isRandomTier) {
      // 隨機精選對戰對手：每次切換都隨機抽取 $19~$25 的題目
      p = DAILY_PLANS[Math.floor(Math.random() * DAILY_PLANS.length)];
    } else {
      p = DAILY_PLANS.find(x => x.id === state.dailyPlanId) || DAILY_PLANS[0];
    }
    state.enemy = buildFromPlan(p.plan, rng);
    state.enemyName = p.name;
    state.enemyDoc = DOCTRINES[Math.floor(rng() * 3)].id;
  } else if (state.mode === 'quick') {
    state.event = pick(EVENTS);
    if (state.quickSubMode === 'ghost') {
      const pool = getGhostPool();
      state.ghostTarget = state.ghostTarget || pick(pool);
      state.enemy = state.ghostTarget.deck.slice();
      state.enemyName = state.ghostTarget.callsign;
      state.enemyDoc = state.ghostTarget.doctrine;
    } else {
      const arch = state.aiArch === 'random' ? pick(ARCHETYPES) : ARCHETYPES.find(a => a.id === state.aiArch);
      state.enemy = buildFromPlan(arch.plan, Math.random);
      state.enemyName = arch.name;
      state.enemyDoc = pick(DOCTRINES).id;
    }
  } else if (state.mode === 'ghost') {
    state.mode = 'quick';
    state.quickSubMode = 'ghost';
    setupMatch();
    return;
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
// 嚴格分層隨機抽樣：保證 5 大兵種每一類別均嚴格維持 5, 4, 3, 2, 1 各一個武器選項，杜絕金額等級重複
function generateRandomMarketPool() {
  const cats = ['air', 'armor', 'air_defense', 'naval', 'support'];
  const costs = [5, 4, 3, 2, 1];
  const pool = {};

  cats.forEach(cat => {
    pool[cat] = costs.map(cost => {
      // 找出該兵種該價位的 4 款不同型號裝備 (A/B/C/D)
      const cand = UNITS.filter(u => u.cat === cat && u.cost === cost);
      if (!cand.length) return null;
      // 隨機抽選其中一款型號
      const picked = cand[Math.floor(Math.random() * cand.length)];
      // 同步記錄該價位的型號選擇
      state.variants[`${cat}-${cost}`] = picked.v;
      return picked;
    }).filter(Boolean);
  });

  state.marketPool = pool;
  return pool;
}

function updateRerollMarketButtonState() {
  const btn = $('#btnRerollMarket');
  if (!btn) return;
  if (state.mode === 'bo3') {
    btn.disabled = true;
    btn.classList.add('locked-bo3');
    btn.setAttribute('title', 'BO5 征服賽期間軍火庫由戰區司令部固定配給，嚴禁臨陣更換軍火庫！請善用現有裝備調整戰術。');
    const icon = btn.querySelector('.reroll-icon');
    const title = btn.querySelector('.reroll-title');
    const sub = btn.querySelector('.reroll-sub');
    if (icon) icon.textContent = '🔒';
    if (title) title.innerHTML = '軍火庫已鎖定';
    if (sub) sub.textContent = 'BO5 系列賽固定配給 · 禁洗牌';
  } else {
    btn.disabled = false;
    btn.classList.remove('locked-bo3');
    btn.setAttribute('title', '隨機調撥 5 大兵種戰區軍火庫 (注意：將清空當前選取) [快捷鍵 D]');
    const icon = btn.querySelector('.reroll-icon');
    const title = btn.querySelector('.reroll-title');
    const sub = btn.querySelector('.reroll-sub');
    if (icon) icon.textContent = '🎲';
    if (title) title.innerHTML = '調撥戰區軍火 <kbd>D</kbd>';
    if (sub) sub.textContent = '重新洗牌 25 款軍武 · 清空當前選取';
  }
}

function rerollMarketPool() {
  if (state.mode === 'bo3') {
    toast('🔒 BO5 征服賽期間軍火庫已封閉鎖定！請在現有配給裝備中調整陣容應對。');
    return;
  }
  // 調撥軍火等同重置當前選取，杜絕利用保留裝備反覆洗出理想軍火的不公平刷牌漏洞
  state.deck = [null, null, null, null, null];
  state.active = 0;
  syncActiveDeck();

  generateRandomMarketPool();
  SoundEngine.play('equip');
  toast('🎲 戰區軍火已全面調撥！已清除當前選取，請由新軍火庫重新選配。');
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
  const diff = (cost + u.cost) - budgetLimit();
  if (diff > 0) return `預算不足 (差$${diff})`;
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
    const isGhost = (state.quickSubMode === 'ghost');
    const t = state.ghostTarget;

    h = `<span class="mission-tag">RAPID BATTLE · 快速交鋒</span>
      <!-- 對手類型二維切換膠囊 -->
      <div class="btn-group-pill quick-submode-pill" style="display:inline-flex;margin:0 4px">
        <button class="pill-btn sm ${!isGhost ? 'active' : ''}" data-submode="ai" title="切換為電腦即時演算法對手">🤖 AI 演習</button>
        <button class="pill-btn sm ${isGhost ? 'active' : ''}" data-submode="ghost" title="切換為全球名將與真實玩家影子部隊">🌐 全球幽靈</button>
      </div>

      <div class="mission-item">
        <span style="font-size:18px">${state.event.icon}</span>
        <div><b>${esc(state.event.name)}</b> <span class="muted" style="font-size:11.5px">(${esc(state.event.desc)})</span></div>
      </div>`;

    if (!isGhost) {
      h += `
        <div class="mission-item" style="margin-left:8px">
          <span class="muted">AI 風格：</span>
          <select class="select sm" id="aiSel" style="padding:3px 8px;width:auto;font-size:12px">
            <option value="random">隨機對手</option>
            ${ARCHETYPES.map(a => `<option value="${a.id}" ${state.aiArch === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
          </select>
        </div>
        <label class="check" style="margin-left:8px;font-size:12px">
          <input type="checkbox" id="scoutChk" ${state.scout ? 'checked' : ''}>
          <span>情報偵察 (預算 −$1)</span>
        </label>
        ${state.scout ? `<span class="mission-tag" style="color:var(--amber);border-color:rgba(255,179,64,.3)">偵得：${esc(state.enemyName)} · ${esc(UNIT_MAP[state.enemy[state.scoutIdx]].name)}</span>` : ''}`;
    } else {
      if (t) {
        h += `
          <div class="mission-item" style="margin-left:8px">
            <b>${esc(t.callsign)}</b>
            <span class="ghost-rank" style="font-size:11px;padding:1px 6px">${t.title} · ${t.rating} RP</span>
            <span class="muted" style="font-size:11.5px">戰績: ${t.wins}勝 ${t.losses}負 · 「${esc(t.motto)}」</span>
          </div>
          <div class="mission-actions">
            <button class="btn ghost sm" id="btnRerollGhost" title="隨機換一位幽靈名將對手">換一位名將 🔄</button>
            <button class="btn amber sm" id="btnDeployGhost" title="上傳當前陣容為世界影子防禦部隊">部署防禦部隊 🌐</button>
          </div>`;
      }
    }
  } else if (mode === 'ghost') {
    state.mode = 'quick';
    state.quickSubMode = 'ghost';
    renderMissionBar();
    return;
  } else if (mode === 'bo3') {
    const b = state.bo3;
    if (state.isOnlinePvp) {
      const opp = OnlinePvPEngine.getOpponent();
      const oppDisplay = opp ? `${opp.flag} ${opp.name}` : b.rivalName;
      h = `<span class="mission-tag" style="background:rgba(56,189,248,.18);color:#38bdf8;border-color:rgba(56,189,248,.4);font-weight:800">🌐 線上真人 BO5 · 第 ${b.round}/5 局</span>
        <div class="mission-item" style="background:rgba(255,255,255,.06);padding:3px 10px;border-radius:6px;border:1px solid var(--line2)">
          <span style="font-family:var(--head);font-size:16px;font-weight:800;letter-spacing:.05em">即時比分：<b style="color:var(--cyan);font-size:18px">${b.winsA}</b> <span style="color:var(--muted)">-</span> <b style="color:var(--red);font-size:18px">${b.winsB}</b></span>
          <span class="muted" style="margin-left:10px">對手：<b style="color:var(--text)">${esc(oppDisplay)}</b></span>
          <span class="badge ${state.pvpOpponentReady ? 'badge-ok' : 'badge-no'}" style="margin-left:8px;font-size:11px">${state.pvpOpponentReady ? '✔ 對手已就緒' : '⏳ 對手配置中'}</span>
          ${b.bannedByA ? `<span style="color:var(--green);background:rgba(93,255,176,.12);border:1px solid rgba(93,255,176,.4);padding:2px 7px;border-radius:4px;font-size:11.5px;margin-left:8px;font-weight:700">🚫 你已禁用敵方：$${UNIT_MAP[b.bannedByA].cost} ${UNIT_MAP[b.bannedByA].name} (${CATS[UNIT_MAP[b.bannedByA].cat].label})</span>` : ''}
          ${b.bannedByB ? `<span style="color:var(--red);background:rgba(255,93,110,.12);border:1px solid rgba(255,93,110,.4);padding:2px 7px;border-radius:4px;font-size:11.5px;margin-left:8px;font-weight:700">⚠️ 敵方已禁用你：$${UNIT_MAP[b.bannedByB].cost} ${UNIT_MAP[b.bannedByB].name} (${CATS[UNIT_MAP[b.bannedByB].cat].label})</span>` : ''}
        </div>
        <div class="mission-actions">
          <button class="btn ghost sm" id="btnExitPvp" style="color:var(--red);border-color:rgba(255,93,110,.3)" title="退出當前線上對戰房間">退出連線 ✕</button>
        </div>`;
    } else {
      h = `<span class="mission-tag" style="background:rgba(255,179,64,.18);color:var(--amber);border-color:rgba(255,179,64,.4);font-weight:800">🏆 BO5 征服賽 · 第 ${b.round}/5 局 (五局三勝制)</span>
        <div class="mission-item" style="background:rgba(255,255,255,.06);padding:3px 10px;border-radius:6px;border:1px solid var(--line2)">
          <span style="font-family:var(--head);font-size:16px;font-weight:800;letter-spacing:.05em">當前比分：<b style="color:var(--cyan);font-size:18px">${b.winsA}</b> <span style="color:var(--muted)">-</span> <b style="color:var(--red);font-size:18px">${b.winsB}</b></span>
          <span class="muted" style="margin-left:10px">對手：<b style="color:var(--text)">${esc(b.rivalName)}</b></span>
          ${b.bannedByA ? `<span style="color:var(--green);background:rgba(93,255,176,.12);border:1px solid rgba(93,255,176,.4);padding:2px 7px;border-radius:4px;font-size:11.5px;margin-left:8px;font-weight:700">🚫 你已禁用敵方：$${UNIT_MAP[b.bannedByA].cost} ${UNIT_MAP[b.bannedByA].name} (${CATS[UNIT_MAP[b.bannedByA].cat].label})</span>` : ''}
          ${b.bannedByB ? `<span style="color:var(--red);background:rgba(255,93,110,.12);border:1px solid rgba(255,93,110,.4);padding:2px 7px;border-radius:4px;font-size:11.5px;margin-left:8px;font-weight:700">⚠️ 敵方已禁用你：$${UNIT_MAP[b.bannedByB].cost} ${UNIT_MAP[b.bannedByB].name} (${CATS[UNIT_MAP[b.bannedByB].cat].label})</span>` : ''}
        </div>
        <div class="mission-actions">
          <button class="btn amber sm" id="btnOnlinePvp" title="建立或加入線上雙人 P2P 即時對戰房間">⚔️ 線上雙人房 (Online)</button>
          <button class="btn ghost sm" id="btnResetBo3" title="重置比分並配對新對手">重置系列賽 🔄</button>
        </div>`;
    }
  } else if (mode === 'daily') {
    const k = state.dailyPlanId === 'today' ? ('db15_daily_' + dateKey()) : ('db15_daily_' + dateKey() + '_' + state.dailyPlanId);
    const rec = LS.get(k, null);
    const enemyCost = deckCost(state.enemy);
    const overCost = enemyCost - 15;

    // 將題目按預算分組
    const tiers = [19, 20, 21, 22, 23, 24, 25];
    const groupedOptions = tiers.map(cost => {
      const plans = DAILY_PLANS.filter(p => p.cost === cost);
      if (!plans.length) return '';
      const label = cost === 25 ? `─── $25 終極滅世神裝 ───` : `─── $${cost} 超標階梯 ───`;
      return `<optgroup label="${label}">
        ${plans.map(dp => `<option value="${dp.id}" ${state.dailyPlanId === dp.id ? 'selected' : ''}>${dp.name} ($${dp.cost}超標)</option>`).join('')}
      </optgroup>`;
    }).join('');

    h = `<span class="mission-tag" style="background:rgba(239,68,68,.16);color:var(--red);border-color:rgba(239,68,68,.4);font-weight:800">FEATURED MATCH · 精選對戰 #${dailyNo()}</span>
      <div class="mission-item">
        <span class="muted">選擇關卡：</span>
        <select class="select sm" id="dailyPlanSel" style="padding:3px 8px;width:auto;font-size:12px;font-weight:700">
          <option value="today" ${state.dailyPlanId === 'today' ? 'selected' : ''}>🌟 今日官方特選 (每日隨機 $19~$25)</option>
          <option value="random_tier" ${state.dailyPlanId === 'random_tier' ? 'selected' : ''}>🎲 隨機自由對手 ($19~$25 隨機抽題)</option>
          ${groupedOptions}
        </select>
      </div>
      <div class="mission-item" style="margin-left:8px">
        <span>對手：<b style="color:${enemyCost >= 25 ? '#ff3b30' : enemyCost >= 22 ? 'var(--amber)' : 'var(--cyan)'}">$${enemyCost}</b>（${esc(state.enemyName)} · 超標 +$${overCost}）</span>
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
  updateRerollMarketButtonState();
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

    // 確保已在隊伍中的該兵種裝備精準對齊在同一價位槽位，嚴格維持 5, 4, 3, 2, 1 結構
    const equippedInDeck = state.deck.map(id => id ? UNIT_MAP[id] : null).find(unit => unit && unit.cat === cat);
    if (equippedInDeck) {
      const matchIdx = displayUnits.findIndex(u => u.cost === equippedInDeck.cost);
      if (matchIdx >= 0) {
        displayUnits = displayUnits.slice();
        displayUnits[matchIdx] = equippedInDeck;
      }
    }

    // 【重要修復】若該兵種有被 BAN 的單位（如大衛投石索），強制在看板該價位格位展示該單位本尊，杜絕被其他型號隱藏遮蔽！
    const bannedIds = currentBanned();
    if (bannedIds.length) {
      bannedIds.forEach(bId => {
        const bUnit = UNIT_MAP[bId];
        if (bUnit && bUnit.cat === cat) {
          const matchIdx = displayUnits.findIndex(u => u.cost === bUnit.cost);
          if (matchIdx >= 0 && (!equippedInDeck || equippedInDeck.cost !== bUnit.cost)) {
            displayUnits = displayUnits.slice();
            displayUnits[matchIdx] = bUnit;
            state.variants[`${cat}-${bUnit.cost}`] = bUnit.v;
          }
        }
      });
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
          ${why && !isEquipped ? `<span class="m-why ${isBanned ? 'why-banned' : 'why-budget'}">${why}</span>` : ''}
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

  if (state.isOnlinePvp) {
    if (state.pvpMyReady) {
      btnGo.disabled = true;
      btnGo.classList.remove('status-ready', 'status-missing', 'status-error');
      btnGo.classList.add('status-locked');
    } else {
      btnGo.disabled = !isReady;
      btnGo.classList.toggle('status-ready', isReady);
      btnGo.classList.toggle('status-missing', !isReady && missing > 0);
      btnGo.classList.toggle('status-error', !isReady && missing === 0 && errs.length > 0);
    }
  } else {
    btnGo.disabled = !isReady;
    btnGo.classList.toggle('status-ready', isReady);
    btnGo.classList.toggle('status-missing', !isReady && missing > 0);
    btnGo.classList.toggle('status-error', !isReady && missing === 0 && errs.length > 0);
  }

  const launchTitle = $('#launchTitle');
  const launchSub = $('#launchSub');
  const launchIcon = $('#launchIcon');

  if (launchTitle && launchSub) {
    if (state.isOnlinePvp && state.pvpMyReady) {
      if (launchIcon) launchIcon.textContent = '⏳';
      launchTitle.textContent = state.pvpOpponentReady ? '雙方就緒，即將開打...' : '陣容已鎖定 · 等待對手';
      launchSub.textContent = state.pvpOpponentReady ? '同步戰場數據中...' : '對手指揮官配置中，請稍候...';
    } else if (isReady) {
      if (state.isOnlinePvp) {
        if (launchIcon) launchIcon.textContent = state.pvpOpponentReady ? '⚡' : '🔒';
        launchTitle.textContent = state.pvpOpponentReady ? '對手已就緒！點擊鎖定出擊' : '鎖定陣容 (提交戰術)';
        launchSub.textContent = state.pvpOpponentReady ? '對手已在等待你！點擊立即開戰' : '點擊鎖定 5 槽陣容並發送給對手';
      } else if (state.mode === 'sandbox') {
        if (launchIcon) launchIcon.textContent = '⚡';
        launchTitle.textContent = '開始 300 場模擬';
        launchSub.textContent = '陣容就緒 · SPACE / ENTER';
      } else if (state.mode === 'bo3') {
        if (launchIcon) launchIcon.textContent = '🏆';
        launchTitle.textContent = `第 ${state.bo3.round} 局開戰 (${state.bo3.winsA}-${state.bo3.winsB})`;
        launchSub.textContent = '陣容就緒 · SPACE / ENTER';
      } else {
        if (launchIcon) launchIcon.textContent = '⚔️';
        launchTitle.textContent = '開始聯合作戰';
        launchSub.textContent = '陣容就緒 · SPACE / ENTER';
      }
    } else if (errs.length > 0 && missing === 0) {
      if (launchIcon) launchIcon.textContent = '🚫';
      launchTitle.textContent = '預算超額';
      launchSub.textContent = errs[0];
    } else {
      if (launchIcon) launchIcon.textContent = '⏳';
      launchTitle.textContent = `尚缺 ${missing} 個槽位`;
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
  if (e.target.closest('#btnCodeToggle')) {
    $('#codeMenu').hidden = !$('#codeMenu').hidden;
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
    if (state.mode === 'sandbox') {
      runSandbox();
    } else if (state.isOnlinePvp) {
      handleOnlinePvpSubmit();
    } else {
      startBattle();
    }
    return;
  }
});

// 點擊空白處關閉選單
document.addEventListener('click', e => {
  if (!e.target.closest('#codeDropdownWrap')) { const m = $('#codeMenu'); if (m) m.hidden = true; }
});

// 橫幅事件代理
$('#missionBar').addEventListener('click', e => {
  const subBtn = e.target.closest('[data-submode]');
  if (subBtn) {
    const targetSub = subBtn.dataset.submode;
    if (state.quickSubMode !== targetSub) {
      state.quickSubMode = targetSub;
      setupMatch();
      renderAll();
      toast(targetSub === 'ghost' ? '🌐 已切換至「全球幽靈」：挑戰世界名將異步防禦戰隊！' : '🤖 已切換至「AI 演習」：自由挑戰各流派 AI 戰術教條！');
    }
    return;
  }
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
    initBo3Series();
    generateRandomMarketPool();
    state.deck = [null, null, null, null, null];
    state.active = 0;
    syncActiveDeck();
    renderAll();
    toast(`🔄 已重置 BO5 征服系列賽，重新配對新對手【${state.bo3.rivalName}】！新軍火庫已配給完畢並鎖定。`);
    return;
  }
  if (e.target.closest('#btnOnlinePvp')) {
    openOnlinePvpModal(); return;
  }
  if (e.target.closest('#btnExitPvp')) {
    OnlinePvPEngine.closeConnection();
    state.isOnlinePvp = false;
    state.pvpMyReady = false;
    state.pvpOpponentReady = false;
    state.pvpOpponentDeck = null;
    initBo3Series();
    renderAll();
    toast('已安全退出線上雙人對戰房間，回到常規模式。');
    return;
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
    handleDailyPlanChange(e.target.value);
  }
  if (e.target.id === 'sandEnemy') state.sandEnemy = e.target.value;
  if (e.target.id === 'sandEvent') state.sandEvent = e.target.value;
});

function handleDailyPlanChange(val) {
  state.dailyPlanId = val;
  setupMatch();
  renderAll();
  let planName = '今日官方特選題目';
  const c = deckCost(state.enemy);
  if (val === 'random_tier') {
    planName = `🎲 隨機抽題【${state.enemyName}】($${c}超標 · +$${c - 15})`;
  } else if (val === 'today') {
    planName = `🌟 今日特選【${state.enemyName}】($${c}超標 · +$${c - 15})`;
  } else {
    const found = DAILY_PLANS.find(p => p.id === val);
    planName = found ? `【${found.name}】($${c}超標 · +$${c - 15})` : state.enemyName;
  }
  toast(`已切換精選對戰題目：${planName}`);
}

$('#missionBar').addEventListener('change', e => {
  if (e.target.id === 'dailyPlanSel') {
    handleDailyPlanChange(e.target.value);
  }
  if (e.target.id === 'sandEnemy') state.sandEnemy = e.target.value;
  if (e.target.id === 'sandEvent') state.sandEvent = e.target.value;
  if (e.target.id === 'aiArchSel') {
    state.aiArch = e.target.value;
    setupMatch();
    renderAll();
  }
});

/* ---------- 離開/清理戰鬥推演與檢視戰場 ---------- */
function exitActiveBattle() {
  playToken++; // 中止推演循環
  const vb = $('#viewBattle');
  if (vb) vb.hidden = true;
  
  // 關閉所有戰鬥相關彈窗與主遮罩
  const modals = [
    $('#resultModal'),
    $('#ladderResultModal'),
    $('#bo3SeriesModal'),
    $('#bo3RoundModal')
  ];
  modals.forEach(m => {
    if (m) m.hidden = true;
  });
  if (typeof currentActiveModal !== 'undefined' && currentActiveModal) {
    currentActiveModal.hidden = true;
  }

  // 重置右上角戰鬥控制按鈕
  const btnSpeed = $('#btnSpeed'); if (btnSpeed) btnSpeed.hidden = false;
  const btnSkip = $('#btnSkip'); if (btnSkip) btnSkip.hidden = false;
  const btnReopen = $('#btnReopenResult'); if (btnReopen) btnReopen.hidden = true;
  const btnExit = $('#btnBattleExit'); if (btnExit) btnExit.hidden = true;

  // 清空戰鬥特效層
  const fxLayer = $('#combatFxLayer');
  if (fxLayer) fxLayer.innerHTML = '';
}

/* ---------- 模式切換與預算修剪 ---------- */
$('#modeTabs').addEventListener('click', e => {
  const b = e.target.closest('[data-mode]'); if (!b) return;
  setMode(b.dataset.mode);
});

// 點擊品牌 Logo 亦可平滑返回快速對戰指揮所
const brandLogo = $('.brand');
if (brandLogo) {
  brandLogo.addEventListener('click', () => {
    setMode('quick');
  });
}

function setMode(m) {
  // 無論何時點選上方功能列（即使在戰鬥中或檢視戰場情形），立即乾淨退出戰鬥
  exitActiveBattle();

  // 相容舊 ghost 模式：自動映射至快速對戰之幽靈子模式
  if (m === 'ghost') {
    m = 'quick';
    state.quickSubMode = 'ghost';
  }

  const prevMode = state.mode;
  state.mode = m; state.sandResult = null; state.scout = false;
  document.querySelectorAll('.mode-btn').forEach(x => x.classList.toggle('active', x.dataset.mode === m));
  
  const viewLadder = $('#viewLadder');
  const viewTournament = $('#viewTournament');
  const viewBuild = $('#viewBuild');
  const missionBar = $('#missionBar');
  const commandDeck = $('#commandDeck');

  if (m === 'ladder') {
    if (viewLadder) viewLadder.hidden = false;
    if (viewTournament) viewTournament.hidden = true;
    if (viewBuild) viewBuild.hidden = true;
    if (missionBar) missionBar.hidden = true;
    if (commandDeck) commandDeck.hidden = true;
    renderLadderView();
    toast('🏆 已進入天梯競技場：挑戰全球王牌防線，爭奪五星特級上將席位！');
    const p = LadderEngine.getState().player;
    if (!p.hasCustomName) {
      setTimeout(() => openCommanderModal(), 400);
    }
    return;
  } else if (m === 'tournament') {
    if (viewTournament) viewTournament.hidden = false;
    if (viewLadder) viewLadder.hidden = true;
    if (viewBuild) viewBuild.hidden = true;
    if (missionBar) missionBar.hidden = true;
    if (commandDeck) commandDeck.hidden = true;
    renderTournamentView();
    toast('🥇 已進入世界盃淘汰錦標賽：4/8/16/32 強世足樹狀爭霸戰！');
    return;
  } else {
    if (viewLadder) viewLadder.hidden = true;
    if (viewTournament) viewTournament.hidden = true;
    if (viewBuild) viewBuild.hidden = false;
    if (missionBar) missionBar.hidden = false;
    if (commandDeck) commandDeck.hidden = false;
  }

  prune(); setupMatch(); renderAll();
  if (m === 'bo3') {
    toast(`🏆 已進入 BO5 征服賽：五局三勝制！配對對手【${state.bo3.rivalName}】，輸掉該局之一方可啟動戰術反制，禁用對方關鍵裝備！`);
  } else if (m === 'daily') {
    toast(`🎯 已進入精選對戰 #${dailyNo()}：挑戰超標對手，考驗戰略微操！`);
  } else if (m === 'sandbox') {
    toast('🧪 已進入沙盒模擬：推演 300 場大規模戰術大數據！');
  } else if (m === 'quick') {
    if (state.quickSubMode === 'ghost') {
      toast('🌐 已進入快速對戰 · 全球名將異步幽靈！');
    } else if (prevMode !== 'quick') {
      toast('⚡ 已切換至快速對戰 · AI 戰術演習！');
    } else {
      toast('⚡ 已返回快速對戰陣容指揮所');
    }
  }
}

/* =====================================================
   🏆 天梯競技場介面與交互邏輯 (Tactical Ladder UI Controller)
   ===================================================== */
let currentRosterTab = 'live'; // 'live' 或 'yesterday'

function renderLadderView() {
  if (typeof LadderEngine === 'undefined') return;
  LadderEngine.init();
  const lState = LadderEngine.getState();
  const player = lState.player;
  const pTier = LadderEngine.getRankTier(player.rp);

  // 1. 渲染頂部個人戰情卡
  const myTierBadge = $('#myTierBadge');
  if (myTierBadge) {
    const iconStr = pTier.icon || '🎖️';
    const starCount = (iconStr.match(/⭐/g) || []).length;
    if (starCount >= 2) {
      myTierBadge.innerHTML = `<div class="tier-stars-box stars-${starCount}">${iconStr}</div>`;
    } else {
      myTierBadge.innerHTML = `<div class="tier-stars-box single">${iconStr}</div>`;
    }
    myTierBadge.title = `${pTier.name} (${pTier.en})`;
  }
  const myFlag = $('#myFlag');
  if (myFlag) myFlag.textContent = player.flag || '🇹🇼';
  const myCallsign = $('#myCallsign');
  if (myCallsign) myCallsign.textContent = player.name;
  const myUidPill = $('#myUidPill');
  if (myUidPill) myUidPill.textContent = player.uid || 'CMD-7392';
  const myTierName = $('#myTierName');
  if (myTierName) {
    myTierName.textContent = pTier.name;
    myTierName.style.color = pTier.color;
    myTierName.style.borderColor = pTier.color;
  }
  const myStreakBadge = $('#myStreakBadge');
  if (myStreakBadge) {
    const days = player.streakDays || 1;
    myStreakBadge.textContent = days >= 3 ? `👑 霸榜 ${days} 天` : `🛡️ 駐榜 ${days} 天`;
    myStreakBadge.className = days >= 3 ? 'my-streak-badge gold' : 'my-streak-badge';
  }
  const myRankVal = $('#myRankVal');
  if (myRankVal) myRankVal.textContent = `#${player.rank}`;

  const myRankTrend = $('#myRankTrend');
  if (myRankTrend) {
    const diff = player.yesterdayRank - player.rank;
    if (diff > 0) {
      myRankTrend.textContent = `▲ +${diff} (昨日 #${player.yesterdayRank})`;
      myRankTrend.className = 'trend';
    } else if (diff < 0) {
      myRankTrend.textContent = `▼ ${diff} (昨日 #${player.yesterdayRank})`;
      myRankTrend.className = 'trend down';
    } else {
      myRankTrend.textContent = `− 持平 (昨日 #${player.yesterdayRank})`;
      myRankTrend.className = 'trend flat';
    }
  }

  const myRPVal = $('#myRPVal');
  if (myRPVal) myRPVal.textContent = player.rp.toLocaleString();
  const myRPSub = $('#myRPSub');
  if (myRPSub) myRPSub.textContent = `昨日 ${player.yesterdayRP.toLocaleString()}`;

  const myOrdersVal = $('#myOrdersVal');
  if (myOrdersVal) {
    myOrdersVal.textContent = `⚡ ${player.orders} / 5`;
    myOrdersVal.className = player.orders > 0 ? 'val green' : 'val';
    if (player.orders === 0) myOrdersVal.style.color = '#ef4444';
  }

  // 防守部隊預覽
  const defDeck = player.defenseDeck || state.deck;
  const defBox = $('#defenseDeckPreview');
  if (defBox) {
    defBox.innerHTML = defDeck.map(id => {
      const u = UNIT_MAP[id];
      if (!u) return '<div class="mini-unit-chip"></div>';
      return `<div class="mini-unit-chip" title="${esc(u.name)} ($${u.cost})">
        <img src="${u.img || `assets/units/${u.id}.jpg`}" alt="${esc(u.name)}" onerror="this.style.display='none'"/>
        <span class="cost-tag">$${u.cost}</span>
      </div>`;
    }).join('');
  }

  // 2. 渲染 Top 30 單列階梯天梯榜
  renderLadderRosterTable();
}

function renderLadderRosterTable() {
  const tableBox = $('#rosterTableBox');
  if (!tableBox) return;
  const lState = LadderEngine.getState();
  const player = lState.player;

  const isLive = currentRosterTab === 'live';
  const list = isLive ? LadderEngine.getRosterTop30() : lState.yesterdayTop10;

  tableBox.innerHTML = list.map((u, idx) => {
    const isMe = u.id === player.id;
    const rankNo = u.rank || (idx + 1);
    const topClass = rankNo === 1 ? 'top-1' : rankNo === 2 ? 'top-2' : rankNo === 3 ? 'top-3' : '';
    const tier = LadderEngine.getRankTier(u.rp);
    const streak = u.streakDays || 1;

    // 挑戰規則判定：只能挑戰比自己高、且在前方 5 名以內之對手 (例如排名 25 只能挑戰 20~24 名)
    const canEngage = isLive && (rankNo < player.rank) && (rankNo >= player.rank - 5);
    const isOverRank = isLive && (rankNo < player.rank - 5); // 跨級鎖定
    const isBeaten = isLive && (rankNo > player.rank); // 已超越名次

    // 排名趨勢
    let trendHtml = '<span class="r-trend flat">− 持平</span>';
    if (isLive && u.yesterdayRank) {
      const diff = u.yesterdayRank - rankNo;
      if (diff > 0) trendHtml = `<span class="r-trend up">▲ +${diff}</span>`;
      else if (diff < 0) trendHtml = `<span class="r-trend down">▼ ${diff}</span>`;
    }

    // 連續維持該名次天數徽章
    let streakBadgeHtml = '';
    if (streak >= 5) {
      streakBadgeHtml = `<span class="r-streak-tag top" title="霸榜 ${streak} 天！擊敗可獲終結者超額獎勵">👑 霸榜 ${streak} 天</span>`;
    } else if (streak >= 3) {
      streakBadgeHtml = `<span class="r-streak-tag high" title="頑強守位 ${streak} 天！擊敗可獲終結者超額獎勵">🛡️ 守位 ${streak} 天</span>`;
    } else if (streak >= 2) {
      streakBadgeHtml = `<span class="r-streak-tag mid">🛡️ 守位 ${streak} 天</span>`;
    } else {
      streakBadgeHtml = `<span class="r-streak-tag new">🔥 今日新晉</span>`;
    }

    // 防守陣容預覽 (若為可挑戰的高位對手，中間部分槽位受電戰迷霧遮蔽增添策略性)
    const deckChipsHtml = (u.deck || []).map((id, slotIdx) => {
      const unit = UNIT_MAP[id];
      // 距離 3~5 名之對手中間 2 槽受迷霧遮蔽
      const isMasked = canEngage && (player.rank - rankNo >= 3) && (slotIdx === 1 || slotIdx === 2);
      if (isMasked) {
        return `<div class="r-deck-chip masked" title="受電戰迷霧遮蔽：未知裝備">
          <span style="font-size:10px">📡</span>
        </div>`;
      }
      if (!unit) return '<div class="r-deck-chip"></div>';
      return `<div class="r-deck-chip" title="${esc(unit.name)} ($${unit.cost})">
        <img src="${unit.img || `assets/units/${unit.id}.jpg`}" alt="${esc(unit.name)}" onerror="this.style.display='none'"/>
        <span class="chip-cost">$${unit.cost}</span>
      </div>`;
    }).join('');

    // 右側動作狀態欄
    let actionColHtml = '';
    if (isMe) {
      actionColHtml = `<span class="r-action-pill you">📍 我方作戰群</span>`;
    } else if (canEngage) {
      actionColHtml = `<button class="btn-ladder-engage" data-target-rank="${rankNo}" data-target-id="${u.id}">
        <span>⚔️ 挑戰</span>
        ${streak >= 3 ? '<b class="breaker-dot" title="終結者加成目標">+15</b>' : ''}
      </button>`;
    } else if (isOverRank) {
      actionColHtml = `<span class="r-action-pill locked" title="階梯限制：僅可挑戰前方 5 名內之目標">🔒 跨級鎖定</span>`;
    } else if (isBeaten) {
      actionColHtml = `<span class="r-action-pill beaten">✓ 已超越</span>`;
    }

    return `<div class="roster-row ${isMe ? 'is-me' : ''} ${topClass} ${canEngage ? 'engageable' : ''}">
      <div class="r-rank">${rankNo <= 3 ? ['🥇','🥈','🥉'][rankNo - 1] : '#' + rankNo}</div>
      <div class="r-trend">${trendHtml}</div>
      <div class="r-streak">${streakBadgeHtml}</div>
      <div class="r-commander">
        <span style="font-size:18px">${u.flag}</span>
        <div class="r-name-block">
          <span class="r-name">${esc(u.name)} ${isMe ? `<span class="r-my-tag">我方 ${esc(u.uid || player.uid || 'CMD-7392')}</span>` : ''}</span>
          <span class="r-title-sub">${esc(u.title || '戰區指揮官')} · <b style="color:${tier.color}">${tier.name}</b></span>
        </div>
      </div>
      <div class="r-rp">${u.rp.toLocaleString()} <small>RP</small></div>
      <div class="r-deck-preview">${deckChipsHtml}</div>
      <div class="r-action">${actionColHtml}</div>
    </div>`;
  }).join('');
}

// 天梯操作事件代理
$('#viewLadder')?.addEventListener('click', e => {
  // 1. 同步當前陣容為防守部隊
  if (e.target.closest('#btnSyncDefense')) {
    if (!state.deck.every(Boolean)) {
      toast('請先在快速對戰模式配置滿 5 個槽位再同步防守！');
      return;
    }
    LadderEngine.setDefenseFleet(state.deck, state.doctrine);
    renderLadderView();
    toast('🛡️ 已將當前主力編制同步為天梯防守部隊！');
    return;
  }

  // 2. 切換即時榜 vs 昨日榮譽榜
  if (e.target.closest('#tabRosterLive')) {
    currentRosterTab = 'live';
    $('#tabRosterLive').classList.add('active');
    $('#tabRosterYesterday').classList.remove('active');
    renderLadderRosterTable();
    return;
  }
  if (e.target.closest('#tabRosterYesterday')) {
    currentRosterTab = 'yesterday';
    $('#tabRosterYesterday').classList.add('active');
    $('#tabRosterLive').classList.remove('active');
    renderLadderRosterTable();
    return;
  }

  // 3. 發起天梯單列階梯挑戰 (點擊 ⚔️ 挑戰 按鈕)
  const engageBtn = e.target.closest('.btn-ladder-engage');
  if (engageBtn) {
    const targetRank = +engageBtn.dataset.targetRank;
    const targetId = engageBtn.dataset.targetId;
    const lState = LadderEngine.getState();
    const targetUser = lState.roster.find(u => u.rank === targetRank || u.id === targetId);
    if (!targetUser) {
      toast('❌ 目標指揮官資料已過期，請重新整理！');
      return;
    }

    // 檢查防跨級規則 (嚴格檢驗是否在玩家前方 5 名內)
    const pRank = lState.player.rank;
    if (targetUser.rank >= pRank) {
      toast('⚠️ 該名次低於或等於我方當前排名，無需重複挑戰！');
      return;
    }
    if (pRank - targetUser.rank > 5) {
      toast('🔒 階梯交戰守則：不可跨級挑戰！僅可挑戰前方最近 5 名以內之對手。');
      return;
    }

    if (!state.deck.every(Boolean)) {
      toast('⚠️ 你的出征部隊尚未配置滿 5 個槽位！請先切換至快速對戰補齊裝備。');
      return;
    }

    const playerOrders = lState.player.orders;
    if (playerOrders <= 0) {
      toast('❌ 今日作戰派遣令已耗盡 (0/5)！每日 00:00 補給完畢。');
      return;
    }

    // 啟動天梯挑戰！
    state.ladderEnemy = targetUser;
    state.enemy = targetUser.deck.slice();
    state.enemyName = `${targetUser.flag} ${targetUser.name}`;
    state.enemyDoc = targetUser.doc || 'defense';
    state.event = pick(EVENTS);

    // 關閉天梯視圖，切換至對戰視圖開始推演
    $('#viewLadder').hidden = true;
    startBattle();
    toast(`⚔️ 已派出聯合作戰群，向第 #${targetUser.rank} 名【${targetUser.name}】發起階梯突擊！`);
    return;
  }

  // 4. 自訂指揮官呼號與旗幟
  if (e.target.closest('#btnEditCallsign') || e.target.closest('#myCallsign')) {
    openCommanderModal();
    return;
  }
});

/* ---------- 🎖️ 指揮官呼號與任命狀 Modal (UID 對應與名稱唯一性驗證) ---------- */
const RANDOM_CALLSIGNS = [
  '蒼鷹特遣隊・李少校', '天弓先鋒作戰群', '深藍幽靈艦隊', '鐵血近衛第一旅',
  '雷霆防衛指揮部', '極限獵鷹中隊', '黑曜突擊戰鬥群', '赤焰遊騎兵分隊',
  '北極星巡弋部隊', '海神無人作戰群', '神盾防空聯隊', '紫電裝甲突擊軍',
  '玉山鋼鐵防衛聯隊', '風暴領主打擊群', '熾天使近距支援隊', '深淵潛龍特勤隊'
];
let selectedFlag = '🇹🇼';

/* 即時驗證使用者輸入的作戰呼號 (檢查長度、保留字與名稱是否與現役席次重複) */
function checkCallsignInputValidity() {
  const input = $('#commanderNameInput');
  const feedback = $('#callsignFeedback');
  const saveBtn = $('#commanderSave');
  if (!input || !feedback) return false;

  const val = input.value.trim();
  const p = LadderEngine.getState().player;
  const pUid = p.uid || LadderEngine.getPlayerUID();

  if (!val) {
    feedback.className = 'callsign-feedback invalid';
    feedback.innerHTML = '⚠️ 請輸入 2 ~ 16 字元的作戰部隊呼號！';
    input.classList.add('input-error');
    if (saveBtn) saveBtn.disabled = true;
    return false;
  }

  // 若與自身目前的名稱完全相同，提示維持現狀並允許保存
  if (val === p.name) {
    feedback.className = 'callsign-feedback unchanged';
    feedback.innerHTML = `ℹ️ 目前呼號已對應綁定專屬軍籍編號 [<b>${pUid}</b>]`;
    input.classList.remove('input-error');
    if (saveBtn) saveBtn.disabled = false;
    return true;
  }

  // 調用 LadderEngine 全域名稱唯一性校驗
  const valid = LadderEngine.validateCallsign(val);
  if (!valid.ok) {
    feedback.className = 'callsign-feedback invalid';
    feedback.innerHTML = `❌ ${valid.reason}`;
    input.classList.add('input-error');
    if (saveBtn) saveBtn.disabled = true;
    return false;
  }

  // 驗證通過：名稱唯一且符合軍規
  feedback.className = 'callsign-feedback valid';
  feedback.innerHTML = `✅ 呼號可用！確認後將與軍籍編號 [<b>${pUid}</b>] 永久綁定`;
  input.classList.remove('input-error');
  if (saveBtn) saveBtn.disabled = false;
  return true;
}

function openCommanderModal() {
  const p = LadderEngine.getState().player;
  const pUid = p.uid || LadderEngine.getPlayerUID();
  const modal = $('#commanderModal');
  if (!modal) return;
  currentActiveModal = modal;

  // 1. 填入專屬軍籍 UID (不可變)
  const idDisplay = $('#commanderIdDisplay');
  if (idDisplay) idDisplay.textContent = pUid;

  // 2. 填入目前呼號與旗幟
  const nameInput = $('#commanderNameInput');
  if (nameInput) {
    nameInput.value = p.name || '我方聯合戰術作戰群';
    nameInput.classList.remove('input-error');
  }
  selectedFlag = p.flag || '🇹🇼';

  document.querySelectorAll('.flag-opt').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.flag === selectedFlag);
  });

  // 3. 執行初始驗證狀態反饋
  checkCallsignInputValidity();

  modal.hidden = false;
  setTimeout(() => {
    if (nameInput) {
      nameInput.focus();
      nameInput.select();
    }
  }, 100);
}

// 綁定 commanderModal 互動
$('#flagPickerRow')?.addEventListener('click', e => {
  const btn = e.target.closest('.flag-opt');
  if (!btn) return;
  selectedFlag = btn.dataset.flag;
  document.querySelectorAll('.flag-opt').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
});

// 即時輸入重複性檢驗監聽
$('#commanderNameInput')?.addEventListener('input', () => {
  checkCallsignInputValidity();
});

// 🎲 隨機呼號 (智慧過濾已被佔用的呼號，保證產出絕對可用)
$('#btnRandomCallsign')?.addEventListener('click', () => {
  const available = RANDOM_CALLSIGNS.filter(name => !LadderEngine.isCallsignTaken(name, true));
  const pool = available.length > 0 ? available : RANDOM_CALLSIGNS;
  const rName = pick(pool);
  const input = $('#commanderNameInput');
  if (input) {
    input.value = rName;
    checkCallsignInputValidity();
  }
});

// 📋 複製軍籍編號 (UID)
$('#btnCopyCommanderId')?.addEventListener('click', () => {
  const p = LadderEngine.getState().player;
  const uid = p.uid || LadderEngine.getPlayerUID();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(uid).then(() => {
      toast(`📋 軍籍指戰編號 [${uid}] 已複製到剪貼簿！`);
    }).catch(() => {
      toast(`📋 指戰編號: ${uid}`);
    });
  } else {
    toast(`📋 指戰編號: ${uid}`);
  }
});

$('#commanderCancel')?.addEventListener('click', () => {
  $('#commanderModal').hidden = true;
  currentActiveModal = null;
});

$('#commanderSave')?.addEventListener('click', () => {
  const val = ($('#commanderNameInput')?.value || '').trim();
  if (!checkCallsignInputValidity()) {
    toast('⚠️ 呼號格式不合規或已被現有席次佔用，請重新命名！');
    return;
  }
  const result = LadderEngine.setPlayerProfile(val, selectedFlag);
  if (!result || !result.success) {
    toast(`⚠️ 任命失敗：${(result && result.reason) || '未知錯誤'}`);
    checkCallsignInputValidity();
    return;
  }
  $('#commanderModal').hidden = true;
  currentActiveModal = null;
  renderLadderView();
  toast(`🎖️ 戰術任命狀已頒布！指揮官【${selectedFlag} ${result.name}】(${result.uid}) 正式進駐戰區！`);
});

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

/* ---------- 沙盒大數據模擬系統 (Sandbox 300 Simulation Engine) ---------- */
function runSandbox() {
  const deck = state.deck.slice();
  const errs = validateDeck(deck, budgetLimit(), currentBanned());
  if (errs.length > 0) {
    toast('⚠️ 陣容未就緒：' + (errs[0] || '請先組建合法的 5 槽陣容再啟動模擬'));
    return;
  }

  // 1. 取得對手風格群
  const archs = state.sandEnemy === 'random' ? ARCHETYPES : [ARCHETYPES.find(a => a.id === state.sandEnemy)].filter(Boolean);
  const targetRuns = 300;
  const per = Math.ceil(targetRuns / archs.length);

  const total = {
    n: 0,
    win: 0,
    lose: 0,
    draw: 0,
    sumA: 0,
    sumB: 0,
    byEvent: {},
    byArch: {}
  };

  EVENTS.forEach(e => {
    total.byEvent[e.id] = { win: 0, lose: 0, draw: 0, n: 0, name: e.name, icon: e.icon };
  });
  archs.forEach(a => {
    total.byArch[a.id] = { win: 0, lose: 0, draw: 0, n: 0, name: a.name };
  });

  const baseSeed = (Date.now() ^ (Math.random() * 4294967296)) >>> 0;

  archs.forEach((a, k) => {
    const enemyDeck = buildFromPlan(a.plan, mulberry32(baseSeed + k * 17 + 3));
    const r = simulate(deck, enemyDeck, per, {
      docA: state.doctrine,
      seed: (baseSeed + k * 997) >>> 0,
      event: state.sandEvent === 'all' ? null : EVENTS.find(e => e.id === state.sandEvent)
    });

    ['n', 'win', 'lose', 'draw', 'sumA', 'sumB'].forEach(f => {
      total[f] += r[f];
    });

    total.byArch[a.id].win += r.win;
    total.byArch[a.id].lose += r.lose;
    total.byArch[a.id].draw += r.draw;
    total.byArch[a.id].n += r.n;

    EVENTS.forEach(e => {
      if (r.byEvent[e.id]) {
        total.byEvent[e.id].win += r.byEvent[e.id].win;
        total.byEvent[e.id].n += r.byEvent[e.id].n;
      }
    });
  });

  state.sandResult = total;
  showSandboxModal(total);
}

function showSandboxModal(res) {
  const modal = $('#sandboxModal');
  const card = $('#sandboxCard');
  if (!modal || !card) return;

  const total = res.n || 1;
  const winRate = ((res.win / total) * 100).toFixed(1);
  const loseRate = ((res.lose / total) * 100).toFixed(1);
  const drawRate = ((res.draw / total) * 100).toFixed(1);
  const avgVpA = (res.sumA / total).toFixed(1);
  const avgVpB = (res.sumB / total).toFixed(1);

  // 綜合戰略評級 (Grade)
  let grade = 'B', gradeTitle = '戰 術 均 勢', gradeDesc = '與主流陣容互有勝負，建議針對弱點調整配件', gradeClass = 'grade-b';
  const numWinRate = parseFloat(winRate);
  if (numWinRate >= 70) {
    grade = 'S';
    gradeTitle = '戰 略 霸 權';
    gradeDesc = '大數據展現壓倒性勝率，具備強大泛用統治力';
    gradeClass = 'grade-s';
  } else if (numWinRate >= 55) {
    grade = 'A';
    gradeTitle = '優 勢 陣 容';
    gradeDesc = '整體戰術穩定克敵，大部分地形皆能佔據主動';
    gradeClass = 'grade-a';
  } else if (numWinRate >= 45) {
    grade = 'B';
    gradeTitle = '勢 均 力 敵';
    gradeDesc = '抗衡主流戰術，勝負取決於戰場隨機事件與臨場教條';
    gradeClass = 'grade-b';
  } else {
    grade = 'C';
    gradeTitle = '風 險 陣 容';
    gradeDesc = '抗壓能力受限，在特定極端環境中容易被強勢克制';
    gradeClass = 'grade-c';
  }

  // 陣容簡要
  const currentDoc = DOCTRINES.find(d => d.id === state.doctrine) || DOCTRINES[0];

  // 分析最強環境與最弱環境
  const evArr = Object.values(res.byEvent).filter(e => e.n > 0);
  evArr.sort((a, b) => (b.win / b.n) - (a.win / a.n));
  const bestEvent = evArr[0];
  const worstEvent = evArr[evArr.length - 1];

  // 分析最克制風格與最苦手風格
  const archArr = Object.values(res.byArch).filter(a => a.n > 0);
  archArr.sort((a, b) => (b.win / b.n) - (a.win / a.n));
  const bestArch = archArr[0];
  const worstArch = archArr[archArr.length - 1];

  card.innerHTML = `
    <button class="modal-x" id="sandCloseX" title="關閉大數據報告">✕</button>

    <!-- 頂部旗艦級橫幅 -->
    <div class="aar-header ${numWinRate >= 50 ? 'win' : 'lose'}" style="margin-bottom:14px">
      <div class="aar-grade-badge ${gradeClass}">
        <span class="grade-char">${grade}</span>
        <span class="grade-label">SIM-META</span>
      </div>
      <div class="aar-title-group">
        <div class="aar-meta-row">
          <span class="aar-mode-tag">⚡ MONTE CARLO · 蒙地卡羅大數據</span>
          <span class="aar-env-tag">已完成 ${res.n} 場模擬推演 · 採用【${esc(currentDoc.name)}】教條</span>
        </div>
        <h2 class="aar-main-title">${gradeTitle} · 總勝率 ${winRate}%</h2>
        <div class="aar-sub-desc">${gradeDesc}</div>
      </div>
    </div>

    <!-- 核心數據 KPI 看板 -->
    <div class="sand-kpi-grid">
      <div class="sand-kpi-card highlight">
        <div class="sand-kpi-lbl">整體作戰勝率</div>
        <div class="sand-kpi-val ${numWinRate >= 50 ? 'green' : 'amber'}">${winRate}%</div>
        <div class="sand-kpi-sub">300 局確定性種子迭代</div>
      </div>
      <div class="sand-kpi-card">
        <div class="sand-kpi-lbl">戰績分佈統計</div>
        <div class="sand-record-pills">
          <span class="sand-pill win"><b>${res.win}</b> 勝</span>
          <span class="sand-pill lose"><b>${res.lose}</b> 敗</span>
          <span class="sand-pill draw"><b>${res.draw}</b> 平</span>
        </div>
        <div class="sand-kpi-sub">勝 ${winRate}% · 負 ${loseRate}% · 平 ${drawRate}%</div>
      </div>
      <div class="sand-kpi-card">
        <div class="sand-kpi-lbl">雙方平均戰略積分 (VP)</div>
        <div class="sand-kpi-val cyan">${avgVpA} <small style="font-size:12px;color:var(--muted)">vs</small> <span style="color:var(--red)">${avgVpB}</span></div>
        <div class="sand-kpi-sub">友軍平均 VP 領先 ${(avgVpA - avgVpB).toFixed(1)} 分</div>
      </div>
    </div>

    <!-- 雙欄進度分析：左側戰場環境適性 + 右側敵方風格抗性 -->
    <div class="sand-breakdown-grid">
      <!-- 戰場環境表現 -->
      <div class="sand-panel">
        <div class="sand-panel-head">
          <span>🌍 戰場環境適性矩陣</span>
          <small class="muted">各事件輪替 ${evArr[0]?.n || 0} 場</small>
        </div>
        <div class="sand-bar-list">
          ${evArr.map(e => {
            const wr = e.n > 0 ? Math.round((e.win / e.n) * 100) : 0;
            const barCol = wr >= 60 ? 'var(--green)' : wr >= 45 ? 'var(--cyan)' : wr >= 35 ? 'var(--amber)' : 'var(--red)';
            return `
              <div class="sand-bar-row">
                <div class="sand-bar-info">
                  <span class="sand-bar-name">${e.icon} ${esc(e.name)}</span>
                  <span class="sand-bar-num" style="color:${barCol}">${wr}% (${e.win}/${e.n})</span>
                </div>
                <div class="sand-bar-track">
                  <div class="sand-bar-fill" style="width:${wr}%;background:${barCol}"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- 敵方 AI 風格克制抗性 -->
      <div class="sand-panel">
        <div class="sand-panel-head">
          <span>⚔️ 假想敵風格克制分析</span>
          <small class="muted">對決主流戰術流派</small>
        </div>
        <div class="sand-bar-list">
          ${archArr.map(a => {
            const wr = a.n > 0 ? Math.round((a.win / a.n) * 100) : 0;
            const barCol = wr >= 60 ? 'var(--green)' : wr >= 45 ? 'var(--cyan)' : wr >= 35 ? 'var(--amber)' : 'var(--red)';
            return `
              <div class="sand-bar-row">
                <div class="sand-bar-info">
                  <span class="sand-bar-name">🎯 ${esc(a.name)}</span>
                  <span class="sand-bar-num" style="color:${barCol}">${wr}% (${a.win}/${a.n})</span>
                </div>
                <div class="sand-bar-track">
                  <div class="sand-bar-fill" style="width:${wr}%;background:${barCol}"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>

    <!-- 參謀本部戰略綜合診斷 -->
    <div class="sand-debrief-box">
      <div class="sand-debrief-title">💡 參謀本部大數據戰略診斷 (STRATEGIC INSIGHTS)</div>
      <ul class="aar-debrief-list">
        ${bestEvent ? `
          <li class="d-good">
            <span class="d-bullet">✔</span>
            <span><b>最佳戰場優勢</b>：此陣容在【${bestEvent.icon} ${esc(bestEvent.name)}】表現最為強勁，勝率達 <b>${Math.round((bestEvent.win / bestEvent.n) * 100)}%</b>，部隊裝備與環境特性具備高度綜效。</span>
          </li>
        ` : ''}
        ${worstEvent && worstEvent !== bestEvent ? `
          <li class="${(worstEvent.win / worstEvent.n) < 0.45 ? 'd-bad' : 'd-neutral'}">
            <span class="d-bullet">${(worstEvent.win / worstEvent.n) < 0.45 ? '⚠' : 'ℹ'}</span>
            <span><b>環境適應警報</b>：在【${worstEvent.icon} ${esc(worstEvent.name)}】勝率降至 <b>${Math.round((worstEvent.win / worstEvent.n) * 100)}%</b>，面對該地形的特殊修正易處於火力劣勢。</span>
          </li>
        ` : ''}
        ${bestArch ? `
          <li class="d-good">
            <span class="d-bullet">🎯</span>
            <span><b>戰術克制掌握</b>：對戰【${esc(bestArch.name)}】具備壓制性優勢 (勝率 <b>${Math.round((bestArch.win / bestArch.n) * 100)}%</b>)。</span>
          </li>
        ` : ''}
        ${worstArch && worstArch !== bestArch ? `
          <li class="d-bad">
            <span class="d-bullet">🛡️</span>
            <span><b>潛在克制對手</b>：對陣【${esc(worstArch.name)}】遭遇較大阻力 (勝率僅 <b>${Math.round((worstArch.win / worstArch.n) * 100)}%</b>)，建議微調單位配比或更換戰術教條。</span>
          </li>
        ` : ''}
      </ul>
    </div>

    <!-- 底部行動指令列 -->
    <div class="aar-actions" style="margin-top:14px">
      <button class="btn primary aar-btn-main" id="sandRerun">⚡ 重新迭代 300 場模擬</button>
      <button class="btn ghost" id="sandCopyReport">📋 複製大數據評測結果</button>
      <button class="btn ghost" id="sandToBattle">⚔️ 以此陣容開戰一場</button>
      <button class="btn ghost" id="sandClose">返回調整陣容</button>
    </div>
  `;

  modal.hidden = false;

  // 事件綁定
  const closeModal = () => { modal.hidden = true; };
  $('#sandClose').onclick = closeModal;
  $('#sandCloseX').onclick = closeModal;
  modal.onclick = (e) => { if (e.target === modal) closeModal(); };

  $('#sandRerun').onclick = () => {
    toast('⚡ 正在運行新種子 300 場蒙地卡羅推演...');
    setTimeout(runSandbox, 50);
  };

  $('#sandCopyReport').onclick = () => {
    const text = `【頂尖對戰：15元聯合作戰 - 300場大數據沙盒評測報告】\\n` +
      `陣容代碼：${encodeDeck(state.deck)}\\n` +
      `戰術教條：${currentDoc.name}\\n` +
      `綜合勝率：${winRate}% (${res.win}勝 / ${res.lose}敗 / ${res.draw}平)\\n` +
      `平均積分：友軍 ${avgVpA} VP vs 敵軍 ${avgVpB} VP\\n` +
      `最佳戰場：${bestEvent?.name} (${Math.round((bestEvent?.win / bestEvent?.n) * 100)}%)\\n` +
      `最克制風格：${bestArch?.name} (${Math.round((bestArch?.win / bestArch?.n) * 100)}%)`;
    navigator.clipboard.writeText(text).then(() => {
      toast('📋 已複製 300 場大數據評測報告至剪貼簿！');
    }).catch(() => {
      toast('代碼：' + encodeDeck(state.deck));
    });
  };

  $('#sandToBattle').onclick = () => {
    modal.hidden = true;
    startBattle();
  };
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
  const totalCost = units.reduce((sum, u) => {
    const c = u.cost !== undefined ? u.cost : (UNIT_MAP[u.id]?.cost || 0);
    return sum + Number(c);
  }, 0);

  const costColor = (side === 'B' && totalCost > 15)
    ? (totalCost >= 25 ? '#ff3b30' : 'var(--amber)')
    : (side === 'B' ? 'var(--red)' : 'var(--cyan)');

  const budgetLabel = (side === 'B' && totalCost > 15)
    ? `$${totalCost} BUDGET · 超標 +$${totalCost - 15}`
    : `$${totalCost} BUDGET`;

  return `<h3><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${side === 'A' ? '我 方 ▸ 友軍編組' : '敵 方 ▸ ' + esc(state.enemyName || '敵軍特遣部隊')}</span><span style="font-size:11px;font-family:var(--mono);color:${costColor};font-weight:700;flex:none;margin-left:6px" title="${side === 'B' && totalCost > 15 ? '精選對戰超標預算陣容' : '作戰總預算'}">${budgetLabel}</span></h3>` + units.map(u => {
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
  if (hp === undefined || isNaN(hp)) return;
  const u = $('#hp-' + uid); if (!u) return;
  const p = max > 0 ? (hp / max) : 0;
  u.style.width = Math.max(0, p * 100) + '%';
  u.className = p < 0.25 ? 'low' : p < 0.55 ? 'mid' : '';
  const hptEl = $('#hpt-' + uid);
  if (hptEl) hptEl.textContent = Math.round(hp) + ' / ' + max;
  const row = $('#bu-' + uid);
  if (row && hp <= 0) row.classList.add('dead');
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
  const viewLadder = $('#viewLadder'); if (viewLadder) viewLadder.hidden = true;
  const viewTournament = $('#viewTournament'); if (viewTournament) viewTournament.hidden = true;
  hideTooltip();
  $('#viewBattle').hidden = false;
  $('#resultModal').hidden = true;
  $('#btnSpeed').hidden = false;
  $('#btnSkip').hidden = false;
  $('#btnReopenResult').hidden = true;
  $('#btnBattleExit').hidden = true;

  const btnBack = $('#btnBattleBack');
  const btnBackTxt = $('#btnBattleBackTxt');
  const btnExitTxt = $('#btnBattleExitTxt');
  if (btnBack) btnBack.hidden = false;
  if (state.mode === 'tournament') {
    if (btnBackTxt) btnBackTxt.textContent = '🏆 返回錦標賽';
    if (btnExitTxt) btnExitTxt.textContent = '🏆 返回錦標賽';
    if (btnBack) { btnBack.className = 'btn amber sm'; btnBack.title = '隨時一鍵返回世界盃淘汰錦標賽對抗樹'; }
  } else if (state.mode === 'ladder') {
    if (btnBackTxt) btnBackTxt.textContent = '🎖️ 返回天梯';
    if (btnExitTxt) btnExitTxt.textContent = '🎖️ 返回天梯';
    if (btnBack) { btnBack.className = 'btn primary sm'; btnBack.title = '隨時返回天梯競技防線'; }
  } else if (state.mode === 'bo3') {
    if (btnBackTxt) btnBackTxt.textContent = '⚔️ 返回 BO5';
    if (btnExitTxt) btnExitTxt.textContent = '⚔️ 返回 BO5';
    if (btnBack) { btnBack.className = 'btn amber sm'; btnBack.title = '隨時返回 BO5 征服賽對決'; }
  } else {
    if (btnBackTxt) btnBackTxt.textContent = '✕ 退出推演';
    if (btnExitTxt) btnExitTxt.textContent = '返回陣容編組';
    if (btnBack) { btnBack.className = 'btn ghost sm'; btnBack.title = '退出當前推演'; }
  }
  const fxLayer = $('#combatFxLayer');
  if (fxLayer) fxLayer.innerHTML = '';
  const radarEl = $('.radar');
  if (radarEl) radarEl.classList.remove('emp-active');

  window.scrollTo({ top: 0 });
  const T = res.final;
  
  // 注入左右部隊卡片列表（注入至 unitsCardList 容器，不覆蓋頂部 team-bg-hud）
  const uBoxA = $('#unitsCardListA') || $('#teamUnitsA');
  const uBoxB = $('#unitsCardListB') || $('#teamUnitsB');
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
      updateHoloPhase(curPhase);
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
      d.className = `s${ln.side} ${ln.kind}`;
      const brevityBadge = ln.brevity ? `<span class="brevity-tag ${ln.kind}">${esc(ln.brevity)}</span>` : '';
      d.innerHTML = `${brevityBadge}<span class="log-text">${esc(ln.text)}</span>`;
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

function updateHoloPhase(phase) {
  document.querySelectorAll('.holo-domain').forEach(el => el.classList.remove('active'));
  if (phase === 1) {
    const elEW = $('#domain-ew'), elAA = $('#domain-aa');
    if (elEW) elEW.classList.add('active');
    if (elAA) elAA.classList.add('active');
  } else if (phase === 2) {
    const elAir = $('#domain-air'), elSea = $('#domain-sea');
    if (elAir) elAir.classList.add('active');
    if (elSea) elSea.classList.add('active');
  } else if (phase === 3) {
    const elArmor = $('#domain-armor');
    if (elArmor) elArmor.classList.add('active');
  }
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
    const isClashOfTitans = (aUnit.cost >= 4 && tUnit.cost >= 4);

    if (ln.side === 'A') {
      // 我方開火攻擊 ➔ 左邊為攻擊武器大圖，右邊為受擊目標大圖
      setSideHero('A', aUnit, 'fire', aUnit.weapon);
      setSideHero('B', tUnit, 'hit', ln.text);
      if (sAtk) sAtk.textContent = `${aUnit.flag} ${aUnit.name}`;
      if (sTgt) sTgt.textContent = `${tUnit.flag} ${tUnit.name}`;
      if (sVec) sVec.textContent = isClashOfTitans ? `🎯 頂峰對決 // CLASH ➔` : `⚡ [${aUnit.weapon ? aUnit.weapon.split(' ')[0] : '開火'}] ➔`;
    } else {
      // 敵方開火攻擊 ➔ 右邊為攻擊武器大圖，左邊為受擊目標大圖
      setSideHero('B', aUnit, 'fire', aUnit.weapon);
      setSideHero('A', tUnit, 'hit', ln.text);
      if (sAtk) sAtk.textContent = `${tUnit.flag} ${tUnit.name}`;
      if (sTgt) sTgt.textContent = `${aUnit.flag} ${aUnit.name}`;
      if (sVec) sVec.textContent = isClashOfTitans ? `🎯 頂峰對決 // CLASH ➔` : `⚡ [${aUnit.weapon ? aUnit.weapon.split(' ')[0] : '突襲'}] ➔`;
    }

    // 連動全息雷達態勢帶
    const lockTag = $('#holoLockTag');
    if (lockTag) {
      if (ln.brevity === 'FOX-3') lockTag.textContent = '[TWS RADAR LOCK]';
      else if (ln.brevity === 'SABOT') lockTag.textContent = '[LASER RANGE LOCK]';
      else if (ln.brevity === 'SEAD') lockTag.textContent = '[ANTI-RAD TARGET]';
      else if (ln.brevity === 'APS-BLOCK') lockTag.textContent = '[APS HARD-KILL]';
      else if (ln.kind === 'kill') lockTag.textContent = '[TARGET SPLASHED]';
      else lockTag.textContent = '[FIRE CONTROL ON]';
    }

    // 觸發兵種態勢燈高亮
    const uCat = aUnit.cat;
    if (uCat) {
      const catMap = {
        air: 'domain-air',
        air_defense: 'domain-aa',
        armor: 'domain-armor',
        naval: 'domain-sea',
        support: 'domain-ew'
      };
      const domId = catMap[uCat];
      if (domId) {
        const domEl = $('#' + domId);
        if (domEl) {
          domEl.classList.add('active');
          setTimeout(() => domEl.classList.remove('active'), 600 / speed);
        }
      }
    }

    // 動態經緯度模擬
    const camCoords = $('#camCoords');
    if (camCoords && Math.random() < 0.35) {
      const minN = (18 + Math.random() * 0.9).toFixed(2);
      const minE = (34 + Math.random() * 0.9).toFixed(2);
      camCoords.textContent = `LAT 24°${minN}'N LON 120°${minE}'E`;
    }

    // 【以小博大・戰術奇蹟警報 (Tactical Upset Alarm)】
    // 當低成本兵種 (<= $2) 成功擊毀高價值旗艦 (>= $4)
    if (ln.kind === 'kill' && aUnit.cost <= 2 && tUnit.cost >= 4) {
      spawnTacticalUpset(aUnit, tUnit);
    }
  }

  // 2. 觸發開火音效 (帶陣營立體聲方位)
  if (aUnit) {
    SoundEngine.play(aUnit.sfx || 'missile', ln.side);
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

  // 開火方微後座力發光動畫
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

  // 5. 命中受擊、爆炸衝擊波與浮動戰鬥數字 (受擊方聲相為對手方位)
  function triggerImpact() {
    if (skip) return;
    const targetSide = ln.side === 'A' ? 'B' : 'A';
    if (ln.kind === 'kill') {
      tEl.classList.remove('hit-shake', 'kill-blast');
      void tEl.offsetWidth;
      tEl.classList.add('kill-blast', 'destroyed-badge');
      spawnExplosion(tx, ty);
      spawnFloater(tx, ty, '💥 擊毀!', 'kill');
      SoundEngine.play('explosion', targetSide);
    } else if (ln.kind === 'hit') {
      tEl.classList.remove('hit-shake');
      void tEl.offsetWidth;
      tEl.classList.add('hit-shake');
      spawnExplosion(tx, ty);
      const dmgText = ln.dmg ? `−${ln.dmg}` : `命中!`;
      spawnFloater(tx, ty, dmgText, 'hit');
      SoundEngine.play('hit_impact', targetSide);
    } else if (ln.kind === 'block') {
      spawnShield(tx, ty);
      spawnFloater(tx, ty, '🛡️ APS 攔截', 'block');
      SoundEngine.play('block', targetSide);
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

  function spawnTacticalUpset(attacker, victim) {
    const banner = document.createElement('div');
    banner.className = 'tactical-upset-banner';
    banner.innerHTML = `
      <div class="upset-title">⚡ 戰 術 奇 蹟 // ASYMMETRIC UPSET ⚡</div>
      <div class="upset-desc">${attacker.flag} ${attacker.name} ($${attacker.cost}) 擊墜 ${victim.flag} ${victim.name} ($${victim.cost})！</div>
    `;
    const viewBattle = $('#viewBattle');
    if (viewBattle) {
      viewBattle.appendChild(banner);
      setTimeout(() => banner.remove(), 2300);
    }
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
function handleExitBattleToCurrentMode() {
  closeBattle();
  if (state.mode === 'tournament') {
    setMode('tournament');
    toast('🏆 已一鍵返回 2026 世界盃淘汰錦標賽對抗樹');
  } else if (state.mode === 'ladder') {
    setMode('ladder');
    toast('🎖️ 已返回天梯競技防線');
  } else if (state.mode === 'bo3') {
    setMode('bo3');
  } else {
    setupMatch();
    renderAll();
  }
}
$('#btnBattleBack')?.addEventListener('click', handleExitBattleToCurrentMode);
$('#btnBattleExit')?.addEventListener('click', handleExitBattleToCurrentMode);

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
  if (state.mode === 'ghost' || (state.mode === 'quick' && state.quickSubMode === 'ghost')) {
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

  /* 錦標賽 / 天梯 / BO3 系列賽邏輯分流 */
  if (state.mode === 'tournament') {
    handleTournamentRoundEnd(res);
  } else if (state.mode === 'bo3') {
    handleBo3RoundEnd(res);
  } else if (state.mode === 'ladder' && state.ladderEnemy) {
    handleLadderMatchEnd(res);
  } else {
    showResult(res);
  }
}

/* ---------- 🏆 天梯戰功勝點結算 ---------- */
function handleLadderMatchEnd(res) {
  const isWin = res.winner === 'A';
  const enemy = state.ladderEnemy;
  const rep = LadderEngine.resolveMatch(isWin, enemy, res);

  currentActiveModal = $('#ladderResultModal');
  const card = $('#ladderResultCard');
  if (!card) return;

  card.innerHTML = `
    <div class="l-res-banner ${isWin ? 'win' : 'lose'}">
      ${isWin ? '🏆 戰 術 獲 勝 · VICTORY' : '✘ 作 戰 失 利 · DEFEAT'}
    </div>
    <div class="muted">天梯對決目標：${enemy.flag} ${esc(enemy.name)} (${enemy.rp} RP)</div>

    <div class="l-res-rp-change">
      <span class="l-res-old-rp">${rep.oldRP} RP</span>
      <span class="l-res-arrow">➔</span>
      <span class="l-res-new-rp">${rep.newRP} RP</span>
      <span class="l-res-delta ${rep.totalDelta >= 0 ? 'up' : 'down'}">
        ${rep.totalDelta >= 0 ? '+' : ''}${rep.totalDelta} RP
      </span>
    </div>

    ${rep.rankDelta > 0 ? `
      <div class="l-rank-jump">
        🚀 全球天梯名次躍升：第 ${rep.oldRank} 名 ➔ <b>第 ${rep.newRank} 名</b>（上升 ${rep.rankDelta} 位！）
      </div>
    ` : rep.rankDelta < 0 ? `
      <div class="l-rank-jump" style="background:rgba(244,63,94,0.12);border-color:rgba(244,63,94,0.35);color:#f43f5e">
        名次微調：第 ${rep.oldRank} 名 ➔ 第 ${rep.newRank} 名
      </div>
    ` : `
      <div class="l-rank-jump" style="color:#94a3b8">
        名次維持在：第 ${rep.newRank} 名
      </div>
    `}

    <div class="l-breakdown-box">
      <div class="l-breakdown-row"><span>基礎戰功評級</span><b>${rep.baseDelta >= 0 ? '+' : ''}${rep.baseDelta} RP</b></div>
      ${rep.diffBonus !== 0 ? `<div class="l-breakdown-row"><span>分差難度校正 (${rep.diffBonus >= 0 ? '越級強攻' : '弱勢對陣'})</span><b>${rep.diffBonus >= 0 ? '+' : ''}${rep.diffBonus} RP</b></div>` : ''}
      ${rep.aceBonus ? `<div class="l-breakdown-row" style="color:#4ade80"><span>🎖️ ACE 完勝獎章 (全隊全員生還)</span><b>倍率 +25%</b></div>` : ''}
      ${rep.blitzBonus ? `<div class="l-breakdown-row" style="color:#38bdf8"><span>⚡ 閃擊先制獎章 (前置階段全殲)</span><b>倍率 +15%</b></div>` : ''}
      ${rep.miracleBonus > 0 ? `<div class="l-breakdown-row" style="color:#fbbf24"><span>🌟 以小博大奇蹟賞金 (${rep.miracleCount} 次)</span><b>+${rep.miracleBonus} RP</b></div>` : ''}
      ${rep.streakBreakerBonus > 0 ? `<div class="l-breakdown-row" style="color:#f59e0b"><span>💥 終結者大捷 (擊墜霸榜守將)</span><b>+${rep.streakBreakerBonus} RP</b></div>` : ''}
    </div>

    <div class="res-actions">
      <button class="btn primary block" id="btnLadderReturn">返回天梯戰情室</button>
      <button class="btn ghost block" id="btnLadderReview">檢視戰場情形 🔍</button>
    </div>
  `;

  $('#ladderResultModal').hidden = false;

  $('#btnLadderReturn').onclick = () => {
    $('#ladderResultModal').hidden = true;
    closeBattle();
    setMode('ladder');
  };

  $('#btnLadderReview').onclick = () => {
    $('#ladderResultModal').hidden = true;
    $('#btnSpeed').hidden = true;
    $('#btnSkip').hidden = true;
    $('#btnReopenResult').hidden = false;
    $('#btnBattleExit').hidden = false;
    toast('🔍 已進入戰場檢視：可自由滾動日誌與檢視部隊殘局');
  };
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
    if (state.isOnlinePvp) {
      // 線上對抗：我方獲勝，由對手進行戰術反制
      showResult(res, {
        bo3NextText: `進入第 ${nextRound} 局（等待對手反制）`,
        bo3Callback: () => {
          closeBattle();
          state.pvpMyReady = false;
          state.pvpOpponentReady = false;
          state.pvpOpponentDeck = null;
          renderAll();
          toast(`🏆 本局獲勝！正在等待對手指揮官進行戰術禁用反制...`);
        }
      });
      return;
    }

    // 電腦在上一局失利，觸發電腦智能戰術反制！
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

  if (state.isOnlinePvp) {
    // 線上真人對抗：發送 BAN_COMMIT 給對手
    OnlinePvPEngine.sendPacket('BAN_COMMIT', { bannedUnitId: bannedId });
    bo3.round++;
    state.pvpMyReady = false;
    state.pvpOpponentReady = false;
    state.pvpOpponentDeck = null;
    renderAll();
    toast(`🎯 戰術反制生效：已成功禁用對手的【${UNIT_MAP[bannedId].name}】！請重新調整第 ${bo3.round} 局陣容。`);
    return;
  }

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

/* ---------- 旗艦級戰鬥結算報告 (C4ISR Tactical After-Action Report, AAR) ---------- */
function showResult(res, bo3Custom) {
  const won = res.winner === 'A', draw = res.winner === 'draw';
  const A = res.vp.A, B = res.vp.B;
  const f = x => x.toFixed(1);
  const why = buildWhy(res);

  // 1. 計算作戰評級 (Combat Grade)
  let grade = 'B', gradeTitle = '險 勝', gradeDesc = '戰局焦灼，驚險獲勝', gradeClass = 'grade-b';
  if (won) {
    const allAlive = res.final.A.every(u => u.alive);
    if (res.wipeout || allAlive) {
      grade = 'S';
      gradeTitle = '戰 略 完 勝';
      gradeDesc = allAlive ? 'ACE 全隊全員生還 · 完美殲敵' : '全殲敵方全體特遣部隊';
      gradeClass = 'grade-s';
    } else if (A.total - B.total >= 10) {
      grade = 'A';
      gradeTitle = '戰 術 大 勝';
      gradeDesc = '火力全面壓制，取得決定性戰略分差';
      gradeClass = 'grade-a';
    } else {
      grade = 'B';
      gradeTitle = '戰 術 險 勝';
      gradeDesc = '雙方互有折損，以微弱積分優勢勝出';
      gradeClass = 'grade-b';
    }
  } else if (draw) {
    grade = '⚖';
    gradeTitle = '戰 略 僵 局';
    gradeDesc = '雙方勢均力敵，戰略積分打平';
    gradeClass = 'grade-draw';
  } else {
    if (A.total > 0 && B.total - A.total < 10) {
      grade = 'C';
      gradeTitle = '作 戰 惜 敗';
      gradeDesc = '重創敵方主力，僅因微幅戰術分差落敗';
      gradeClass = 'grade-c';
    } else {
      grade = 'D';
      gradeTitle = '作 戰 潰 敗';
      gradeDesc = '部隊遭受壓制性打擊，建議調整戰術教條';
      gradeClass = 'grade-d';
    }
  }

  // 2. 計算 MVP 王牌軍武單位
  const mvpSide = won ? 'A' : 'B';
  const mvpUnit = res.mvp[mvpSide] || (won ? res.final.A[0] : res.final.B[0]);
  const mvpMeta = UNIT_MAP[mvpUnit.id] || {};
  const mvpIsMine = mvpSide === 'A';

  // 3. 雙方生還統計與得分對比
  const aliveCountA = res.final.A.filter(u => u.alive).length;
  const aliveCountB = res.final.B.filter(u => u.alive).length;
  const sumVP = A.total + B.total;
  const pctA = sumVP > 0 ? Math.round((A.total / sumVP) * 100) : 50;
  const pctB = 100 - pctA;

  let subtitle = `${esc(res.ev.icon + ' ' + res.ev.name)}`;
  if (state.mode === 'daily') subtitle += ' · 精選對戰 #' + dailyNo();
  else if (state.mode === 'ghost' || (state.mode === 'quick' && state.quickSubMode === 'ghost')) subtitle += ` · 幽靈對決 (${state.ghostTarget?.callsign || '名將'})`;
  else if (state.mode === 'bo3') subtitle += ` · BO5 第 ${state.bo3.round} 局 (比分 ${state.bo3.winsA} - ${state.bo3.winsB})`;
  else subtitle += ' · 快速交鋒 · AI 戰術演練';

  $('#resultCard').innerHTML = `
    <button class="modal-x" id="rCloseX" title="關閉彈窗並檢視戰場情形">✕</button>

    <!-- 一體化戰略評級與積分戰情列 (Unified Outcome Bar) -->
    <div class="aar-outcome-bar ${won ? 'win' : draw ? 'draw' : 'lose'}">
      <div class="outcome-badge-col">
        <div class="aar-grade-badge-sm ${gradeClass}">
          <span class="grade-char">${grade}</span>
          <span class="grade-label">GRADE</span>
        </div>
      </div>
      <div class="outcome-title-col">
        <div class="outcome-headline">
          <h2 class="outcome-main-title">${gradeTitle}</h2>
          <span class="outcome-mode-tag">${res.wipeout ? '💥 全殲' : '🎯 戰略判定'}</span>
          <span class="outcome-sub-desc">${gradeDesc}</span>
        </div>
        <div class="outcome-meta-row">
          <span class="aar-env-tag">${subtitle}</span>
        </div>
      </div>
      <div class="outcome-gauge-col">
        <div class="gauge-labels-compact">
          <span class="g-side g-a">友軍 <b>${f(A.total)} VP</b> <span class="g-alive">(${aliveCountA}/5 存活)</span></span>
          <span class="g-vs">VS</span>
          <span class="g-side g-b">敵軍 <b>${f(B.total)} VP</b> <span class="g-alive">(${aliveCountB}/5 存活)</span></span>
        </div>
        <div class="gauge-bar-track">
          <div class="gauge-fill-a" style="width:${pctA}%"></div>
          <div class="gauge-fill-b" style="width:${pctB}%"></div>
        </div>
      </div>
    </div>

    <!-- 中部網格：全場 MVP 寫真展台 + 戰略積分三維度解析 -->
    <div class="aar-body-grid">
      <!-- 左側：全場 MVP 榮譽寫真展台 -->
      <div class="aar-mvp-showcase ${mvpIsMine ? 'mine' : 'enemy'}">
        <div class="mvp-badge-tag">👑 COMBAT MVP · 王牌作戰單位</div>
        ${mvpMeta.img ? `<img class="mvp-bg-img" src="${mvpMeta.img}" alt="${esc(mvpMeta.name || '')}" onerror="this.style.display='none'"/>` : ''}
        <div class="mvp-overlay">
          <div class="mvp-flag-name">
            <span class="mvp-flag-badge">${mvpMeta.flag || '🌐'}</span>
            <div class="mvp-name-box">
              <strong class="mvp-name">${esc(mvpUnit.name)}</strong>
              <span class="mvp-sub-text">${esc(mvpMeta.origin || '')} · $${mvpUnit.cost} · ${mvpUnit.v}型</span>
            </div>
          </div>
          <div class="mvp-stats-row">
            <div class="mvp-stat-pill">
              <span class="lbl">累計輸出傷害</span>
              <strong class="val gold">${Math.round(mvpUnit.dmgDone || 0)}</strong>
            </div>
            <div class="mvp-stat-pill">
              <span class="lbl">作戰生還態勢</span>
              <strong class="val ${mvpUnit.alive ? 'green' : 'red'}">${mvpUnit.alive ? '🛡️ 存活生還' : '💥 光榮擊毀'}</strong>
            </div>
          </div>
        </div>
      </div>

      <!-- 右側：積分三維度細節卡 -->
      <div class="aar-vp-breakdown-card">
        <div class="breakdown-head">📊 戰略積分維度結算</div>
        <div class="vp-dimension-item">
          <div class="vp-dim-info">
            <span class="dim-name">🛡️ 殘餘戰力 (Force Survival)</span>
            <small class="dim-desc">以生還單位造價、殘餘耐久%折算</small>
          </div>
          <div class="vp-dim-scores">
            <b class="s-a ${A.remain >= B.remain ? 'lead' : ''}">${f(A.remain)}</b>
            <span class="s-sep">:</span>
            <b class="s-b ${B.remain >= A.remain ? 'lead' : ''}">${f(B.remain)}</b>
          </div>
        </div>
        <div class="vp-dimension-item">
          <div class="vp-dim-info">
            <span class="dim-name">🎯 戰線控制 (Zone Dominance)</span>
            <small class="dim-desc">陸空海三大戰場領域主導權控制分</small>
          </div>
          <div class="vp-dim-scores">
            <b class="s-a ${A.control >= B.control ? 'lead' : ''}">${f(A.control)}</b>
            <span class="s-sep">:</span>
            <b class="s-b ${B.control >= A.control ? 'lead' : ''}">${f(B.control)}</b>
          </div>
        </div>
        <div class="vp-dimension-item">
          <div class="vp-dim-info">
            <span class="dim-name">⚡ 以小博大 (Tactical Upset)</span>
            <small class="dim-desc">平民輕型單位越級狙殺敵主力之奇蹟分</small>
          </div>
          <div class="vp-dim-scores">
            <b class="s-a ${A.upset >= B.upset ? 'lead' : ''}">${f(A.upset)}</b>
            <span class="s-sep">:</span>
            <b class="s-b ${B.upset >= A.upset ? 'lead' : ''}">${f(B.upset)}</b>
          </div>
        </div>
      </div>
    </div>

    <!-- 下部網格：戰局關鍵轉折點 + 參謀本部戰術復盤 -->
    <div class="aar-intel-grid">
      <div class="aar-intel-card">
        <div class="intel-card-title">⚡ 戰局關鍵轉折點 (KEY TURNING POINTS)</div>
        <ul class="aar-turn-list">
          ${res.key && res.key.length ? res.key.slice(0, 2).map(k => `
            <li class="${k.side === 'A' ? 'k-side-a' : 'k-side-b'}">
              <span class="k-marker">${k.side === 'A' ? '友軍制勝' : '敵方突破'}</span>
              <span class="k-text">${esc(k.text)}</span>
            </li>
          `).join('') : '<li class="k-neutral">雙方平穩消耗，未發生決定性轉折</li>'}
        </ul>
      </div>

      <div class="aar-intel-card">
        <div class="intel-card-title">💡 參謀本部戰後復盤 (TACTICAL DEBRIEF)</div>
        <ul class="aar-debrief-list">
          ${why.slice(0, 2).map(w => `
            <li class="${w.t === 'good' ? 'd-good' : w.t === 'bad' ? 'd-bad' : 'd-neutral'}">
              <span class="d-bullet">${w.t === 'good' ? '✔' : w.t === 'bad' ? '⚠' : 'ℹ'}</span>
              <span>${esc(w.s)}</span>
            </li>
          `).join('')}
        </ul>
      </div>
    </div>

    <!-- 底部現代軍規行動指令列 -->
    <div class="aar-actions">
      ${bo3Custom ? `<button class="btn amber" id="rBo3Next">${esc(bo3Custom.bo3NextText)}</button>` : `<button class="btn primary aar-btn-main" id="rRematch">🔥 ${state.mode === 'daily' ? '調整陣容再挑戰' : '再戰一場'}</button>`}
      <button class="btn ghost" id="rReview">🔍 檢視戰場情形</button>
      <button class="btn ghost" id="rShareDebrief" title="複製精美戰報至剪貼簿">📋 複製戰報代碼</button>
      <button class="btn ghost" id="rEdit">⚙️ 返回編輯陣容</button>
    </div>
  `;

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

  // 複製戰報代碼功能
  $('#rShareDebrief').onclick = () => {
    const txt = shareText(res);
    navigator.clipboard.writeText(txt).then(() => {
      toast('📋 已複製精彩戰報與陣容代碼至剪貼簿！可直接貼上分享給戰友！');
    }).catch(() => {
      toast('代碼：' + encodeDeck(state.deck));
    });
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

  const editBtn = $('#rEdit');
  if (editBtn) {
    if (state.mode === 'tournament') {
      editBtn.textContent = '🏆 返回錦標賽對抗樹';
    } else if (state.mode === 'ladder') {
      editBtn.textContent = '🎖️ 返回天梯防線';
    } else {
      editBtn.textContent = '⚙️ 返回編輯陣容';
    }
    editBtn.onclick = handleExitBattleToCurrentMode;
  }
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
  const modeName = state.mode === 'daily' ? '精選對戰 #' + dailyNo() : (state.mode === 'ghost' || (state.mode === 'quick' && state.quickSubMode === 'ghost')) ? '幽靈對決' : '快速交鋒';
  return `【頂尖對戰】${modeName} ${won ? '勝利 ✅' : res.winner === 'draw' ? '平手 ⚖' : '敗北 ❌'}\n戰場：${res.ev.name}　積分 ${res.vp.A.total.toFixed(0)} : ${res.vp.B.total.toFixed(0)}\n我的 $${deckCost(state.deck)} 陣容：${names}\n陣容代碼：${encodeDeck(state.deck)}\n你能用 $15 做得更好嗎？`;
}

function closeBattle() {
  exitActiveBattle();
  const vb = $('#viewBuild'); if (vb) vb.hidden = false;
  const mb = $('#missionBar'); if (mb) mb.hidden = false;
  const cd = $('#commandDeck'); if (cd) cd.hidden = false;
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
  g.fillText(`${res.ev.name} ｜ 積分 ${res.vp.A.total.toFixed(0)} : ${res.vp.B.total.toFixed(0)} ｜ ${state.mode === 'daily' ? '精選對戰 #' + dailyNo() : dateKey()}`, 70, 430);
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
  const a = document.createElement('a'); a.download = 'topclash-15.png'; a.href = c.toDataURL('image/png'); a.click();
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
    <li><b>精選對戰</b>：對手擁有 <b>$19 ~ $25</b> 超標陣容，你只有 $15，挑戰極限以小博大克敵制勝！</li>
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
    if ($('#sandboxModal')) $('#sandboxModal').hidden = true;
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
    if (state.mode === 'bo3') {
      toast('🔒 BO5 征服賽期間軍火庫已封閉鎖定！請在現有配給裝備中調整陣容應對。');
      return;
    }
    rerollMarketPool();
    return;
  }
});

$('#btnRerollMarket')?.addEventListener('click', rerollMarketPool);

/* ---------- 🌐 線上真人雙人對戰 (Online PvP) 處理 ---------- */
function openOnlinePvpModal(forceJoinCode = null) {
  const modal = $('#onlinePvpModal');
  if (!modal) return;
  currentActiveModal = modal;
  modal.hidden = false;

  const player = LadderEngine.getState().player;
  const pUid = player.uid || LadderEngine.getPlayerUID();

  $('#pvpMyFlag').textContent = player.flag || '🇹🇼';
  $('#pvpMyName').textContent = player.name || '我方指揮官';
  $('#pvpMyUid').textContent = pUid;

  if (forceJoinCode) {
    switchPvpTab('join');
    $('#pvpJoinCodeInput').value = forceJoinCode;
  } else {
    switchPvpTab('host');
    initHostRoom();
  }
}

function switchPvpTab(tab) {
  document.querySelectorAll('.pvp-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  $('#pvpPanelHost').hidden = (tab !== 'host');
  $('#pvpPanelJoin').hidden = (tab !== 'join');
  $('#pvpVersusBox').hidden = true;
  $('#btnPvpStartBattle').hidden = true;
}

async function initHostRoom() {
  const codeDisplay = $('#pvpRoomCodeDisplay');
  const waitingStatus = $('#pvpWaitingStatus');
  if (!codeDisplay) return;

  codeDisplay.textContent = '連線配對中...';
  waitingStatus.innerHTML = '<span class="radar-dot"></span><span>正在向 WebRTC 訊令伺服器註冊房間...</span>';

  const player = LadderEngine.getState().player;
  const profile = { name: player.name, uid: player.uid || LadderEngine.getPlayerUID(), flag: player.flag };

  try {
    const res = await OnlinePvPEngine.createRoom(profile);
    codeDisplay.textContent = res.roomCode;
    waitingStatus.innerHTML = `<span class="radar-dot"></span><span>房間已就緒！請分享代碼 <b>${res.roomCode}</b> 給好友加入...</span>`;
  } catch (err) {
    codeDisplay.textContent = '連線失敗';
    waitingStatus.innerHTML = `<span style="color:var(--red)">⚠️ 連線失敗：${err.message || '請檢查網路連線'}</span>`;
  }
}

async function joinTargetRoom() {
  const code = ($('#pvpJoinCodeInput')?.value || '').trim();
  if (!code) {
    toast('⚠️ 請輸入 6 位房間代碼！');
    return;
  }
  const player = LadderEngine.getState().player;
  const profile = { name: player.name, uid: player.uid || LadderEngine.getPlayerUID(), flag: player.flag };

  toast(`正在連線進入房間 [${code.toUpperCase()}]...`);
  try {
    await OnlinePvPEngine.joinRoom(code, profile);
  } catch (err) {
    toast(`⚠️ 加入失敗：${err.message}`);
  }
}

// 綁定 onlinePvpModal 互動
$('#pvpTabsRow')?.addEventListener('click', e => {
  const btn = e.target.closest('.pvp-tab');
  if (!btn) return;
  const tab = btn.dataset.tab;
  switchPvpTab(tab);
  if (tab === 'host') initHostRoom();
});

$('#btnCopyRoomCode')?.addEventListener('click', () => {
  const code = OnlinePvPEngine.getCurrentRoomCode();
  if (!code) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).then(() => toast(`📋 房間代碼 [${code}] 已複製！`));
  } else {
    toast(`📋 房間代碼: ${code}`);
  }
});

$('#btnCopyShareUrl')?.addEventListener('click', () => {
  const code = OnlinePvPEngine.getCurrentRoomCode();
  if (!code) return;
  const loc = window.location;
  const base = loc.protocol + '//' + loc.host + loc.pathname;
  const shareUrl = `${base}?room=${code}`;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(shareUrl).then(() => toast(`🔗 邀請網址已複製！好友開啟即可直連加入！`));
  } else {
    toast(`🔗 邀請網址: ${shareUrl}`);
  }
});

$('#btnSubmitJoinRoom')?.addEventListener('click', joinTargetRoom);

$('#btnPvpCancel')?.addEventListener('click', () => {
  OnlinePvPEngine.closeConnection();
  $('#onlinePvpModal').hidden = true;
  currentActiveModal = null;
});

// 當對手連線加入時
OnlinePvPEngine.on('opponent_joined', ({ opponent, isHost }) => {
  $('#pvpPanelHost').hidden = true;
  $('#pvpPanelJoin').hidden = true;
  $('#pvpVersusBox').hidden = false;

  $('#pvpEnemyFlag').textContent = opponent.flag || '🌐';
  $('#pvpEnemyName').textContent = opponent.name || '敵方指揮官';
  $('#pvpEnemyUid').textContent = opponent.uid || 'CMD-ONLINE';

  $('#btnPvpStartBattle').hidden = false;
  toast(`⚡ 玩家【${opponent.flag} ${opponent.name}】(${opponent.uid}) 已成功連線進房！`);
});

function handleOnlinePvpSubmit() {
  if (state.pvpMyReady) {
    toast('⏳ 你的陣容已提交並鎖定，正在等待對手指揮官完成配置...');
    return;
  }
  const full = state.deck.every(Boolean);
  const errs = full ? validateDeck(state.deck, budgetLimit(), currentBanned()) : ['請先配置滿 5 個槽位'];
  if (errs.length > 0) {
    toast('⚠️ 陣容未就緒：' + errs[0]);
    return;
  }

  // 1. 本地標記我方已準備
  state.pvpMyReady = true;

  // 2. 透過 WebRTC 發送 DECK_SUBMIT 給對手
  OnlinePvPEngine.sendPacket('DECK_SUBMIT', {
    deck: state.deck.slice(),
    doctrine: state.doctrine
  });

  SoundEngine.play('equip');
  renderCommandDeck();
  renderMissionBar();

  if (state.pvpOpponentReady) {
    toast('🎯 雙方陣容皆已就緒！系統正在同步戰場，即將交火！');
    checkBothReadyAndStartCombat();
  } else {
    toast('✅ 你的陣容已提交並鎖定！正在等待對手完成配置...');
  }
}

function checkBothReadyAndStartCombat() {
  if (!state.pvpMyReady || !state.pvpOpponentReady) return;

  if (OnlinePvPEngine.isHostUser()) {
    // 房主生成同一個公平隨機種子與戰場事件
    const seed = (Math.random() * 4294967296) >>> 0;
    const event = state.event || pick(EVENTS);
    OnlinePvPEngine.sendPacket('COMBAT_SYNC', { seed, event });
    startOnlinePvpBattle(seed, event);
  }
}

function startOnlinePvpBattle(seed, event) {
  if (!state.pvpOpponentDeck) {
    toast('⚠️ 戰術資料同步中，請稍候...');
    return;
  }
  state.event = event;
  state.enemy = state.pvpOpponentDeck.slice();
  state.enemyDoc = state.pvpOpponentDoc || 'defense';
  const opp = OnlinePvPEngine.getOpponent();
  if (opp) state.enemyName = `${opp.flag} ${opp.name}`;

  const deck = state.deck.slice();
  const res = resolveBattle(deck, state.enemy, {
    seed,
    event: state.event,
    docA: state.doctrine,
    docB: state.enemyDoc
  });
  state.lastRes = res;
  openBattle(res);
}

OnlinePvPEngine.on('game_session_started', payload => {
  const opp = OnlinePvPEngine.getOpponent();
  state.isOnlinePvp = true;
  state.pvpMyReady = false;
  state.pvpOpponentReady = false;
  state.pvpOpponentDeck = null;
  state.bo3.active = true;
  state.bo3.round = payload.round || 1;
  state.bo3.winsA = payload.winsA || 0;
  state.bo3.winsB = payload.winsB || 0;
  state.bo3.bannedByA = null;
  state.bo3.bannedByB = null;
  if (opp) state.bo3.rivalName = `${opp.flag} ${opp.name} (${opp.uid})`;
  state.mode = 'bo3';

  $('#onlinePvpModal').hidden = true;
  currentActiveModal = null;
  renderAll();
  toast(`⚡ 房主已發起 BO5 系列賽！請挑選 5 槽陣容並點擊【鎖定陣容】！`);
});

OnlinePvPEngine.on('opponent_deck_ready', payload => {
  state.pvpOpponentDeck = payload.deck;
  state.pvpOpponentDoc = payload.doctrine || 'defense';
  state.pvpOpponentReady = true;

  renderCommandDeck();
  renderMissionBar();

  if (state.pvpMyReady) {
    toast(`⚡ 對手已完成配置！雙方就緒，即將開打！`);
    checkBothReadyAndStartCombat();
  } else {
    toast(`⚡ 對手已就緒！等待你完成陣容配置並鎖定！`);
  }
});

OnlinePvPEngine.on('combat_start_sync', payload => {
  startOnlinePvpBattle(payload.seed, payload.event);
});

OnlinePvPEngine.on('opponent_ban_committed', payload => {
  const bannedId = payload.bannedUnitId;
  state.bo3.bannedByB = bannedId; // 對手禁用了我方的裝備
  toast(`⚠️ 對手啟動戰術反制！禁用了你的【${UNIT_MAP[bannedId].name}】！`);
  
  // 若當前卡槽中正好有被敵方 Ban 的單位，強制卸下該單位
  const bannedIdx = state.deck.indexOf(bannedId);
  if (bannedIdx >= 0) {
    state.deck[bannedIdx] = null;
    state.active = bannedIdx;
  }
  
  // 推進小局並重置就緒狀態
  state.bo3.round++;
  state.pvpMyReady = false;
  state.pvpOpponentReady = false;
  state.pvpOpponentDeck = null;
  renderAll();
});

OnlinePvPEngine.on('opponent_left', () => {
  toast('⚠️ 對手已斷開連線！');
  state.isOnlinePvp = false;
  state.pvpMyReady = false;
  state.pvpOpponentReady = false;
  state.pvpOpponentDeck = null;
  $('#pvpVersusBox').hidden = true;
  $('#btnPvpStartBattle').hidden = true;
  renderAll();
  switchPvpTab('host');
  initHostRoom();
});

OnlinePvPEngine.on('error', msg => {
  toast(`⚠️ 連線提示：${msg}`);
});

$('#btnPvpStartBattle')?.addEventListener('click', () => {
  const opp = OnlinePvPEngine.getOpponent();
  if (!opp) return;

  // 房主啟動連線遊戲會話
  state.isOnlinePvp = true;
  state.pvpMyReady = false;
  state.pvpOpponentReady = false;
  state.pvpOpponentDeck = null;
  state.bo3.rivalName = `${opp.flag} ${opp.name} (${opp.uid})`;
  state.bo3.active = true;
  state.bo3.winsA = 0;
  state.bo3.winsB = 0;
  state.bo3.round = 1;
  state.bo3.bannedByA = null;
  state.bo3.bannedByB = null;
  state.mode = 'bo3';

  // 通知挑戰者同步開局
  OnlinePvPEngine.sendPacket('GAME_START_SESSION', {
    round: 1,
    winsA: 0,
    winsB: 0
  });

  $('#onlinePvpModal').hidden = true;
  currentActiveModal = null;
  renderAll();
  toast(`🏆 線上 BO5 系列賽正式開戰！請挑選 5 槽陣容並點擊【鎖定陣容】！`);
});

/* =====================================================
   🥇 世界盃淘汰錦標賽 (Tournament Championship) 前端控制器
   ===================================================== */
let tourneySelectedSize = 16;
let tourneySelectedFormat = 'hybrid';

function renderTournamentView() {
  let t = TournamentEngine.getState();
  if (!t) {
    const playerObj = (typeof LadderEngine !== 'undefined') ? LadderEngine.getState().player : null;
    t = TournamentEngine.create(tourneySelectedSize, tourneySelectedFormat, playerObj ? {
      uid: playerObj.uid || 'CMD-7392',
      name: playerObj.name || '我方聯合戰術作戰群',
      flag: playerObj.flag || '🇹🇼',
      isMe: true,
      isAI: false,
      deck: state.deck.every(Boolean) ? state.deck.slice() : null,
      doctrine: state.doctrine || 'defense'
    } : null);
  }

  const isLobby = (t.status === 'registration');
  const lobbyCard = $('#tourneyLobbyCard');
  const bracketVp = $('#tourneyBracketViewport');

  if (lobbyCard) lobbyCard.hidden = !isLobby;
  if (bracketVp) bracketVp.hidden = isLobby;

  renderTourneyHeader(t);

  if (isLobby) {
    renderTourneyLobby(t);
  } else {
    renderTournamentBracket(t);
  }
}

function renderTourneyHeader(t) {
  const roundNames = {
    1: t.size === 32 ? '32 強淘汰賽' : t.size === 16 ? '16 強世界爭霸' : t.size === 8 ? '半準決賽 (8強)' : '準決賽 (4強)',
    2: t.size === 32 ? '16 強賽' : t.size === 16 ? '半準決賽 (8強)' : '決賽圈',
    3: t.size === 32 ? '半準決賽 (8強)' : t.size === 16 ? '準決賽 (4強)' : '總決賽',
    4: t.size === 32 ? '準決賽 (4強)' : '世界總決賽',
    5: '世界總決賽 (World Final)'
  };

  const formatNames = {
    bo1: '⚡ 全程 BO1 單淘汰',
    hybrid: '⭐ 四強前 BO1 · 決賽圈 BO3',
    bo3: '⚔️ 全程 BO3 征服反制'
  };

  const myMatch = TournamentEngine.getMyMatch();
  const amIEliminated = !myMatch && t.status === 'in_progress';

  $('#tourneyRoundPill').textContent = `第 ${t.currentRound}/${t.totalRounds} 輪 · ${roundNames[t.currentRound] || '淘汰賽'}`;
  $('#tourneyFormatName').textContent = formatNames[t.matchType] || '標準賽制';

  const myStateEl = $('#tourneyMyState');
  if (myStateEl) {
    if (t.status === 'completed') {
      myStateEl.innerHTML = t.champion?.isMe ? '🏆 <b style="color:#fbbf24">榮登世界總冠軍！</b>' : '🏁 賽事圓滿完結';
    } else if (amIEliminated) {
      myStateEl.innerHTML = '👀 <span style="color:#94a3b8">特邀戰術觀摩員 (收看決賽)</span>';
    } else if (myMatch) {
      myStateEl.innerHTML = '🟢 <b style="color:var(--cyan)">席位在線 · 準備迎戰</b>';
    } else {
      myStateEl.innerHTML = '⏳ 備戰大廳';
    }
  }

  // 計算當前輪次剩餘隊伍
  const activeTeams = Object.values(t.matches).filter(m => m.round === t.currentRound && m.status !== 'finished').length * 2;
  $('#tourneyRemainingCount').textContent = `${Math.max(activeTeams, 2)} 隊`;

  // 操作按鈕列
  const actBox = $('#tourneyActionBox');
  if (actBox) {
    if (t.status === 'registration') {
      actBox.innerHTML = '';
    } else if (myMatch && t.status === 'in_progress') {
      const opp = myMatch.teamA.isMe ? myMatch.teamB : myMatch.teamA;
      actBox.innerHTML = `
        <button class="btn amber sm" id="btnTourneyGoFight" style="font-weight:800;animation:pulseGoldBorder 1.5s infinite">
          ⚔️ 迎戰 ${opp.flag} ${esc(opp.name)} (出擊)
        </button>
        <button class="btn ghost sm" id="btnTourneyTuneDeck" title="調整當前作戰陣容">🛠️ 調配陣容</button>
        <button class="btn ghost sm" id="btnTourneyResetAll" style="color:var(--red);border-color:rgba(255,93,110,.3)">重置錦標賽 ✕</button>
      `;
    } else {
      actBox.innerHTML = `
        <span class="muted" style="font-size:12px;margin-right:6px">點選樹狀圖任一場次即可觀摩推演</span>
        <button class="btn ghost sm" id="btnTourneyTuneDeck">🛠️ 瀏覽軍火庫</button>
        <button class="btn ghost sm" id="btnTourneyResetAll" style="color:var(--red);border-color:rgba(255,93,110,.3)">重新開賽 🔄</button>
      `;
    }
  }
}

function renderTourneyLobby(t) {
  $('#lobbyTotalCount').textContent = t.size;
  const filled = t.participants.filter(Boolean).length;
  $('#lobbyFilledCount').textContent = filled;

  const grid = $('#lobbyParticipantsGrid');
  if (!grid) return;

  grid.innerHTML = t.participants.map((p, idx) => {
    if (!p) {
      return `<div class="p-slot-chip empty">
        <span class="muted">#${idx + 1}</span>
        <span class="p-name muted">等待加入...</span>
      </div>`;
    }
    return `<div class="p-slot-chip ${p.isMe ? 'me' : 'ai'}">
      <span>${p.flag || '🌐'}</span>
      <span class="p-name" title="${esc(p.name)}">${esc(p.name)}</span>
      <span class="muted" style="font-size:10px">${p.isMe ? '我方' : 'AI'}</span>
    </div>`;
  }).join('');
}

/* 繪製仿照世足 2026 的左右雙翼對抗樹 (FIFA World Cup Bracket) */
/* =====================================================
   方案 A：心智圖雙向向心樹 (Bilateral Mindmap Arena)
   具備實體動態 SVG 貝茲流光連線、自適應向心聚攏與電競 2.0 對抗節點
   ===================================================== */
function renderTournamentBracket(t) {
  const container = $('#bracketContainer');
  if (!container) return;

  const totalRounds = t.totalRounds;

  // 1. 生成左半區欄位 (Left Wing: R1 -> R2 -> Semi-Finals 向心)
  const leftWingCols = [];
  for (let r = 1; r < totalRounds; r++) {
    const matchesInRound = Object.values(t.matches).filter(m => m.round === r && m.isLeft);
    leftWingCols.push({
      round: r,
      title: getRoundTitle(r, t.size),
      matches: matchesInRound
    });
  }

  // 2. 生成右半區欄位 (Right Wing: Semi-Finals <- R2 <- R1 向心)
  const rightWingCols = [];
  for (let r = totalRounds - 1; r >= 1; r--) {
    const matchesInRound = Object.values(t.matches).filter(m => m.round === r && !m.isLeft && m.id !== t.finalMatchId && m.id !== t.bronzeMatchId);
    rightWingCols.push({
      round: r,
      title: getRoundTitle(r, t.size),
      matches: matchesInRound
    });
  }

  // 3. 中央決賽與季軍賽
  const finalMatch = t.matches[t.finalMatchId];
  const bronzeMatch = t.matches[t.bronzeMatchId];

  // 容器尺度自適應類別 (針對 4/8/16/32 強縮放)
  container.className = `bracket-container bracket-size-${t.size}`;

  container.innerHTML = `
    <!-- 戰術極座標同心圓雷達底座 (Tactical Radar Backdrop) -->
    <div class="bracket-tactical-backdrop" aria-hidden="true">
      <div class="radar-crosshair-h"></div>
      <div class="radar-crosshair-v"></div>
      <div class="radar-ring rr-1"></div>
      <div class="radar-ring rr-2"></div>
      <div class="radar-ring rr-3"></div>
      <div class="radar-label top">TACTICAL ARENA · WORLD CUP 2026</div>
    </div>

    <!-- 全畫布動態 SVG 貝茲連線圖層 (Bézier Flow Layer) -->
    <svg class="bracket-svg-layer" id="bracketSvgLayer"></svg>

    <!-- 左翼 (上半區 向心聚合) -->
    <div class="bracket-wing left-wing">
      ${leftWingCols.map(col => renderBracketColHtml(col, t, 'left')).join('')}
    </div>

    <!-- 中央世界冠軍王座 (歐冠 2024 神殿風格：上方冠亞軍 · 正中央大獎盃 · 下方季殿軍) -->
    <div class="bracket-center">
      <!-- 上方：總冠軍決賽 (GOLD FINAL 冠亞軍爭霸) -->
      <div class="final-match-box">
        <div class="match-box-title gold-title">
          <span>★ 巔峰總決賽 · 冠亞軍爭霸 ★</span>
        </div>
        ${finalMatch ? renderMatchCardHtml(finalMatch, t, true) : ''}
      </div>

      <!-- 正中央：大獎盃榮譽神壇 (World Champion Center Trophy) -->
      <div class="trophy-podium center-trophy">
        <div class="trophy-halo"></div>
        <div class="trophy-icon-glow">🏆</div>
        <div class="trophy-title">WORLD CHAMPION</div>
        <div class="trophy-sub-tag">2026 頂尖霸主王座</div>
        <div class="trophy-champion-box" id="trophyChampionDisplay">
          ${t.champion ? `<span class="champ-flag">${t.champion.flag}</span> <strong class="champ-name">${esc(t.champion.name)}</strong> <span class="crown">👑</span>` : '<span class="champ-wait">⏳ 待世界冠軍誕生...</span>'}
        </div>
      </div>

      <!-- 下方：季殿軍爭奪戰 (BRONZE FINAL) -->
      <div class="bronze-match-box">
        <div class="match-box-title bronze-title">
          <span>◆ 季殿軍榮譽戰 · BRONZE FINAL ◆</span>
        </div>
        ${bronzeMatch ? renderMatchCardHtml(bronzeMatch, t, false, true) : ''}
      </div>
    </div>

    <!-- 右翼 (下半區 向心聚合) -->
    <div class="bracket-wing right-wing">
      ${rightWingCols.map(col => renderBracketColHtml(col, t, 'right')).join('')}
    </div>
  `;

  // 一屏流自適應縮放並繪製 SVG 貝茲心智圖連線（同步一次 + 下一幀字型/排版穩定後再校正一次）
  applyBracketFitToViewport();
  renderBracketSvgLinks(t);
  requestAnimationFrame(() => {
    applyBracketFitToViewport();
    renderBracketSvgLinks(t);
  });
}

/* =====================================================
   智慧一屏流自適應縮放引擎 (Scale-to-fit Engine)
   自動量測可用視窗寬高，保證 4/8/16/32 強均在單一螢幕完全顯示，徹底消滅滾動條
   ===================================================== */
function applyBracketFitToViewport() {
  const viewport = $('#tourneyBracketViewport');
  const container = $('#bracketContainer');
  if (!viewport || !container) return 1;

  // 1. 以自然設計尺寸量測（不受 transform 影響）
  container.style.transform = 'translate(-50%, -50%)';
  const natW = container.offsetWidth;
  const natH = container.offsetHeight;
  const vpW = viewport.clientWidth;
  const vpH = viewport.clientHeight;
  if (!natW || !natH || !vpW || !vpH) return 1;

  // 2. 計算等比例縮放：寬高皆完整放入（保留 12px 安全邊距），小規模最多放大 1.25 倍
  const scale = Math.min((vpW - 12) / natW, (vpH - 12) / natH, 1.25);
  container.style.transform = `translate(-50%, -50%) scale(${scale.toFixed(4)})`;
  container.dataset.scale = String(scale);
  container.classList.add('is-fitted');
  return scale;
}

function getRoundTitle(r, size) {
  if (size === 32) {
    if (r === 1) return '32 強賽';
    if (r === 2) return '16 強賽';
    if (r === 3) return '半準決賽 (8強)';
    if (r === 4) return '準決賽 (4強)';
  } else if (size === 16) {
    if (r === 1) return '16 強賽';
    if (r === 2) return '半準決賽 (8強)';
    if (r === 3) return '準決賽 (4強)';
  } else if (size === 8) {
    if (r === 1) return '半準決賽 (8強)';
    if (r === 2) return '準決賽 (4強)';
  } else {
    return '準決賽 (4強)';
  }
  return `第 ${r} 輪`;
}

function renderBracketColHtml(col, t, side) {
  return `<div class="bracket-col ${side}-col" data-round="${col.round}">
    <div class="bracket-col-header">
      <span class="col-header-pill">${col.title}</span>
    </div>
    <div class="bracket-col-matches">
      ${col.matches.map(m => renderMatchCardHtml(m, t)).join('')}
    </div>
  </div>`;
}

function renderMatchCardHtml(m, t, isFinal = false, isBronze = false) {
  const isMyMatch = (m.teamA?.isMe || m.teamB?.isMe);
  const isFinished = (m.status === 'finished');
  const reqWins = TournamentEngine.getRequiredWins(m);

  // 局數計分圓點生成輔助 (BO3/BO5 pips)
  const renderPips = (score, req) => {
    if (req <= 1) return '';
    let pips = '';
    for (let i = 0; i < req; i++) {
      pips += `<span class="pip ${i < score ? 'won' : ''}"></span>`;
    }
    return `<div class="b-pips">${pips}</div>`;
  };

  return `<div class="b-match-card ${isMyMatch ? 'is-my-match' : ''} ${isFinal ? 'is-grand-final' : ''} ${isBronze ? 'is-bronze-card' : ''}" data-match-id="${m.id}">
    <!-- 兩側實體連接端子口 (SVG 連線錨定端子) -->
    <div class="port-terminal port-left" aria-hidden="true"></div>
    <div class="port-terminal port-right" aria-hidden="true"></div>

    ${isMyMatch ? `<div class="my-match-strip"><span class="pulse-beacon"></span> 我方作戰線</div>` : ''}

    <div class="b-team-row ${isFinished && m.winner === 'A' ? 'winner' : isFinished ? 'loser' : ''}">
      <div class="b-team-name-box">
        <span class="b-team-flag-pill">${m.teamA ? m.teamA.flag : '？'}</span>
        <span class="b-team-name" title="${m.teamA ? esc(m.teamA.name) : '待定對手'}">${m.teamA ? esc(m.teamA.name) : '待定對手'}</span>
      </div>
      <div class="b-score-wrapper">
        ${renderPips(m.scoreA, reqWins)}
        <span class="b-score-plate ${isFinished && m.winner === 'A' ? 'is-winner' : ''}">${m.scoreA}</span>
      </div>
    </div>

    <div class="b-team-row ${isFinished && m.winner === 'B' ? 'winner' : isFinished ? 'loser' : ''}">
      <div class="b-team-name-box">
        <span class="b-team-flag-pill">${m.teamB ? m.teamB.flag : '？'}</span>
        <span class="b-team-name" title="${m.teamB ? esc(m.teamB.name) : '待定對手'}">${m.teamB ? esc(m.teamB.name) : '待定對手'}</span>
      </div>
      <div class="b-score-wrapper">
        ${renderPips(m.scoreB, reqWins)}
        <span class="b-score-plate ${isFinished && m.winner === 'B' ? 'is-winner' : ''}">${m.scoreB}</span>
      </div>
    </div>

    <div class="b-match-status-bar">
      <span class="b-match-id-tag">${m.id} · ${reqWins > 1 ? `BO3(先${reqWins}勝)` : 'BO1'}</span>
      ${isFinished ?
        `<span class="b-status-badge finished">✔ 戰報 ℹ</span>` :
        (m.teamA && m.teamB) ?
          `<span class="b-status-badge live">● 觀戰 ▶</span>` :
          `<span class="b-status-badge waiting">⏳ 待定</span>`}
    </div>
  </div>`;
}

/* =====================================================
   動態 SVG 貝茲流光連線核心演算法 (SVG Bézier Connector Engine)
   精準計算卡片幾何錨點，以心智圖平滑三次貝茲曲線銜接各輪次
   ===================================================== */
function renderBracketSvgLinks(t) {
  const container = $('#bracketContainer');
  const svg = $('#bracketSvgLayer');
  if (!container || !svg || !t || !t.matches) return;

  // 畫布已被 scale 縮放：getBoundingClientRect 為縮放後尺寸，需除以 scale 還原為畫布內部座標
  const s = parseFloat(container.dataset.scale) || 1;
  const rawRect = container.getBoundingClientRect();
  if (rawRect.width === 0 || rawRect.height === 0) return;
  const W = container.offsetWidth;
  const H = container.offsetHeight;
  const toLocal = r => ({
    left: (r.left - rawRect.left) / s,
    right: (r.right - rawRect.left) / s,
    top: (r.top - rawRect.top) / s,
    height: r.height / s
  });
  const cRect = { left: 0, top: 0 };
  const localRect = el => toLocal(el.getBoundingClientRect());

  svg.setAttribute('width', W);
  svg.setAttribute('height', H);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  let pathsHtml = `
    <defs>
      <!-- 金色晉級流光漸層 -->
      <linearGradient id="winnerFlowGold" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.9" />
        <stop offset="50%" stop-color="#fbbf24" stop-opacity="1" />
        <stop offset="100%" stop-color="#f59e0b" stop-opacity="0.9" />
      </linearGradient>
      <!-- 翡翠綠晉級漸層 -->
      <linearGradient id="winnerFlowGreen" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#059669" stop-opacity="0.9" />
        <stop offset="50%" stop-color="#34d399" stop-opacity="1" />
        <stop offset="100%" stop-color="#10b981" stop-opacity="0.9" />
      </linearGradient>
      <!-- 季軍古銅漸層 -->
      <linearGradient id="bronzeFlow" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#b45309" stop-opacity="0.5" />
        <stop offset="100%" stop-color="#d97706" stop-opacity="0.8" />
      </linearGradient>
      <!-- 霓虹光暈濾鏡 -->
      <filter id="neonGlow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="3.5" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
  `;

  // 1. 繪製標準晉級樹 (Left & Right Wings -> Final)
  Object.values(t.matches).forEach(m => {
    if (!m.nextMatchId || !t.matches[m.nextMatchId]) return;

    const fromEl = container.querySelector(`[data-match-id="${m.id}"]`);
    const toEl = container.querySelector(`[data-match-id="${m.nextMatchId}"]`);
    if (!fromEl || !toEl) return;

    const fromRect = localRect(fromEl);
    const toRect = localRect(toEl);

    let x1, y1, x2, y2, ctrlX1, ctrlY1, ctrlX2, ctrlY2;
    const isLeft = m.isLeft;

    if (isLeft) {
      // 左翼：從卡片右緣中心出發 -> 進入下一輪卡片左緣
      x1 = fromRect.right - cRect.left;
      y1 = fromRect.top + fromRect.height * 0.5 - cRect.top;
      x2 = toRect.left - cRect.left;
      const slotRatio = m.nextSlot === 'A' ? 0.32 : m.nextSlot === 'B' ? 0.68 : 0.5;
      y2 = toRect.top + toRect.height * slotRatio - cRect.top;

      const dx = Math.max(25, (x2 - x1) * 0.55);
      ctrlX1 = x1 + dx;
      ctrlY1 = y1;
      ctrlX2 = x2 - dx;
      ctrlY2 = y2;
    } else {
      // 右翼：從卡片左緣中心出發 -> 進入下一輪卡片右緣
      x1 = fromRect.left - cRect.left;
      y1 = fromRect.top + fromRect.height * 0.5 - cRect.top;
      x2 = toRect.right - cRect.left;
      const slotRatio = m.nextSlot === 'A' ? 0.32 : m.nextSlot === 'B' ? 0.68 : 0.5;
      y2 = toRect.top + toRect.height * slotRatio - cRect.top;

      const dx = Math.max(25, (x1 - x2) * 0.55);
      ctrlX1 = x1 - dx;
      ctrlY1 = y1;
      ctrlX2 = x2 + dx;
      ctrlY2 = y2;
    }

    const pathD = `M ${x1} ${y1} C ${ctrlX1} ${ctrlY1}, ${ctrlX2} ${ctrlY2}, ${x2} ${y2}`;
    const isFinished = (m.status === 'finished');
    const isMyAdvancement = isFinished && ((m.winner === 'A' && m.teamA?.isMe) || (m.winner === 'B' && m.teamB?.isMe));

    let strokeClass = 'bracket-link-pending';
    let strokeAttr = '';
    let filterAttr = '';

    if (isFinished) {
      if (isMyAdvancement) {
        strokeClass = 'bracket-link-my-flow';
        strokeAttr = 'stroke="url(#winnerFlowGold)"';
        filterAttr = 'filter="url(#neonGlow)"';
      } else {
        strokeClass = 'bracket-link-active';
        strokeAttr = 'stroke="url(#winnerFlowGreen)"';
        filterAttr = 'filter="url(#neonGlow)"';
      }
    }

    pathsHtml += `
      <g class="bracket-link-group">
        <!-- 底層深色軌道 -->
        <path d="${pathD}" class="bracket-link-bg" />
        <!-- 核心貝茲導軌 (流光動畫) -->
        <path d="${pathD}" class="bracket-link-core ${strokeClass}" ${strokeAttr} ${filterAttr} />
        <!-- 起始端點與接入端點微型科技圓點 -->
        <circle cx="${x1}" cy="${y1}" r="3" class="bracket-port-circle ${isFinished ? 'active' : ''}" />
        <circle cx="${x2}" cy="${y2}" r="3" class="bracket-port-circle ${isFinished ? 'active' : ''}" />
      </g>
    `;
  });

  // 2. 準決賽敗者引導至季軍賽 (Bronze Final) 的虛線導引
  if (t.bronzeMatchId && t.matches[t.bronzeMatchId]) {
    const bronzeEl = container.querySelector(`[data-match-id="${t.bronzeMatchId}"]`);
    if (bronzeEl) {
      const bRect = localRect(bronzeEl);
      const semiMatches = Object.values(t.matches).filter(m => m.round === t.totalRounds - 1);
      semiMatches.forEach(sm => {
        const smEl = container.querySelector(`[data-match-id="${sm.id}"]`);
        if (!smEl) return;
        const smRect = localRect(smEl);
        let x1, y1, x2, y2, ctrlX1, ctrlY1, ctrlX2, ctrlY2;
        if (sm.isLeft) {
          x1 = smRect.right - cRect.left;
          y1 = smRect.top + smRect.height * 0.7 - cRect.top;
          x2 = bRect.left - cRect.left;
          y2 = bRect.top + bRect.height * 0.4 - cRect.top;
          const dx = Math.max(20, (x2 - x1) * 0.5);
          ctrlX1 = x1 + dx; ctrlY1 = y1; ctrlX2 = x2 - dx; ctrlY2 = y2;
        } else {
          x1 = smRect.left - cRect.left;
          y1 = smRect.top + smRect.height * 0.7 - cRect.top;
          x2 = bRect.right - cRect.left;
          y2 = bRect.top + bRect.height * 0.6 - cRect.top;
          const dx = Math.max(20, (x1 - x2) * 0.5);
          ctrlX1 = x1 - dx; ctrlY1 = y1; ctrlX2 = x2 + dx; ctrlY2 = y2;
        }
        const bPathD = `M ${x1} ${y1} C ${ctrlX1} ${ctrlY1}, ${ctrlX2} ${ctrlY2}, ${x2} ${y2}`;
        pathsHtml += `
          <g class="bracket-link-bronze-group">
            <path d="${bPathD}" class="bracket-link-bg" />
            <path d="${bPathD}" class="bracket-link-bronze" stroke="url(#bronzeFlow)" stroke-dasharray="4 3" />
          </g>
        `;
      });
    }
  }

  svg.innerHTML = pathsHtml;
}

/* 點擊錦標賽任一對抗卡片，彈出觀戰與戰報彈窗 */
function openTournamentSpectatorModal(matchId) {
  const snap = TournamentEngine.getMatchSnapshot(matchId);
  if (!snap) return;

  const modal = $('#tourneySpectatorModal');
  const card = $('#tourneySpectatorCard');
  if (!modal || !card) return;

  const reqWins = snap.requiredWins;
  const teamAName = snap.teamA ? `${snap.teamA.flag} ${snap.teamA.name}` : '待定';
  const teamBName = snap.teamB ? `${snap.teamB.flag} ${snap.teamB.name}` : '待定';

  card.innerHTML = `
    <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:12px">
      <div style="font-family:var(--head);font-size:16px;font-weight:800;color:var(--amber)">
        🏆 戰況情報所 · 場次 ${snap.matchId} (${reqWins > 1 ? 'BO3 三局兩勝制' : 'BO1 單淘汰'})
      </div>
      <button class="btn ghost sm" id="btnTourneySpecClose">關閉 ✕</button>
    </div>

    <!-- 對抗即時大比分面板 -->
    <div class="pvp-versus-box" style="margin-bottom:16px">
      <div class="pvp-v-player">
        <div class="v-flag">${snap.teamA?.flag || '🌐'}</div>
        <div class="v-name">${esc(snap.teamA?.name || '待定')}</div>
        <span class="v-uid">${snap.teamA?.isMe ? '我方' : 'AI'}</span>
      </div>
      <div class="pvp-vs-badge">
        <span style="font-size:24px;font-family:var(--mono);color:#fff">${snap.scoreA} : ${snap.scoreB}</span>
        <div class="pvp-ping" style="color:${snap.status === 'finished' ? '#10b981' : '#f59e0b'}">
          ${snap.status === 'finished' ? '✔ 已完賽' : '⚡ 爭霸激戰中'}
        </div>
      </div>
      <div class="pvp-v-player">
        <div class="v-flag">${snap.teamB?.flag || '🌐'}</div>
        <div class="v-name">${esc(snap.teamB?.name || '待定')}</div>
        <span class="v-uid">${snap.teamB?.isMe ? '我方' : 'AI'}</span>
      </div>
    </div>

    <!-- 歷局小局快照清單 (零頻寬黑盒子重播) -->
    <div style="margin-top:12px">
      <div class="sheet-label" style="margin-bottom:8px">小局交火推演記錄 (${snap.history.length} 局)</div>
      ${snap.history.length === 0 ? `<div class="muted" style="padding:16px;text-align:center">此場次正在進行戰術配置，尚未交火。</div>` : ''}
      <div style="display:flex;flex-direction:column;gap:10px">
        ${snap.history.map((h, i) => {
          const wName = h.winner === 'A' ? teamAName : teamBName;
          return `<div class="panel" style="padding:10px 14px;background:rgba(255,255,255,.04);border:1px solid var(--line2);display:flex;justify-content:space-between;align-items:center">
            <div>
              <strong style="color:var(--cyan)">第 ${h.round} 局</strong> ｜
              戰場：${h.event?.icon || '🌐'} ${esc(h.event?.name || '標準戰區')} ｜
              獲勝：<b style="color:${h.winner === 'A' ? '#38bdf8' : '#f87171'}">${wName}</b>
              <div class="muted" style="font-size:11px;margin-top:2px">積分 ${h.scoreA.toFixed(0)} : ${h.scoreB.toFixed(0)}</div>
            </div>
            <button class="btn ghost sm btnReplayRound" data-match="${snap.matchId}" data-round-idx="${i}" style="font-size:11.5px">
              🎬 播放戰鬥推演
            </button>
          </div>`;
        }).join('')}
      </div>
    </div>
  `;

  modal.hidden = false;
  currentActiveModal = modal;
}

/* 啟動錦標賽中玩家的一場戰鬥 */
function startTournamentPlayerBattle() {
  const myMatch = TournamentEngine.getMyMatch();
  if (!myMatch) {
    toast('⚠️ 目前沒有輪到你的對戰場次');
    return;
  }

  // 驗證玩家陣容
  if (!state.deck.every(Boolean)) {
    toast('⚠️ 參賽陣容必須完整配置 5 個作戰槽位！請至軍火庫完成配給。');
    setMode('quick');
    return;
  }

  const opp = myMatch.teamA.isMe ? myMatch.teamB : myMatch.teamA;
  state.enemy = (opp.deck || generateLegalDeck()).slice();
  state.enemyName = `${opp.flag} ${opp.name}`;
  state.enemyDoc = opp.doctrine || 'defense';

  // 開啟戰鬥推演
  startBattle();
}

/* 錦標賽單局結算處理 */
function handleTournamentRoundEnd(res) {
  const myMatch = TournamentEngine.getMyMatch();
  if (!myMatch) {
    showResult(res);
    return;
  }

  const seed = (Math.random() * 4294967296) >>> 0;
  const eventObj = state.event || pick(EVENTS);
  const out = TournamentEngine.submitPlayerRoundResult(myMatch.id, res, seed, eventObj);

  if (out.matchFinished) {
    const iWon = out.winner.isMe;
    showResult(res, {
      bo3NextText: iWon ? '🏆 晉級下一輪！回到錦標賽對抗樹' : '💔 遺憾止步！回到錦標賽觀戰',
      bo3Callback: () => {
        closeBattle();
        const t = TournamentEngine.getState();
        if (t.status === 'completed' && t.champion?.isMe) {
          showTournamentChampionModal(t.champion);
        } else {
          setMode('tournament');
          if (iWon) {
            toast(`🎉 恭喜突破重圍！已順利晉級下一輪！`);
          } else {
            toast(`💔 於本輪止步！你已轉為特邀戰術觀摩員，可收看後續所有決賽！`);
          }
        }
      }
    });
  } else {
    // BO3 還沒打完
    showResult(res, {
      bo3NextText: `進入第 ${myMatch.history.length + 1} 局 (比分 ${out.currentScore[0]} - ${out.currentScore[1]})`,
      bo3Callback: () => {
        closeBattle();
        setMode('tournament');
        toast(`小局戰罷！當前比分 ${out.currentScore[0]} : ${out.currentScore[1]}，請準備下一小局出擊！`);
      }
    });
  }
}

/* 世界冠軍頒獎典禮 Modal */
function showTournamentChampionModal(championTeam) {
  const modal = $('#tourneyChampionModal');
  const card = $('#tourneyChampionCard');
  if (!modal || !card) return;

  card.innerHTML = `
    <div style="font-size:64px;line-height:1;animation:floatTrophy 2s ease-in-out infinite">🏆</div>
    <h1 style="font-family:var(--head);font-size:26px;color:#fbbf24;margin:12px 0 4px;letter-spacing:0.08em">
      WORLD CHAMPION 2026
    </h1>
    <h2 style="font-size:20px;color:#fff;margin:0 0 16px">
      ${championTeam.flag} ${esc(championTeam.name)}
    </h2>
    <p class="muted" style="font-size:13.5px;max-width:440px;margin:0 auto 20px;line-height:1.6">
      歷經多輪殊死淘汰與戰術推演，以不可阻擋的聯合作戰微操奪得最高榮譽！登頂世界冠軍王座！
    </p>
    <div class="row" style="justify-content:center;gap:12px">
      <button class="btn amber lg" id="btnDownloadTourneyPoster" style="font-weight:900">
        📜 下載冠軍榮譽戰報海報
      </button>
      <button class="btn ghost lg" id="btnTourneyChampionClose">
        關閉 ✕
      </button>
    </div>
  `;

  modal.hidden = false;
  currentActiveModal = modal;
  SoundEngine.play('victory');
}

/* 錦標賽世界冠軍戰術海報下載 (Canvas) */
function downloadTournamentChampionPoster(championTeam) {
  const W = 1080, H = 1440, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#090d16'); bg.addColorStop(1, '#1e1b4b'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  
  g.strokeStyle = 'rgba(245,158,11,.15)'; g.lineWidth = 1;
  for (let x = 0; x < W; x += 54) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  for (let y = 0; y < H; y += 54) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }

  g.fillStyle = '#fbbf24'; g.font = '700 28px "JetBrains Mono",monospace'; g.fillText('TOP CLASH 15 · WORLD CHAMPIONSHIP', 80, 110);
  g.fillStyle = '#ffffff'; g.font = '900 68px "Noto Sans TC",sans-serif'; g.fillText('世界盃淘汰大獎賽', 80, 200);

  g.fillStyle = '#f59e0b'; g.font = '900 130px "Noto Sans TC",sans-serif';
  g.fillText('世界總冠軍 🏆', 80, 380);

  g.fillStyle = '#38bdf8'; g.font = '700 48px "Noto Sans TC",sans-serif';
  g.fillText(`${championTeam.flag} ${championTeam.name}`, 80, 470);

  g.fillStyle = '#94a3b8'; g.font = '500 28px "Noto Sans TC",sans-serif';
  g.fillText(`登頂日期：${new Date().toLocaleDateString('zh-TW')} ｜ 15元聯合作戰最高殿堂`, 80, 530);

  let y = 600;
  state.deck.forEach((id, i) => {
    const u = UNIT_MAP[id]; if (!u) return;
    const col = CATS[u.cat].color;
    g.fillStyle = 'rgba(255,255,255,.05)'; roundRect(g, 80, y, 920, 120, 18); g.fill();
    g.fillStyle = col; g.fillRect(80, y, 8, 120);
    g.fillStyle = '#94a3b8'; g.font = '600 24px "JetBrains Mono",monospace'; g.fillText(CATS[u.cat].short + ' · ' + SLOTS[i].label, 120, y + 40);
    g.fillStyle = '#dbe7f5'; g.font = '700 42px "Noto Sans TC",sans-serif'; g.fillText(u.name, 120, y + 90);
    g.fillStyle = '#fbbf24'; g.font = '700 54px Rajdhani,"Noto Sans TC",sans-serif'; g.textAlign = 'right'; g.fillText('$' + u.cost, 960, y + 80); g.textAlign = 'left';
    y += 138;
  });

  const a = document.createElement('a'); a.download = 'topclash-champion.png'; a.href = c.toDataURL('image/png'); a.click();
  toast('🏆 世界冠軍戰報海報已成功下載！');
}

/* 綁定錦標賽大廳與樹狀圖交互事件 */
$('#tourneySizeSelector')?.addEventListener('click', e => {
  const btn = e.target.closest('.pill-btn'); if (!btn) return;
  document.querySelectorAll('#tourneySizeSelector .pill-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  tourneySelectedSize = +btn.dataset.size;
  TournamentEngine.create(tourneySelectedSize, tourneySelectedFormat);
  renderTournamentView();
});

$('#tourneyFormatSelector')?.addEventListener('click', e => {
  const btn = e.target.closest('.pill-btn'); if (!btn) return;
  document.querySelectorAll('#tourneyFormatSelector .pill-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  tourneySelectedFormat = btn.dataset.format;
  TournamentEngine.create(tourneySelectedSize, tourneySelectedFormat);
  renderTournamentView();
});

$('#btnTourneyFillAI')?.addEventListener('click', () => {
  TournamentEngine.fillWithAI();
  renderTournamentView();
  toast('🤖 已自動調派全球各國精選特遣隊，補滿全部參賽席位！');
});

$('#btnTourneyResetLobby')?.addEventListener('click', () => {
  TournamentEngine.create(tourneySelectedSize, tourneySelectedFormat);
  renderTournamentView();
  toast('已重置參賽席位');
});

$('#btnTourneyStart')?.addEventListener('click', () => {
  TournamentEngine.start();
  renderTournamentView();
  toast('🏆 世界盃淘汰錦標賽正式開賽！世足對抗樹已生成！');
});

$('#tourneyActionBox')?.addEventListener('click', e => {
  if (e.target.closest('#btnTourneyGoFight')) {
    startTournamentPlayerBattle();
    return;
  }
  if (e.target.closest('#btnTourneyTuneDeck')) {
    setMode('quick');
    toast('請在軍火庫調整你的 5 槽聯合作戰陣容，完成後切回【淘汰錦標賽】出擊！');
    return;
  }
  if (e.target.closest('#btnTourneyResetAll')) {
    TournamentEngine.create(tourneySelectedSize, tourneySelectedFormat);
    renderTournamentView();
    toast('已重置淘汰錦標賽，回到配置大廳');
    return;
  }
});

// 點擊樹狀圖上任何比賽節點
$('#bracketContainer')?.addEventListener('click', e => {
  const card = e.target.closest('.b-match-card'); if (!card) return;
  const matchId = card.dataset.matchId;
  openTournamentSpectatorModal(matchId);
});

// 觀戰彈窗內點擊播放推演
$('#tourneySpectatorModal')?.addEventListener('click', e => {
  if (e.target.id === 'tourneySpectatorModal' || e.target.id === 'btnTourneySpecClose' || e.target.closest('#btnTourneySpecClose')) {
    $('#tourneySpectatorModal').hidden = true;
    currentActiveModal = null;
    return;
  }
  const replayBtn = e.target.closest('.btnReplayRound');
  if (replayBtn) {
    const matchId = replayBtn.dataset.match;
    const rIdx = +replayBtn.dataset.roundIdx;
    const snap = TournamentEngine.getMatchSnapshot(matchId);
    if (!snap || !snap.history[rIdx]) return;
    const h = snap.history[rIdx];
    const res = resolveBattle(h.deckA, h.deckB, {
      seed: h.seed,
      event: h.event,
      docA: h.docA || 'defense',
      docB: h.docB || 'defense'
    });
    $('#tourneySpectatorModal').hidden = true;
    currentActiveModal = null;
    showBattle(res);
  }
});

// 冠軍彈窗互動
$('#tourneyChampionModal')?.addEventListener('click', e => {
  if (e.target.id === 'tourneyChampionModal' || e.target.id === 'btnTourneyChampionClose') {
    $('#tourneyChampionModal').hidden = true;
    currentActiveModal = null;
    return;
  }
  if (e.target.id === 'btnDownloadTourneyPoster' || e.target.closest('#btnDownloadTourneyPoster')) {
    const t = TournamentEngine.getState();
    if (t?.champion) downloadTournamentChampionPoster(t.champion);
  }
});

function refitTournamentBracket() {
  if (state.mode === 'tournament' && typeof TournamentEngine !== 'undefined') {
    const t = TournamentEngine.getState();
    if (t && t.status !== 'registration') {
      applyBracketFitToViewport();
      renderBracketSvgLinks(t);
    }
  }
}
window.addEventListener('resize', refitTournamentBracket);
if (typeof ResizeObserver !== 'undefined' && $('#tourneyBracketViewport')) {
  new ResizeObserver(() => requestAnimationFrame(refitTournamentBracket)).observe($('#tourneyBracketViewport'));
}
if (document.fonts && document.fonts.ready) document.fonts.ready.then(refitTournamentBracket);

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

if (typeof LadderEngine !== 'undefined') LadderEngine.init();

setupMatch();
renderAll();

// 檢查 URL 是否帶有模式或好友邀請房間代碼
const urlParams = new URLSearchParams(window.location.search);
const modeParam = urlParams.get('mode');
if (modeParam && ['ladder', 'tournament', 'bo3', 'quick', 'ghost', 'daily', 'sandbox'].includes(modeParam)) {
  if (modeParam === 'ghost') {
    setMode('quick');
    state.quickSubMode = 'ghost';
    setupMatch();
    renderAll();
  } else {
    setMode(modeParam);
  }
}
const roomParam = urlParams.get('room');
if (roomParam) {
  setTimeout(() => {
    setMode('bo3');
    openOnlinePvpModal(roomParam.trim());
    toast(`🎯 偵測到好友 BO5 房間邀請 [${roomParam.toUpperCase()}]！點擊立即加入即可連線對決！`);
  }, 500);
}

if (!LS.get('db15_seen', 0)) showHelp();
window.__db15 = { state, startBattle, setMode, getGhostPool, applyTheme, toggleTheme, LadderEngine, renderLadderView, OnlinePvPEngine };
})();
