/**
 * 錦標賽核心邏輯單元測試
 */
const assert = require('assert');
const TournamentEngine = require('../js/tournament.js');

console.log('=== [測試 1] 建立 16 強世足淘汰賽並驗證樹狀結構 ===');
const tourney = TournamentEngine.create(16, 'hybrid', {
  uid: 'CMD-TEST',
  name: '指揮官特遣隊',
  flag: '🇹🇼',
  isMe: true,
  isAI: false
});

assert.strictEqual(tourney.size, 16);
assert.strictEqual(tourney.totalRounds, 4); // 16 -> 8 -> 4 -> 2 (決賽)
assert.strictEqual(Object.keys(tourney.matches).length, 16); // 8 + 4 + 2 + 1 + 1(季軍賽) = 16場
console.log('✅ 測試 1 通過：16 強樹狀結構完整生成');

console.log('=== [測試 2] 一鍵 AI 影子戰隊補位 ===');
TournamentEngine.fillWithAI();
assert.strictEqual(tourney.participants.length, 16);
assert.strictEqual(tourney.participants.every(Boolean), true, '16 個席位必須全部填滿');
assert.strictEqual(tourney.participants[0].isMe, true, '第一席位為玩家自己');
assert.strictEqual(tourney.participants[1].isAI, true, '第二席位為 AI 戰隊');
console.log('✅ 測試 2 通過：AI 影子部隊成功補齊');

console.log('=== [測試 3] 正式開賽，第一輪 AI 對決自動推演 ===');
TournamentEngine.start();
assert.strictEqual(tourney.status, 'in_progress');

// 找到玩家當前的比賽
const myMatch = TournamentEngine.getMyMatch();
assert.notStrictEqual(myMatch, null, '玩家在第一輪必須有配對的比賽');
assert.strictEqual(myMatch.round, 1);
console.log(`✅ 測試 3 通過：玩家第一輪對手為 【${myMatch.teamB.flag} ${myMatch.teamB.name}】`);

console.log('=== [測試 4] 模擬玩家獲勝並成功晉級第二輪 ===');
const mockWinRes = {
  winner: 'A',
  deckA: ['f35a', 'm1a2', 'patriot', 'burke', 'himars'],
  deckB: ['su57', 't90m', 's400', 'slava', 'tos1'],
  vp: { A: { total: 120 }, B: { total: 60 } }
};
const res = TournamentEngine.submitPlayerRoundResult(myMatch.id, mockWinRes, 12345, { id: 'storm', name: '暴風雨' });
assert.strictEqual(res.matchFinished, true);
assert.strictEqual(myMatch.winnerTeam.isMe, true, '玩家成功獲勝');

// 檢查下一輪 (Round 2 八強)
const r2Match = TournamentEngine.getMyMatch();
assert.notStrictEqual(r2Match, null, '玩家成功晉級至第二輪 (八強賽)');
assert.strictEqual(r2Match.round, 2);
console.log('✅ 測試 4 通過：勝者自動晉級至八強賽');

console.log('=== [測試 5] 零頻寬觀戰黑盒子快照驗證 ===');
const snapshot = TournamentEngine.getMatchSnapshot(myMatch.id);
assert.notStrictEqual(snapshot, null);
assert.strictEqual(snapshot.history.length, 1);
assert.strictEqual(snapshot.history[0].seed, 12345);
assert.strictEqual(snapshot.scoreA, 1);
console.log('✅ 測試 5 通過：觀戰快照完整包含種子與卡組');

console.log('\n🎉 所有錦標賽核心演算法單元測試全部通過！');
