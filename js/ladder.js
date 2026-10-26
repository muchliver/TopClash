'use strict';
/* =====================================================
   頂尖對戰：15元聯合作戰 — 天梯核心演算法與排名引擎 (Ladder Engine)
   實作 CRS-15 戰略勝點數學模型、每日 00:00 截算、戰術迷霧偵察與排名躍升
   ===================================================== */

const LadderEngine = (function() {
  const STORAGE_KEY = 'topclash_ladder_v3';
  const LEGACY_STORAGE_KEY = 'topbattle_ladder_v3';

  let state = {
    player: {
      id: 'player_me',
      name: '我方聯合戰術作戰群',
      flag: '🇹🇼',
      rp: 2055,
      rank: 25,
      yesterdayRank: 27,
      yesterdayRP: 2010,
      orders: 5, // 今日剩餘作戰派遣令
      lastResetDate: '',
      streakDays: 1, // 連續維持該名次天數
      defenseDeck: ['F16V', 'M1A2', 'TC2', 'TUOCHIANG', 'FPV'],
      defenseDoc: 'air_sup',
      stats: { wins: 0, losses: 0, highestRank: 25, highestRP: 2055, miracleKills: 0, streakBreaks: 0 }
    },
    roster: [], // 全體天梯名冊 (包含玩家與對手，即時依 rp 降序)
    yesterdayTop10: [] // 昨日前十強榮譽殿堂快照
  };

  function init() {
    load();
    checkDailyReset();
    sortAndReindex();
  }

  function getTodayDateStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && saved.player && Array.isArray(saved.roster) && saved.roster.length > 0) {
          state = saved;
          // 若舊存檔玩家排名在 30 名外，自動邀請進入 Top 30 爭霸戰 (定級第 25 名)
          if (!state.player.rank || state.player.rank > 30) {
            state.player.rp = 2055;
            state.player.rank = 25;
            state.player.yesterdayRank = 27;
            state.player.yesterdayRP = 2010;
          }
          if (typeof state.player.streakDays !== 'number' || state.player.streakDays < 1) {
            state.player.streakDays = 1;
          }
          // 確保每位 NPC 都有合理的連續駐榜天數 streakDays
          state.roster.forEach((u, i) => {
            if (typeof u.streakDays !== 'number' || u.streakDays < 1) {
              u.streakDays = i === 0 ? 5 : i === 1 ? 4 : i === 2 ? 3 : Math.floor(Math.random() * 4 + 1);
            }
          });
          return;
        }
      }
    } catch (e) {
      console.warn('載入天梯存檔失敗，重建天梯預設名冊', e);
    }

    // 首次初始化天梯資料
    state.roster = JSON.parse(JSON.stringify(LADDER_PRESETS));
    // 為 NPC 初始化擬真的連續在榜天數 (1~7 天)
    state.roster.forEach((u, i) => {
      u.streakDays = i === 0 ? 5 : i === 1 ? 4 : i === 2 ? 3 : Math.floor(Math.random() * 4 + 1);
    });

    state.roster.push(state.player);
    state.player.lastResetDate = getTodayDateStr();
    sortAndReindex();

    // 產生初始的「昨日前十強快照」
    state.yesterdayTop10 = state.roster.slice(0, 10).map((u, idx) => ({
      ...u,
      finalRank: idx + 1,
      yesterdayRP: u.rp + Math.floor((Math.random() - 0.5) * 40)
    }));
    save();
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('儲存天梯資料失敗', e);
    }
  }

  /* 每日 00:00 截算協議 */
  function checkDailyReset() {
    const today = getTodayDateStr();
    if (state.player.lastResetDate !== today) {
      // 1. 結算連續在位天數 streakDays
      if (state.player.yesterdayRank === state.player.rank) {
        state.player.streakDays = (state.player.streakDays || 1) + 1;
      } else {
        state.player.streakDays = 1;
      }

      state.player.yesterdayRank = state.player.rank;
      state.player.yesterdayRP = state.player.rp;
      state.player.orders = 5; // 恢復每日 5 次挑戰派遣令
      state.player.lastResetDate = today;

      // 2. 備份昨日前十強
      state.yesterdayTop10 = state.roster.slice(0, 10).map((u, idx) => ({
        ...u,
        finalRank: idx + 1
      }));

      // 3. 模擬世界天梯演化：全體 NPC 指揮官產生微量分數波動 (±1 ~ 15 RP) 並更新連續天數
      state.roster.forEach(u => {
        if (u.id !== state.player.id) {
          const shift = Math.floor((Math.random() - 0.48) * 16);
          const oldRank = u.rank || 50;
          u.yesterdayRank = oldRank;
          u.rp = Math.max(700, u.rp + shift);
          if (oldRank === u.rank) {
            u.streakDays = (u.streakDays || 1) + 1;
          } else {
            u.streakDays = 1;
          }
        }
      });

      sortAndReindex();
      save();
    }
  }

  function sortAndReindex() {
    state.roster.sort((a, b) => b.rp - a.rp);
    state.roster.forEach((u, idx) => {
      u.rank = idx + 1;
      if (u.id === state.player.id) {
        state.player.rank = u.rank;
        if (!state.player.stats.highestRank || state.player.rank < state.player.stats.highestRank) {
          state.player.stats.highestRank = state.player.rank;
        }
        if (state.player.rp > state.player.stats.highestRP) {
          state.player.stats.highestRP = state.player.rp;
        }
      }
    });
  }

  /* 取得對應 RP 的軍階資訊 */
  function getRankTier(rp) {
    for (const r of LADDER_RANKS) {
      if (rp >= r.minRP) return r;
    }
    return LADDER_RANKS[LADDER_RANKS.length - 1];
  }

  /* 取得 Top 30 名冊清單 */
  function getRosterTop30() {
    sortAndReindex();
    return state.roster.slice(0, 30);
  }

  /* 依排名取得指揮官資料 */
  function getRosterUserByRank(rank) {
    sortAndReindex();
    return state.roster.find(u => u.rank === rank) || null;
  }

  /* 判斷特定名次是否在玩家可挑戰的最近 5 名內 */
  function canChallengeRank(targetRank) {
    const pRank = state.player.rank;
    // 只能挑戰比自己高、且距離在 5 名以內之對手 (例如排名 25 只能挑戰 20, 21, 22, 23, 24)
    return targetRank < pRank && targetRank >= pRank - 5;
  }

  /* 挑選 3 名具備挑戰梯度的候選對手 (附帶戰術偵察迷霧) */
  function getMatchCandidates() {
    sortAndReindex();
    const pIdx = state.roster.findIndex(u => u.id === state.player.id);
    const total = state.roster.length;

    // 梯度 1：穩健目標 (領先 1 ~ 3 名)
    const idx1 = Math.max(0, pIdx - Math.floor(Math.random() * 3 + 1));
    // 梯度 2：進取目標 (領先 4 ~ 7 名)
    const idx2 = Math.max(0, pIdx - Math.floor(Math.random() * 4 + 4));
    // 梯度 3：越級強攻 (領先 8 ~ 14 名)
    const idx3 = Math.max(0, pIdx - Math.floor(Math.random() * 7 + 8));

    const pickedIndices = Array.from(new Set([idx1, idx2, idx3])).filter(i => i !== pIdx);
    // 防呆：若已經在前幾名，向下挑選
    if (pickedIndices.length < 3) {
      for (let i = pIdx - 1; i >= 0 && pickedIndices.length < 3; i--) {
        if (!pickedIndices.includes(i) && i !== pIdx) pickedIndices.push(i);
      }
      for (let i = pIdx + 1; i < total && pickedIndices.length < 3; i++) {
        if (!pickedIndices.includes(i) && i !== pIdx) pickedIndices.push(i);
      }
    }

    return pickedIndices.map(idx => {
      const opp = state.roster[idx];
      // 產生戰術偵察情報：旗艦 (deck[0]) 公開，其餘 2~3 個槽位遮蔽 (戰術迷霧)
      const intelDeck = opp.deck.map((unitId, slotIdx) => {
        const u = UNIT_MAP[unitId] || { name: '未知裝備', cat: 'air', cost: 3 };
        const isMasked = (slotIdx >= 1 && slotIdx <= 3); // 中間 3 槽受電戰迷霧遮蔽
        return {
          id: unitId,
          name: isMasked ? '【密電遮蔽】' : u.name,
          cat: u.cat,
          cost: isMasked ? '?' : u.cost,
          flag: isMasked ? '📡' : (u.flag || '🌐'),
          img: isMasked ? '' : (u.img || `assets/units/${unitId}.jpg`),
          isMasked: isMasked
        };
      });

      const rpDiff = opp.rp - state.player.rp;
      let label = '勢均力敵';
      let tagClass = 'even';
      if (rpDiff >= 80) { label = '越級強攻'; tagClass = 'hard'; }
      else if (rpDiff <= -20) { label = '穩操勝券'; tagClass = 'easy'; }

      return {
        ...opp,
        rpDiff,
        label,
        tagClass,
        intelDeck,
        rawDeck: opp.deck
      };
    });
  }

  /* 戰略勝點數學模型 (CRS-15) 結算 */
  function resolveMatch(isWin, enemy, battleRes) {
    if (state.player.orders > 0) {
      state.player.orders--;
    }

    const pRP = state.player.rp;
    const eRP = enemy.rp;
    const diff = eRP - pRP;

    let baseDelta = 0;
    let diffBonus = 0;
    let excellenceMult = 1.0;
    let miracleBonus = 0;
    let aceBonus = false;
    let blitzBonus = false;

    if (isWin) {
      state.player.stats.wins++;
      baseDelta = 30; // 基礎獲勝分數

      // 難度分差加成：挑戰高分對手獲得獎勵
      if (diff > 0) {
        diffBonus = Math.min(25, Math.round(diff / 22));
      } else {
        diffBonus = -Math.min(10, Math.round(Math.abs(diff) / 35));
      }

      // 戰術卓越加乘 (TEM)
      // 1. ACE 完勝判定：5 單位全員生還
      const myLosses = battleRes.final.A.filter(u => u.hp <= 0).length;
      if (myLosses === 0) {
        aceBonus = true;
        excellenceMult += 0.25;
      }

      // 2. 閃擊先制判定：階段二前即結束
      if (battleRes.frames.length <= 2) {
        blitzBonus = true;
        excellenceMult += 0.15;
      }
    } else {
      state.player.stats.losses++;
      baseDelta = -12; // 失敗低扣分保護
      if (diff > 0) {
        // 敗給極高分對手，扣分減免
        diffBonus = Math.min(6, Math.round(diff / 40));
      }
    }

    // 3. 以小博大奇蹟加成：低打高每次 +15 分 (不論輸贏皆榮譽發放)
    const miracleKills = (battleRes.keys || []).filter(k => k.text && k.text.includes('擊毀') && k.side === 'A').length;
    // 粗估檢查是否有低成本擊毀高價
    let miracleCount = 0;
    if (battleRes.frames) {
      battleRes.frames.forEach(f => {
        f.lines.forEach(ln => {
          if (ln.kind === 'kill' && ln.side === 'A') {
            const aId = ln.auid ? ln.auid.split('-')[0] : '';
            const tId = ln.tuid ? ln.tuid.split('-')[0] : '';
            const aU = UNIT_MAP[aId], tU = UNIT_MAP[tId];
            if (aU && tU && aU.cost <= 2 && tU.cost >= 4) miracleCount++;
          }
        });
      });
    }

    if (miracleCount > 0) {
      miracleBonus = miracleCount * 15;
      state.player.stats.miracleKills += miracleCount;
    }

    // 4. 終結者加成 (Streak Breaker Bonus)：若敵方連續霸榜/守位 >= 3 天，給予超額終結者獎金
    let streakBreakerBonus = 0;
    const oppInRoster = state.roster.find(u => u.id === enemy.id);
    if (isWin && oppInRoster && oppInRoster.streakDays >= 3) {
      streakBreakerBonus = 15;
      state.player.stats.streakBreaks = (state.player.stats.streakBreaks || 0) + 1;
      oppInRoster.streakDays = 1; // 霸榜被終結
    }

    // 總分計算
    let totalDelta = 0;
    if (isWin) {
      totalDelta = Math.round((baseDelta + diffBonus) * excellenceMult) + miracleBonus + streakBreakerBonus;
      totalDelta = Math.max(12, totalDelta); // 獲勝保底 +12 分

      // 階梯篡位保障：若挑戰的是比自己高的對手，保證結算後 RP 至少超越該對手，達成直升！
      if (oppInRoster && oppInRoster.rp >= state.player.rp) {
        const minNeeded = (oppInRoster.rp - state.player.rp) + 4;
        if (totalDelta < minNeeded) {
          totalDelta = minNeeded;
        }
      }
    } else {
      totalDelta = Math.min(-4, baseDelta + diffBonus) + miracleBonus;
    }

    const oldRank = state.player.rank;
    state.player.rp = Math.max(600, state.player.rp + totalDelta);

    // 對手分數同步微幅變動
    if (oppInRoster) {
      oppInRoster.rp = Math.max(600, oppInRoster.rp - Math.round(totalDelta * 0.65));
    }

    sortAndReindex();
    save();

    const newRank = state.player.rank;
    const rankDelta = oldRank - newRank; // 正數代表名次上升
    if (rankDelta !== 0) {
      state.player.streakDays = 1; // 名次發生變更，重新計算駐留天數
    }

    return {
      isWin,
      oldRP: pRP,
      newRP: state.player.rp,
      totalDelta,
      baseDelta,
      diffBonus,
      miracleBonus,
      miracleCount,
      streakBreakerBonus,
      aceBonus,
      blitzBonus,
      oldRank,
      newRank,
      rankDelta,
      currentTier: getRankTier(state.player.rp)
    };
  }

  function setDefenseFleet(deck, doc) {
    if (Array.isArray(deck) && deck.length === 5) {
      state.player.defenseDeck = [...deck];
    }
    if (doc) {
      state.player.defenseDoc = doc;
    }
    save();
  }

  return {
    init,
    getState: () => state,
    getRankTier,
    getRosterTop30,
    getRosterUserByRank,
    canChallengeRank,
    getMatchCandidates,
    resolveMatch,
    setDefenseFleet,
    checkDailyReset,
    save
  };
})();
