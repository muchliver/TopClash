'use strict';
/**
 * =====================================================
 * TopClash 全域遙測與戰情報告引擎 (Telemetry & Analytics Engine)
 * 雙軌統計架構 (Dual-Track Architecture):
 * 軌道 1 (Firebase RTDB): 全服在線人數 (Presence)、累計推演場次、總註冊指揮官數、今日戰況
 * 軌道 2 (Google Analytics 4): 專業訪客流向、留存率、自訂遊戲戰術事件 (GA4 Measurement)
 * =====================================================
 */

const Telemetry = (() => {
  const FIREBASE_CONFIG = {
    databaseURL: "https://top-game-913c0-default-rtdb.asia-southeast1.firebasedatabase.app"
  };

  // 內部狀態
  let db = null;
  let isInitialized = false;
  let onlineCount = 1;
  let totalBattles = 0;
  let totalPlayers = 0;
  let todayBattles = 0;
  let myPresenceRef = null;
  let mySessionId = 'sess_' + Math.random().toString(36).substring(2, 10);

  // 取得或生成不變的本機玩家 UID
  function getMyUid() {
    let uid = localStorage.getItem('topclash_user_uid');
    if (!uid) {
      uid = 'CMD-' + Math.floor(1000 + Math.random() * 9000);
      localStorage.setItem('topclash_user_uid', uid);
    }
    return uid;
  }

  function getMyCallsign() {
    return localStorage.getItem('topclash_auto_callsign') || '特遣隊指揮官';
  }

  function getTodayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  }

  // 初始化 Firebase Realtime Database
  function initFirebase() {
    if (db) return db;
    if (typeof window.firebase === 'undefined') {
      console.warn('[Telemetry] Firebase SDK 尚未載入，離線靜態降級');
      return null;
    }
    try {
      const app = window.firebase.apps.length
        ? window.firebase.apps[0]
        : window.firebase.initializeApp(FIREBASE_CONFIG);
      db = app.database();
      return db;
    } catch (e) {
      console.warn('[Telemetry] Firebase 初始化異常:', e);
      return null;
    }
  }

  // 初始化軌道 2：Google Analytics 4 (GA4) 動態載入器
  function initGA4() {
    try {
      window.dataLayer = window.dataLayer || [];
      if (typeof window.gtag !== 'function') {
        window.gtag = function() { window.dataLayer.push(arguments); };
      }
      window.gtag('js', new Date());

      // 讀取站長設定的 GA4 ID (優先: localStorage -> window.TOPCLASH_GA_ID -> 預設)
      const gaId = localStorage.getItem('topclash_ga_id') || window.TOPCLASH_GA_ID;
      if (gaId && gaId.startsWith('G-')) {
        loadGAScript(gaId);
      }
    } catch (e) {
      console.warn('[Telemetry] GA4 初始化略過:', e);
    }
  }

  function loadGAScript(measurementId) {
    if (!measurementId || !measurementId.startsWith('G-')) return;
    if (document.querySelector(`script[src*="${measurementId}"]`)) return;

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);

    window.gtag('config', measurementId, {
      send_page_view: true,
      cookie_flags: 'SameSite=None;Secure'
    });
    console.log('[Telemetry] GA4 測量服務已啟動:', measurementId);
  }

  // 設置自訂 GA4 評估 ID
  function setGA4MeasurementId(newId) {
    const cleanId = (newId || '').trim();
    if (cleanId && !cleanId.startsWith('G-')) {
      throw new Error('GA4 評估 ID 格式必須以 "G-" 開頭（例如：G-ABC123XYZ）');
    }
    if (cleanId) {
      localStorage.setItem('topclash_ga_id', cleanId);
      loadGAScript(cleanId);
    } else {
      localStorage.removeItem('topclash_ga_id');
    }
    return true;
  }

  function getGA4MeasurementId() {
    return localStorage.getItem('topclash_ga_id') || window.TOPCLASH_GA_ID || '';
  }

  // 觸發自訂事件 (同時派發至 GA4 與自訂監聽)
  function trackEvent(eventName, params = {}) {
    try {
      if (typeof window.gtag === 'function') {
        window.gtag('event', eventName, params);
      }
      // 派發自訂 DOM 事件方便內部除錯或擴充
      window.dispatchEvent(new CustomEvent('topclash:telemetry', { detail: { eventName, params } }));
    } catch (e) {
      // 靜默防止阻斷遊戲
    }
  }

  // 初始化遙測系統
  function init() {
    if (isInitialized) return;
    isInitialized = true;

    initGA4();
    const database = initFirebase();
    if (!database) {
      updateUI();
      return;
    }

    const uid = getMyUid();
    const callsign = getMyCallsign();

    // 1. 在線狀態管理 (Online Presence)
    const connectedRef = database.ref('.info/connected');
    connectedRef.on('value', snap => {
      if (snap.val() === true) {
        myPresenceRef = database.ref(`global_presence/${mySessionId}`);
        myPresenceRef.onDisconnect().remove();
        myPresenceRef.set({
          uid: uid,
          callsign: callsign,
          time: window.firebase.database.ServerValue.TIMESTAMP
        });
      }
    });

    // 監聽全服在線人數
    database.ref('global_presence').on('value', snap => {
      const val = snap.val() || {};
      onlineCount = Math.max(1, Object.keys(val).length);
      updateUI();
    });

    // 2. 指揮官累計登記統計 (去重計數)
    const hasRegistered = localStorage.getItem('topclash_telemetry_registered');
    if (!hasRegistered) {
      const playerRef = database.ref(`global_stats/players/${uid}`);
      playerRef.once('value').then(pSnap => {
        if (!pSnap.exists()) {
          playerRef.set({
            joinedAt: window.firebase.database.ServerValue.TIMESTAMP,
            callsign: callsign,
            lastActive: window.firebase.database.ServerValue.TIMESTAMP
          });
          database.ref('global_stats/summary/total_players').transaction(c => (c || 0) + 1);
        }
        localStorage.setItem('topclash_telemetry_registered', '1');
      }).catch(() => {});
    } else {
      // 每日更新最後活躍時間
      database.ref(`global_stats/players/${uid}/lastActive`).set(window.firebase.database.ServerValue.TIMESTAMP).catch(() => {});
    }

    // 3. 監聽全域推演總數與部隊總數
    database.ref('global_stats/summary').on('value', snap => {
      const val = snap.val() || {};
      totalBattles = val.total_battles || 0;
      totalPlayers = val.total_players || 0;
      updateUI();
    });

    // 4. 監聽今日全服對戰局數
    const todayKey = getTodayKey();
    database.ref(`global_stats/daily/${todayKey}/battles`).on('value', snap => {
      todayBattles = snap.val() || 0;
      updateUI();
    });

    // 綁定 UI 點擊事件
    setupUIEvents();
    updateUI();
  }

  // 記錄對戰結束數據
  function recordBattle(data = {}) {
    const { mode = 'quick', won = false, draw = false, turns = 0, flagshipId = null } = data;

    // 軌道 2：GA4 事件上報
    trackEvent('battle_finish', {
      mode: mode,
      result: won ? 'victory' : (draw ? 'draw' : 'defeat'),
      turns: turns,
      flagship: flagshipId || 'unknown'
    });

    // 軌道 1：Firebase 原子計數自增
    if (!db) return;

    try {
      // 1. 全服累計局數 +1
      db.ref('global_stats/summary/total_battles').transaction(c => (c || 0) + 1);

      // 2. 今日全服局數 +1
      const today = getTodayKey();
      db.ref(`global_stats/daily/${today}/battles`).transaction(c => (c || 0) + 1);

      // 3. 今日特定模式局數 +1
      if (mode) {
        db.ref(`global_stats/daily/${today}/modes/${mode}`).transaction(c => (c || 0) + 1);
      }

      // 4. 旗艦軍武出戰熱度計數
      if (flagshipId) {
        db.ref(`global_stats/summary/flagships/${flagshipId}`).transaction(c => (c || 0) + 1);
      }
    } catch (e) {
      console.warn('[Telemetry] 戰果回傳異常 (靜默處理):', e);
    }
  }

  // 更新介面上的戰情數字
  function updateUI() {
    const onlineEl = document.getElementById('telemetryOnlineVal');
    const battlesEl = document.getElementById('telemetryBattlesVal');
    if (onlineEl) onlineEl.textContent = onlineCount.toLocaleString();
    if (battlesEl) battlesEl.textContent = totalBattles > 0 ? totalBattles.toLocaleString() : '--';

    // 更新彈窗內的數字（若已打開）
    const mOnline = document.getElementById('modalTelOnline');
    const mBattles = document.getElementById('modalTelBattles');
    const mPlayers = document.getElementById('modalTelPlayers');
    const mToday = document.getElementById('modalTelToday');

    if (mOnline) mOnline.textContent = onlineCount.toLocaleString();
    if (mBattles) mBattles.textContent = totalBattles.toLocaleString();
    if (mPlayers) mPlayers.textContent = totalPlayers.toLocaleString();
    if (mToday) mToday.textContent = todayBattles.toLocaleString();
  }

  // 開啟全域戰情大盤彈窗
  function openTelemetryModal() {
    const modal = document.getElementById('globalTelemetryModal');
    if (!modal) return;

    // 填入最新資料
    updateUI();

    const inputGA = document.getElementById('inputGA4MeasurementId');
    if (inputGA) {
      inputGA.value = getGA4MeasurementId();
    }

    modal.hidden = false;
  }

  function closeTelemetryModal() {
    const modal = document.getElementById('globalTelemetryModal');
    if (modal) modal.hidden = true;
  }

  function setupUIEvents() {
    document.addEventListener('click', e => {
      if (e.target.closest('#btnOpenTelemetry') || e.target.closest('#hudGlobalTelemetry')) {
        openTelemetryModal();
        return;
      }
      if (e.target.closest('#btnCloseTelemetryModal') || e.target.closest('#btnCancelTelemetry')) {
        closeTelemetryModal();
        return;
      }
      if (e.target.closest('#btnSaveGA4')) {
        const input = document.getElementById('inputGA4MeasurementId');
        if (!input) return;
        try {
          setGA4MeasurementId(input.value);
          if (typeof window.toast === 'function') {
            window.toast(input.value.trim() ? `✅ 已儲存 GA4 評估代碼【${input.value.trim()}】，立即生效！` : 'ℹ️ 已清除自訂 GA4 代碼');
          }
          closeTelemetryModal();
        } catch (err) {
          if (typeof window.toast === 'function') {
            window.toast(`⚠️ ${err.message}`);
          } else {
            alert(err.message);
          }
        }
      }
      if (e.target.closest('#btnTestGAEvent')) {
        trackEvent('c4isr_ping', { time: Date.now() });
        if (typeof window.toast === 'function') {
          window.toast('📡 已向 GA4 派發測試事件【c4isr_ping】！請在 GA4 即時報表中查看。');
        }
      }
    });
  }

  return {
    init,
    recordBattle,
    trackEvent,
    getStats: () => ({ onlineCount, totalBattles, totalPlayers, todayBattles }),
    openTelemetryModal,
    closeTelemetryModal,
    setGA4MeasurementId,
    getGA4MeasurementId
  };
})();

// 自動掛載至全域
if (typeof window !== 'undefined') {
  window.Telemetry = Telemetry;
}
