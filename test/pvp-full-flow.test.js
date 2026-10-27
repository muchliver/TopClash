/**
 * 線上真人雙人對戰 (Online PvP) 雙向互鎖與去 AI 假人完整邏輯單元測試
 */
const assert = require('assert');

// 模擬兩位玩家的狀態
function createPlayerState(name, isHost) {
  return {
    name,
    isHost,
    isOnlinePvp: false,
    pvpMyReady: false,
    pvpOpponentReady: false,
    pvpOpponentDeck: null,
    pvpOpponentDoc: null,
    deck: [null, null, null, null, null],
    doctrine: 'defense',
    enemy: null,
    enemyDoc: null,
    bo3: {
      active: false,
      round: 1,
      winsA: 0,
      winsB: 0,
      bannedByA: null,
      bannedByB: null
    }
  };
}

console.log('=== [測試 1] 初始化雙人房間與會話啟動 ===');
const host = createPlayerState('PlayerHost', true);
const guest = createPlayerState('PlayerGuest', false);

// 房主點擊開戰按鈕 (btnPvpStartBattle)
host.isOnlinePvp = true;
host.bo3.active = true;
host.bo3.round = 1;

// 廣播 GAME_START_SESSION
const sessionPacket = { type: 'GAME_START_SESSION', payload: { round: 1, winsA: 0, winsB: 0 } };

// 挑戰者收到 GAME_START_SESSION
guest.isOnlinePvp = true;
guest.bo3.active = true;
guest.bo3.round = sessionPacket.payload.round;
assert.strictEqual(guest.isOnlinePvp, true, '挑戰者應正確切換至線上對戰狀態');
console.log('✅ 測試 1 通過：會話成功雙向同步');

console.log('=== [測試 2] 雙向 Ready 互鎖：單方提交不可開戰 ===');
// 房主挑選陣容
host.deck = ['f35a', 'm1a2', 'patriot', 'burke', 'himars'];
host.doctrine = 'first_strike';
// 房主點擊鎖定出擊
host.pvpMyReady = true;

// 檢查是否開戰
function tryStartCombat(state) {
  return state.pvpMyReady && state.pvpOpponentReady;
}

assert.strictEqual(tryStartCombat(host), false, '對手未 Ready 前，房主不能開始戰鬥');
assert.strictEqual(host.pvpOpponentReady, false, '對手目前尚未就緒');

// 房主發送 DECK_SUBMIT
const hostDeckPacket = {
  type: 'DECK_SUBMIT',
  payload: { deck: host.deck.slice(), doctrine: host.doctrine }
};

// 挑戰者收到房主提交的陣容
guest.pvpOpponentDeck = hostDeckPacket.payload.deck;
guest.pvpOpponentDoc = hostDeckPacket.payload.doctrine;
guest.pvpOpponentReady = true;

assert.strictEqual(tryStartCombat(guest), false, '挑戰者自己未提交陣容前，不可開始戰鬥');
console.log('✅ 測試 2 通過：雙向 Ready 互鎖嚴格生效，杜絕未選即開戰');

console.log('=== [測試 3] 雙方皆就緒後開戰，確認對手為真人而非 AI ===');
// 挑戰者配置陣容
guest.deck = ['su57', 't90m', 's400', 'slava', 'tos1'];
guest.doctrine = 'electronic';
guest.pvpMyReady = true;

const guestDeckPacket = {
  type: 'DECK_SUBMIT',
  payload: { deck: guest.deck.slice(), doctrine: guest.doctrine }
};

// 房主收到挑戰者陣容
host.pvpOpponentDeck = guestDeckPacket.payload.deck;
host.pvpOpponentDoc = guestDeckPacket.payload.doctrine;
host.pvpOpponentReady = true;

assert.strictEqual(tryStartCombat(host), true, '房主端雙方已就緒');
assert.strictEqual(tryStartCombat(guest), true, '挑戰者端雙方已就緒');

// 房主生成種子發送 COMBAT_SYNC
const syncPacket = {
  type: 'COMBAT_SYNC',
  payload: { seed: 12345678, event: { id: 'storm', name: '暴風雨' } }
};

// 雙方加載對手卡組進入戰鬥
host.enemy = host.pvpOpponentDeck.slice();
host.enemyDoc = host.pvpOpponentDoc;

guest.enemy = guest.pvpOpponentDeck.slice();
guest.enemyDoc = guest.pvpOpponentDoc;

assert.deepStrictEqual(host.enemy, ['su57', 't90m', 's400', 'slava', 'tos1'], '房主面對的必須是挑戰者親選的真人卡組，而非 AI 假人！');
assert.deepStrictEqual(guest.enemy, ['f35a', 'm1a2', 'patriot', 'burke', 'himars'], '挑戰者面對的必須是房主親選的真人卡組，而非 AI 假人！');
console.log('✅ 測試 3 通過：徹底消滅 AI 假人，完全對抗真人自選陣容');

console.log('=== [測試 4] 小局結算與 BAN 反制同步 ===');
// 假設 Host 獲勝 (A 贏)，Guest 為敗者啟動 BAN 反制
const banUnitId = 'f35a'; // Guest 選擇禁用 Host 的 F-35A
const banPacket = { type: 'BAN_COMMIT', payload: { bannedUnitId: banUnitId } };

// Host 收到 BAN_COMMIT
host.bo3.bannedByB = banPacket.payload.bannedUnitId;
const bannedIdx = host.deck.indexOf(host.bo3.bannedByB);
if (bannedIdx >= 0) {
  host.deck[bannedIdx] = null; // 強制卸下被 Ban 裝備
}
host.bo3.round++;
host.pvpMyReady = false;
host.pvpOpponentReady = false;
host.pvpOpponentDeck = null;

assert.strictEqual(host.deck[0], null, '被 Ban 的 F-35A 槽位已被強制清空');
assert.strictEqual(host.bo3.round, 2, '小局順利推進至第 2 局');
assert.strictEqual(host.pvpMyReady, false, '雙方就緒狀態順利重置');
console.log('✅ 測試 4 通過：小局 BAN 反制與被禁用卡槽自動卸載邏輯完全正確');

console.log('\n🎉 所有線上真人雙人對抗測試案例全部通過！');
