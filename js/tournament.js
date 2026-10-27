'use strict';
/* =====================================================
   頂尖對戰：15元聯合作戰 — 世界盃淘汰錦標賽引擎 (Tournament Engine)
   支援 4 / 8 / 16 / 32 強單淘汰對抗樹、AI 影子戰隊一鍵補齊、
   確定性推演零頻寬即時觀戰、決賽圈 BO3/BO5 升級賽制與世足樹狀圖
   ===================================================== */

const TournamentEngine = (() => {
  // 錦標賽全局狀態
  let tourney = null;

  // 預設 32 國代表隊名單 (從世界名隊中選取)
  const NATION_TEAMS = [
    { name: '美國第七艦隊特遣隊', flag: '🇺🇸', doc: 'strike', callsign: 'TASK FORCE 70' },
    { name: '德國第十裝甲師', flag: '🇩🇪', doc: 'defense', callsign: 'PANZER 10' },
    { name: '法國外籍空降特戰群', flag: '🇫🇷', doc: 'strike', callsign: 'LEGION AIR' },
    { name: '日本海上自衛隊護衛群', flag: '🇯🇵', doc: 'defense', callsign: 'ESCORTE FLEET' },
    { name: '英國皇家海軍陸戰隊', flag: '🇬🇧', doc: 'strike', callsign: 'ROYAL COMMANDO' },
    { name: '韓國首都防衛司令部', flag: '🇰🇷', doc: 'defense', callsign: 'SHIELD CAPITAL' },
    { name: '以色列國防軍裝甲打擊旅', flag: '🇮🇱', doc: 'strike', callsign: 'GOLANI STRIKE' },
    { name: '中華民國海軍陸戰特遣隊', flag: '🇹🇼', doc: 'defense', callsign: 'IRON FIST TW' },
    { name: '加拿大第一步兵師', flag: '🇨🇦', doc: 'defense', callsign: 'MAPLE LEAF' },
    { name: '瑞典哥特蘭防衛軍群', flag: '🇸🇪', doc: 'electronic', callsign: 'NORDIC SHIELD' },
    { name: '荷蘭皇家空軍快速反應群', flag: '🇳🇱', doc: 'strike', callsign: 'ORANGE TALON' },
    { name: '波蘭第十六機械化師', flag: '🇵🇱', doc: 'defense', callsign: 'WHITE EAGLE' },
    { name: '義大利重裝特遣旅', flag: '🇮🇹', doc: 'strike', callsign: 'CENTAURO' },
    { name: '西班牙特種空中突擊隊', flag: '🇪🇸', doc: 'strike', callsign: 'MATADOR AIR' },
    { name: '澳洲陸軍第一旅', flag: '🇦🇺', doc: 'defense', callsign: 'ANZAC BRIGADE' },
    { name: '新加坡裝甲突擊群', flag: '🇸🇬', doc: 'electronic', callsign: 'LION ARMOR' },
    { name: '挪威北部邊防特遣隊', flag: '🇳🇴', doc: 'defense', callsign: 'ARCTIC VANGUARD' },
    { name: '芬蘭野戰砲兵戰術群', flag: '🇫🇮', doc: 'defense', callsign: 'SISU FORCE' },
    { name: '巴西空軍遠程巡邏聯隊', flag: '🇧🇷', doc: 'strike', callsign: 'VERDE AR' },
    { name: '瑞士阿爾卑斯守備聯隊', flag: '🇨🇭', doc: 'defense', callsign: 'ALPIN GUARD' },
    { name: '南非特種突擊旅', flag: '🇿🇦', doc: 'strike', callsign: 'SAVANNA LION' },
    { name: '土耳其無人機精準打擊群', flag: '🇹🇷', doc: 'strike', callsign: 'BAYRAKTAR WING' },
    { name: '希臘愛琴海聯合打擊聯隊', flag: '🇬🇷', doc: 'electronic', callsign: 'SPARTAN NAVAL' },
    { name: '捷克第四快速部署旅', flag: '🇨🇿', doc: 'defense', callsign: 'BOHEMIAN FAST' },
    { name: '丹麥日德蘭裝甲特遣隊', flag: '🇩🇰', doc: 'defense', callsign: 'DANISH VIKING' },
    { name: '葡萄牙海軍陸戰特遣旅', flag: '🇵🇹', doc: 'strike', callsign: 'NAVIGATOR' },
    { name: '墨西哥海軍快速反應艦隊', flag: '🇲🇽', doc: 'strike', callsign: 'AZTEC STRIKE' },
    { name: '克羅埃西亞獵鷹防空突擊團', flag: '🇭🇷', doc: 'electronic', callsign: 'FALCON SHIELD' },
    { name: '奧地利山地獵兵戰術聯隊', flag: '🇦🇹', doc: 'defense', callsign: 'EDELWEISS' },
    { name: '摩洛哥皇家武裝步兵旅', flag: '🇲🇦', doc: 'strike', callsign: 'ATLAS TIGER' },
    { name: '阿拉伯聯合大公國總統防衛衛隊', flag: '🇦🇪', doc: 'strike', callsign: 'FALCON DESERT' },
    { name: '比利時第一輕步兵突擊營', flag: '🇧🇪', doc: 'defense', callsign: 'ARDENNES HUNT' }
  ];

  /**
   * 隨機產生一套符合 15 元預算五兵種的合法陣容
   */
  function generateLegalDeck() {
    // 預設常見黃金陣容之一
    if (typeof LADDER_PRESETS !== 'undefined' && LADDER_PRESETS.length) {
      const p = LADDER_PRESETS[Math.floor(Math.random() * LADDER_PRESETS.length)];
      return p.deck.slice();
    }
    return ['F35A', 'M1A2', 'PATRIOT', 'BURKE', 'HIMARS'];
  }

  /**
   * 建立錦標賽
   * @param {number} size - 參賽隊伍總數 (4, 8, 16, 32)
   * @param {string} matchType - 賽制 ('bo1', 'hybrid', 'bo3')
   * @param {object} hostPlayer - 房主自己
   */
  function create(size = 16, matchType = 'hybrid', hostPlayer = null) {
    if (![4, 8, 16, 32].includes(size)) size = 16;

    const me = hostPlayer || {
      uid: 'CMD-7392',
      name: '我方聯合戰術作戰群',
      flag: '🇹🇼',
      isMe: true,
      isAI: false,
      deck: null,
      doctrine: 'defense'
    };

    // 參賽隊列槽位初始化
    const participants = new Array(size).fill(null);
    participants[0] = Object.assign({}, me, { seedNo: 1, slotIdx: 0 });

    tourney = {
      id: 'TOURNEY-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      size,
      matchType, // 'bo1' (全程單場淘汰), 'hybrid' (四強前BO1，四強與決賽BO3), 'bo3' (全程BO3)
      currentRound: 1, // 1: 32強, 2: 16強, 3: 8強, 4: 準決賽(4強), 5: 決賽
      totalRounds: Math.log2(size), // 4強:2輪, 8強:3輪, 16強:4輪, 32強:5輪
      status: 'registration', // 'registration' -> 'in_progress' -> 'completed'
      participants,
      matches: {}, // key: matchId, value: Match
      leftWingMatchIds: [],
      rightWingMatchIds: [],
      finalMatchId: null,
      bronzeMatchId: null,
      champion: null,
      runnerUp: null,
      thirdPlace: null,
      historyLog: []
    };

    buildBracketStructure();
    return tourney;
  }

  /**
   * 建立世足 2026 左右雙翼樹狀結構
   */
  function buildBracketStructure() {
    const size = tourney.size;
    const totalRounds = tourney.totalRounds;

    // 清空
    tourney.matches = {};
    tourney.leftWingMatchIds = [];
    tourney.rightWingMatchIds = [];

    // 每一輪的比賽數量
    // 例如 size=16: R1: 8場, R2: 4場 (八強), R3: 2場 (準決賽), R4: 1場 (決賽)
    let currentMatchCount = size / 2;

    for (let r = 1; r <= totalRounds; r++) {
      const isFinalRound = (r === totalRounds);
      const isSemiFinal = (r === totalRounds - 1);

      for (let m = 0; m < currentMatchCount; m++) {
        const matchId = `R${r}-M${m + 1}`;
        const isLeft = isFinalRound ? false : (m < currentMatchCount / 2);

        // 下一輪晉級節點指針
        let nextMatchId = null;
        let nextSlot = 'A';
        if (!isFinalRound) {
          const nextR = r + 1;
          const nextM = Math.floor(m / 2) + 1;
          nextMatchId = `R${nextR}-M${nextM}`;
          nextSlot = (m % 2 === 0) ? 'A' : 'B';
        }

        const matchObj = {
          id: matchId,
          round: r,
          index: m,
          isLeft,
          status: 'pending', // 'pending' | 'ready' | 'battling' | 'finished'
          teamA: null,
          teamB: null,
          scoreA: 0,
          scoreB: 0,
          winner: null, // 'A' | 'B'
          winnerTeam: null,
          loserTeam: null,
          nextMatchId,
          nextSlot,
          history: [], // 小局推演快照
          currentSeed: null,
          currentEvent: null,
          combatStartTime: null,
          bannedByA: null,
          bannedByB: null,
          isBronze: false
        };

        tourney.matches[matchId] = matchObj;

        if (isFinalRound) {
          tourney.finalMatchId = matchId;
        } else {
          if (isLeft) tourney.leftWingMatchIds.push(matchId);
          else tourney.rightWingMatchIds.push(matchId);
        }
      }
      currentMatchCount /= 2;
    }

    // 建立季軍賽 (Bronze Final)
    tourney.bronzeMatchId = 'BRONZE-FINAL';
    tourney.matches[tourney.bronzeMatchId] = {
      id: 'BRONZE-FINAL',
      round: totalRounds,
      index: 99,
      isLeft: false,
      isBronze: true,
      status: 'pending',
      teamA: null,
      teamB: null,
      scoreA: 0,
      scoreB: 0,
      winner: null,
      winnerTeam: null,
      loserTeam: null,
      nextMatchId: null,
      nextSlot: null,
      history: []
    };
  }

  /**
   * 一鍵用 AI 影子部隊補齊空位
   */
  function fillWithAI() {
    if (!tourney || tourney.status !== 'registration') return;

    // 洗牌備選國家代表隊
    const shuffledPool = NATION_TEAMS.slice().sort(() => Math.random() - 0.5);
    let nationIdx = 0;

    for (let i = 0; i < tourney.size; i++) {
      if (!tourney.participants[i]) {
        const nation = shuffledPool[nationIdx % shuffledPool.length];
        nationIdx++;
        tourney.participants[i] = {
          uid: 'AI-' + (1000 + i),
          name: nation.name,
          flag: nation.flag,
          callsign: nation.callsign,
          isMe: false,
          isAI: true,
          deck: generateLegalDeck(),
          doctrine: nation.doc || 'defense',
          seedNo: i + 1,
          slotIdx: i
        };
      }
    }

    // 將參賽者分配至第 1 輪 (Round 1) 比賽中
    // 採用標準世足種子對抗排序，避免強強提早相撞
    const r1Matches = Object.values(tourney.matches).filter(m => m.round === 1);
    for (let i = 0; i < r1Matches.length; i++) {
      const match = r1Matches[i];
      // 上半區 vs 下半區種子對抗配對
      const idxA = i * 2;
      const idxB = i * 2 + 1;
      match.teamA = Object.assign({}, tourney.participants[idxA]);
      match.teamB = Object.assign({}, tourney.participants[idxB]);
      match.status = 'ready';
    }

    return tourney.participants;
  }

  /**
   * 正式開賽
   */
  function start() {
    if (!tourney) return;
    // 若未滿額自動補齊
    fillWithAI();
    tourney.status = 'in_progress';
    tourney.currentRound = 1;
    // 初始化第一輪純 AI 比賽的推演
    resolveCurrentRoundAIBattles();
    return tourney;
  }

  /**
   * 獲取當前所需要的獲勝局數 (BO1=1勝, BO3=2勝)
   */
  function getRequiredWinsForMatch(match) {
    if (tourney.matchType === 'bo1') return 1;
    if (tourney.matchType === 'bo3') return 2;
    // hybrid 模式：準決賽 (round === totalRounds - 1) 與決賽 (round === totalRounds) 採 BO3
    if (tourney.matchType === 'hybrid') {
      if (match.round >= tourney.totalRounds - 1) return 2;
      return 1;
    }
    return 1;
  }

  /**
   * 尋找「我方」目前參與的對戰 (若已淘汰則回傳 null)
   */
  function getMyMatch() {
    if (!tourney || tourney.status !== 'in_progress') return null;
    return Object.values(tourney.matches).find(m => {
      if (m.status === 'finished') return false;
      const aIsMe = m.teamA && m.teamA.isMe;
      const bIsMe = m.teamB && m.teamB.isMe;
      return (aIsMe || bIsMe) && (m.teamA && m.teamB);
    }) || null;
  }

  /**
   * 自動推演當前輪次中「純 AI vs AI」的所有對決
   */
  function resolveCurrentRoundAIBattles() {
    if (!tourney || tourney.status !== 'in_progress') return;

    const currentMatches = Object.values(tourney.matches).filter(m => m.round === tourney.currentRound && m.status !== 'finished');

    currentMatches.forEach(match => {
      if (!match.teamA || !match.teamB) return;
      // 若兩邊都是 AI，由確定性引擎瞬間完成結算
      if (match.teamA.isAI && match.teamB.isAI) {
        resolveAIMatchSeries(match);
      }
    });

    // 檢查本輪是否已全部完賽
    checkAndAdvanceRound();
  }

  /**
   * 結算一場純 AI 的對決系列賽
   */
  function resolveAIMatchSeries(match) {
    const reqWins = getRequiredWinsForMatch(match);
    match.status = 'battling';

    while (match.scoreA < reqWins && match.scoreB < reqWins) {
      const curRound = match.history.length + 1;
      const seed = (Math.random() * 4294967296) >>> 0;
      const eventObj = (typeof EVENTS !== 'undefined' && EVENTS.length) ? EVENTS[Math.floor(Math.random() * EVENTS.length)] : { id: 'storm', name: '暴風雨' };

      const deckA = match.teamA.deck || generateLegalDeck();
      const deckB = match.teamB.deck || generateLegalDeck();

      let res = null;
      if (typeof resolveBattle === 'function') {
        res = resolveBattle(deckA, deckB, {
          seed,
          event: eventObj,
          docA: match.teamA.doctrine || 'defense',
          docB: match.teamB.doctrine || 'defense'
        });
      } else {
        // Fallback
        res = { winner: Math.random() > 0.5 ? 'A' : 'B', vp: { A: { total: 100 }, B: { total: 80 } }, mvp: { A: { name: '主力' }, B: { name: '主力' } } };
      }

      const w = res.winner === 'draw' ? (Math.random() > 0.5 ? 'A' : 'B') : res.winner;
      if (w === 'A') match.scoreA++;
      else match.scoreB++;

      match.history.push({
        round: curRound,
        winner: w,
        deckA: deckA.slice(),
        deckB: deckB.slice(),
        docA: match.teamA.doctrine,
        docB: match.teamB.doctrine,
        seed,
        event: eventObj,
        scoreA: res.vp?.A?.total || 100,
        scoreB: res.vp?.B?.total || 100
      });
    }

    finalizeMatchResult(match);
  }

  /**
   * 提交玩家真實戰鬥結果（真人玩家單局結算）
   */
  function submitPlayerRoundResult(matchId, singleRoundResult, seed, eventObj) {
    const match = tourney.matches[matchId];
    if (!match) return;

    const w = singleRoundResult.winner === 'draw' ? 'A' : singleRoundResult.winner;
    if (w === 'A') match.scoreA++;
    else match.scoreB++;

    match.history.push({
      round: match.history.length + 1,
      winner: w,
      deckA: (singleRoundResult.deckA || match.teamA.deck).slice(),
      deckB: (singleRoundResult.deckB || match.teamB.deck).slice(),
      docA: match.teamA.doctrine,
      docB: match.teamB.doctrine,
      seed,
      event: eventObj,
      scoreA: singleRoundResult.vp?.A?.total || 100,
      scoreB: singleRoundResult.vp?.B?.total || 100,
      mvpA: singleRoundResult.mvp?.A,
      mvpB: singleRoundResult.mvp?.B
    });

    const reqWins = getRequiredWinsForMatch(match);
    if (match.scoreA >= reqWins || match.scoreB >= reqWins) {
      finalizeMatchResult(match);
      checkAndAdvanceRound();
      return { matchFinished: true, winner: match.winnerTeam };
    } else {
      return { matchFinished: false, currentScore: [match.scoreA, match.scoreB] };
    }
  }

  /**
   * 正式完賽並將勝者推至下一輪節點
   */
  function finalizeMatchResult(match) {
    match.status = 'finished';
    const isAWinner = match.scoreA > match.scoreB;
    match.winner = isAWinner ? 'A' : 'B';
    match.winnerTeam = isAWinner ? match.teamA : match.teamB;
    match.loserTeam = isAWinner ? match.teamB : match.teamA;

    // 若是決賽，產出總冠軍與亞軍
    if (match.id === tourney.finalMatchId) {
      tourney.champion = match.winnerTeam;
      tourney.runnerUp = match.loserTeam;
    } else if (match.id === tourney.bronzeMatchId) {
      tourney.thirdPlace = match.winnerTeam;
    } else {
      // 推進下一輪
      if (match.nextMatchId && tourney.matches[match.nextMatchId]) {
        const nextMatch = tourney.matches[match.nextMatchId];
        if (match.nextSlot === 'A') nextMatch.teamA = Object.assign({}, match.winnerTeam);
        else nextMatch.teamB = Object.assign({}, match.winnerTeam);

        if (nextMatch.teamA && nextMatch.teamB) {
          nextMatch.status = 'ready';
        }
      }

      // 若是準決賽 (Semi-Final)，將落敗者送入季軍賽 (Bronze Final)
      if (match.round === tourney.totalRounds - 1 && tourney.matches[tourney.bronzeMatchId]) {
        const bronzeMatch = tourney.matches[tourney.bronzeMatchId];
        if (!bronzeMatch.teamA) bronzeMatch.teamA = Object.assign({}, match.loserTeam);
        else bronzeMatch.teamB = Object.assign({}, match.loserTeam);

        if (bronzeMatch.teamA && bronzeMatch.teamB) {
          bronzeMatch.status = 'ready';
        }
      }
    }
  }

  /**
   * 檢查是否可推進至下一輪
   */
  function checkAndAdvanceRound() {
    if (!tourney || tourney.status !== 'in_progress') return;

    // 檢查當前輪次的所有比賽是否都已完成
    const currentMatches = Object.values(tourney.matches).filter(m => m.round === tourney.currentRound);
    const allFinished = currentMatches.every(m => m.status === 'finished');

    if (allFinished) {
      if (tourney.currentRound < tourney.totalRounds) {
        tourney.currentRound++;
        // 進入新一輪，自動模擬該輪次所有純 AI 比賽
        resolveCurrentRoundAIBattles();
      } else {
        // 決賽與季軍賽均已完成
        const finalM = tourney.matches[tourney.finalMatchId];
        const bronzeM = tourney.matches[tourney.bronzeMatchId];
        if (finalM?.status === 'finished' && (!bronzeM || bronzeM.status === 'finished')) {
          tourney.status = 'completed';
        }
      }
    }
  }

  /**
   * 取得指定比賽的輕量黑盒子（用於觀戰重播）
   */
  function getMatchSnapshot(matchId) {
    if (!tourney || !tourney.matches[matchId]) return null;
    const m = tourney.matches[matchId];
    return {
      matchId: m.id,
      round: m.round,
      status: m.status,
      teamA: m.teamA,
      teamB: m.teamB,
      scoreA: m.scoreA,
      scoreB: m.scoreB,
      winner: m.winner,
      history: m.history,
      requiredWins: getRequiredWinsForMatch(m)
    };
  }

  return {
    create,
    start,
    fillWithAI,
    getMyMatch,
    getMatch: (id) => tourney?.matches[id] || null,
    submitPlayerRoundResult,
    resolveCurrentRoundAIBattles,
    checkAndAdvanceRound,
    getMatchSnapshot,
    getState: () => tourney,
    getRequiredWins: getRequiredWinsForMatch
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TournamentEngine;
}
