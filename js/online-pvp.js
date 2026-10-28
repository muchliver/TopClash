'use strict';
/* =====================================================
   頂尖對戰：15元聯合作戰 — 線上真人雙人對戰引擎 (Online PvP Engine)
   基於 WebRTC P2P DataChannel 技術，零後端伺服器成本，支援 GitHub Pages 與 Vercel 靜態環境
   ===================================================== */

const OnlinePvPEngine = (function() {
  const PEERJS_CDN = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
  const ROOM_PREFIX = 'TOPCLASH-BO5-';

  let peer = null;
  let conn = null;
  let isHost = false;
  let currentRoomId = '';
  let opponentInfo = null; // { name, uid, flag }
  let listeners = {};

  // 線上 BO5 比分與狀態
  let pvpState = {
    connected: false,
    round: 1,
    winsA: 0, // 本部特遣隊比分
    winsB: 0, // 挑戰突擊隊比分
    bannedByOpponent: null, // 對手禁用我方的裝備
    bannedByMe: null,       // 我方禁用對手的裝備
    myReady: false,
    opponentReady: false
  };

  function on(evt, fn) {
    if (!listeners[evt]) listeners[evt] = [];
    listeners[evt].push(fn);
  }

  function emit(evt, data) {
    if (listeners[evt]) {
      listeners[evt].forEach(fn => {
        try { fn(data); } catch(e) { console.error('PVP listener error', e); }
      });
    }
  }

  /* 動態非同步載入 PeerJS 函式庫 */
  function ensurePeerJS() {
    return new Promise((resolve, reject) => {
      if (window.Peer) return resolve();
      const existing = document.querySelector(`script[src="${PEERJS_CDN}"]`);
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('載入 PeerJS 失敗')));
        return;
      }
      const s = document.createElement('script');
      s.src = PEERJS_CDN;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('無法從 CDN 載入 WebRTC 連線套件'));
      document.head.appendChild(s);
    });
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

  /* 本部特遣隊建立房間 */
  async function createRoom(playerProfile) {
    await ensurePeerJS();
    closeConnection();

    const shortCode = generateRoomCode();
    currentRoomId = shortCode;
    isHost = true;
    pvpState.connected = false;
    pvpState.winsA = 0;
    pvpState.winsB = 0;
    pvpState.round = 1;

    const fullPeerId = `${ROOM_PREFIX}${shortCode}`;

    return new Promise((resolve, reject) => {
      peer = new window.Peer(fullPeerId, {
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      });

      peer.on('open', id => {
        emit('room_created', { roomCode: shortCode, shareUrl: getShareUrl(shortCode) });
        resolve({ roomCode: shortCode, shareUrl: getShareUrl(shortCode) });
      });

      peer.on('connection', incoming => {
        setupConnection(incoming, playerProfile);
      });

      peer.on('error', err => {
        console.error('Peer error:', err);
        emit('error', err.message || '連線錯誤');
        reject(err);
      });
    });
  }

  /* 挑戰突擊隊加入房間 */
  async function joinRoom(roomCode, playerProfile) {
    await ensurePeerJS();
    closeConnection();

    const cleanCode = roomCode.trim().toUpperCase().replace(/^TOPCLASH-BO5-/, '');
    currentRoomId = cleanCode;
    isHost = false;
    pvpState.connected = false;
    pvpState.winsA = 0;
    pvpState.winsB = 0;
    pvpState.round = 1;

    const fullPeerId = `${ROOM_PREFIX}${cleanCode}`;

    return new Promise((resolve, reject) => {
      // 挑戰者使用隨機 peer id
      peer = new window.Peer({
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      });

      peer.on('open', () => {
        const outgoing = peer.connect(fullPeerId, { reliable: true });
        setupConnection(outgoing, playerProfile);
        resolve({ roomCode: cleanCode });
      });

      peer.on('error', err => {
        console.error('Peer join error:', err);
        emit('error', '找不到該房間或房間已關閉，請確認代碼！');
        reject(err);
      });
    });
  }

  /* 設定 DataChannel 雙向通訊監聽 */
  function setupConnection(c, playerProfile) {
    conn = c;

    conn.on('open', () => {
      pvpState.connected = true;
      // 發送身分握手封包 (Handshake)
      sendPacket('HANDSHAKE', {
        name: playerProfile.name,
        uid: playerProfile.uid,
        flag: playerProfile.flag,
        isHost
      });
    });

    conn.on('data', data => {
      handleIncomingPacket(data);
    });

    conn.on('close', () => {
      pvpState.connected = false;
      emit('opponent_left');
    });

    conn.on('error', err => {
      console.error('Conn error', err);
      emit('error', '對戰連線中斷');
    });
  }

  /* 處理接收到的封包 */
  function handleIncomingPacket(data) {
    if (!data || !data.type) return;

    switch (data.type) {
      case 'HANDSHAKE':
        opponentInfo = data.payload;
        emit('opponent_joined', { opponent: opponentInfo, isHost });
        break;

      case 'GAME_START_SESSION':
        emit('game_session_started', data.payload);
        break;

      case 'DECK_SUBMIT':
        emit('opponent_deck_ready', data.payload);
        break;

      case 'BAN_COMMIT':
        pvpState.bannedByOpponent = data.payload.bannedUnitId;
        emit('opponent_ban_committed', data.payload);
        break;

      case 'COMBAT_SYNC':
        emit('combat_start_sync', data.payload);
        break;

      case 'EMOTE':
        emit('emote_received', data.payload);
        break;

      case 'REMATCH_REQ':
        emit('rematch_requested');
        break;
    }
  }

  /* 發送封包 */
  function sendPacket(type, payload) {
    if (conn && conn.open) {
      conn.send({ type, payload, timestamp: Date.now() });
    }
  }

  function getShareUrl(code) {
    const loc = window.location;
    const base = loc.protocol + '//' + loc.host + loc.pathname;
    return `${base}?room=${code}`;
  }

  function closeConnection() {
    if (conn) {
      try { conn.close(); } catch(e) {}
      conn = null;
    }
    if (peer) {
      try { peer.destroy(); } catch(e) {}
      peer = null;
    }
    pvpState.connected = false;
    opponentInfo = null;
  }

  return {
    on,
    createRoom,
    joinRoom,
    sendPacket,
    closeConnection,
    getState: () => pvpState,
    getOpponent: () => opponentInfo,
    isHostUser: () => isHost,
    getCurrentRoomCode: () => currentRoomId
  };
})();
