'use strict';
/* =====================================================
   頂尖對戰：15元聯合作戰 — 軍武庫圖鑑全鑑核心邏輯 (armory.js)
   ===================================================== */

(function () {
  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));

  // 主題控制
  function initTheme() {
    const saved = localStorage.getItem('db15_theme') || 'light';
    document.documentElement.dataset.theme = saved;
    updateThemeIcon(saved);

    $('#btnTheme')?.addEventListener('click', () => {
      const current = document.documentElement.dataset.theme || 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      localStorage.setItem('db15_theme', next);
      updateThemeIcon(next);
    });
  }

  function updateThemeIcon(t) {
    const icon = $('#themeIcon');
    if (icon) icon.textContent = t === 'dark' ? '☀️' : '🌙';
  }
  window.addEventListener('storage', e => {
    if (e.key === 'db15_theme' && e.newValue) {
      document.documentElement.dataset.theme = e.newValue;
      updateThemeIcon(e.newValue);
    }
  });
  if (false) {
  }

  // 狀態管理
  const state = {
    cat: 'all',
    cost: 'all',
    trait: 'all',
    sort: 'cost_desc',
    query: '',
    view: 'grid'
  };

  // 初始化戰術特性選單與底部辭典
  function initCodexAndFilters() {
    const traitSelect = $('#traitSelect');
    const codexGrid = $('#codexTraitsGrid');

    if (traitSelect) {
      Object.keys(TRAITS).forEach(k => {
        const opt = document.createElement('option');
        opt.value = k;
        opt.textContent = `[${k}] ${TRAITS[k].split('：')[0]}`;
        traitSelect.appendChild(opt);
      });
    }

    if (codexGrid) {
      codexGrid.innerHTML = Object.keys(TRAITS).map(k => `
        <div class="trait-codex-card">
          <b>[${k}] ${TRAITS[k].split('：')[0]}</b>
          <p>${TRAITS[k].split('：')[1] || TRAITS[k]}</p>
        </div>
      `).join('');
    }
  }

  // 取得篩選與排序後的裝備清單
  function getFilteredUnits() {
    return UNITS.filter(u => {
      if (state.cat !== 'all' && u.cat !== state.cat) return false;
      if (state.cost !== 'all' && u.cost !== Number(state.cost)) return false;
      if (state.trait !== 'all' && !u.traits.includes(state.trait)) return false;

      if (state.query) {
        const q = state.query.toLowerCase().trim();
        const match =
          u.name.toLowerCase().includes(q) ||
          u.id.toLowerCase().includes(q) ||
          u.origin.toLowerCase().includes(q) ||
          u.weapon.toLowerCase().includes(q) ||
          u.tag.toLowerCase().includes(q) ||
          u.desc.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    }).sort((a, b) => {
      switch (state.sort) {
        case 'cost_desc': return b.cost - a.cost || b.hp - a.hp;
        case 'cost_asc':  return a.cost - b.cost || a.hp - b.hp;
        case 'hp_desc':   return b.hp - a.hp;
        case 'atk_desc':  return b.atk - a.atk;
        case 'sth_desc':  return b.st - a.st;
        case 'ew_desc':   return b.ew - a.ew;
        case 'name_asc':  return a.name.localeCompare(b.name, 'zh-Hant');
        default: return 0;
      }
    });
  }

  // 渲染卡片網格 (Grid View)
  function renderGrid(units) {
    const container = $('#armoryGrid');
    if (!container) return;

    if (!units.length) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--muted);">
          <div style="font-size: 40px; margin-bottom: 12px;">🔍</div>
          <h3 style="color: var(--text); font-size: 18px; margin-bottom: 6px;">查無符合條件的裝備</h3>
          <p style="font-size: 13px;">請嘗試更換搜尋關鍵字或放寬篩選條件。</p>
        </div>
      `;
      return;
    }

    container.innerHTML = units.map(u => {
      const cat = CATS[u.cat] || { label: u.cat, short: u.cat, color: '#3de0ff' };
      const fallbackImg = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="190" viewBox="0 0 320 190"><rect width="100%" height="100%" fill="%230c1420"/><text x="50%" y="50%" fill="%233de0ff" font-family="sans-serif" font-size="16" text-anchor="middle" dy=".3em">${u.name}</text></svg>`;
      const imgSrc = u.img || fallbackImg;

      const traitsHtml = u.traits.map(t => {
        const cls = t.toLowerCase();
        const hint = (TRAITS[t] || t).replace(/"/g, '&quot;');
        return `<span class="trait-chip ${cls}" title="${hint}">${t}</span>`;
      }).join('');

      return `
        <article class="unit-card" style="--c: ${cat.color}" data-unit-id="${u.id}">
          <div class="card-media-box">
            <img class="card-img" src="${imgSrc}" alt="${u.name}" loading="lazy" onerror="this.onerror=null;this.src='${fallbackImg}'">
            <div class="card-media-overlay"></div>
            <span class="badge-cost">$${u.cost}</span>
            <span class="badge-cat" style="--c: ${cat.color}">${cat.label}</span>
            <div class="badge-origin">${u.flag} ${u.origin}</div>
            <div class="badge-style">${u.v}型 · ${u.tag}</div>
          </div>
          <div class="card-body">
            <div class="card-head-title">
              <h3 class="card-name">${u.name}</h3>
              <span class="card-id">${u.id}</span>
            </div>
            <div class="card-tagline">🎯 ${u.tag}</div>
            <div class="card-weapon">⚔️ ${u.weapon}</div>
            <p class="card-desc" title="${u.desc}">${u.desc}</p>
            <div class="card-traits">${traitsHtml}</div>
            <div class="card-stats">
              <div class="stat-row">
                <span class="stat-name">HP</span>
                <div class="stat-bar-track"><div class="stat-bar-fill hp" style="width: ${Math.min(100, (u.hp / 380) * 100)}%"></div></div>
                <span class="stat-val">${u.hp}</span>
              </div>
              <div class="stat-row">
                <span class="stat-name">ATK</span>
                <div class="stat-bar-track"><div class="stat-bar-fill atk" style="width: ${Math.min(100, (u.atk / 150) * 100)}%"></div></div>
                <span class="stat-val">${u.atk}</span>
              </div>
              <div class="stat-row">
                <span class="stat-name">DEF</span>
                <div class="stat-bar-track"><div class="stat-bar-fill def" style="width: ${u.def * 100}%"></div></div>
                <span class="stat-val">${Math.round(u.def * 100)}%</span>
              </div>
              <div class="stat-row">
                <span class="stat-name">STH</span>
                <div class="stat-bar-track"><div class="stat-bar-fill sth" style="width: ${u.st}%"></div></div>
                <span class="stat-val">${u.st}</span>
              </div>
              <div class="stat-row">
                <span class="stat-name">EW</span>
                <div class="stat-bar-track"><div class="stat-bar-fill ew" style="width: ${Math.min(100, (u.ew / 50) * 100)}%"></div></div>
                <span class="stat-val">${u.ew}</span>
              </div>
            </div>
          </div>
        </article>
      `;
    }).join('');

    // 綁定點擊展開全息情報
    container.querySelectorAll('.unit-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.unitId;
        openIntelModal(id);
      });
    });
  }

  // 渲染表格清單 (Table View)
  function renderTable(units) {
    const tbody = $('#armoryTableBody');
    if (!tbody) return;

    if (!units.length) {
      tbody.innerHTML = `<tr><td colspan="13" style="text-align:center; padding: 40px; color: var(--muted);">查無符合條件的裝備</td></tr>`;
      return;
    }

    tbody.innerHTML = units.map(u => {
      const cat = CATS[u.cat] || { label: u.cat, color: '#3de0ff' };
      const fallbackImg = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="58" height="38" viewBox="0 0 58 38"><rect width="100%" height="100%" fill="%230c1420"/><text x="50%" y="50%" fill="%233de0ff" font-size="10" text-anchor="middle" dy=".3em">${u.id}</text></svg>`;
      const imgSrc = u.img || fallbackImg;

      const traitsHtml = u.traits.map(t => `<span class="trait-chip" style="font-size:10px; padding:1px 5px;">${t}</span>`).join(' ');

      return `
        <tr style="cursor:pointer;" data-unit-id="${u.id}">
          <td><img class="table-thumb" src="${imgSrc}" alt="${u.name}" loading="lazy" onerror="this.onerror=null;this.src='${fallbackImg}'"></td>
          <td><b>${u.name}</b><br><small style="font-family:var(--mono); color:var(--muted);">${u.id}</small></td>
          <td><span style="color:${cat.color}; font-weight:700;">${cat.label}</span></td>
          <td><b style="color:var(--amber); font-family:var(--mono); font-size:14px;">$${u.cost}</b></td>
          <td>${u.flag} ${u.origin}</td>
          <td><small style="color:var(--cyan);">${u.tag}</small></td>
          <td style="max-width:200px; font-size:12px;">${u.weapon}</td>
          <td><b>${u.hp}</b></td>
          <td><b>${u.atk}</b></td>
          <td>${Math.round(u.def * 100)}%</td>
          <td>${u.st}</td>
          <td>${u.ew}</td>
          <td>${traitsHtml || '<span style="color:var(--muted);">-</span>'}</td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('tr').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.dataset.unitId;
        if (id) openIntelModal(id);
      });
    });
  }

  // 刷新主視圖
  function updateView() {
    const filtered = getFilteredUnits();
    $('#filteredCount').textContent = filtered.length;

    if (state.view === 'grid') {
      $('#armoryGrid').hidden = false;
      $('#armoryTableWrap').hidden = true;
      renderGrid(filtered);
    } else {
      $('#armoryGrid').hidden = true;
      $('#armoryTableWrap').hidden = false;
      renderTable(filtered);
    }
  }

  // 全息情報模態窗邏輯
  function openIntelModal(id) {
    const u = UNIT_MAP[id];
    if (!u) return;

    const cat = CATS[u.cat] || { label: u.cat, color: '#3de0ff' };
    const modal = $('#intelModal');
    const fallbackImg = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="880" height="320" viewBox="0 0 880 320"><rect width="100%" height="100%" fill="%230c1420"/><text x="50%" y="50%" fill="%233de0ff" font-family="sans-serif" font-size="28" text-anchor="middle" dy=".3em">${u.name}</text></svg>`;

    $('#intelImg').src = u.img || fallbackImg;
    $('#intelImg').onerror = () => { $('#intelImg').src = fallbackImg; };
    $('#intelTitle').innerHTML = `${u.flag} ${u.name} <small style="font-size:16px; color:var(--muted); font-family:var(--mono);">(${u.id})</small>`;
    $('#intelTagline').textContent = `【${u.v}型 · ${u.tag}】 研發產地：${u.origin}`;
    $('#intelWeapon').innerHTML = `<b>主力武裝配置：</b> ${u.weapon}`;
    $('#intelDesc').textContent = u.desc;

    $('#intelBadges').innerHTML = `
      <span class="badge-cost" style="position:static;">$${u.cost} 費用</span>
      <span class="badge-cat" style="position:static; --c:${cat.color}">${cat.label}</span>
    `;

    $('#intelSpecs').innerHTML = `
      <div class="spec-card">
        <div class="k">生命值 (HP)</div>
        <div class="v">${u.hp}</div>
      </div>
      <div class="spec-card">
        <div class="k">戰術火力 (ATK)</div>
        <div class="v" style="color:var(--amber);">${u.atk}</div>
      </div>
      <div class="spec-card">
        <div class="k">裝甲減傷 (DEF)</div>
        <div class="v" style="color:var(--green);">${Math.round(u.def * 100)}%</div>
      </div>
      <div class="spec-card">
        <div class="k">雷達隱匿 (STH)</div>
        <div class="v" style="color:var(--violet);">${u.st}</div>
      </div>
      <div class="spec-card">
        <div class="k">電戰干擾 (EW)</div>
        <div class="v" style="color:#6366f1;">${u.ew}</div>
      </div>
      <div class="spec-card">
        <div class="k">戰術特性 (Traits)</div>
        <div class="v" style="font-size:13px; font-family:var(--mono);">${u.traits.join(', ') || '無特殊特性'}</div>
      </div>
    `;

    // 戰術建議
    const catHint = CAT_HINT[u.cat] || '';
    const traitHints = u.traits.map(t => `【${t}】${TRAITS[t] || ''}`).join('；');
    $('#intelTacticalTips').innerHTML = `
      <b>兵種作戰機制：</b>${catHint}<br>
      ${traitHints ? `<b>特性加成效果：</b>${traitHints}` : ''}
    `;

    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeIntelModal() {
    const modal = $('#intelModal');
    if (modal) {
      modal.hidden = true;
      document.body.style.overflow = '';
    }
  }

  // 事件綁定
  function bindEvents() {
    // 搜尋輸入
    $('#searchInput')?.addEventListener('input', e => {
      state.query = e.target.value;
      updateView();
    });

    // 兵種篩選
    $('#catFilterGroup')?.addEventListener('click', e => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      $$('#catFilterGroup .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.cat = btn.dataset.cat;
      updateView();
    });

    // 費用篩選
    $('#costFilterGroup')?.addEventListener('click', e => {
      const btn = e.target.closest('.cost-btn');
      if (!btn) return;
      $$('#costFilterGroup .cost-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.cost = btn.dataset.cost;
      updateView();
    });

    // 特性下拉
    $('#traitSelect')?.addEventListener('change', e => {
      state.trait = e.target.value;
      updateView();
    });

    // 排序下拉
    $('#sortSelect')?.addEventListener('change', e => {
      state.sort = e.target.value;
      updateView();
    });

    // 檢視模式切換
    $('#btnViewGrid')?.addEventListener('click', () => {
      state.view = 'grid';
      $('#btnViewGrid').classList.add('active');
      $('#btnViewTable').classList.remove('active');
      updateView();
    });
    $('#btnViewTable')?.addEventListener('click', () => {
      state.view = 'table';
      $('#btnViewTable').classList.add('active');
      $('#btnViewGrid').classList.remove('active');
      updateView();
    });

    // 模態視窗關閉
    $('#intelCloseBtn')?.addEventListener('click', closeIntelModal);
    $('#intelModal')?.addEventListener('click', e => {
      if (e.target.id === 'intelModal') closeIntelModal();
    });
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeIntelModal();
    });
  }

  // 啟動初始化
  function init() {
    initTheme();
    initCodexAndFilters();
    bindEvents();
    updateView();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
