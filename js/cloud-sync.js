/**
 * TopClash 雲端指揮官帳號與跨電腦同步核心模組 (A+C 體系)
 * 方案 A：自選英數代號 (>=6碼) + 戰術密碼 (>=4碼)
 * 方案 C：安全 Token 專屬免密書籤連結 (Ctrl+D / LINE Keep 一鍵秒登)
 */
const CloudSync = (() => {
  const FIREBASE_CONFIG = {
    databaseURL: "https://top-game-913c0-default-rtdb.asia-southeast1.firebasedatabase.app"
  };

  const ID_REGEX = /^[a-zA-Z0-9]{6,20}$/;
  const PWD_REGEX = /^[a-zA-Z0-9]{4,30}$/;

  let db = null;

  function initFirebase() {
    if (db) return db;
    if (typeof window.firebase === 'undefined') {
      console.warn('[CloudSync] Firebase SDK 未載入，請確認網路連線');
      return null;
    }
    try {
      const app = window.firebase.apps.length
        ? window.firebase.apps[0]
        : window.firebase.initializeApp(FIREBASE_CONFIG);
      db = app.database();
      return db;
    } catch (e) {
      console.error('[CloudSync] Firebase 初始化失敗:', e);
      return null;
    }
  }

  /* 密碼 SHA-256 安全雜湊 (絕不在雲端儲存明文密碼) */
  async function hashPassword(pwd) {
    const encoder = new TextEncoder();
    const data = encoder.encode(pwd + '_TOPCLASH_SALT_2026');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /* 生成隨機安全免密 Token */
  function generateAuthToken() {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /* 取得當前本機綁定狀態 */
  function getAccount() {
    return LS.get('db15_cloud_account', null);
  }

  /* 儲存綁定狀態 */
  function setAccount(acc) {
    if (acc) {
      LS.set('db15_cloud_account', acc);
    } else {
      localStorage.removeItem('db15_cloud_account');
    }
  }

  /* 收集當前本機所有遊戲戰績與設定 */
  function collectLocalSaveData() {
    return {
      stats: LS.get('db15_stats', { played: 0, win: 0, streak: 0, best: 0, bo3Won: 0 }),
      ladder: LS.get('db15_ladder', null),
      playerGhost: LS.get('db15_player_ghost', null),
      deck: LS.get('db15_deck', null),
      doctrine: LS.get('db15_doctrine', null),
      profile: LS.get('db15_player_profile', null),
      theme: LS.get('db15_theme', 'dark'),
      sound: LS.get('db15_sound', true)
    };
  }

  /* 將雲端存檔覆蓋寫入本地 localStorage */
  function restoreSaveDataToLocal(cloudData) {
    if (!cloudData) return;
    if (cloudData.stats) LS.set('db15_stats', cloudData.stats);
    if (cloudData.ladder) LS.set('db15_ladder', cloudData.ladder);
    if (cloudData.playerGhost) LS.set('db15_player_ghost', cloudData.playerGhost);
    if (cloudData.deck) LS.set('db15_deck', cloudData.deck);
    if (cloudData.doctrine) LS.set('db15_doctrine', cloudData.doctrine);
    if (cloudData.profile) LS.set('db15_player_profile', cloudData.profile);
    if (cloudData.theme) LS.set('db15_theme', cloudData.theme);
    if (typeof cloudData.sound === 'boolean') LS.set('db15_sound', cloudData.sound);
  }

  /* 註冊並綁定雲端指揮官帳號 */
  async function register(id, pwd, customNickname = '') {
    if (!ID_REGEX.test(id)) {
      throw new Error('指揮官代號必須為半形英數字，且長度至少 6 碼 (6~20 碼)！');
    }
    if (!PWD_REGEX.test(pwd)) {
      throw new Error('戰術密碼必須為半形英數字，且長度至少 4 碼 (4~30 碼)！');
    }

    const database = initFirebase();
    if (!database) throw new Error('雲端資料庫尚未就緒，請檢查網路連線後重試');

    const cleanId = id.toLowerCase();
    const snap = await database.ref(`commanders/${cleanId}`).once('value');
    if (snap.exists()) {
      throw new Error(`指揮官代號【${id}】已被搶先註冊！請更換一個代號`);
    }

    const passHash = await hashPassword(pwd);
    const authToken = generateAuthToken();
    const localData = collectLocalSaveData();
    const now = Date.now();

    const payload = {
      id: cleanId,
      displayId: id,
      passHash,
      authToken,
      createdAt: now,
      updatedAt: now,
      nickname: customNickname || localData.profile?.name || '特遣隊指揮官',
      flag: localData.profile?.flag || '🇹🇼',
      saveData: localData
    };

    await database.ref(`commanders/${cleanId}`).set(payload);

    const account = {
      id: cleanId,
      displayId: id,
      authToken,
      nickname: payload.nickname,
      flag: payload.flag,
      boundAt: now
    };
    setAccount(account);

    return {
      success: true,
      account,
      bookmarkUrl: generateBookmarkUrl(cleanId, authToken)
    };
  }

  /* 密碼登入 (方案 A) */
  async function loginWithPassword(id, pwd) {
    if (!ID_REGEX.test(id)) {
      throw new Error('指揮官代號必須為半形英數字，且長度至少 6 碼！');
    }
    if (!PWD_REGEX.test(pwd)) {
      throw new Error('戰術密碼必須為半形英數字，且長度至少 4 碼！');
    }

    const database = initFirebase();
    if (!database) throw new Error('雲端資料庫尚未就緒，請檢查網路連線後重試');

    const cleanId = id.toLowerCase();
    const snap = await database.ref(`commanders/${cleanId}`).once('value');
    if (!snap.exists()) {
      throw new Error(`找不到指揮官【${id}】的雲端存檔，請確認代號是否正確`);
    }

    const cloudUser = snap.val();
    const inputHash = await hashPassword(pwd);
    if (cloudUser.passHash !== inputHash) {
      throw new Error('戰術密碼不相符，請重新確認！');
    }

    // 若原雲端無 token 則自動補發
    let authToken = cloudUser.authToken;
    if (!authToken) {
      authToken = generateAuthToken();
      await database.ref(`commanders/${cleanId}/authToken`).set(authToken);
    }

    // 還原雲端戰績至本機
    if (cloudUser.saveData) {
      restoreSaveDataToLocal(cloudUser.saveData);
    }

    const account = {
      id: cleanId,
      displayId: cloudUser.displayId || id,
      authToken,
      nickname: cloudUser.nickname || '特遣隊指揮官',
      flag: cloudUser.flag || '🇹🇼',
      boundAt: Date.now()
    };
    setAccount(account);

    return {
      success: true,
      account,
      bookmarkUrl: generateBookmarkUrl(cleanId, authToken)
    };
  }

  /* Token 免密碼登入 (方案 C) */
  async function loginWithToken(id, token) {
    if (!id || !token) return false;
    const database = initFirebase();
    if (!database) return false;

    const cleanId = id.toLowerCase();
    const snap = await database.ref(`commanders/${cleanId}`).once('value');
    if (!snap.exists()) return false;

    const cloudUser = snap.val();
    if (cloudUser.authToken !== token) {
      console.warn('[CloudSync] 專屬免密 Token 已過期或不吻合');
      return false;
    }

    // 驗證成功，同步還原雲端存檔
    if (cloudUser.saveData) {
      restoreSaveDataToLocal(cloudUser.saveData);
    }

    const account = {
      id: cleanId,
      displayId: cloudUser.displayId || id,
      authToken: token,
      nickname: cloudUser.nickname || '特遣隊指揮官',
      flag: cloudUser.flag || '🇹🇼',
      boundAt: Date.now()
    };
    setAccount(account);

    return {
      success: true,
      account,
      bookmarkUrl: generateBookmarkUrl(cleanId, token)
    };
  }

  /* 背景自動同步最新戰績至雲端 */
  async function syncToCloud() {
    const account = getAccount();
    if (!account || !account.id) return false;

    const database = initFirebase();
    if (!database) return false;

    try {
      const localData = collectLocalSaveData();
      const now = Date.now();
      await database.ref(`commanders/${account.id}`).update({
        updatedAt: now,
        nickname: localData.profile?.name || account.nickname,
        flag: localData.profile?.flag || account.flag,
        saveData: localData
      });
      return true;
    } catch (e) {
      console.warn('[CloudSync] 背景同步雲端失敗:', e);
      return false;
    }
  }

  /* 生成專屬一鍵免密書籤網址 (方案 C) */
  function generateBookmarkUrl(id, token) {
    const acc = getAccount();
    const cid = id || acc?.id;
    const ctoken = token || acc?.authToken;
    if (!cid || !ctoken) return '';
    const cleanUrl = window.location.href.split('#')[0];
    return `${cleanUrl}#cmd=${encodeURIComponent(cid)}&token=${encodeURIComponent(ctoken)}`;
  }

  /* 登出 / 解除本機綁定 */
  function logout() {
    setAccount(null);
  }

  return {
    validateId: id => ID_REGEX.test(id),
    validatePassword: pwd => PWD_REGEX.test(pwd),
    getAccount,
    register,
    loginWithPassword,
    loginWithToken,
    syncToCloud,
    generateBookmarkUrl,
    logout
  };
})();
