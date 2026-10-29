'use strict';
/* =====================================================
   頂尖對戰：15元聯合作戰 — Firebase 雲端多人錦標賽引擎 (Firebase Tournament Engine)
   支援：
   1. 👤 單人世界盃闖關 (純本機零等待)
   2. 👥 私人好友開房 (6位軍規碼 / 邀請連結 / 未滿 AI 一鍵補位)
   3. 🌐 公開大廳隨機匹配 (即時房間清單 / 快速入桌 / 60s (1分鐘) 熔斷開賽)
   4. 🛡️ 雙階段盲提防作弊 (Two-Phase Blind Commit)
   5. ⚡ 確定性推演同步 (Deterministic Engine Sync & Live Spectator)
   6. 🤖 斷線自動判定與 AI 託管 (onDisconnect Presence & AI Takeover)
   ===================================================== */

const FirebaseTourneyEngine = (function() {
  const firebaseConfig = {
    apiKey: "AIzaSyCcqIW2P88KMBTCkNJhneADRjdJzjBOcI0",
    authDomain: "top-game-913c0.firebaseapp.com",
    databaseURL: "https://top-game-913c0-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "top-game-913c0",
    storageBucket: "top-game-913c0.firebasestorage.app",
    messagingSenderId: "948581983008",
    appId: "1:948581983008:web:c141212f221a706263ad45"
  };

  let app = null;
  let db = null;
  let isConnected = false;
  let currentRoomCode = null;
  let currentRoomData = null;
  let roomListenerUnsub = null;
  let publicRoomsListenerUnsub = null;
  let presenceRef = null;
  let listeners = {};

  // 本地盲提陣容緩存 (Two-phase Blind Commit: 雙方 ready 後才正式發布，防 F12 偷看)
  const pendingSubmissions = {};
  const seenHistoryLengths = {};
  let isFirstSnap = true;

  // 備選 AI 代表隊庫
  const NATION_POOL = [
    { name: '美國第七艦隊特遣隊', flag: '🇺🇸', doc: 'strike', callsign: 'TASK FORCE 70' },
    { name: '德國第十裝甲師', flag: '🇩🇪', doc: 'defense', callsign: 'PANZER 10' },
    { name: '法國外籍空降特戰群', flag: '🇫🇷', doc: 'strike', callsign: 'LEGION AIR' },
    { name: '日本海上自衛隊護衛群', flag: '🇯🇵', doc: 'defense', callsign: 'ESCORTE FLEET' },
    { name: '英國皇家海軍陸戰隊', flag: '🇬🇧', doc: 'strike', callsign: 'ROYAL COMMANDO' },
    { name: '韓國首都防衛司令部', flag: '🇰🇷', doc: 'defense', callsign: 'SHIELD CAPITAL' },
    { name: '以色列國防軍裝甲打擊旅', flag: '🇮🇱', doc: 'strike', callsign: 'GOLANI STRIKE' },
    { name: '加拿大第一步兵師', flag: '🇨🇦', doc: 'defense', callsign: 'MAPLE LEAF' },
    { name: '瑞典哥特蘭防衛軍群', flag: '🇸🇪', doc: 'deception', callsign: 'NORDIC SHIELD' },
    { name: '荷蘭皇家空軍快速反應群', flag: '🇳🇱', doc: 'strike', callsign: 'ORANGE TALON' },
    { name: '波蘭第十六機械化師', flag: '🇵🇱', doc: 'defense', callsign: 'WHITE EAGLE' },
    { name: '義大利重裝特遣旅', flag: '🇮🇹', doc: 'strike', callsign: 'CENTAURO' },
    { name: '西班牙特種空中突擊隊', flag: '🇪🇸', doc: 'strike', callsign: 'MATADOR AIR' },
    { name: '澳洲陸軍第一旅', flag: '🇦🇺', doc: 'defense', callsign: 'ANZAC BRIGADE' },
    { name: '新加坡裝甲突擊群', flag: '🇸🇬', doc: 'deception', callsign: 'LION ARMOR' },
    { name: '挪威北部邊防特遣隊', flag: '🇳🇴', doc: 'defense', callsign: 'ARCTIC VANGUARD' }
  ];

    // 陣列反序列化安全轉換 (防 Firebase RTDB 將陣列還原為純 Object 導致 push/length 失效)
  function ensureArray(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val.slice();
    if (typeof val === 'object') return Object.values(val);
    return [];
  }

  function getRequiredWinsForMatch(match, format, totalRounds) {
    if (format === 'bo1') return 1;
    if (format === 'bo3') return 2;
    if (format === 'hybrid') {
      return (match.round === totalRounds || match.isBronze) ? 2 : 1;
    }
    return 1;
  }

  function on(evt, fn) {
    if (!listeners[evt]) listeners[evt] = [];
    listeners[evt].push(fn);
  }

  function emit(evt, data) {
    if (listeners[evt]) {
      listeners[evt].forEach(fn => {
        try { fn(data); } catch(e) { console.error('FirebaseTourneyEngine emit error', e); }
      });
    }
  }

  /* 初始化 Firebase App 與 Realtime Database 連線 */
  function init() {
    if (app && db) return true;
    try {
      if (typeof window.firebase === 'undefined' || typeof window.firebase.database !== 'function') {
        console.warn('Firebase SDK 尚未載入，請確認 CDN 連線');
        return false;
      }
      app = window.firebase.apps.length ? window.firebase.apps[0] : window.firebase.initializeApp(firebaseConfig);
      db = window.firebase.database();

      // 監聽與 Firebase 伺服器之連線狀態
      db.ref('.info/connected').on('value', snap => {
        isConnected = !!snap.val();
        emit('connection_changed', { connected: isConnected });
      });

      return true;
    } catch (e) {
      console.error('Firebase 初始化失敗:', e);
      return false;
    }
  }

  /* 生成 6 位大寫軍規房間代碼 */
  function generateRoomCode() {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /* 隨機挑選備選軍備組合成合法 $15 陣容 */
  function generateFallbackDeck() {
    if (typeof LADDER_PRESETS !== 'undefined' && LADDER_PRESETS.length) {
      const p = LADDER_PRESETS[Math.floor(Math.random() * LADDER_PRESETS.length)];
      return p.deck.slice();
    }
    return ['F35A', 'M1A2', 'PAC3', 'TJ', 'MORTAR'];
  }

  /* 監聽公開大廳等待中房間列表 (自動過濾過期殭屍房) */
  function listenPublicRooms(callback) {
    if (!init()) return () => {};
    const roomsRef = db.ref('tournaments');

    const listener = roomsRef.on('value', snap => {
      const val = snap.val();
      if (!val) {
        callback([]);
        return;
      }
      const now = Date.now();
      const list = [];

      Object.keys(val).forEach(code => {
        const r = val[code];
        if (!r) return;
        // 僅列出：公開房 + 等待中 + 房主在線 + 30 分鐘內建立
        const isRecent = r.createdAt && (now - r.createdAt < 30 * 60 * 1000);
        const isWaiting = r.status === 'waiting';
        const isPublic = r.isPublic === true;
        const isAlive = r.hostOnline !== false;

        if (isWaiting && isPublic && isRecent && isAlive) {
          const filledCount = Array.isArray(r.participants) 
            ? r.participants.filter(Boolean).length 
            : Object.values(r.participants || {}).filter(Boolean).length;

          list.push({
            code,
            name: r.name || `第 ${code} 號錦標賽`,
            size: r.size || 4,
            format: r.format || 'hybrid',
            filledCount,
            hostName: r.hostName || '特遣隊指揮官',
            hostFlag: r.hostFlag || '🌐',
            countdownEnd: r.countdownEnd || null,
            createdAt: r.createdAt
          });
        }
      });

      // 依建立時間由新到舊排序
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      callback(list);
    });

    return () => roomsRef.off('value', listener);
  }

  /* 建立線上多人錦標賽房間 */
  async function createRoom({ name, size = 4, format = 'hybrid', isPublic = true, playerProfile }) {
    if (!init()) throw new Error('Firebase 尚未初始化');
    if (![4, 8, 16, 32].includes(size)) size = 4;
    if (!['bo1', 'hybrid', 'bo3'].includes(format)) format = 'hybrid';

    const shortCode = generateRoomCode();
    const now = Date.now();
    const roomRef = db.ref(`tournaments/${shortCode}`);

    // 初始化席位 (Slot 0 為房主)
    const participants = new Array(size).fill(null);
    participants[0] = {
      slotIdx: 0,
      seedNo: 1,
      uid: playerProfile.uid || 'CMD-' + Math.floor(1000 + Math.random() * 9000),
      name: playerProfile.name || '特遣隊指揮官',
      flag: playerProfile.flag || '🇹🇼',
      isMe: false, // 雲端客觀標記，客戶端會依自己的 UID 判定
      isAI: false,
      isHost: true,
      ready: true,
      deck: (playerProfile.deck && playerProfile.deck.every(Boolean)) ? playerProfile.deck.slice() : null,
      doctrine: playerProfile.doctrine || 'defense'
    };

    // 建立世足對抗樹結構
    const bracket = buildInitialBracket(size, format);

    const roomPayload = {
      id: shortCode,
      name: name || `2026 世界盃大獎賽 #${shortCode}`,
      size,
      format,
      isPublic: !!isPublic,
      status: 'waiting', // 'waiting' | 'in_progress' | 'completed'
      hostUid: playerProfile.uid,
      hostName: playerProfile.name || '特遣隊指揮官',
      hostFlag: playerProfile.flag || '🇹🇼',
      hostOnline: true,
      createdAt: now,
      countdownEnd: isPublic ? (now + 60000) : null, // 公開房 60 秒 (1分鐘) 自動熔斷湊桌
      currentRound: 1,
      totalRounds: Math.log2(size),
      participants,
      matches: bracket.matches,
      leftWingMatchIds: bracket.leftWingMatchIds,
      rightWingMatchIds: bracket.rightWingMatchIds,
      finalMatchId: bracket.finalMatchId,
      bronzeMatchId: bracket.bronzeMatchId,
      champion: null
    };

    await roomRef.set(roomPayload);

    // 設置房主斷線清理 hook
    setupPresence(shortCode, playerProfile.uid, true);

    // 訂閱此房間即時狀態
    listenRoom(shortCode, playerProfile.uid);

    return {
      roomCode: shortCode,
      shareUrl: getShareUrl(shortCode)
    };
  }

  /* 加入現有線上錦標賽房間 */
  async function joinRoom(roomCode, playerProfile) {
    if (!init()) throw new Error('Firebase 尚未初始化');
    const upperCode = roomCode.toUpperCase().trim();
    const roomRef = db.ref(`tournaments/${upperCode}`);

    const snap = await roomRef.once('value');
    const room = snap.val();
    if (!room) throw new Error('找不到該錦標賽房間，請確認代碼是否正確');
    if (room.status !== 'waiting') throw new Error('該錦標賽已經開賽或已結束，無法加入');

    let mySlotIdx = -1;
    const roomSize = room.size || 16;
    const txRes = await roomRef.child('participants').transaction(curParts => {
      let list = Array.isArray(curParts) ? curParts.slice() : Object.values(curParts || {});
      while (list.length < roomSize) list.push(null);

      let idx = list.findIndex(p => p && p.uid === playerProfile.uid);
      if (idx === -1) {
        idx = list.findIndex(p => !p);
        if (idx === -1) return; // 席位已滿，中止 transaction
        list[idx] = {
          slotIdx: idx,
          seedNo: idx + 1,
          uid: playerProfile.uid || 'CMD-' + Math.floor(1000 + Math.random() * 9000),
          name: playerProfile.name || '特遣隊指揮官',
          flag: playerProfile.flag || '🇹🇼',
          isAI: false,
          isHost: false,
          ready: true,
          deck: (playerProfile.deck && playerProfile.deck.every(Boolean)) ? playerProfile.deck.slice() : null,
          doctrine: playerProfile.doctrine || 'defense'
        };
      }
      mySlotIdx = idx;
      return list;
    });

    if (!txRes.committed || mySlotIdx === -1) {
      throw new Error('參賽席位已滿，無法加入');
    }

    // 設置玩家斷線 presence hook
    setupPresence(upperCode, playerProfile.uid, false);

    // 訂閱房間
    listenRoom(upperCode, playerProfile.uid);

    return {
      roomCode: upperCode,
      slotIdx: mySlotIdx,
      shareUrl: getShareUrl(upperCode)
    };
  }

  /* 快速匹配：加入最快開賽的公開房，若無則自動建房 */
  async function quickMatch(playerProfile, preferredSize = 4, preferredFormat = 'hybrid') {
    if (!init()) throw new Error('Firebase 尚未初始化');
    if (![4, 8, 16, 32].includes(preferredSize)) preferredSize = 4;
    if (!['bo1', 'hybrid', 'bo3'].includes(preferredFormat)) preferredFormat = 'hybrid';

    return new Promise((resolve, reject) => {
      const roomsRef = db.ref('tournaments');
      roomsRef.once('value').then(async snap => {
        const val = snap.val() || {};
        const now = Date.now();
        let targetRoomCode = null;

        for (const code of Object.keys(val)) {
          const r = val[code];
          if (r && r.status === 'waiting' && r.isPublic === true && r.size === preferredSize && (r.format || 'hybrid') === preferredFormat && r.hostOnline !== false && (now - r.createdAt < 30 * 60 * 1000)) {
            const filled = Array.isArray(r.participants) ? r.participants.filter(Boolean).length : Object.values(r.participants || {}).filter(Boolean).length;
            if (filled < r.size) {
              targetRoomCode = code;
              break;
            }
          }
        }

        if (targetRoomCode) {
          try {
            const res = await joinRoom(targetRoomCode, playerProfile);
            resolve(Object.assign({ isNew: false }, res));
          } catch(e) {
            // 加入失敗則轉為建房
            const res = await createRoom({ name: `軍武世界盃 ${preferredSize}強公開賽`, size: preferredSize, format: preferredFormat, isPublic: true, playerProfile });
            resolve(Object.assign({ isNew: true }, res));
          }
        } else {
          // 無空房，建立新公開房並啟動 60s (1分鐘) 倒數
          const res = await createRoom({ name: `軍武世界盃 ${preferredSize}強公開賽`, size: preferredSize, format: preferredFormat, isPublic: true, playerProfile });
          resolve(Object.assign({ isNew: true }, res));
        }
      }).catch(reject);
    });
  }

  /* 檢查是否有新的小局推演結果並對所有在線客戶端分發 match_resolved 事件 */
  function checkAndEmitMatchResolutions(room) {
    if (!room || !room.matches) return;
    Object.values(room.matches).forEach(m => {
      if (!m) return;
      const hist = ensureArray(m.history);
      if (!hist.length) return;
      const prev = seenHistoryLengths[m.id] !== undefined ? seenHistoryLengths[m.id] : 0;
      if (hist.length > prev) {
        for (let i = prev; i < hist.length; i++) {
          const h = hist[i];
          let res = null;
          if (typeof resolveBattle === 'function') {
            res = resolveBattle(ensureArray(h.deckA), ensureArray(h.deckB), {
              seed: h.seed,
              event: h.event,
              docA: h.docA,
              docB: h.docB
            });
          } else {
            res = {
              winner: h.winner,
              vp: { A: { total: h.scoreA || 100 }, B: { total: h.scoreB || 100 } }
            };
          }
          emit('match_resolved', {
            matchId: m.id,
            match: m,
            historyItem: h,
            res,
            matchFinished: (m.status === 'finished')
          });
        }
        seenHistoryLengths[m.id] = hist.length;
      }
    });
  }

  /* 監聽房間即時數據變化 */
  function listenRoom(roomCode, myUid) {
    if (roomListenerUnsub) roomListenerUnsub();
    currentRoomCode = roomCode;
    const roomRef = db.ref(`tournaments/${roomCode}`);

    const listener = roomRef.on('value', snap => {
      const room = snap.val();
      if (!room) {
        emit('room_closed', { reason: '房間已解散或關閉' });
        leaveCurrentRoom();
        return;
      }

      currentRoomData = room;

      // 標註「我方」是誰
      if (Array.isArray(room.participants)) {
        room.participants.forEach(p => {
          if (p) p.isMe = (p.uid === myUid);
        });
      }

      if (isFirstSnap) {
        if (room.matches) {
          Object.values(room.matches).forEach(m => {
            if (m) seenHistoryLengths[m.id] = ensureArray(m.history).length;
          });
        }
        isFirstSnap = false;
      } else {
        checkAndEmitMatchResolutions(room);
      }

      emit('room_updated', room);

      // 若處於開戰狀態，檢查是否輪到自己出擊或是否有新對決結算
      if (room.status === 'in_progress') {
        handleTournamentProgressCheck(room, myUid);
      }
    });

    roomListenerUnsub = () => roomRef.off('value', listener);
  }

  /* 設置斷線清理 Presence */
  function setupPresence(roomCode, myUid, isHost) {
    if (!db) return;
    const roomRef = db.ref(`tournaments/${roomCode}`);
    const userPresenceRef = roomRef.child(`presence/${myUid}`);

    userPresenceRef.set({
      online: true,
      lastSeen: window.firebase.database.ServerValue.TIMESTAMP
    });

    userPresenceRef.onDisconnect().remove();

    if (isHost) {
      roomRef.child('hostOnline').onDisconnect().set(false);
    }
  }

  /* 一鍵 AI 補齊席位並立即開賽 */
  async function fillWithAI(roomCode) {
    if (!db || !currentRoomData) return;
    const roomRef = db.ref(`tournaments/${roomCode}`);
    const snap = await roomRef.once('value');
    const room = snap.val();
    if (!room || room.status !== 'waiting') return;

    let participants = Array.isArray(room.participants) ? room.participants.slice() : Object.values(room.participants || {});
    while (participants.length < room.size) participants.push(null);

    const shuffledNations = NATION_POOL.slice().sort(() => Math.random() - 0.5);
    let nationIdx = 0;

    for (let i = 0; i < room.size; i++) {
      if (!participants[i]) {
        const nation = shuffledNations[nationIdx % shuffledNations.length];
        nationIdx++;
        participants[i] = {
          slotIdx: i,
          seedNo: i + 1,
          uid: 'AI-' + (2000 + i),
          name: nation.name,
          flag: nation.flag,
          callsign: nation.callsign,
          isAI: true,
          isHost: false,
          ready: true,
          deck: generateFallbackDeck(),
          doctrine: nation.doc || 'defense'
        };
      }
    }

    await roomRef.child('participants').set(participants);
    // 自動正式開賽
    await startOnlineTournament(roomCode);
  }

  /* 正式開賽：種子保護、Round 1 對抗配對、純 AI 自動推演 */
  async function startOnlineTournament(roomCode) {
    if (!db) return;
    const roomRef = db.ref(`tournaments/${roomCode}`);
    const snap = await roomRef.once('value');
    const room = snap.val();
    if (!room || room.status !== 'waiting') return;

    let participants = Array.isArray(room.participants) ? room.participants.slice() : Object.values(room.participants || {});
    while (participants.length < room.size) participants.push(null);

    // 若仍有空位，自動補滿 AI
    const shuffledNations = NATION_POOL.slice().sort(() => Math.random() - 0.5);
    let nationIdx = 0;
    for (let i = 0; i < room.size; i++) {
      if (!participants[i]) {
        const nation = shuffledNations[nationIdx % shuffledNations.length];
        nationIdx++;
        participants[i] = {
          slotIdx: i,
          seedNo: i + 1,
          uid: 'AI-' + (2000 + i),
          name: nation.name,
          flag: nation.flag,
          callsign: nation.callsign,
          isAI: true,
          isHost: false,
          ready: true,
          deck: generateFallbackDeck(),
          doctrine: nation.doc || 'defense'
        };
      }
    }

    // 參賽者種子對稱排列：真人玩家盡可能分流至左翼與右翼
    const r1Matches = Object.values(room.matches).filter(m => m.round === 1);
    for (let i = 0; i < r1Matches.length; i++) {
      const match = r1Matches[i];
      const idxA = i * 2;
      const idxB = i * 2 + 1;
      match.teamA = Object.assign({}, participants[idxA]);
      match.teamB = Object.assign({}, participants[idxB]);
      match.status = 'ready';
      match.seed = (Math.random() * 4294967296) >>> 0;
      match.event = (typeof EVENTS !== 'undefined' && EVENTS.length) ? EVENTS[Math.floor(Math.random() * EVENTS.length)] : { id: 'storm', name: '暴風雨', icon: '⛈' };
      match.readyA = false;
      match.readyB = false;
      match.submissionA = null;
      match.submissionB = null;
    }

    const now = Date.now();
    await roomRef.update({
      participants,
      matches: room.matches,
      status: 'in_progress',
      currentRound: 1,
      roundStartTime: now,
      roundDeadline: now + 45000 // 45 秒部署倒數
    });

    // 觸發第一輪純 AI 場次的背景推演
    resolveAIOnlyMatchesInCurrentRound(roomCode);
  }

  /* 產生 Commit-Reveal 盲選雜湊摘要（防止對手在就緒前透過 F12 窺探明文陣容） */
  function computeCommitHash(deck, doc, salt) {
    const raw = `${(deck || []).join('.')}|${doc || 'defense'}|${salt}`;
    let h = 2166136261;
    for (let i = 0; i < raw.length; i++) {
      h ^= raw.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  }

  /* 雙階段盲提提交 (Commit-Reveal)：先提交雜湊摘要與就緒狀態，待雙方皆就緒才揭曉明文陣容 */
  async function submitMatchDeck(roomCode, matchId, playerUid, deck, doctrine) {
    if (!db || !currentRoomData) return;
    const roomRef = db.ref(`tournaments/${roomCode}`);
    const match = currentRoomData.matches[matchId];
    if (!match) return;

    const isTeamA = match.teamA && match.teamA.uid === playerUid;
    const isTeamB = match.teamB && match.teamB.uid === playerUid;
    if (!isTeamA && !isTeamB) return;

    const slotKey = isTeamA ? 'A' : 'B';
    const oppSlot = isTeamA ? 'B' : 'A';
    const oppTeam = isTeamA ? match.teamB : match.teamA;
    const oppIsAI = !!(oppTeam && oppTeam.isAI);
    const oppReady = oppIsAI || match[`ready${oppSlot}`] === true;

    const cleanDeck = ensureArray(deck);
    const cleanDoc = doctrine || 'defense';
    const salt = Math.random().toString(36).slice(2, 10);
    const commitHash = computeCommitHash(cleanDeck, cleanDoc, salt);
    const subPayload = { deck: cleanDeck, doc: cleanDoc, salt, commitHash };

    // 1. 本地暫存真實出陣
    pendingSubmissions[matchId + '_' + slotKey] = subPayload;

    // 2. 斷線自動揭曉保險：若玩家在等待對手時關閉視窗，Firebase 自動補交其鎖定陣容
    try {
      roomRef.child(`matches/${matchId}/submission${slotKey}`).onDisconnect().set(subPayload);
    } catch (e) {}

    // 3. 若對手尚未就緒且為真人，僅先寫入 commitHash 與 ready 標記（隱藏明文 deck）
    const updateObj = {};
    updateObj[`matches/${matchId}/ready${slotKey}`] = true;
    updateObj[`matches/${matchId}/commitHash${slotKey}`] = commitHash;
    if (oppReady) {
      updateObj[`matches/${matchId}/submission${slotKey}`] = subPayload;
    }
    if (!match.deadline) {
      updateObj[`matches/${matchId}/deadline`] = Date.now() + 60000;
    }
    await roomRef.update(updateObj);

    // 4. 若對手是 AI，或對手也已揭曉明文，立即進行推演
    if (oppIsAI || (oppReady && (match[`submission${oppSlot}`] || pendingSubmissions[matchId + '_' + oppSlot]))) {
      await revealAndResolveMatch(roomCode, matchId);
    }
  }

  /* 揭曉陣容並調用確定性推演引擎進行裁決 (支援 BO1 / BO3 多小局累計、戰鬥廣播與季殿軍分流) */
  async function revealAndResolveMatch(roomCode, matchId) {
    if (!db || !currentRoomData) return;
    const roomRef = db.ref(`tournaments/${roomCode}`);
    const match = currentRoomData.matches[matchId];
    if (!match || match.status === 'finished') return;

    // 取得雙方真實提交陣容 (優先取 submission，其次 pendingSubmissions，最後取預設 fallback)
    const subA = match.submissionA || pendingSubmissions[matchId + '_A'] || pendingSubmissions[matchId] || {
      deck: match.teamA.deck || generateFallbackDeck(),
      doc: match.teamA.doctrine || 'defense'
    };

    const subB = match.submissionB || pendingSubmissions[matchId + '_B'] || ((match.teamB && match.teamB.isAI) ? {
      deck: match.teamB.deck || generateFallbackDeck(),
      doc: match.teamB.doctrine || 'defense'
    } : (pendingSubmissions[matchId] || {
      deck: match.teamB.deck || generateFallbackDeck(),
      doc: match.teamB.doctrine || 'defense'
    }));

    const seed = match.seed || (Math.random() * 4294967296) >>> 0;
    const eventObj = match.event || { id: 'fair', name: '晴朗無風', icon: '☀' };

    const deckA = ensureArray(subA.deck);
    const deckB = ensureArray(subB.deck);

    let res = null;
    if (typeof resolveBattle === 'function') {
      res = resolveBattle(deckA, deckB, {
        seed,
        event: eventObj,
        docA: subA.doc,
        docB: subB.doc
      });
    } else {
      res = { winner: Math.random() > 0.5 ? 'A' : 'B', vp: { A: { total: 100 }, B: { total: 80 } } };
    }

    const winnerKey = (res.winner === 'draw') ? ((seed % 2 === 0) ? 'A' : 'B') : res.winner;
    const totalRounds = currentRoomData.totalRounds || Math.log2(currentRoomData.size);
    const reqWins = getRequiredWinsForMatch(match, currentRoomData.format, totalRounds);

    let matchFinished = false;
    let finalWinnerTeam = null;
    let finalLoserTeam = null;
    let newHistoryItem = null;

    // 原子交易 (Transaction) 寫入小局推演結果
    await roomRef.child(`matches/${matchId}`).transaction(curMatch => {
      if (!curMatch || curMatch.status === 'finished') return curMatch;

      const hist = ensureArray(curMatch.history);
      const gameRound = hist.length + 1;

      if (winnerKey === 'A') curMatch.scoreA = (curMatch.scoreA || 0) + 1;
      else curMatch.scoreB = (curMatch.scoreB || 0) + 1;

      newHistoryItem = {
        round: gameRound,
        winner: winnerKey,
        deckA: deckA,
        deckB: deckB,
        docA: subA.doc,
        docB: subB.doc,
        seed,
        event: eventObj,
        scoreA: res.vp?.A?.total || 100,
        scoreB: res.vp?.B?.total || 100
      };
      hist.push(newHistoryItem);
      curMatch.history = hist;

      // 判定是否已滿足晉級或奪冠勝場 (BO1=1, BO3=2)
      if (curMatch.scoreA >= reqWins || curMatch.scoreB >= reqWins) {
        curMatch.status = 'finished';
        const isAWinner = curMatch.scoreA > curMatch.scoreB;
        curMatch.winner = isAWinner ? 'A' : 'B';
        curMatch.winnerTeam = isAWinner ? curMatch.teamA : curMatch.teamB;
        curMatch.loserTeam = isAWinner ? curMatch.teamB : curMatch.teamA;
        matchFinished = true;
        finalWinnerTeam = curMatch.winnerTeam;
        finalLoserTeam = curMatch.loserTeam;
      } else {
        // BO3 尚未分出勝負：重置雙方就緒，產生下一小局事件
        curMatch.readyA = false;
        curMatch.readyB = false;
        curMatch.commitHashA = null;
        curMatch.commitHashB = null;
        curMatch.submissionA = null;
        curMatch.submissionB = null;
        curMatch.deadline = null;
        curMatch.seed = (Math.random() * 4294967296) >>> 0;
        curMatch.event = (typeof EVENTS !== 'undefined' && EVENTS.length)
          ? EVENTS[Math.floor(Math.random() * EVENTS.length)]
          : { id: 'storm', name: '暴風雨', icon: '⛈' };
      }
      return curMatch;
    });

    if (newHistoryItem) {
      seenHistoryLengths[matchId] = ensureArray(match.history).length + 1;
    }

    // 廣播小局裁決事件，通知客戶端自動進入戰鬥畫面
    emit('match_resolved', {
      matchId,
      match: Object.assign({}, match, {
        status: matchFinished ? 'finished' : 'ready',
        winnerTeam: finalWinnerTeam,
        loserTeam: finalLoserTeam
      }),
      historyItem: newHistoryItem,
      res,
      matchFinished
    });

    // 若整場 Match 完賽，進行勝者晉級與敗者季軍賽分流
    if (matchFinished && finalWinnerTeam) {
      // 1. 勝者晉級至下一輪
      if (match.nextMatchId) {
        await roomRef.child(`matches/${match.nextMatchId}`).transaction(nextM => {
          if (!nextM) return nextM;
          if (match.nextSlot === 'A') nextM.teamA = finalWinnerTeam;
          else nextM.teamB = finalWinnerTeam;
          if (nextM.teamA && nextM.teamB) {
            nextM.status = 'ready';
            nextM.seed = (Math.random() * 4294967296) >>> 0;
            nextM.event = (typeof EVENTS !== 'undefined' && EVENTS.length)
              ? EVENTS[Math.floor(Math.random() * EVENTS.length)]
              : { id: 'storm', name: '暴風雨', icon: '⛈' };
          }
          return nextM;
        });
      }

      // 2. 準決賽敗者分流至季殿軍賽 (BRONZE-FINAL)
      const semiRound = totalRounds - 1;
      if (match.round === semiRound && currentRoomData.bronzeMatchId) {
        const isSemiA = (match.index === 0);
        await roomRef.child(`matches/${currentRoomData.bronzeMatchId}`).transaction(bm => {
          if (!bm) return bm;
          if (isSemiA) bm.teamA = finalLoserTeam;
          else bm.teamB = finalLoserTeam;
          if (bm.teamA && bm.teamB) {
            bm.status = 'ready';
            bm.seed = (Math.random() * 4294967296) >>> 0;
            bm.event = (typeof EVENTS !== 'undefined' && EVENTS.length)
              ? EVENTS[Math.floor(Math.random() * EVENTS.length)]
              : { id: 'fair', name: '晴朗無風', icon: '☀' };
          }
          return bm;
        });
      }

      // 3. 總決賽完賽：總冠軍誕生
      if (matchId === currentRoomData.finalMatchId) {
        await roomRef.update({
          status: 'completed',
          champion: finalWinnerTeam,
          runnerUp: finalLoserTeam
        });
      }

      // 4. 季軍賽完賽：季軍誕生
      if (matchId === currentRoomData.bronzeMatchId) {
        await roomRef.update({
          thirdPlace: finalWinnerTeam
        });
      }
    }

    // 檢查本輪進度
    checkAndAdvanceOnlineRound(roomCode);
  }

  /* 推演當前輪次中純 AI vs AI 的場次 (含季軍賽，支援 BO3 自動完整推演完畢) */
  async function resolveAIOnlyMatchesInCurrentRound(roomCode) {
    if (!currentRoomData || currentRoomData.status !== 'in_progress') return;
    const matches = currentRoomData.matches;
    const curRound = currentRoomData.currentRound;

    const aiMatches = Object.values(matches).filter(m => (m.round === curRound || m.isBronze) && m.status === 'ready' && m.teamA && m.teamB && m.teamA.isAI && m.teamB.isAI);

    for (const m of aiMatches) {
      let guard = 0;
      while (guard < 5) {
        guard++;
        await revealAndResolveMatch(roomCode, m.id);
        const latestMatch = currentRoomData?.matches?.[m.id];
        if (!latestMatch || latestMatch.status === 'finished') break;
      }
    }
  }

  /* 60 秒 (1分鐘) 熔斷超時自動代管推演 */
  async function checkTimeoutAndAutoResolve(roomCode) {
    if (!db || !currentRoomData || currentRoomData.status !== 'in_progress') return;
    const now = Date.now();
    const matches = currentRoomData.matches || {};
    for (const matchId of Object.keys(matches)) {
      const m = matches[matchId];
      if (m && m.status === 'ready' && m.deadline && now > m.deadline) {
        let neededUpdate = false;
        const updateObj = {};
        if (!m.readyA) {
          updateObj[`matches/${matchId}/readyA`] = true;
          updateObj[`matches/${matchId}/submissionA`] = {
            deck: generateFallbackDeck(),
            doc: 'defense'
          };
          neededUpdate = true;
        }
        if (!m.readyB) {
          updateObj[`matches/${matchId}/readyB`] = true;
          updateObj[`matches/${matchId}/submissionB`] = {
            deck: generateFallbackDeck(),
            doc: 'defense'
          };
          neededUpdate = true;
        }
        if (neededUpdate) {
          await db.ref(`tournaments/${roomCode}`).update(updateObj);
        }
        await revealAndResolveMatch(roomCode, matchId);
      }
    }
  }

  /* 檢查並推進錦標賽輪次 */
  async function checkAndAdvanceOnlineRound(roomCode) {
    if (!db || !currentRoomData) return;
    const roomRef = db.ref(`tournaments/${roomCode}`);
    const snap = await roomRef.once('value');
    const room = snap.val();
    if (!room || room.status !== 'in_progress') return;

    const curRound = room.currentRound;
    const matchesInRound = Object.values(room.matches).filter(m => m.round === curRound && m.id !== room.bronzeMatchId);
    const allFinished = matchesInRound.every(m => m.status === 'finished');

    if (allFinished) {
      if (curRound < room.totalRounds) {
        const nextRound = curRound + 1;
        const now = Date.now();
        await roomRef.update({
          currentRound: nextRound,
          roundStartTime: now,
          roundDeadline: now + 45000
        });
        // 推進新一輪後，自動結算新一輪中的純 AI 場次
        resolveAIOnlyMatchesInCurrentRound(roomCode);
      } else {
        // 全系列賽完結
        const finalMatch = room.matches[room.finalMatchId];
        if (finalMatch && finalMatch.winnerTeam) {
          await roomRef.update({
            status: 'completed',
            champion: finalMatch.winnerTeam
          });
        }
      }
    }
  }

  /* 輪次進度安全檢查：雙盲 Commit-Reveal 自動揭曉與超時 AI 託管 */
  function handleTournamentProgressCheck(room, myUid) {
    if (!room || !room.matches) return;
    const now = Date.now();
    const activeMatches = Object.values(room.matches).filter(m => m && m.status === 'ready');

    activeMatches.forEach(m => {
      // 1. Commit-Reveal 第二階段：當雙方皆已 ready，若我方明文尚未揭曉則自動上傳明文並觸發裁決
      if (m.readyA && m.readyB) {
        const isMeA = m.teamA && m.teamA.uid === myUid;
        const isMeB = m.teamB && m.teamB.uid === myUid;
        const mySlot = isMeA ? 'A' : (isMeB ? 'B' : null);
        const myPending = mySlot ? pendingSubmissions[m.id + '_' + mySlot] : null;
        if (mySlot && myPending && !m[`submission${mySlot}`]) {
          db.ref(`tournaments/${room.id}/matches/${m.id}/submission${mySlot}`).set(myPending).then(() => {
            revealAndResolveMatch(room.id, m.id);
          }).catch(() => {});
          return;
        }
        // 當雙方明文皆已到位（或一方為 AI），啟動確定性推演
        const hasSubA = !!(m.submissionA || (m.teamA && m.teamA.isAI));
        const hasSubB = !!(m.submissionB || (m.teamB && m.teamB.isAI));
        if (hasSubA && hasSubB && (isMeA || isMeB || (room.participants && room.participants[0] && room.participants[0].uid === myUid))) {
          revealAndResolveMatch(room.id, m.id);
          return;
        }
      }

      // 2. 檢查是否超過單局 60 秒熔斷或輪次截止時間
      if ((m.deadline && now > m.deadline) || (room.roundDeadline && now > room.roundDeadline && m.round === room.currentRound)) {
        if (!m.readyA || !m.readyB) {
          revealAndResolveMatch(room.id, m.id);
        }
      }
    });
  }

  /* 離開當前房間並清理監聽 */
  function leaveCurrentRoom() {
    if (roomListenerUnsub) {
      roomListenerUnsub();
      roomListenerUnsub = null;
    }
    if (presenceRef) {
      presenceRef.remove();
      presenceRef = null;
    }
    currentRoomCode = null;
    currentRoomData = null;
    Object.keys(seenHistoryLengths).forEach(k => delete seenHistoryLengths[k]);
    isFirstSnap = true;
  }

  /* 產生專屬分享網址 */
  function getShareUrl(roomCode) {
    const url = new URL(window.location.href);
    url.searchParams.set('tourney', roomCode);
    return url.toString();
  }

  /* 構建初始樹狀結構數據 */
  function buildInitialBracket(size, format) {
    const totalRounds = Math.log2(size);
    const matches = {};
    const leftWingMatchIds = [];
    const rightWingMatchIds = [];
    let currentMatchCount = size / 2;
    let finalMatchId = null;

    for (let r = 1; r <= totalRounds; r++) {
      const isFinalRound = (r === totalRounds);

      for (let m = 0; m < currentMatchCount; m++) {
        const matchId = `R${r}-M${m + 1}`;
        const isLeft = isFinalRound ? false : (m < currentMatchCount / 2);

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
          status: 'pending',
          teamA: null,
          teamB: null,
          scoreA: 0,
          scoreB: 0,
          winner: null,
          winnerTeam: null,
          loserTeam: null,
          nextMatchId,
          nextSlot,
          history: [],
          readyA: false,
          readyB: false,
          isBronze: false
        };

        matches[matchId] = matchObj;

        if (isFinalRound) {
          finalMatchId = matchId;
        } else {
          if (isLeft) leftWingMatchIds.push(matchId);
          else rightWingMatchIds.push(matchId);
        }
      }
      currentMatchCount /= 2;
    }

    const bronzeMatchId = 'BRONZE-FINAL';
    matches[bronzeMatchId] = {
      id: bronzeMatchId,
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

    return {
      matches,
      leftWingMatchIds,
      rightWingMatchIds,
      finalMatchId,
      bronzeMatchId
    };
  }

  return {
    init,
    isAvailable: () => isConnected,
    listenPublicRooms,
    createRoom,
    joinRoom,
    quickMatch,
    fillWithAI,
    startTournament: startOnlineTournament,
    submitMatchDeck,
    revealAndResolveMatch,
    checkTimeoutAndAutoResolve,
    getRequiredWins: getRequiredWinsForMatch,
    leaveRoom: leaveCurrentRoom,
    getCurrentRoom: () => currentRoomData,
    getCurrentRoomCode: () => currentRoomCode,
    getMatchSnapshot: (matchId, roundIdx = -1) => {
      if (!currentRoomData || !currentRoomData.matches) return null;
      const m = currentRoomData.matches[matchId];
      if (!m) return null;
      const hist = ensureArray(m.history);
      if (!hist.length) return null;
      const idx = (roundIdx >= 0 && roundIdx < hist.length) ? roundIdx : (hist.length - 1);
      const h = hist[idx];
      if (!h) return null;
      let res = null;
      if (typeof resolveBattle === 'function') {
        res = resolveBattle(ensureArray(h.deckA), ensureArray(h.deckB), {
          seed: h.seed,
          event: h.event,
          docA: h.docA,
          docB: h.docB
        });
      }
      return {
        matchId: m.id,
        roundIndex: idx,
        totalRoundsPlayed: hist.length,
        teamA: m.teamA,
        teamB: m.teamB,
        scoreA: m.scoreA,
        scoreB: m.scoreB,
        historyItem: h,
        battleRes: res
      };
    },
    on,
    emit
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = FirebaseTourneyEngine;
}

