(function () {
'use strict';

function ensureArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.slice();
  if (typeof val === 'object') return Object.values(val);
  return [];
}

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

/* ---------- 軍規級純前端 Web Audio API 物理聲學與戰場空間殘響合成引擎 v2 (Military Acoustic DSP Engine) ---------- */
const SoundEngine = {
  ctx: null,
  masterComp: null,
  reverbNode: null,
  reverbSend: null,
  distCurve: null,
  whiteBuffer: null,
  noiseBuffer: null, // Pink Noise
  brownBuffer: null,
  enabled: LS.get('db15_sound', true),

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      const sr = this.ctx.sampleRate;

      // 1. 母帶級動態壓限器：承受多武器齊射與重低音殉爆，防止數位破音
      this.masterComp = this.ctx.createDynamicsCompressor();
      this.masterComp.threshold.setValueAtTime(-12, this.ctx.currentTime);
      this.masterComp.knee.setValueAtTime(18, this.ctx.currentTime);
      this.masterComp.ratio.setValueAtTime(10, this.ctx.currentTime);
      this.masterComp.attack.setValueAtTime(0.002, this.ctx.currentTime);
      this.masterComp.release.setValueAtTime(0.22, this.ctx.currentTime);
      this.masterComp.connect(this.ctx.destination);

      // 2. 非線性火藥爆燃失真曲線 (WaveShaper Soft-Clipper / Harmonic Saturation)
      const curveLen = 8192;
      this.distCurve = new Float32Array(curveLen);
      for (let i = 0; i < curveLen; i++) {
        const x = (i * 2) / curveLen - 1;
        this.distCurve[i] = Math.tanh(x * 2.8);
      }

      // 3. 生成三種物理噪聲基底：White (超音速音爆/破片)、Pink (火箭噴流/火藥)、Brown (深層重低音殉爆/海浪)
      const bufSize = sr * 2;
      this.whiteBuffer = this.ctx.createBuffer(1, bufSize, sr);
      this.noiseBuffer = this.ctx.createBuffer(1, bufSize, sr);
      this.brownBuffer = this.ctx.createBuffer(1, bufSize, sr);

      const wData = this.whiteBuffer.getChannelData(0);
      const pData = this.noiseBuffer.getChannelData(0);
      const bData = this.brownBuffer.getChannelData(0);

      let b0 = 0, b1 = 0, b2 = 0, lastBrown = 0;
      for (let i = 0; i < bufSize; i++) {
        const white = Math.random() * 2 - 1;
        wData[i] = white * 0.65;

        // Pink Noise
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        pData[i] = (b0 + b1 + b2 + white * 0.08) * 0.38;

        // Brown Noise (低頻能量濃厚，適合火砲膛壓與遠方滾動雷鳴)
        lastBrown = (lastBrown + (0.028 * white)) / 1.028;
        bData[i] = lastBrown * 2.8;
      }

      // 4. 建立 1.35 秒戶外開闊戰場空間殘響 (Outdoor Battlefield Convolution Reverb IR)
      const irLen = Math.floor(sr * 1.35);
      const irBuf = this.ctx.createBuffer(2, irLen, sr);
      for (let ch = 0; ch < 2; ch++) {
        const chData = irBuf.getChannelData(ch);
        let lp = 0;
        for (let i = 0; i < irLen; i++) {
          const tSec = i / sr;
          // 模擬地面與山谷早期反射 (Early Reflections at 18ms, 45ms, 88ms) + 戶外空氣衰減尾音
          const early = (Math.abs(tSec - 0.018) < 0.004 || Math.abs(tSec - 0.045) < 0.005 || Math.abs(tSec - 0.088) < 0.006) ? 0.55 : 0;
          const env = Math.exp(-tSec * 3.8) + early * Math.exp(-tSec * 2.0);
          const raw = (Math.random() * 2 - 1) * env;
          // 隨時間加深空氣低通吸收，讓遠方殘響溫暖渾厚不刺耳
          const alpha = Math.max(0.06, 0.35 * Math.exp(-tSec * 2.2));
          lp = lp + alpha * (raw - lp);
          chData[i] = lp * 0.65;
        }
      }
      this.reverbNode = this.ctx.createConvolver();
      this.reverbNode.buffer = irBuf;
      this.reverbSend = this.ctx.createGain();
      this.reverbSend.gain.setValueAtTime(0.32, this.ctx.currentTime);
      this.reverbNode.connect(this.reverbSend);
      this.reverbSend.connect(this.masterComp);
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

  // 建立帶非線性火藥飽和失真、左右立體聲定位與戰場空間殘響的物理聲學通道
  _createBus(t, side = 'A', wetLevel = 0.25, saturate = true) {
    const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    if (panner) {
      panner.pan.setValueAtTime(side === 'A' ? -0.26 : 0.26, t);
      panner.connect(this.masterComp);
      if (this.reverbNode && wetLevel > 0) {
        const wetGain = this.ctx.createGain();
        wetGain.gain.setValueAtTime(wetLevel, t);
        panner.connect(wetGain);
        wetGain.connect(this.reverbNode);
      }
    }
    const dest = panner || this.masterComp;
    if (saturate && this.distCurve) {
      const shaper = this.ctx.createWaveShaper();
      shaper.curve = this.distCurve;
      shaper.oversample = '2x';
      shaper.connect(dest);
      return shaper;
    }
    return dest;
  },

  // 播放具備真實戰場物理衝擊與空間尾韻的軍武音效 (side: 'A' 為我方左側, 'B' 為敵方右側)
  play(type, side = 'A') {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || !this.noiseBuffer) return;

    try {
      const t = this.ctx.currentTime;

      if (type === 'heavy_cannon') {
        // 【120mm/125mm 戰車滑膛砲實彈射擊：超音速膛口音爆 + 火藥膨脹怒吼 + 胸腔次低音 + 砲閂退殼金屬聲】
        const bus = this._createBus(t, side, 0.45, true);

        // 1. 0~14ms 超音速膛口裂帛瞬態 (Supersonic Ballistic Crack)
        const crack = this.ctx.createBufferSource();
        crack.buffer = this.whiteBuffer;
        const crackHp = this.ctx.createBiquadFilter();
        crackHp.type = 'highpass';
        crackHp.frequency.setValueAtTime(950, t);
        const crackGain = this.ctx.createGain();
        crackGain.gain.setValueAtTime(0.85, t);
        crackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.022);
        crack.connect(crackHp);
        crackHp.connect(crackGain);
        crackGain.connect(bus);
        crack.start(t);
        crack.stop(t + 0.025);

        // 2. 火藥高壓燃氣膨脹轟鳴 (Propellant Blast Body)
        const blast = this.ctx.createBufferSource();
        blast.buffer = this.brownBuffer;
        const blastLp = this.ctx.createBiquadFilter();
        blastLp.type = 'lowpass';
        blastLp.frequency.setValueAtTime(480, t);
        blastLp.frequency.exponentialRampToValueAtTime(58, t + 0.34);
        const blastGain = this.ctx.createGain();
        blastGain.gain.setValueAtTime(0.95, t);
        blastGain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
        blast.connect(blastLp);
        blastLp.connect(blastGain);
        blastGain.connect(bus);
        blast.start(t);
        blast.stop(t + 0.4);

        // 3. 62Hz -> 26Hz 重型後座力次低音衝擊 (Sub-Bass Recoil Thud)
        const sub = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(72, t);
        sub.frequency.exponentialRampToValueAtTime(26, t + 0.28);
        subGain.gain.setValueAtTime(0.85, t);
        subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
        sub.connect(subGain);
        subGain.connect(bus);
        sub.start(t);
        sub.stop(t + 0.36);

        // 4. +115ms 自動裝填機 / 砲閂金屬拋殼聲 (Breech Clatter)
        const clack = this.ctx.createBufferSource();
        clack.buffer = this.whiteBuffer;
        const clackBp = this.ctx.createBiquadFilter();
        clackBp.type = 'bandpass';
        clackBp.frequency.setValueAtTime(2350, t + 0.115);
        clackBp.Q.setValueAtTime(4.5, t + 0.115);
        const clackGain = this.ctx.createGain();
        clackGain.gain.setValueAtTime(0.24, t + 0.115);
        clackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.155);
        clack.connect(clackBp);
        clackBp.connect(clackGain);
        clackGain.connect(bus);
        clack.start(t + 0.115);
        clack.stop(t + 0.165);

      } else if (type === 'cannon' || type === 'flak') {
        // 【30mm/35mm 機砲 / 防空快砲 / 近迫密集陣 4 連發機械點射：徹底消除卡通滑音，呈現真實機械膛壓與金屬槍機撞擊】
        const bus = this._createBus(t, side, 0.28, true);
        for (let i = 0; i < 4; i++) {
          const d = i * 0.056;
          // 膛口火藥爆裂音
          const snap = this.ctx.createBufferSource();
          snap.buffer = this.whiteBuffer;
          const bp = this.ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.setValueAtTime(2400 - i * 80, t + d);
          bp.Q.setValueAtTime(1.6, t + d);
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0.48, t + d);
          g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.038);
          snap.connect(bp);
          bp.connect(g);
          g.connect(bus);
          snap.start(t + d);
          snap.stop(t + d + 0.042);

          // 槍膛低頻厚重撞擊
          const body = this.ctx.createBufferSource();
          body.buffer = this.brownBuffer;
          const lp = this.ctx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.setValueAtTime(340, t + d);
          const bg = this.ctx.createGain();
          bg.gain.setValueAtTime(0.62, t + d);
          bg.gain.exponentialRampToValueAtTime(0.001, t + d + 0.052);
          body.connect(lp);
          lp.connect(bg);
          bg.connect(bus);
          body.start(t + d);
          body.stop(t + d + 0.058);
        }

      } else if (type === 'missile') {
        // 【防空飛彈 / 超音速空對空飛彈：冷發射氣爆點火 + 固態火箭發動機寬頻撕裂噴流聲】
        const bus = this._createBus(t, side, 0.35, true);

        // 1. 發射筒點火氣爆瞬態 (Booster Ignition Thump)
        const pop = this.ctx.createBufferSource();
        pop.buffer = this.brownBuffer;
        const popLp = this.ctx.createBiquadFilter();
        popLp.type = 'lowpass';
        popLp.frequency.setValueAtTime(260, t);
        const popGain = this.ctx.createGain();
        popGain.gain.setValueAtTime(0.75, t);
        popGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
        pop.connect(popLp);
        popLp.connect(popGain);
        popGain.connect(bus);
        pop.start(t);
        pop.stop(t + 0.1);

        // 2. 固態火箭高壓尾焰撕裂空氣嘶吼 (Broadband Turbulent Jet Roar，寬頻帶 Q=0.8 杜絕口哨感)
        const jet = this.ctx.createBufferSource();
        jet.buffer = this.noiseBuffer;
        const jetFilter = this.ctx.createBiquadFilter();
        jetFilter.type = 'bandpass';
        jetFilter.frequency.setValueAtTime(1650, t + 0.015);
        jetFilter.frequency.exponentialRampToValueAtTime(680, t + 0.42);
        jetFilter.Q.setValueAtTime(0.75, t + 0.015);
        const jetGain = this.ctx.createGain();
        jetGain.gain.setValueAtTime(0.05, t);
        jetGain.gain.linearRampToValueAtTime(0.52, t + 0.045);
        jetGain.gain.exponentialRampToValueAtTime(0.001, t + 0.44);
        jet.connect(jetFilter);
        jetFilter.connect(jetGain);
        jetGain.connect(bus);
        jet.start(t);
        jet.stop(t + 0.46);

        // 3. 尾焰低頻空氣震動基底
        const rumble = this.ctx.createBufferSource();
        rumble.buffer = this.brownBuffer;
        const rumLp = this.ctx.createBiquadFilter();
        rumLp.type = 'lowpass';
        rumLp.frequency.setValueAtTime(280, t);
        const rumGain = this.ctx.createGain();
        rumGain.gain.setValueAtTime(0.42, t + 0.02);
        rumGain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
        rumble.connect(rumLp);
        rumLp.connect(rumGain);
        rumGain.connect(bus);
        rumble.start(t + 0.02);
        rumble.stop(t + 0.4);

      } else if (type === 'rocket_salvo') {
        // 【海馬斯 / 多管火箭 / 巡弋飛彈波次齊射：4 發連續出筒悶響與火箭推進尾流】
        const bus = this._createBus(t, side, 0.38, true);
        for (let i = 0; i < 4; i++) {
          const delay = i * 0.068;
          // 發射箱點火重擊
          const tube = this.ctx.createBufferSource();
          tube.buffer = this.brownBuffer;
          const tubeLp = this.ctx.createBiquadFilter();
          tubeLp.type = 'lowpass';
          tubeLp.frequency.setValueAtTime(220, t + delay);
          const tubeGain = this.ctx.createGain();
          tubeGain.gain.setValueAtTime(0.55, t + delay);
          tubeGain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.075);
          tube.connect(tubeLp);
          tubeLp.connect(tubeGain);
          tubeGain.connect(bus);
          tube.start(t + delay);
          tube.stop(t + delay + 0.085);

          // 火箭噴流嘶吼
          const roar = this.ctx.createBufferSource();
          roar.buffer = this.noiseBuffer;
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(1150 - i * 70, t + delay);
          filter.frequency.exponentialRampToValueAtTime(420, t + delay + 0.25);
          filter.Q.setValueAtTime(0.85, t + delay);
          const gain = this.ctx.createGain();
          gain.gain.setValueAtTime(0.04, t + delay);
          gain.gain.linearRampToValueAtTime(0.38, t + delay + 0.04);
          gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.28);
          roar.connect(filter);
          filter.connect(gain);
          gain.connect(bus);
          roar.start(t + delay);
          roar.stop(t + delay + 0.3);
        }

      } else if (type === 'torpedo') {
        // 【重型魚雷 / 潛艦高壓水下發射：高壓氣體出管悶響 + 螺旋槳空泡湍流 + 聲納回波】
        const bus = this._createBus(t, side, 0.35, false);

        // 1. 水下高壓魚雷管射出悶響
        const slug = this.ctx.createBufferSource();
        slug.buffer = this.brownBuffer;
        const slugLp = this.ctx.createBiquadFilter();
        slugLp.type = 'lowpass';
        slugLp.frequency.setValueAtTime(180, t);
        slugLp.frequency.exponentialRampToValueAtTime(55, t + 0.35);
        const slugGain = this.ctx.createGain();
        slugGain.gain.setValueAtTime(0.75, t);
        slugGain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
        slug.connect(slugLp);
        slugLp.connect(slugGain);
        slugGain.connect(bus);
        slug.start(t);
        slug.stop(t + 0.4);

        // 2. 水下泵噴推進空泡水流聲 (Cavitation Turbulence)
        const cav = this.ctx.createBufferSource();
        cav.buffer = this.noiseBuffer;
        const cavBp = this.ctx.createBiquadFilter();
        cavBp.type = 'bandpass';
        cavBp.frequency.setValueAtTime(520, t + 0.03);
        cavBp.frequency.exponentialRampToValueAtTime(240, t + 0.42);
        cavBp.Q.setValueAtTime(1.4, t + 0.03);
        const cavGain = this.ctx.createGain();
        cavGain.gain.setValueAtTime(0.28, t + 0.03);
        cavGain.gain.exponentialRampToValueAtTime(0.001, t + 0.44);
        cav.connect(cavBp);
        cavBp.connect(cavGain);
        cavGain.connect(bus);
        cav.start(t + 0.03);
        cav.stop(t + 0.45);

      } else if (type === 'swarm') {
        // 【自殺無人機 / 巡飛彈蜂群：多旋翼葉片調幅氣流聲 + 高速俯衝風切聲 (無卡通鋸齒滑音)】
        const bus = this._createBus(t, side, 0.2, false);

        // 高速俯衝風切氣流
        const wind = this.ctx.createBufferSource();
        wind.buffer = this.noiseBuffer;
        const windBp = this.ctx.createBiquadFilter();
        windBp.type = 'bandpass';
        windBp.frequency.setValueAtTime(620, t);
        windBp.frequency.linearRampToValueAtTime(980, t + 0.16);
        windBp.frequency.linearRampToValueAtTime(480, t + 0.34);
        windBp.Q.setValueAtTime(1.5, t);
        const windGain = this.ctx.createGain();
        windGain.gain.setValueAtTime(0.04, t);
        windGain.gain.linearRampToValueAtTime(0.34, t + 0.14);
        windGain.gain.exponentialRampToValueAtTime(0.001, t + 0.36);
        wind.connect(windBp);
        windBp.connect(windGain);
        windGain.connect(bus);
        wind.start(t);
        wind.stop(t + 0.38);

        // 螺旋槳葉片切割空氣脈衝 (Rotor Blade Pass Modulation)
        const rotor = this.ctx.createOscillator();
        const rotorFilter = this.ctx.createBiquadFilter();
        const rotorGain = this.ctx.createGain();
        rotor.type = 'triangle';
        rotor.frequency.setValueAtTime(210, t);
        rotor.frequency.linearRampToValueAtTime(265, t + 0.16);
        rotor.frequency.linearRampToValueAtTime(175, t + 0.34);
        rotorFilter.type = 'lowpass';
        rotorFilter.frequency.setValueAtTime(750, t);
        rotorGain.gain.setValueAtTime(0.02, t);
        rotorGain.gain.linearRampToValueAtTime(0.14, t + 0.14);
        rotorGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        rotor.connect(rotorFilter);
        rotorFilter.connect(rotorGain);
        rotorGain.connect(bus);
        rotor.start(t);
        rotor.stop(t + 0.36);

      } else if (type === 'explosion') {
        // 【戰損毀滅雙段式重型殉爆：初段高爆破片裂帛 ➔ 70ms 彈藥庫二次深層重低音殉爆 ➔ 1.35s 戰場轟鳴尾音】
        const bus = this._createBus(t, side, 0.58, true);

        // 1. 初段高爆破空瞬態 (Initial Detonation Snap)
        const snap = this.ctx.createBufferSource();
        snap.buffer = this.whiteBuffer;
        const snapLp = this.ctx.createBiquadFilter();
        snapLp.type = 'lowpass';
        snapLp.frequency.setValueAtTime(2800, t);
        snapLp.frequency.exponentialRampToValueAtTime(180, t + 0.18);
        const snapGain = this.ctx.createGain();
        snapGain.gain.setValueAtTime(0.85, t);
        snapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        snap.connect(snapLp);
        snapLp.connect(snapGain);
        snapGain.connect(bus);
        snap.start(t);
        snap.stop(t + 0.24);

        // 2. 二段彈藥庫殉爆深層滾動巨響 (Secondary Ammo Cook-off Brown Roar)
        const rumble = this.ctx.createBufferSource();
        rumble.buffer = this.brownBuffer;
        const rumLp = this.ctx.createBiquadFilter();
        rumLp.type = 'lowpass';
        rumLp.frequency.setValueAtTime(320, t + 0.045);
        rumLp.frequency.exponentialRampToValueAtTime(48, t + 0.78);
        const rumGain = this.ctx.createGain();
        rumGain.gain.setValueAtTime(0.95, t + 0.045);
        rumGain.gain.exponentialRampToValueAtTime(0.001, t + 0.85);
        rumble.connect(rumLp);
        rumLp.connect(rumGain);
        rumGain.connect(bus);
        rumble.start(t + 0.045);
        rumble.stop(t + 0.88);

        // 3. 32Hz 地面震波次低音 (Seismic Sub-Bass Shockwave)
        const sub = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(88, t);
        sub.frequency.exponentialRampToValueAtTime(24, t + 0.65);
        subGain.gain.setValueAtTime(0.92, t);
        subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.72);
        sub.connect(subGain);
        subGain.connect(bus);
        sub.start(t);
        sub.stop(t + 0.75);

      } else if (type === 'hit_impact') {
        // 【裝甲鋼板動能貫穿與破片撞擊：低頻受擊悶響 + 高頻金屬碎裂】
        const bus = this._createBus(t, side, 0.3, true);

        const thud = this.ctx.createBufferSource();
        thud.buffer = this.brownBuffer;
        const thudLp = this.ctx.createBiquadFilter();
        thudLp.type = 'lowpass';
        thudLp.frequency.setValueAtTime(280, t);
        const thudGain = this.ctx.createGain();
        thudGain.gain.setValueAtTime(0.75, t);
        thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
        thud.connect(thudLp);
        thudLp.connect(thudGain);
        thudGain.connect(bus);
        thud.start(t);
        thud.stop(t + 0.18);

        const crunch = this.ctx.createBufferSource();
        crunch.buffer = this.whiteBuffer;
        const crunchBp = this.ctx.createBiquadFilter();
        crunchBp.type = 'bandpass';
        crunchBp.frequency.setValueAtTime(1950, t);
        crunchBp.frequency.exponentialRampToValueAtTime(520, t + 0.11);
        crunchBp.Q.setValueAtTime(1.8, t);
        const crunchGain = this.ctx.createGain();
        crunchGain.gain.setValueAtTime(0.52, t);
        crunchGain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
        crunch.connect(crunchBp);
        crunchBp.connect(crunchGain);
        crunchGain.connect(bus);
        crunch.start(t);
        crunch.stop(t + 0.14);

      } else if (type === 'block') {
        // 【主動防護系統 APS 近迫攔截彈爆破與鎢珠破片散射聲 (無卡通彈簧音)】
        const bus = this._createBus(t, side, 0.25, true);

        // 攔截彈空爆瞬態
        const pop = this.ctx.createBufferSource();
        pop.buffer = this.whiteBuffer;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(1600, t);
        bp.Q.setValueAtTime(1.2, t);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.6, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
        pop.connect(bp);
        bp.connect(g);
        g.connect(bus);
        pop.start(t);
        pop.stop(t + 0.06);

        // 3 顆高速金屬破片散射清脆撞擊
        [0.018, 0.036, 0.054].forEach((d, idx) => {
          const ping = this.ctx.createBufferSource();
          ping.buffer = this.whiteBuffer;
          const pFilter = this.ctx.createBiquadFilter();
          pFilter.type = 'bandpass';
          pFilter.frequency.setValueAtTime(3400 + idx * 450, t + d);
          pFilter.Q.setValueAtTime(6.0, t + d);
          const pGain = this.ctx.createGain();
          pGain.gain.setValueAtTime(0.28, t + d);
          pGain.gain.exponentialRampToValueAtTime(0.001, t + d + 0.03);
          ping.connect(pFilter);
          pFilter.connect(pGain);
          pGain.connect(bus);
          ping.start(t + d);
          ping.stop(t + d + 0.035);
        });

      } else if (type === 'emp_pulse') {
        // 【戰機 RWR 雷達鎖定告警雙脈衝 + 寬頻電磁干擾雜訊】
        const bus = this._createBus(t, side, 0.15, false);

        // NATO RWR 威脅鎖定急促雙音 (1480Hz / 1180Hz)
        [0, 0.065].forEach((d, idx) => {
          const rwr = this.ctx.createOscillator();
          const rg = this.ctx.createGain();
          rwr.type = 'sine';
          rwr.frequency.setValueAtTime(idx === 0 ? 1480 : 1180, t + d);
          rg.gain.setValueAtTime(0.16, t + d);
          rg.gain.exponentialRampToValueAtTime(0.001, t + d + 0.048);
          rwr.connect(rg);
          rg.connect(bus);
          rwr.start(t + d);
          rwr.stop(t + d + 0.052);
        });

        // 電磁干擾靜電脈衝
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.whiteBuffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(2200, t);
        filter.frequency.exponentialRampToValueAtTime(650, t + 0.24);
        filter.Q.setValueAtTime(2.2, t);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.26, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(bus);
        noise.start(t);
        noise.stop(t + 0.28);

      } else if (type === 'equip') {
        // 【軍械金屬槍機上膛卡榫聲 (Click-Clack)】
        const bus = this._createBus(t, side, 0.05, false);
        [0, 0.032].forEach((d, idx) => {
          const click = this.ctx.createBufferSource();
          click.buffer = this.whiteBuffer;
          const bp = this.ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.setValueAtTime(idx === 0 ? 1900 : 2950, t + d);
          bp.Q.setValueAtTime(4.0, t + d);
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0.28, t + d);
          g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.024);
          click.connect(bp);
          bp.connect(g);
          g.connect(bus);
          click.start(t + d);
          click.stop(t + d + 0.028);
        });

      } else if (type === 'victory') {
        // 【軍事勝利凱旋和弦 (F4 -> A4 -> C5)】
        const bus = this._createBus(t, side, 0.28, false);
        [349.23, 440.0, 523.25].forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, t + idx * 0.08);
          gain.gain.setValueAtTime(0.16, t + idx * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.08 + 0.7);
          osc.connect(gain);
          gain.connect(bus);
          osc.start(t + idx * 0.08);
          osc.stop(t + idx * 0.08 + 0.75);
        });
      }
    } catch (e) {}
  }
};
window.SoundEngine = SoundEngine;

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
const playerGhost = LS.get('db15_player_ghost', { rp: 2055, callsign: '破浪突擊巡防大隊', rankTitle: '四星上將', wins: 0, losses: 0, myGhostDeck: null });

function calcRankTitle(rp) {
  if (typeof LadderEngine !== 'undefined' && LadderEngine.getRankTier) {
    return LadderEngine.getRankTier(rp).name;
  }
  if (rp >= 3000) return '特級上將';
  if (rp >= 2000) return '四星上將';
  if (rp >= 1600) return '三星中將';
  if (rp >= 1300) return '二星少將';
  if (rp >= 1050) return '一星准將';
  if (rp >= 850)  return '戰區上校';
  if (rp >= 650)  return '作戰中校';
  if (rp >= 450)  return '戰術少校';
  if (rp >= 250)  return '特遣上尉';
  return '作戰少尉';
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
    bannedByA: null, bannedByB: null, bannedListA: [], bannedListB: [], candidateBan: null, nextEvent: null
  },
  /* 線上真人雙人對戰狀態 (WebRTC Online PvP) */
  isOnlinePvp: false,
  pvpMyReady: false,
  pvpOpponentReady: false,
  pvpOpponentDeck: null,
  pvpOpponentDoc: 'defense'
};
let playToken = 0, speed = Number(LS.get('db15_speed', 1)) || 1, skip = false, paused = false, currentActiveModal = null;

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
const sleep = async ms => {
  if (skip) return;
  await new Promise(r => setTimeout(r, ms / speed));
  while (paused && !skip) {
    await new Promise(r => setTimeout(r, 80));
  }
};
const pick = a => a[Math.floor(Math.random() * a.length)];
const currentBanned = () => {
  if (state.mode !== 'bo3' || !state.bo3) return [];
  if (Array.isArray(state.bo3.bannedListB) && state.bo3.bannedListB.length) {
    return state.bo3.bannedListB;
  }
  return state.bo3.bannedByB ? [state.bo3.bannedByB] : [];
};

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
    if (state.isOnlinePvp) {
      state.event = state.bo3.nextEvent || state.event || pick(EVENTS);
      state.enemy = state.pvpOpponentDeck ? state.pvpOpponentDeck.slice() : null;
      state.enemyName = state.bo3.rivalName;
      state.enemyDoc = state.pvpOpponentDoc || 'defense';
    } else if (!state.bo3.active) {
      initBo3Series();
    } else {
      state.event = state.bo3.nextEvent || pick(EVENTS);
      state.enemy = (state.bo3.enemyDeck && state.bo3.enemyDeck.slice()) || [];
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
    bannedByA: null, bannedByB: null,
    bannedListA: [], bannedListB: [], candidateBan: null,
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

    h = `<span class="mission-tag">⚡ 快速交鋒</span>
      <!-- 對手類型二維切換膠囊 (保證單行水平排列) -->
      <div class="quick-submode-pill">
        <button class="pill-btn sm ${!isGhost ? 'active' : ''}" data-submode="ai" title="切換為電腦即時演算法對手">🤖 AI 演習</button>
        <button class="pill-btn sm ${isGhost ? 'active' : ''}" data-submode="ghost" title="切換為全球名將與真實玩家影子部隊">🌐 全球幽靈</button>
      </div>

      <div class="mission-item">
        <span style="font-size:16px">${state.event.icon}</span>
        <div><b>${esc(state.event.name)}</b> <span class="muted" style="font-size:11px">(${esc(state.event.desc)})</span></div>
      </div>`;

    if (!isGhost) {
      h += `
        <div class="mission-item" style="margin-left:6px">
          <span class="badge" style="background:rgba(56,189,248,.15);color:#38bdf8;border:1px solid rgba(56,189,248,.35);font-size:10px;font-weight:700">🤖 AI 對手</span>
          <span class="muted" style="margin-left:4px">教條：</span>
          <select class="select sm" id="aiSel" style="padding:2px 6px;width:auto;font-size:11.5px">
            <option value="random">隨機對手</option>
            ${ARCHETYPES.map(a => `<option value="${a.id}" ${state.aiArch === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
          </select>
        </div>
        <label class="check" style="margin-left:6px;font-size:11.5px">
          <input type="checkbox" id="scoutChk" ${state.scout ? 'checked' : ''}>
          <span>偵察 (−$1)</span>
        </label>
        ${state.scout ? `<span class="mission-tag" style="color:var(--amber);border-color:rgba(255,179,64,.3)">偵得：${esc(state.enemyName)} · ${esc(UNIT_MAP[state.enemy[state.scoutIdx]].name)}</span>` : ''}`;
    } else {
      if (t) {
        h += `
          <div class="mission-item enemy-target-card" style="margin-left:6px">
            <span class="badge enemy-tag-badge" style="background:rgba(239,68,68,0.18);color:#f87171;border:1px solid rgba(239,68,68,0.4);font-size:10px;font-weight:800;padding:1px 5px">🎯 當前假想敵</span>
            <b style="color:var(--text)">${esc(t.callsign)}</b>
            <span class="ghost-rank" style="font-size:10.5px;padding:1px 5px">${t.title} · ${t.rating} RP</span>
            <span class="muted" style="font-size:11px">防守戰績: ${t.wins}勝 ${t.losses}負 · 「${esc(t.motto)}」</span>
          </div>
          <div class="mission-actions">
            <button class="btn ghost sm" id="btnRerollGhost" title="隨機換一位幽靈名將對手">換對手 🔄</button>
            <button class="btn amber sm" id="btnDeployGhost" title="上傳當前陣容為世界影子防禦部隊">部署防禦 🌐</button>
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
          ${(b.bannedListA && b.bannedListA.length) 
            ? b.bannedListA.map(id => `<span style="color:var(--green);background:rgba(93,255,176,.12);border:1px solid rgba(93,255,176,.4);padding:2px 7px;border-radius:4px;font-size:11.5px;margin-left:6px;font-weight:700" title="全系列賽永久禁用">🚫 禁敵：${UNIT_MAP[id]?.name || id}</span>`).join('') 
            : (b.bannedByA ? `<span style="color:var(--green);background:rgba(93,255,176,.12);border:1px solid rgba(93,255,176,.4);padding:2px 7px;border-radius:4px;font-size:11.5px;margin-left:6px;font-weight:700">🚫 禁敵：${UNIT_MAP[b.bannedByA]?.name || b.bannedByA}</span>` : '')}
          ${(b.bannedListB && b.bannedListB.length) 
            ? b.bannedListB.map(id => `<span style="color:var(--red);background:rgba(255,93,110,.12);border:1px solid rgba(255,93,110,.4);padding:2px 7px;border-radius:4px;font-size:11.5px;margin-left:6px;font-weight:700" title="全系列賽永久禁用">⚠️ 敵禁你：${UNIT_MAP[id]?.name || id}</span>`).join('') 
            : (b.bannedByB ? `<span style="color:var(--red);background:rgba(255,93,110,.12);border:1px solid rgba(255,93,110,.4);padding:2px 7px;border-radius:4px;font-size:11.5px;margin-left:6px;font-weight:700">⚠️ 敵禁你：${UNIT_MAP[b.bannedByB]?.name || b.bannedByB}</span>` : '')}
        </div>
        <div class="mission-actions">
          <button class="btn ghost sm" id="btnExitPvp" style="color:var(--red);border-color:rgba(255,93,110,.3)" title="退出當前線上對戰房間">退出連線 ✕</button>
        </div>`;
    } else {
      h = `<span class="mission-tag" style="background:rgba(255,179,64,.18);color:var(--amber);border-color:rgba(255,179,64,.4);font-weight:800">🏆 BO5 征服賽 · 第 ${b.round}/5 局 (五局三勝制)</span>
        <div class="mission-item" style="background:rgba(255,255,255,.06);padding:3px 10px;border-radius:6px;border:1px solid var(--line2)">
          <span style="font-family:var(--head);font-size:16px;font-weight:800;letter-spacing:.05em">當前比分：<b style="color:var(--cyan);font-size:18px">${b.winsA}</b> <span style="color:var(--muted)">-</span> <b style="color:var(--red);font-size:18px">${b.winsB}</b></span>
          <span class="muted" style="margin-left:10px">對手：<b style="color:var(--text)">${esc(b.rivalName)}</b></span>
          ${(b.bannedListA && b.bannedListA.length) 
            ? b.bannedListA.map(id => `<span style="color:var(--green);background:rgba(93,255,176,.12);border:1px solid rgba(93,255,176,.4);padding:2px 7px;border-radius:4px;font-size:11.5px;margin-left:6px;font-weight:700" title="全系列賽永久禁用">🚫 禁敵：${UNIT_MAP[id]?.name || id}</span>`).join('') 
            : (b.bannedByA ? `<span style="color:var(--green);background:rgba(93,255,176,.12);border:1px solid rgba(93,255,176,.4);padding:2px 7px;border-radius:4px;font-size:11.5px;margin-left:6px;font-weight:700">🚫 禁敵：${UNIT_MAP[b.bannedByA]?.name || b.bannedByA}</span>` : '')}
          ${(b.bannedListB && b.bannedListB.length) 
            ? b.bannedListB.map(id => `<span style="color:var(--red);background:rgba(255,93,110,.12);border:1px solid rgba(255,93,110,.4);padding:2px 7px;border-radius:4px;font-size:11.5px;margin-left:6px;font-weight:700" title="全系列賽永久禁用">⚠️ 敵禁你：${UNIT_MAP[id]?.name || id}</span>`).join('') 
            : (b.bannedByB ? `<span style="color:var(--red);background:rgba(255,93,110,.12);border:1px solid rgba(255,93,110,.4);padding:2px 7px;border-radius:4px;font-size:11.5px;margin-left:6px;font-weight:700">⚠️ 敵禁你：${UNIT_MAP[b.bannedByB]?.name || b.bannedByB}</span>` : '')}
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
    const enemySource = state.customSandEnemy || state.lastBattleEnemy;
    const customOpt = (enemySource && Array.isArray(enemySource.deck) && enemySource.deck.length === 5)
      ? `<option value="custom_enemy" ${state.sandEnemy === 'custom_enemy' ? 'selected' : ''}>🎯 最近對戰敵陣：${esc(enemySource.name)} (${enemySource.deck.map(id => UNIT_MAP[id]?.name?.split(' ')[0] || id).join('·')})</option>`
      : '';
    const lastEventOpt = (enemySource && enemySource.event)
      ? `<option value="last_event" ${state.sandEvent === 'last_event' ? 'selected' : ''}>🎯 最近對戰戰場：${esc(enemySource.event.icon + ' ' + enemySource.event.name)}</option>`
      : '';
    h = `<span class="mission-tag">SANDBOX · 大數據模擬</span>
      <div class="mission-item">
        <span class="muted">對手風格：</span>
        <select class="select sm" id="sandEnemy" style="padding:3px 8px;width:auto;font-size:12px">
          ${customOpt}
          <option value="random" ${state.sandEnemy === 'random' ? 'selected' : ''}>全部風格輪流 (全天候 Meta 壓力測試)</option>
          ${ARCHETYPES.map(a => `<option value="${a.id}" ${state.sandEnemy === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
        </select>
        <span class="muted" style="margin-left:8px">戰場事件：</span>
        <select class="select sm" id="sandEvent" style="padding:3px 8px;width:auto;font-size:12px">
          ${lastEventOpt}
          <option value="all" ${state.sandEvent === 'all' ? 'selected' : ''}>全部事件輪替 (全極端地形氣候)</option>
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
      ${(() => {
        const synHints = typeof getUnitSynergyHints === 'function' ? getUnitSynergyHints(u) : [];
        if (!synHints.length) return '';
        return `<div class="u-tt-synergy-box">${synHints.map(h => `<div class="u-tt-syn-item"><b>${h.icon} ${esc(h.name)}：</b><span>${esc(h.hint)}</span></div>`).join('')}</div>`;
      })()}
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

  // 聯合作戰體系羈絆常駐亮燈指示槽 (Fixed Tactical Indicator Dock)
  const synBar = $('#deckSynergyBar');
  if (synBar) {
    const pickedUnits = state.deck.map(id => id ? UNIT_MAP[id] : null).filter(Boolean);
    const activeSyns = (typeof getDeckSynergies === 'function') ? getDeckSynergies(pickedUnits) : [];
    const activeSynMap = new Set(activeSyns.map(s => s.id));

    // 4 大核心體系常駐指示燈定義 (未激活時暗淡線框，達成時瞬間點亮發光)
    const INDICATOR_DEFS = [
      { id: 'cec', icon: '📡', code: 'CEC', name: '協同接戰', req: '$5高階預警機 ＋ 遠程防空/神盾艦' },
      { id: 'mumt', icon: '🛸', code: 'MUM-T', name: '有人無人', req: '$5五代空優 ＋ 無人機/巡飛彈/快艇' },
      { id: 'asw_net', icon: '🌊', code: 'ASW', name: '海空獵殺', req: '反潛艦/潛艦 ＋ 電戰/前觀校射' },
      { id: 'iron_fist', icon: '⚙️', code: 'LAND', name: '步坦鐵拳', req: '重裝坦克 ＋ 自走砲/前觀校射' }
    ];

    const indicatorsHtml = INDICATOR_DEFS.map(ind => {
      const isLit = activeSynMap.has(ind.id);
      const synObj = activeSyns.find(s => s.id === ind.id);
      const tip = isLit
        ? `【${ind.icon} ${ind.name} (已啟動)】${synObj ? synObj.desc : '體系加成生效中'}`
        : `【${ind.icon} ${ind.name} (待命中)】啟動條件：${ind.req}`;
      return `<div class="syn-indicator ${isLit ? 'lit' : 'idle'}" data-syn-tip="${esc(tip)}" title="${esc(tip)}">
        <span class="ind-icon">${ind.icon}</span>
        <span class="ind-code">${ind.code}</span>
        <i class="ind-dot"></i>
      </div>`;
    }).join('');

    // 電磁戰力常駐平衡指示
    const baseEw = pickedUnits.reduce((acc, u) => acc + (u.ew || 0), 0) + (activeSynMap.has('cec') ? 12 : 0);
    const effEw = Math.round(baseEw * (state.doctrine === 'deception' ? 1.5 : 1));
    let ewClass = 'idle';
    let ewText = `EW ${effEw}`;
    let ewTip = `【📡 電磁戰況】全隊電戰值 ${effEw}`;
    if (pickedUnits.length >= 3) {
      if (effEw < 10) {
        ewClass = 'warn';
        ewTip = `【⚠ 電戰偏弱】全隊電戰值僅 ${effEw}，面對電戰流易遭壓制`;
      } else {
        ewClass = 'strong';
        ewTip = `【⚡ 電磁強勢】全隊電戰值 ${effEw}，可壓制敵方命中並增益火力`;
      }
    }
    const ewHtml = `<div class="syn-indicator ew-ind ${ewClass}" data-syn-tip="${esc(ewTip)}" title="${esc(ewTip)}">
      <span class="ind-icon">${ewClass === 'warn' ? '⚠' : '⚡'}</span>
      <span class="ind-code">${ewText}</span>
      <i class="ind-dot"></i>
    </div>`;

    synBar.innerHTML = `<div class="indicators-dock-wrap">${indicatorsHtml}${ewHtml}</div>`;

    const sheetSyn = $('#sheetSynergyBox');
    if (sheetSyn) {
      sheetSyn.innerHTML = activeSyns.length > 0
        ? activeSyns.map(s => `<span class="syn-chip active" title="${esc(s.desc)}">${s.icon} ${esc(s.name)}</span>`).join('')
        : '<span class="syn-chip muted">請選取裝備以啟動聯合作戰體系羈絆</span>';
    }
  }

  renderPresetsMenus();

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
      btnGo.disabled = false;
      btnGo.classList.remove('status-missing', 'status-error');
      btnGo.classList.toggle('status-ready', state.pvpOpponentReady);
      btnGo.classList.toggle('status-locked', !state.pvpOpponentReady);
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
      if (launchIcon) launchIcon.textContent = state.pvpOpponentReady ? '⚡' : '⏳';
      if (state.pvpOpponentReady) {
        launchTitle.textContent = OnlinePvPEngine.isHostUser() ? '雙方就緒！點擊開戰 ➔' : '雙方就緒，同步開戰中... ➔';
        launchSub.textContent = OnlinePvPEngine.isHostUser() ? '戰場即將展開，亦可手動點擊立即發起' : '等待本部特遣隊發送作戰訊令 (點擊催促)';
      } else {
        launchTitle.textContent = '陣容已鎖定 · 等待對手';
        launchSub.textContent = '對手指揮官配置中... (點擊重新廣播)';
      }
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
  const lState = (typeof LadderEngine !== 'undefined') ? LadderEngine.getState() : null;
  const p = lState ? lState.player : null;
  const myName = p?.name ? esc(p.name) : (playerGhost.callsign || '破浪突擊巡防大隊');
  const myFlag = p?.flag || playerGhost.flag || '🇹🇼';
  const tier = (typeof LadderEngine !== 'undefined' && p)
    ? LadderEngine.getRankTier(p.rp)
    : { name: '四星上將', color: '#fbbf24' };

  if (p && typeof playerGhost !== 'undefined') {
    playerGhost.callsign = p.name;
    playerGhost.rankTitle = tier.name;
    playerGhost.rp = p.rp;
    playerGhost.flag = myFlag;
    LS.set('db15_player_ghost', playerGhost);
  }

  const hudStats = $('#hudStats');
  if (hudStats) {
    hudStats.innerHTML = `
      <span class="chip-stat player-stat-badge" id="hudPlayerBadge" style="cursor:pointer" title="個人軍階戰績與天梯位階：${esc(tier.name)} (${p ? p.rp : 2055} RP) [點擊前往天梯競技]">
        <span style="font-weight:800;color:var(--cyan)">${myFlag} 我方：${myName}</span>
        <span class="badge" style="font-size:10px;padding:1px 6px;background:${tier.color}22;color:${tier.color};border:1px solid ${tier.color}66;font-weight:700">${esc(tier.name)}</span>
      </span>
      <span class="chip-stat" title="你累計的總對戰場次">場次 <b>${stats.played}</b></span>
      <span class="chip-stat" title="你的個人總勝率">勝率 <b>${stats.played ? Math.round(stats.win / stats.played * 100) : 0}%</b></span>
      <span class="chip-stat" title="你的當前連勝場數">連勝 <b>${stats.streak}</b></span>
    `;
  }
}

function renderAll() {
  renderMissionBar();
  renderMatrix();
  renderCommandDeck();
  renderHud();
}

/* ---------- 常用自訂編制與參謀部推薦模板管理 ---------- */
function getCustomPresets() {
  const raw = LS.get('db15_custom_presets', null);
  if (Array.isArray(raw) && raw.length === 3) return raw;
  return [null, null, null];
}

function saveCustomPreset(slotIdx) {
  if (!state.deck.every(Boolean)) {
    toast('⚠️ 請先配置滿 5 個槽位再儲存至自訂編制！');
    return;
  }
  const presets = getCustomPresets();
  const arch = analyzeDeckArchetype(state.deck);
  presets[slotIdx] = {
    name: `${arch.icon} 自訂編制 #${slotIdx + 1}`,
    deck: state.deck.slice(),
    doc: state.doctrine || 'defense',
    cost: spent()
  };
  LS.set('db15_custom_presets', presets);
  renderCommandDeck();
  if (!$('#deckMoreModal')?.hidden) openDeckMoreModal();
  toast(`💾 已將當前陣容儲存至【自訂編制 #${slotIdx + 1}】！`);
}

function applyPresetDeck(ids, doc, label) {
  const cleanIds = (ids || []).map(id => (UNIT_MAP[id] ? id : null));
  if (cleanIds.length !== 5 || !cleanIds.every(Boolean)) {
    toast('⚠️ 編制資料不完整');
    return;
  }
  const banned = currentBanned();
  if (banned.some(b => cleanIds.includes(b))) {
    toast('⚠️ 此編制包含本局已被戰術禁用的裝備，已為你載入可用槽位');
  }
  state.deck = cleanIds.map(id => banned.includes(id) ? null : id);
  if (doc && DOCTRINES.some(d => d.id === doc)) {
    state.doctrine = doc;
  }
  // 確保每個已選單位在矩陣看板中切換到對應 A/B/C/D 型號方便檢視
  state.deck.forEach(id => {
    const u = id ? UNIT_MAP[id] : null;
    if (u && state.variants) state.variants[`${u.cat}_${u.cost}`] = u.v;
  });
  syncActiveDeck();
  renderAll();
  const cm = $('#codeMenu'); if (cm) cm.hidden = true;
  const dm = $('#deckMoreModal'); if (dm) dm.hidden = true;
  toast(`⚡ 已套用編制：【${label}】`);
}

function renderPresetsMenus() {
  const customBox = $('#customPresetsMenuBox');
  const tplBox = $('#templatePresetsMenuBox');
  const presets = getCustomPresets();

  if (customBox) {
    customBox.innerHTML = presets.map((p, idx) => {
      if (!p || !Array.isArray(p.deck)) {
        return `<div class="preset-menu-row">
          <span class="preset-empty-txt">槽位 #${idx + 1} (尚未儲存)</span>
          <button type="button" class="btn-micro" data-save-preset="${idx}">💾 存入當前</button>
        </div>`;
      }
      const unitNames = p.deck.map(id => UNIT_MAP[id]?.name?.split(' ')[0] || id).join('·');
      return `<div class="preset-menu-row">
        <button type="button" class="preset-load-btn" data-load-custom="${idx}" title="點擊套用：${esc(unitNames)}">
          <b>${esc(p.name)} ($${p.cost || 15})</b>
          <small>${esc(unitNames)}</small>
        </button>
        <button type="button" class="btn-micro" data-save-preset="${idx}" title="覆蓋儲存當前陣容">覆蓋</button>
      </div>`;
    }).join('');
  }

  if (tplBox && typeof TEMPLATES !== 'undefined') {
    tplBox.innerHTML = TEMPLATES.map((t, idx) => {
      const unitNames = t.ids.map(id => UNIT_MAP[id]?.name?.split(' ')[0] || id).join('·');
      return `<button type="button" class="menu-item preset-tpl-btn" data-load-tpl="${idx}">
        <div><b>🎖️ ${esc(t.name)}</b> <small class="muted">(${esc(t.note)})</small></div>
        <div class="preset-sub-units">${esc(unitNames)}</div>
      </button>`;
    }).join('');
  }
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
    ${(() => {
      const synHints = typeof getUnitSynergyHints === 'function' ? getUnitSynergyHints(u) : [];
      if (!synHints.length) return '';
      return `<div class="sheet-label">聯合作戰體系羈絆搭檔</div>
      <div class="sheet-synergy-hints">${synHints.map(h => `<div class="sheet-syn-hint-item"><b>${h.icon} ${esc(h.name)}</b><span>${esc(h.hint)}</span></div>`).join('')}</div>`;
    })()}
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
  const sheetPresets = $('#sheetPresetsBox');
  if (sheetPresets) {
    const presets = getCustomPresets();
    const customHtml = presets.map((p, idx) => {
      if (!p || !Array.isArray(p.deck)) {
        return `<div class="preset-menu-row"><span class="preset-empty-txt">自訂編制 #${idx + 1} (空)</span><button type="button" class="btn-micro" data-save-preset="${idx}">💾 儲存當前</button></div>`;
      }
      const uNames = p.deck.map(id => UNIT_MAP[id]?.name?.split(' ')[0] || id).join('·');
      return `<div class="preset-menu-row"><button type="button" class="preset-load-btn" data-load-custom="${idx}"><b>${esc(p.name)}</b><small>${esc(uNames)}</small></button><button type="button" class="btn-micro" data-save-preset="${idx}">覆蓋</button></div>`;
    }).join('');
    const tplHtml = (typeof TEMPLATES !== 'undefined' ? TEMPLATES : []).map((t, idx) =>
      `<button type="button" class="btn ghost sm" data-load-tpl="${idx}" style="font-size:12px">⚡ ${esc(t.name)}</button>`
    ).join('');
    sheetPresets.innerHTML = `<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px">${customHtml}</div><div style="display:flex;flex-wrap:wrap;gap:6px">${tplHtml}</div>`;
  }
  const sheetSyn = $('#sheetSynergyBox');
  const mainSyn = $('#deckSynergyBar');
  if (sheetSyn && mainSyn) {
    sheetSyn.innerHTML = mainSyn.innerHTML || '<span class="syn-chip muted">請先選取裝備以檢視羈絆與戰術診斷</span>';
  }
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
  const synTipEl = e.target.closest('[data-syn-tip]');
  if (synTipEl) {
    toast(synTipEl.dataset.synTip);
    return;
  }
  if (e.target.id === 'deckMoreModal' || e.target.id === 'btnDeckSheetClose') {
    $('#deckMoreModal').hidden = true;
    return;
  }
  const savePresetBtn = e.target.closest('[data-save-preset]');
  if (savePresetBtn) {
    saveCustomPreset(+savePresetBtn.dataset.savePreset);
    return;
  }
  const loadCustomBtn = e.target.closest('[data-load-custom]');
  if (loadCustomBtn) {
    const p = getCustomPresets()[+loadCustomBtn.dataset.loadCustom];
    if (p) applyPresetDeck(p.deck, p.doc, p.name);
    return;
  }
  const loadTplBtn = e.target.closest('[data-load-tpl]');
  if (loadTplBtn && typeof TEMPLATES !== 'undefined') {
    const t = TEMPLATES[+loadTplBtn.dataset.loadTpl];
    if (t) applyPresetDeck(t.ids, state.doctrine, t.name);
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
  const synTipEl = e.target.closest('[data-syn-tip]');
  if (synTipEl) {
    toast(synTipEl.dataset.synTip);
    return;
  }
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
  const savePresetBtn = e.target.closest('[data-save-preset]');
  if (savePresetBtn) {
    e.stopPropagation();
    saveCustomPreset(+savePresetBtn.dataset.savePreset);
    return;
  }
  const loadCustomBtn = e.target.closest('[data-load-custom]');
  if (loadCustomBtn) {
    const p = getCustomPresets()[+loadCustomBtn.dataset.loadCustom];
    if (p) applyPresetDeck(p.deck, p.doc, p.name);
    return;
  }
  const loadTplBtn = e.target.closest('[data-load-tpl]');
  if (loadTplBtn && typeof TEMPLATES !== 'undefined') {
    const t = TEMPLATES[+loadTplBtn.dataset.loadTpl];
    if (t) applyPresetDeck(t.ids, state.doctrine, t.name);
    return;
  }
  if (e.target.closest('#btnCodeToggle')) {
    renderPresetsMenus();
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

// 點擊頂部玩家資訊徽章平滑前往天梯競技
$('#hudStats')?.addEventListener('click', e => {
  if (e.target.closest('#hudPlayerBadge')) {
    setMode('ladder');
  }
});

function setMode(m) {
  // 無論何時點選上方功能列（即使在戰鬥中或檢視戰場情形），立即乾淨退出戰鬥
  exitActiveBattle();

  // 若從線上雙人對戰切換至其他模式，安全關閉連線並重置狀態
  if (m !== 'bo3' && state.isOnlinePvp) {
    OnlinePvPEngine.closeConnection();
    state.isOnlinePvp = false;
    state.pvpMyReady = false;
    state.pvpOpponentReady = false;
    state.pvpOpponentDeck = null;
  }

  // 相容舊 ghost 模式：自動映射至快速對戰之幽靈子模式
  if (m === 'ghost') {
    m = 'quick';
    state.quickSubMode = 'ghost';
  }

  const prevMode = state.mode;
  state.mode = m; state.sandResult = null; state.scout = false;
  document.querySelectorAll('.mode-btn').forEach(x => {
    const isAct = x.dataset.mode === m;
    x.classList.toggle('active', isAct);
    if (isAct && window.innerWidth <= 960 && typeof x.scrollIntoView === 'function') {
      try { x.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }); } catch (e) {}
    }
  });
  
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
    renderHud();
    toast('🏆 已進入天梯競技場：挑戰全球王牌防線，爭奪特級上將席位！');
    const p = LadderEngine.getState().player;
    if (!p.hasCustomName && !localStorage.getItem('topclash_callsign_set')) {
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
    renderHud();
    toast('🥇 已進入世界盃淘汰錦標賽：4/8/16/32 強世足樹狀爭霸戰！');
    const p = LadderEngine.getState().player;
    if (!p.hasCustomName && !localStorage.getItem('topclash_callsign_set')) {
      setTimeout(() => openCommanderModal(), 400);
    }
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
    if (state.lastBattleEnemy && !state.customSandEnemy) {
      state.customSandEnemy = {
        name: state.lastBattleEnemy.name,
        deck: state.lastBattleEnemy.deck.slice(),
        doc: state.lastBattleEnemy.doc,
        event: state.lastBattleEnemy.event
      };
    }
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
let currentRosterTab = 'zone'; // 'live', 'zone', 或 'yesterday'

function renderLadderTargetsTray() {
  const section = $('#ladderTargetsSection');
  if (!section || typeof LadderEngine === 'undefined') return;
  const lState = LadderEngine.getState();
  const player = lState.player;
  const targets = (LadderEngine.getChallengeableTargets && LadderEngine.getChallengeableTargets()) || [];

  const rankRangeEl = $('#targetRankRange');
  const scrollMyRankEl = $('#btnScrollMyRank');
  if (scrollMyRankEl) scrollMyRankEl.textContent = player.rank;

  if (targets.length === 0) {
    if (rankRangeEl) rankRangeEl.textContent = player.rank === 1 ? '您已登頂榜首' : '暫無可挑戰目標';
    const grid = $('#targetsCardGrid');
    if (grid) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:16px;color:#94a3b8;font-size:13px">
        ${player.rank === 1 ? '👑 恭喜登頂天梯榜首！您是全服頂尖戰略指揮官，請駐防守衛您的榮譽席位！' : '目前前方無可挑戰之席位。'}
      </div>`;
    }
    return;
  }

  const minRank = targets[targets.length - 1].rank;
  const maxRank = targets[0].rank;
  if (rankRangeEl) {
    rankRangeEl.textContent = minRank === maxRank ? `#${minRank}` : `#${minRank} ~ #${maxRank}`;
  }

  const grid = $('#targetsCardGrid');
  if (!grid) return;

  grid.innerHTML = targets.map(u => {
    const tier = LadderEngine.getRankTier(u.rp);
    const streak = u.streakDays || 1;
    const isBreaker = streak >= 3;
    const docObj = DOCTRINES.find(d => d.id === (u.defenseDoc || u.doc || 'defense')) || DOCTRINES[1];
    const rpDiff = u.rp - player.rp;

    const deckChipsHtml = (u.deck || []).map((id, slotIdx) => {
      const unit = UNIT_MAP[id];
      // 戰術電戰迷霧：僅公開第 1 槽（旗艦），後 4 槽完全受密電遮蔽
      const isMasked = slotIdx >= 1;
      if (isMasked) {
        return `<div class="r-deck-chip masked" title="受戰術電戰迷霧遮蔽：未知武器裝備">
          <span class="chip-mask-q">?</span>
        </div>`;
      }
      if (!unit) return '<div class="r-deck-chip"></div>';
      return `<div class="r-deck-chip" title="${esc(unit.name)} ($${unit.cost})">
        <img src="${unit.img || `assets/units/${unit.id}.jpg`}" alt="${esc(unit.name)}" onerror="this.style.display='none'"/>
        <span class="chip-cost">$${unit.cost}</span>
      </div>`;
    }).join('');

    return `<div class="target-card ${isBreaker ? 'breaker-bonus' : ''}">
      <div class="t-card-left">
        <span class="t-card-rank">#${u.rank}</span>
        <span style="font-size:15px">${u.flag || '🌐'}</span>
        <div class="t-commander-info">
          <div class="t-name-row">
            <span class="t-commander-name" title="${esc(u.name)}">${esc(u.name)}</span>
            ${isBreaker ? `<span class="t-card-streak" title="守位 >= 3 天，擊破額外獲得 +15 RP 終結者加成！">👑 守位${streak}天 (+15)</span>` : ''}
          </div>
          <div class="t-commander-meta">
            <span style="color:${tier.color};font-weight:700">${tier.name}</span>
            <span>${u.rp.toLocaleString()} RP</span>
            <span class="doctrine-secret" style="font-size:10px;color:#94a3b8" title="戰略保密教條">🔒 戰術保密</span>
          </div>
        </div>
      </div>
      <div class="t-card-right">
        <div class="t-deck-chips">${deckChipsHtml}</div>
        <button type="button" class="btn-ladder-engage t-card-btn" data-target-rank="${u.rank}" data-target-id="${u.id}">
          ⚔️ 挑戰
        </button>
      </div>
    </div>`;
  }).join('');
}


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
      const stars = Array.from(iconStr.replace(/\s+/g, ''));
      const starsHtml = stars.map(s => `<span class="star-chip">${s}</span>`).join('');
      myTierBadge.innerHTML = `<div class="tier-stars-box stars-${starCount}">${starsHtml}</div>`;
    } else {
      myTierBadge.innerHTML = `<div class="tier-stars-box single"><span class="star-chip">${iconStr}</span></div>`;
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
  const scrollMyRankEl = $('#btnScrollMyRank');
  if (scrollMyRankEl) scrollMyRankEl.textContent = player.rank;

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

  // 防守部隊預覽與 AI 駐防戰術教條自選
  const defDeck = player.defenseDeck || state.deck;
  const defDoc = player.defenseDoc || state.doctrine || 'defense';
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
  const defDocRow = $('#defenseDocRow');
  if (defDocRow) {
    defDocRow.innerHTML = `
      <div class="doc-segmented-head">
        <span class="doc-seg-label" style="white-space:nowrap">駐防 AI 戰術教條</span>
        <span class="doc-seg-hint">（防守時自動執行）</span>
      </div>
      <div class="doc-segmented-grid">
        ${DOCTRINES.map(d => {
          const isActive = defDoc === d.id;
          return `<button type="button" class="doc-seg-btn ${isActive ? 'active-def-doc' : ''}" data-def-doc="${d.id}" title="點擊切換駐防教條：${esc(d.desc)}">
            <span class="doc-seg-icon">${d.icon}</span>
            <span class="doc-seg-name">${esc(d.name)}</span>
          </button>`;
        }).join('')}
      </div>`;
  }

  // 1.5 渲染今日天梯戰區天候橫幅
  const dailyTheater = (LadderEngine.getDailyTheater && LadderEngine.getDailyTheater()) || (typeof EVENTS !== 'undefined' && EVENTS[0]);
  if (dailyTheater) {
    const tIcon = $('#theaterIcon');
    if (tIcon) tIcon.textContent = dailyTheater.icon || '⚡';
    const tName = $('#theaterName');
    if (tName) tName.textContent = dailyTheater.name || '戰區環境';
    const tDesc = $('#theaterDesc');
    if (tDesc) tDesc.textContent = `${dailyTheater.desc}（今日全服天梯攻防對局均在此環境下推演！）`;
  }

  // 2. 渲染上方可挑戰目標托盤
  renderLadderTargetsTray();

  // 3. 渲染階梯天梯榜 (支援全榜與戰區頁籤)
  renderLadderRosterTable();
}

function renderLadderRosterTable() {
  const tableBox = $('#rosterTableBox');
  if (!tableBox) return;
  const lState = LadderEngine.getState();
  const player = lState.player;

  const isLive = currentRosterTab === 'live' || currentRosterTab === 'zone';
  let list = [];
  if (currentRosterTab === 'zone') {
    list = (LadderEngine.getRosterZone && LadderEngine.getRosterZone()) || LadderEngine.getRosterTop30();
  } else if (currentRosterTab === 'yesterday') {
    list = lState.yesterdayTop10;
  } else {
    list = (LadderEngine.getRosterTop10 ? LadderEngine.getRosterTop10() : LadderEngine.getRosterTop30().slice(0, 10));
  }

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

    // 防守陣容預覽 (非我方對手僅公開 Slot 0 旗艦機，後 4 槽全部密電遮蔽；我方席位完整顯示自身防禦陣容)
    const userDeck = u.deck || u.defenseDeck || (isMe ? (player.defenseDeck || state.deck) : []);
    const deckChipsHtml = (userDeck || []).map((id, slotIdx) => {
      const unit = UNIT_MAP[id];
      const isMasked = !isMe && slotIdx >= 1;
      if (isMasked) {
        return `<div class="r-deck-chip masked" title="受戰術電戰迷霧遮蔽：未知武器裝備">
          <span class="chip-mask-q">?</span>
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
        <span class="r-flag">${u.flag}</span>
        <div class="r-name-block">
          <span class="r-name">${esc(u.name)} ${isMe ? `<span class="r-my-tag">我方 ${esc(u.uid || player.uid || 'CMD-7392')}</span>` : ''}</span>
          <span class="r-title-sub">${esc(u.title || '戰區指揮官')} · <b style="color:${tier.color}">${tier.name}</b> · ${isMe ? `<span style="color:var(--cyan);font-size:10.5px" title="我方駐防教條">${(() => { const dObj = DOCTRINES.find(d => d.id === (u.defenseDoc || u.doc || 'defense')) || DOCTRINES[1]; return dObj.icon + ' ' + dObj.name; })()}</span>` : `<span class="doctrine-secret" style="font-size:10.5px;color:#94a3b8" title="敵方駐防戰術教條（先發制人 / 縱深防禦 / 電子欺敵）保密中，進場推演時解密">🔒 戰術保密</span>`}</span>
        </div>
      </div>
      <div class="r-rp">${u.rp.toLocaleString()} <small>RP</small></div>
      <div class="r-deck-preview">${deckChipsHtml}</div>
      <div class="r-action">${actionColHtml}</div>
    </div>`;
  }).join('');
}

// 天梯操作事件代理
// 淘汰錦標賽點擊事件
document.addEventListener('click', e => {
  if (e.target.closest('#btnGoBuildFromTourney')) {
    setMode('battle');
    toast('🛠️ 已切換至戰備指揮所！調整完成後點擊頂部【🥇 淘汰錦標賽】即可即時參賽！');
  }
});

$('#viewLadder')?.addEventListener('click', e => {
  // 0. 切換天梯駐防 AI 戰術教條
  const defDocBtn = e.target.closest('[data-def-doc]');
  if (defDocBtn) {
    const newDoc = defDocBtn.dataset.defDoc;
    const lState = LadderEngine.getState();
    const curDeck = lState.player.defenseDeck || (state.deck.every(Boolean) ? state.deck : ['F16V', 'M1A2', 'NASAMS', 'TJ', 'TB2']);
    LadderEngine.setDefenseFleet(curDeck, newDoc);
    renderLadderView();
    const dObj = DOCTRINES.find(d => d.id === newDoc);
    toast(`🛡️ 已將天梯駐防 AI 戰術教條切換為：【${dObj ? dObj.icon + ' ' + dObj.name : newDoc}】！`);
    return;
  }

  // 0.5 一鍵跳轉至戰備指揮所 (快速對戰編制區)
  if (e.target.closest('#btnGoBuildFromLadder')) {
    setMode('battle');
    toast('🛠️ 已切換至戰備指揮所！調整完成後點擊頂部【🏆 天梯競技】即可即時出征！');
    return;
  }

  // 1. 同步當前陣容為特遣部隊
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

  // 2. 切換即時榜 vs 戰區席位 vs 昨日榮譽榜
  if (e.target.closest('#tabRosterZone')) {
    currentRosterTab = 'zone';
    $('#tabRosterZone')?.classList.add('active');
    $('#tabRosterLive')?.classList.remove('active');
    $('#tabRosterYesterday')?.classList.remove('active');
    renderLadderRosterTable();
    return;
  }
  if (e.target.closest('#tabRosterLive')) {
    currentRosterTab = 'live';
    $('#tabRosterLive')?.classList.add('active');
    $('#tabRosterZone')?.classList.remove('active');
    $('#tabRosterYesterday')?.classList.remove('active');
    renderLadderRosterTable();
    return;
  }
  if (e.target.closest('#tabRosterYesterday')) {
    currentRosterTab = 'yesterday';
    $('#tabRosterYesterday')?.classList.add('active');
    $('#tabRosterLive')?.classList.remove('active');
    $('#tabRosterZone')?.classList.remove('active');
    renderLadderRosterTable();
    return;
  }

  // 2.1 定位我的天梯席位 (#btnScrollToMe)
  if (e.target.closest('#btnScrollToMe')) {
    if (currentRosterTab === 'yesterday') {
      currentRosterTab = 'live';
      $('#tabRosterLive')?.classList.add('active');
      $('#tabRosterZone')?.classList.remove('active');
      $('#tabRosterYesterday')?.classList.remove('active');
      renderLadderRosterTable();
    }
    setTimeout(() => {
      const myRow = document.querySelector('.roster-row.is-me');
      if (myRow) {
        myRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        myRow.classList.remove('highlight-me');
        void myRow.offsetWidth;
        myRow.classList.add('highlight-me');
        setTimeout(() => myRow.classList.remove('highlight-me'), 2500);
        toast(`📍 已精確定位至我方天梯席位 (#${LadderEngine.getState().player.rank})！`);
      } else {
        toast(`📍 我方席位為 #${LadderEngine.getState().player.rank}，已切換顯示！`);
      }
    }, 60);
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
    state.enemyDoc = targetUser.defenseDoc || targetUser.doc || 'defense';
    state.event = (LadderEngine.getDailyTheater && LadderEngine.getDailyTheater()) || pick(EVENTS);

    // 關閉天梯視圖，切換至對戰視圖開始推演
    $('#viewLadder').hidden = true;
    startBattle();
    toast(`⚔️ 已向第 #${targetUser.rank} 名【${targetUser.name}】發起突擊！戰區：【${state.event.icon} ${state.event.name}】`);
    return;
  }

  // 4. 自訂指揮官呼號與旗幟
  if (e.target.closest('#btnEditCallsign') || e.target.closest('#myCallsign')) {
    openCommanderModal();
    return;
  }
});

/* ---------- 🎖️ 程序化軍規呼號生成矩陣 (超過 300 萬種戰術組合，保證 100% 零重複) ---------- */
const CALLSIGN_PREFIXES = [
  '黑貓', '海狼', '雷霆', '幽靈', '長弓', '天弓', '神盾', '深淵', '極光', '暴風',
  '戰隼', '赤焰', '遊騎', '堡壘', '鐵騎', '蒼穹', '白虎', '玄武', '刺客', '影狼',
  '烈陽', '夜梟', '破浪', '幻影', '龍騎', '星芒', '獵豹', '黑曜', '蒼鷹', '紫電',
  '天火', '鋼雨', '怒濤', '逆火', '追風', '迅雷', '鋒刃', '天狼', '雄鷹', '劍齒'
];
const CALLSIGN_TYPES = [
  '匿蹤', '夜襲', '重裝', '制空', '特勤', '防空', '反潛', '電磁', '機動', '突擊',
  '戰術', '快反', '先鋒', '縱深', '伏擊', '海巡', '衛戍', '偵搜', '穿甲', '防衛'
];
const CALLSIGN_ECHELONS = [
  '特遣隊', '作戰群', '打擊旅', '先鋒營', '特巡連', '突擊隊', '巡防大隊', '中隊', '第7聯隊', '防衛軍'
];

function generateProceduralCallsign(existingNames = []) {
  const existingSet = new Set((existingNames || []).map(n => (n || '').trim()));
  for (let attempt = 0; attempt < 200; attempt++) {
    const p = CALLSIGN_PREFIXES[Math.floor(Math.random() * CALLSIGN_PREFIXES.length)];
    const t = CALLSIGN_TYPES[Math.floor(Math.random() * CALLSIGN_TYPES.length)];
    const e = CALLSIGN_ECHELONS[Math.floor(Math.random() * CALLSIGN_ECHELONS.length)];
    const candidate = `${p}${t}${e}`;
    if (!existingSet.has(candidate) && (typeof LadderEngine === 'undefined' || !LadderEngine.isCallsignTaken || !LadderEngine.isCallsignTaken(candidate, true))) {
      return candidate;
    }
  }
  const num = Math.floor(10 + Math.random() * 90);
  return `${CALLSIGN_PREFIXES[Math.floor(Math.random() * CALLSIGN_PREFIXES.length)]}第${num}特遣隊`;
}

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
    if (!p.hasCustomName || !p.name || p.name === '我方聯合戰術作戰群' || p.name === '我方特遣隊') {
      nameInput.value = generateProceduralCallsign();
    } else {
      nameInput.value = p.name;
    }
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
  const rName = generateProceduralCallsign();
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
  localStorage.setItem('topclash_callsign_set', '1');
  localStorage.setItem('topclash_auto_callsign', result.name);
  $('#commanderModal').hidden = true;
  currentActiveModal = null;
  renderLadderView();
  renderHud();
  if (state.mode === 'tournament') {
    renderTournamentView();
  }
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
  if (typeof LadderEngine !== 'undefined' && LadderEngine.setDefenseFleet) {
    LadderEngine.setDefenseFleet(state.deck.slice(), state.doctrine);
  }
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

  // 1. 取得對手風格群（支援指定對戰敵方陣容 custom_enemy）
  const enemySource = (state.sandEnemy === 'custom_enemy') ? (state.customSandEnemy || state.lastBattleEnemy) : null;
  const isCustomEnemy = enemySource && Array.isArray(enemySource.deck) && enemySource.deck.length === 5;
  const archs = isCustomEnemy
    ? [{ id: 'custom_enemy', name: `指定敵陣 (${enemySource.name})`, customDeck: enemySource.deck, customDoc: enemySource.doc }]
    : (state.sandEnemy === 'random' ? ARCHETYPES : [ARCHETYPES.find(a => a.id === state.sandEnemy)].filter(Boolean));
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
    const enemyDeck = a.customDeck ? a.customDeck.slice() : buildFromPlan(a.plan, mulberry32(baseSeed + k * 17 + 3));
    const eventTarget = (state.sandEvent === 'all') 
      ? null 
      : (state.sandEvent === 'last_event' && enemySource && enemySource.event)
        ? enemySource.event
        : (EVENTS.find(e => e.id === state.sandEvent) || null);

    const r = simulate(deck, enemyDeck, per, {
      docA: state.doctrine,
      docB: a.customDoc || null,
      seed: (baseSeed + k * 997) >>> 0,
      event: eventTarget
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
          <span class="mission-tag" style="font-size:11px;color:${state.sandEnemy === 'custom_enemy' ? 'var(--cyan)' : 'var(--amber)'};border-color:currentColor">
            ${state.sandEnemy === 'custom_enemy' ? '🎯 指定單一對手專項反制' : '🌐 全天候 6 大流派 Meta 壓力盲測'}
          </span>
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
      <div style="margin-bottom:10px;padding:8px 12px;border-radius:8px;font-size:12px;line-height:1.5;background:rgba(255,255,255,0.03);border:1px solid var(--line2)">
        ${state.sandEnemy === 'custom_enemy'
          ? '🎯 <b>專項對決模式</b>：本測試針對【' + esc((state.customSandEnemy || state.lastBattleEnemy)?.name || '指定假想敵') + '】進行 300 場確定性迭代，排除單場暴擊或閃避波動，反映點對點真實剋制勝率。'
          : '🌐 <b>全天候 Meta 壓力測試說明</b>：大數據推演會在 300 場中輪番經受 6 大極端氣候地形與 6 種不同假想敵流派（重裝、空優、刺蝟、電戰等）考驗。若陣容偏向特定戰術，在天敵流派與劣勢地形下勝率會受到壓制，因此<b>全天候綜合勝率通常會低於針對單一對手的實戰勝率</b>。若欲驗證剛才快速對戰的點對點勝率，可於上方切換對手為「🎯 最近對戰敵陣」。'}
      </div>
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
  if (state.enemy && state.enemy.length === 5) {
    state.lastBattleEnemy = {
      name: state.enemyName || '最近交鋒對手',
      deck: state.enemy.slice(),
      doc: state.enemyDoc || 'defense',
      event: state.event || null
    };
  }
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

  let titleHtml = '';
  if (state.isOnlinePvp) {
    const isHost = OnlinePvPEngine.isHostUser();
    const opp = OnlinePvPEngine.getOpponent();
    const player = LadderEngine.getState().player;
    const myName = (player && player.name && player.name !== '我方聯合戰術作戰群') ? player.name : (isHost ? '本部特遣隊' : '挑戰突擊隊');
    const myFlag = player?.flag || '🇹🇼';
    const oppName = (opp && opp.name && opp.name !== '我方聯合戰術作戰群') ? opp.name : (isHost ? '挑戰突擊隊' : '本部特遣隊');
    const oppFlag = opp?.flag || '🌐';

    if (side === 'A') {
      // 本部特遣隊在左 (Side A)
      titleHtml = isHost
        ? `👑 本部特遣隊 (我方) ▸ ${myFlag} ${esc(myName)}`
        : `👑 本部特遣隊 (敵方) ▸ ${oppFlag} ${esc(oppName)}`;
    } else {
      // 挑戰突擊隊在右 (Side B)
      titleHtml = isHost
        ? `🎯 挑戰突擊隊 (敵方) ▸ ${oppFlag} ${esc(oppName)}`
        : `🎯 挑戰突擊隊 (我方) ▸ ${myFlag} ${esc(myName)}`;
    }
  } else {
    titleHtml = side === 'A' ? '我 方 ▸ 友軍編組' : '敵 方 ▸ ' + esc(state.enemyName || '敵軍特遣部隊');
  }

  return `<h3><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${titleHtml}</span><span style="font-size:11px;font-family:var(--mono);color:${costColor};font-weight:700;flex:none;margin-left:6px" title="${side === 'B' && totalCost > 15 ? '精選對戰超標預算陣容' : '作戰總預算'}">${budgetLabel}</span></h3>` + units.map(u => {
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
  const token = ++playToken; skip = false; paused = false;
  $('#viewBuild').hidden = true;
  $('#missionBar').hidden = true;
  $('#commandDeck').hidden = true;
  const viewLadder = $('#viewLadder'); if (viewLadder) viewLadder.hidden = true;
  const viewTournament = $('#viewTournament'); if (viewTournament) viewTournament.hidden = true;
  hideTooltip();
  $('#viewBattle').hidden = false;
  $('#resultModal').hidden = true;
  if ($('#btnPause')) {
    $('#btnPause').hidden = false;
    $('#btnPause').textContent = '⏸ 暫停';
    $('#btnPause').classList.remove('active');
  }
  $('#btnSpeed').hidden = false;
  $('#btnSpeed').textContent = '速度 ×' + speed;
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
  let metaHtml = `<span class="chip-stat">${res.ev.icon} <b>${esc(res.ev.name)}</b></span>`;
  if (state.isOnlinePvp) {
    metaHtml = `<span class="chip-stat" style="color:var(--amber)">BO5 第 ${state.bo3.round}/5 局 (比分: 本部特遣隊 ${state.bo3.winsA} - 挑戰突擊隊 ${state.bo3.winsB})</span>` + metaHtml;
    metaHtml += `<span class="chip-stat">本部特遣隊教條 <b>${dn(res.docs.A)}</b></span><span class="chip-stat">挑戰突擊隊教條 <b>${dn(res.docs.B)}</b></span>`;
  } else {
    metaHtml += `<span class="chip-stat">我方教條 <b>${dn(res.docs.A)}</b></span><span class="chip-stat">敵方教條 <b>${dn(res.docs.B)}</b></span>`;
    if (state.mode === 'bo3') {
      metaHtml = `<span class="chip-stat" style="color:var(--amber)">BO5 第 ${state.bo3.round}/5 局 (${state.bo3.winsA} - ${state.bo3.winsB})</span>` + metaHtml;
    }
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

  // 2. 判定武器視覺與聲學類型 (7 大軍武專屬類型)
  let wType = 'missile';
  if (aUnit) {
    if (ln.brevity === 'SEAD' || aUnit.sfx === 'emp_pulse' || (aUnit.cat === 'support' && /預警|電戰|咆哮者|干擾/.test(aUnit.name + (aUnit.weapon || '')))) {
      wType = 'ew';
    } else if (ln.brevity === 'SABOT' || aUnit.sfx === 'heavy_cannon') {
      wType = 'sabot';
    } else if (aUnit.sfx === 'cannon' || aUnit.sfx === 'flak') {
      wType = 'autocannon';
    } else if (aUnit.sfx === 'rocket_salvo') {
      wType = 'salvo';
    } else if (aUnit.sfx === 'torpedo' || (aUnit.cat === 'naval' && /潛艦|魚雷/.test(aUnit.role + (aUnit.weapon || '')))) {
      wType = 'torpedo';
    } else if (aUnit.sfx === 'swarm') {
      wType = 'swarm';
    } else {
      wType = 'missile';
    }
  }

  // 觸發開火音效 (帶陣營立體聲方位與戶外戰場殘響)
  if (aUnit) {
    const sfxToPlay = wType === 'ew' ? 'emp_pulse' : (aUnit.sfx || 'missile');
    SoundEngine.play(sfxToPlay, ln.side);
  }

  // 3. 卡片高亮連動與開火後座力
  if (aEl) {
    aEl.classList.remove('active-attacker');
    void aEl.offsetWidth;
    aEl.classList.add('active-attacker');
    setTimeout(() => aEl.classList.remove('active-attacker'), 380 / speed);

    const recoilClass = ln.side === 'A' ? 'fire-recoil-a' : 'fire-recoil-b';
    aEl.classList.remove('fire-recoil-a', 'fire-recoil-b');
    void aEl.offsetWidth;
    aEl.classList.add(recoilClass);
    setTimeout(() => aEl.classList.remove(recoilClass), 320 / speed);
  }
  if (tEl) {
    tEl.classList.remove('active-target');
    void tEl.offsetWidth;
    tEl.classList.add('active-target');
    setTimeout(() => tEl.classList.remove('active-target'), 380 / speed);
  }

  if (!tEl) return;

  const layerRect = fxLayer.getBoundingClientRect();
  const tRect = tEl.getBoundingClientRect();
  const tx = tRect.left + tRect.width / 2 - layerRect.left;
  const ty = tRect.top + tRect.height / 2 - layerRect.top;

  // 目標卡片浮現軍規火控鎖定準星 (Tactical HUD Lock Reticle)
  spawnLockReticle(tx, ty, wType);

  // 4. 7 大兵種實體 SVG 武器模型與物理彈道動畫
  if (aEl) {
    const aRect = aEl.getBoundingClientRect();
    const ax = (ln.side === 'A' ? aRect.right - 12 : aRect.left + 12) - layerRect.left;
    const ay = aRect.top + aRect.height / 2 - layerRect.top;
    const dx = tx - ax, dy = ty - ay;
    const dist = Math.hypot(dx, dy);
    const baseAngle = Math.atan2(dy, dx) * 180 / Math.PI;
    const sideColor = ln.side === 'A' ? '#3de0ff' : '#ff5d6e';

    // 開火端砲口爆閃 / 垂發白煙特效
    spawnMuzzleFx(ax, ay, baseAngle, wType, sideColor);

    if (wType === 'ew') {
      // 【類型 7：全息電磁脈衝波束與反輻射壓制】
      spawnEwBeam(ax, ay, tx, ty, dist, baseAngle, sideColor);
      setTimeout(() => triggerImpact(), Math.max(90, 170 / speed));

    } else if (wType === 'autocannon') {
      // 【類型 4：30mm 鏈砲 / 方陣快砲密集曳光彈幕流 (5連發高速彈鏈)】
      const burstCount = 5;
      for (let i = 0; i < burstCount; i++) {
        setTimeout(() => {
          if (skip) return;
          const spreadY = (Math.random() - 0.5) * 22;
          const spreadX = (Math.random() - 0.5) * 16;
          launchSingleProjectile({
            ax, ay: ay + (Math.random() - 0.5) * 8,
            tx: tx + spreadX, ty: ty + spreadY,
            wType: 'autocannon', arcHeight: 0, waveAmp: 0,
            dur: Math.max(55, 115 / speed),
            side: ln.side,
            onHit: i === burstCount - 1 ? () => triggerImpact() : () => spawnMiniSparks(tx + spreadX, ty + spreadY)
          });
        }, (i * 26) / speed);
      }

    } else if (wType === 'salvo') {
      // 【類型 3：海馬斯 / 多管火箭 / 巡弋飛彈波次高拋物線飽和齊射 (3枚交錯彈道)】
      const salvoCount = 3;
      for (let i = 0; i < salvoCount; i++) {
        setTimeout(() => {
          if (skip) return;
          const offX = (i - 1) * 14;
          const offY = (i - 1) * 10;
          launchSingleProjectile({
            ax, ay,
            tx: tx + offX, ty: ty + offY,
            wType: 'salvo',
            arcHeight: -Math.min(115, dist * 0.24) - i * 22,
            waveAmp: 0,
            dur: Math.max(110, (240 + i * 25) / speed),
            side: ln.side,
            onHit: i === salvoCount - 1
              ? () => triggerImpact()
              : () => spawnExplosion(tx + offX, ty + offY, false, 'salvo', 0.65)
          });
        }, (i * 42) / speed);
      }

    } else if (wType === 'swarm') {
      // 【類型 6：自殺無人機 / 巡飛彈三角翼蜂群編隊 (3架螺旋蛇行突防)】
      const droneCount = 3;
      for (let i = 0; i < droneCount; i++) {
        setTimeout(() => {
          if (skip) return;
          launchSingleProjectile({
            ax, ay: ay + (i - 1) * 14,
            tx: tx + (i - 1) * 8, ty: ty + (i - 1) * 8,
            wType: 'swarm',
            arcHeight: (i - 1) * 26,
            waveAmp: (i % 2 === 0 ? 1 : -1) * 14,
            dur: Math.max(120, 250 / speed),
            side: ln.side,
            onHit: i === droneCount - 1
              ? () => triggerImpact()
              : () => spawnMiniSparks(tx + (i - 1) * 8, ty + (i - 1) * 8)
          });
        }, (i * 35) / speed);
      }

    } else if (wType === 'sabot') {
      // 【類型 1：120mm 翼穩脫殼穿甲彈 APFSDS (超高速平射鎢芯箭 + 穿甲震波軌跡)】
      spawnSabotMachLine(ax, ay, tx, ty, dist, baseAngle);
      launchSingleProjectile({
        ax, ay, tx, ty,
        wType: 'sabot',
        arcHeight: 0,
        waveAmp: 0,
        dur: Math.max(60, 125 / speed),
        side: ln.side,
        onHit: () => triggerImpact()
      });

    } else if (wType === 'torpedo') {
      // 【類型 5：重型反潛魚雷 / 反艦飛彈 (S型掠海或水下空泡推進軌跡)】
      launchSingleProjectile({
        ax, ay, tx, ty,
        wType: 'torpedo',
        arcHeight: 0,
        waveAmp: 12,
        dur: Math.max(110, 235 / speed),
        side: ln.side,
        onHit: () => triggerImpact()
      });

    } else {
      // 【類型 2：超視距防空 / 空對空飛彈 (二段爬升俯衝曲線 + 凝結尾煙)】
      launchSingleProjectile({
        ax, ay, tx, ty,
        wType: 'missile',
        arcHeight: -Math.min(72, dist * 0.16),
        waveAmp: 0,
        dur: Math.max(95, 210 / speed),
        side: ln.side,
        onHit: () => triggerImpact()
      });
    }
  } else {
    triggerImpact();
  }

  // 生成各兵種專屬高精細 SVG 武器實體圖形
  function getWeaponSvgHtml(type, side) {
    const accent = side === 'A' ? '#3de0ff' : '#ff5d6e';
    if (type === 'sabot') {
      // 翼穩脫殼穿甲彈 (APFSDS Fin-Stabilized Tungsten Dart + Plasma Cone)
      return `<svg class="fx-weapon-svg sabot-svg" viewBox="0 0 64 20" width="58" height="18">
        <defs>
          <linearGradient id="sabotGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="transparent"/>
            <stop offset="45%" stop-color="#f59e0b"/>
            <stop offset="85%" stop-color="#fef08a"/>
            <stop offset="100%" stop-color="#ffffff"/>
          </linearGradient>
        </defs>
        <polygon points="0,8 46,9 46,11 0,12" fill="url(#sabotGrad)"/>
        <polygon points="14,4 22,9 14,9" fill="#fbbf24"/>
        <polygon points="14,16 22,11 14,11" fill="#fbbf24"/>
        <polygon points="22,8.5 56,8.5 64,10 56,11.5 22,11.5" fill="#ffffff"/>
        <ellipse cx="54" cy="10" rx="10" ry="3.5" fill="#fef08a" opacity="0.75"/>
      </svg>`;
    } else if (type === 'autocannon') {
      // 30mm 高爆曳光穿甲彈鏈
      return `<svg class="fx-weapon-svg cannon-svg" viewBox="0 0 42 12" width="38" height="10">
        <polygon points="0,4 30,3.5 30,8.5 0,8" fill="#f97316" opacity="0.85"/>
        <polygon points="24,3 42,6 24,9" fill="#fef08a"/>
      </svg>`;
    } else if (type === 'salvo') {
      // 多管重型火箭彈 / 巡弋飛彈實體
      return `<svg class="fx-weapon-svg salvo-svg" viewBox="0 0 56 22" width="48" height="20">
        <ellipse cx="12" cy="11" rx="12" ry="4.5" fill="#f97316" opacity="0.9"/>
        <ellipse cx="16" cy="11" rx="7" ry="2.5" fill="#fef08a"/>
        <polygon points="18,5 25,8 18,8" fill="#94a3b8"/>
        <polygon points="18,17 25,14 18,14" fill="#94a3b8"/>
        <rect x="20" y="8" width="22" height="6" rx="1" fill="#e2e8f0" stroke="#475569" stroke-width="0.8"/>
        <rect x="33" y="8" width="4" height="6" fill="#ef4444"/>
        <polygon points="42,8 54,11 42,14" fill="#cbd5e1" stroke="#475569" stroke-width="0.8"/>
      </svg>`;
    } else if (type === 'torpedo') {
      // 重型魚雷 / 掠海反艦彈體 (帶氣泡尾流與十字舵)
      return `<svg class="fx-weapon-svg torpedo-svg" viewBox="0 0 56 22" width="48" height="20">
        <circle cx="8" cy="11" r="4" fill="#67e8f9" opacity="0.75"/>
        <circle cx="15" cy="9" r="2.5" fill="#cffafe" opacity="0.85"/>
        <circle cx="15" cy="13" r="2.5" fill="#cffafe" opacity="0.85"/>
        <polygon points="18,5 24,8 18,8" fill="#0891b2"/>
        <polygon points="18,17 24,14 18,14" fill="#0891b2"/>
        <rect x="20" y="7.5" width="24" height="7" rx="2" fill="#0e7490" stroke="#67e8f9" stroke-width="1"/>
        <path d="M44,7.5 C52,7.5 54,11 54,11 C54,11 52,14.5 44,14.5 Z" fill="#22d3ee"/>
      </svg>`;
    } else if (type === 'swarm') {
      // 三角翼自殺無人機 / 巡飛彈 (Loitering Munition Delta-Wing SVG)
      return `<svg class="fx-weapon-svg swarm-svg" viewBox="0 0 36 28" width="32" height="24">
        <polygon points="6,2 28,14 6,26 12,14" fill="#334155" stroke="${accent}" stroke-width="1.3"/>
        <polygon points="12,11 34,14 12,17" fill="#cbd5e1"/>
        <circle cx="29" cy="14" r="2.2" fill="#ff2a4b"/>
        <ellipse cx="7" cy="14" rx="5" ry="2" fill="${accent}" opacity="0.85"/>
      </svg>`;
    } else {
      // 超音速防空 / 空對空飛彈 (Supersonic AAM/SAM with fins & dual afterburner)
      return `<svg class="fx-weapon-svg missile-svg" viewBox="0 0 58 22" width="50" height="20">
        <ellipse cx="11" cy="11" rx="11" ry="4" fill="${accent}" opacity="0.85"/>
        <ellipse cx="16" cy="11" rx="6" ry="2.2" fill="#ffffff"/>
        <polygon points="19,4 25,8.5 19,8.5" fill="#64748b"/>
        <polygon points="19,18 25,13.5 19,13.5" fill="#64748b"/>
        <polygon points="33,6 38,8.5 33,8.5" fill="#475569"/>
        <polygon points="33,16 38,13.5 33,13.5" fill="#475569"/>
        <rect x="20" y="8.5" width="24" height="5" fill="#f8fafc" stroke="#475569" stroke-width="0.7"/>
        <rect x="36" y="8.5" width="3.5" height="5" fill="${accent}"/>
        <polygon points="44,8.5 56,11 44,13.5" fill="#e2e8f0" stroke="#475569" stroke-width="0.7"/>
      </svg>`;
    }
  }

  // 發射單枚具備物理拋物線/弦波軌跡與動態切線轉向的武器實體
  function launchSingleProjectile({ ax, ay, tx, ty, wType, arcHeight, waveAmp, dur, side, onHit }) {
    const proj = document.createElement('div');
    proj.className = `fx-projectile fx-w-${wType} ${side === 'A' ? 'fx-side-a' : 'fx-side-b'}`;
    proj.innerHTML = getWeaponSvgHtml(wType, side);
    fxLayer.appendChild(proj);

    const dx = tx - ax, dy = ty - ay;
    const startTime = performance.now();
    let prevX = ax, prevY = ay;
    let frameCount = 0;

    function step(now) {
      if (skip || !proj.parentElement) { proj.remove(); return; }
      const p = Math.min(1, (now - startTime) / dur);

      // 計算基礎線性位置 + 拋物線仰角高度 + 弦波蛇行偏移
      const parabola = 4 * p * (1 - p) * arcHeight;
      const wave = waveAmp ? Math.sin(p * Math.PI * 2.5) * waveAmp * (1 - p * 0.3) : 0;
      const curX = ax + dx * p;
      const curY = ay + dy * p + parabola + wave;

      // 動態計算瞬時切線方向角，讓飛彈/火箭鼻錐真實隨拋物線抬頭與俯衝
      const vx = curX - prevX;
      const vy = curY - prevY;
      const curAngle = (Math.hypot(vx, vy) > 0.4)
        ? (Math.atan2(vy, vx) * 180 / Math.PI)
        : (Math.atan2(dy, dx) * 180 / Math.PI);

      proj.style.transform = `translate(${curX}px, ${curY}px) rotate(${curAngle}deg)`;
      prevX = curX;
      prevY = curY;
      frameCount++;

      // 沿途釋放推進尾煙或水下空泡粒子
      if (frameCount % 2 === 0 && p > 0.08 && p < 0.92) {
        if (wType === 'missile' || wType === 'salvo') {
          spawnTrailParticle(curX, curY, wType === 'salvo' ? 'smoke-fire' : 'contrail');
        } else if (wType === 'torpedo') {
          spawnTrailParticle(curX, curY, 'bubble');
        }
      }

      if (p < 1) {
        requestAnimationFrame(step);
      } else {
        proj.remove();
        if (onHit) onHit();
      }
    }
    requestAnimationFrame(step);
  }

  // 翼穩脫殼穿甲彈專屬：超音速金色穿甲音爆束線
  function spawnSabotMachLine(ax, ay, tx, ty, dist, angle) {
    const beam = document.createElement('div');
    beam.className = 'fx-sabot-beam';
    beam.style.width = dist + 'px';
    beam.style.left = ax + 'px';
    beam.style.top = ay + 'px';
    beam.style.transform = `rotate(${angle}deg)`;
    fxLayer.appendChild(beam);
    setTimeout(() => beam.remove(), 240 / speed);
  }

  // 電子戰 / 反輻射專屬：全息電磁脈衝干擾波束
  function spawnEwBeam(ax, ay, tx, ty, dist, angle, color) {
    const ew = document.createElement('div');
    ew.className = 'fx-ew-beam';
    ew.style.width = dist + 'px';
    ew.style.left = ax + 'px';
    ew.style.top = ay + 'px';
    ew.style.transform = `rotate(${angle}deg)`;
    ew.style.setProperty('--ew-color', color);
    fxLayer.appendChild(ew);
    setTimeout(() => ew.remove(), 340 / speed);
  }

  // 開火端砲口制退火光 / 垂發煙霧
  function spawnMuzzleFx(x, y, angle, wType, color) {
    const mz = document.createElement('div');
    mz.className = `fx-muzzle fx-muzzle-${wType}`;
    mz.style.left = x + 'px';
    mz.style.top = y + 'px';
    mz.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
    mz.style.setProperty('--mz-color', color);
    fxLayer.appendChild(mz);
    setTimeout(() => mz.remove(), 220 / speed);
  }

  // 沿途尾煙 / 水下氣泡粒子
  function spawnTrailParticle(x, y, kind) {
    const pt = document.createElement('div');
    pt.className = `fx-trail-pt ${kind}`;
    pt.style.left = (x + (Math.random() - 0.5) * 6) + 'px';
    pt.style.top = (y + (Math.random() - 0.5) * 6) + 'px';
    fxLayer.appendChild(pt);
    setTimeout(() => pt.remove(), 320 / speed);
  }

  // 目標火控鎖定準星框
  function spawnLockReticle(x, y, wType) {
    const ret = document.createElement('div');
    ret.className = `fx-reticle ${wType === 'ew' ? 'ew-lock' : ''}`;
    ret.style.left = x + 'px';
    ret.style.top = y + 'px';
    fxLayer.appendChild(ret);
    setTimeout(() => ret.remove(), 340 / speed);
  }

  // 機砲連射微火花
  function spawnMiniSparks(x, y) {
    for (let i = 0; i < 4; i++) {
      const sp = document.createElement('div');
      sp.className = 'fx-spark';
      sp.style.left = x + 'px';
      sp.style.top = y + 'px';
      const ang = Math.random() * Math.PI * 2;
      const d = 14 + Math.random() * 24;
      sp.style.setProperty('--dx', `${Math.cos(ang) * d}px`);
      sp.style.setProperty('--dy', `${Math.sin(ang) * d}px`);
      fxLayer.appendChild(sp);
      setTimeout(() => sp.remove(), 220 / speed);
    }
  }

  // 5. 命中受擊、分級爆炸衝擊波與浮動戰鬥數字 (受擊方聲相為對手方位)
  function triggerImpact() {
    if (skip) return;
    const targetSide = ln.side === 'A' ? 'B' : 'A';
    if (ln.kind === 'kill') {
      tEl.classList.remove('hit-shake', 'kill-blast');
      void tEl.offsetWidth;
      tEl.classList.add('kill-blast', 'destroyed-badge');
      spawnExplosion(tx, ty, true, wType, 1.0);
      spawnFloater(tx, ty, '💥 擊毀!', 'kill');
      SoundEngine.play('explosion', targetSide);

      // 擊毀大型目標時觸發戰場畫面微震動 (Micro Screen Shake)
      const vb = $('#viewBattle');
      if (vb) {
        vb.classList.remove('battle-screen-shake');
        void vb.offsetWidth;
        vb.classList.add('battle-screen-shake');
        setTimeout(() => vb.classList.remove('battle-screen-shake'), 280 / speed);
      }
    } else if (ln.kind === 'hit') {
      tEl.classList.remove('hit-shake');
      void tEl.offsetWidth;
      tEl.classList.add('hit-shake');
      spawnExplosion(tx, ty, false, wType, 1.0);
      const dmgText = ln.dmg ? `−${ln.dmg}` : `命中!`;
      spawnFloater(tx, ty, dmgText, 'hit');
      if (wType !== 'ew') SoundEngine.play('hit_impact', targetSide);
    } else if (ln.kind === 'block') {
      spawnShield(tx, ty);
      spawnFloater(tx, ty, '🛡️ APS 攔截', 'block');
      SoundEngine.play('block', targetSide);
    } else if (ln.kind === 'miss') {
      spawnFloater(tx, ty, 'MISS', 'miss');
    }
  }

  // 多層次物理爆炸：核心火球 + 超音速震波環 + 金屬破片飛濺 + 濃煙 / 水柱
  function spawnExplosion(x, y, isKill = false, weaponType = 'missile', scale = 1.0) {
    // 1. 核心高熱火球
    const boom = document.createElement('div');
    boom.className = `fx-explosion ${isKill ? 'fx-explosion-kill' : ''} ${weaponType === 'ew' ? 'fx-explosion-ew' : ''}`;
    boom.style.left = x + 'px';
    boom.style.top = y + 'px';
    if (scale !== 1.0) boom.style.transform = `scale(${scale})`;
    fxLayer.appendChild(boom);
    setTimeout(() => boom.remove(), (isKill ? 520 : 380) / speed);

    // 2. 擴散超音速震波環 (Shockwave Ring)
    const ring = document.createElement('div');
    ring.className = `fx-shockwave ${isKill ? 'kill-ring' : ''} ${weaponType === 'ew' ? 'ew-ring' : ''}`;
    ring.style.left = x + 'px';
    ring.style.top = y + 'px';
    fxLayer.appendChild(ring);
    setTimeout(() => ring.remove(), (isKill ? 480 : 340) / speed);

    // 3. 魚雷 / 制海武器專屬：衝天白色水柱 (Water Plume)
    if (weaponType === 'torpedo') {
      const plume = document.createElement('div');
      plume.className = 'fx-water-plume';
      plume.style.left = x + 'px';
      plume.style.top = y + 'px';
      fxLayer.appendChild(plume);
      setTimeout(() => plume.remove(), 460 / speed);
    }

    // 4. 飛濺高熱破片火花 (Debris Sparks)
    const sparkCount = isKill ? 12 : 6;
    for (let i = 0; i < sparkCount; i++) {
      const sp = document.createElement('div');
      sp.className = `fx-spark ${isKill ? 'kill-spark' : ''}`;
      sp.style.left = x + 'px';
      sp.style.top = y + 'px';
      const ang = (Math.PI * 2 * i) / sparkCount + (Math.random() - 0.5) * 0.4;
      const dist = (isKill ? 36 : 20) + Math.random() * (isKill ? 44 : 24);
      sp.style.setProperty('--dx', `${Math.cos(ang) * dist}px`);
      sp.style.setProperty('--dy', `${Math.sin(ang) * dist}px`);
      fxLayer.appendChild(sp);
      setTimeout(() => sp.remove(), (isKill ? 460 : 300) / speed);
    }

    // 5. 擊毀時竄升黑煙雲團
    if (isKill) {
      for (let s = 0; s < 2; s++) {
        const sm = document.createElement('div');
        sm.className = 'fx-smoke-cloud';
        sm.style.left = (x + (s === 0 ? -10 : 10)) + 'px';
        sm.style.top = y + 'px';
        fxLayer.appendChild(sm);
        setTimeout(() => sm.remove(), 620 / speed);
      }
    }
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

$('#btnPause')?.addEventListener('click', () => {
  paused = !paused;
  const btn = $('#btnPause');
  if (btn) {
    btn.textContent = paused ? '▶ 繼續' : '⏸ 暫停';
    btn.classList.toggle('active', paused);
  }
  toast(paused ? '⏸ 戰場推演已暫停（可自由檢視日誌與裝備血量）' : '▶ 繼續戰場推演');
});
$('#btnSkip').onclick = () => {
  paused = false;
  skip = true;
  const fx = $('#combatFxLayer');
  if (fx) fx.innerHTML = '';
  const r = $('.radar');
  if (r) r.classList.remove('emp-active');
};
$('#btnSpeed').onclick = () => {
  speed = speed === 1 ? 2 : speed === 2 ? 4 : 1;
  LS.set('db15_speed', speed);
  $('#btnSpeed').textContent = '速度 ×' + speed;
};
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
  renderHud();

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
    if ($('#btnPause')) $('#btnPause').hidden = true;
    $('#btnSpeed').hidden = true;
    $('#btnSkip').hidden = true;
    $('#btnReopenResult').hidden = false;
    $('#btnBattleExit').hidden = false;
    toast('🔍 已進入戰場檢視：可自由滾動日誌與檢視部隊殘局');
  };
}

/* ---------- BO3 系列賽輪次推進 ---------- */
function handleBo3RoundEnd(res) {
  const isHost = OnlinePvPEngine.isHostUser();
  const won = state.isOnlinePvp ? (isHost ? res.winner === 'A' : res.winner === 'B') : (res.winner === 'A');
  const draw = res.winner === 'draw';
  const bo3 = state.bo3;

  if (res.winner === 'A') bo3.winsA++;
  else if (res.winner === 'B') bo3.winsB++;

  bo3.history.push({
    round: bo3.round, winner: res.winner,
    scoreA: res.vp.A.total, scoreB: res.vp.B.total,
    event: res.ev,
    deckA: (state.isOnlinePvp ? (isHost ? state.deck : state.pvpOpponentDeck) : state.deck).slice(),
    deckB: (state.isOnlinePvp ? (isHost ? state.pvpOpponentDeck : state.deck) : state.enemy).slice()
  });

  // 判斷是否有人獲得 3 勝 (BO5 系列賽獲勝)
  if (bo3.winsA >= 3 || bo3.winsB >= 3) {
    const isSeriesWon = state.isOnlinePvp ? (isHost ? bo3.winsA >= 3 : bo3.winsB >= 3) : (bo3.winsA >= 3);
    showBo3SeriesResult(isSeriesWon);
    return;
  }

  // 尚未結束，準備進入下一局 (至多第 5 局)
  const nextRound = bo3.round + 1;
  const nextEvent = pick(EVENTS.filter(e => e.id !== res.ev.id));
  bo3.nextEvent = nextEvent;

  if (state.isOnlinePvp) {
    // 線上對抗：小局結束，立即推進局數並安全重置就緒狀態（全系列賽永久累計禁用，絕不清空 bannedList）
    bo3.round = nextRound;
    state.pvpMyReady = false;
    state.pvpOpponentReady = false;
    state.pvpOpponentDeck = null;
    state.pvpOpponentDoc = null;
  }

  if (draw) {
    showResult(res, {
      bo3NextText: `進入第 ${nextRound} 局（平局重賽）`,
      bo3Callback: () => {
        closeBattle();
        renderAll();
        toast(`⚖️ 本局戰平！雙方戰略積分相同，第 ${nextRound} 局直接交火！`);
      }
    });
    return;
  }

  if (won) {
    if (state.isOnlinePvp) {
      // 線上對抗：我方獲勝，由對手進行戰術反制
      showResult(res, {
        bo3NextText: `進入第 ${nextRound} 局（等待對手反制）`,
        bo3Callback: () => {
          closeBattle();
          renderAll();
          toast(state.bo3.bannedByB 
            ? `⚠️ 對手已禁用了你的【${UNIT_MAP[state.bo3.bannedByB]?.name || '主力裝備'}】！請調整陣容出擊。`
            : `🏆 本局獲勝！正在等待對手指揮官進行戰術禁用反制...`);
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
    if (!bo3.bannedListB) bo3.bannedListB = [];
    if (!bo3.bannedListB.includes(banId)) bo3.bannedListB.push(banId);
    
    // 電腦自身進行陣容微調 (避開所有被累計禁用的裝備)
    bo3.enemyDeck = refitEnemyDeck(state.enemy, state.deck, nextEvent);

    showResult(res, {
      bo3NextText: `進入第 ${nextRound} 局（戰術反制）`,
      bo3Callback: () => {
        closeBattle();
        bo3.round = nextRound;
        setupMatch();
        // 檢查玩家卡槽中所有被累計禁用的裝備，強制卸下
        const allBanned = currentBanned();
        state.deck.forEach((id, idx) => {
          if (id && allBanned.includes(id)) {
            state.deck[idx] = null;
            state.active = idx;
          }
        });
        renderAll();
        toast(`⚠️ 電腦失利啟動反制！鎖定你上一局【${banReason}】，全系列賽永久禁用了【${UNIT_MAP[banId].name}】！(累計禁用 ${bo3.bannedListB.length} 件)`);
      }
    });
  } else {
    // 玩家在上一局失利，賦予玩家戰術反制特權（跳出 Ban 選單）
    showResult(res, {
      bo3NextText: `啟動戰術反制 (BAN 敵方裝備)`,
      bo3Callback: () => {
        closeBattle();
        // 線上對抗中：本部特遣隊失利禁用 Side B (挑戰突擊隊)，挑戰突擊隊失利禁用 Side A (本部特遣隊)
        const winnerTeam = state.isOnlinePvp ? (isHost ? res.final.B : res.final.A) : res.final.B;
        openBo3CounterModal(winnerTeam, nextRound, nextEvent);
      }
    });
  }
}

function refitEnemyDeck(currentEnemyDeck, playerDeck, nextEvent) {
  // 電腦依據戰場事件或玩家高費單位進行微調，且嚴格避開所有被玩家累計禁用的裝備
  const newDeck = currentEnemyDeck.slice();
  const banned = (state.bo3 && state.bo3.bannedListA) || [];
  
  // 先替換已被玩家禁用的單位
  newDeck.forEach((id, idx) => {
    if (banned.includes(id)) {
      const slotFixed = SLOTS[idx].fixed;
      const cat = slotFixed || UNIT_MAP[id]?.cat || 'air';
      const alts = UNITS.filter(u => u.cat === cat && !banned.includes(u.id) && !newDeck.includes(u.id));
      if (alts.length) newDeck[idx] = pick(alts).id;
    }
  });

  const playerAir = playerDeck.some(id => UNIT_MAP[id]?.cat === 'air' && UNIT_MAP[id]?.cost >= 4);
  if (playerAir) {
    // 強化防空槽位
    const adUnits = UNITS.filter(u => u.cat === 'air_defense' && u.cost >= 3 && !banned.includes(u.id));
    if (adUnits.length) newDeck[2] = pick(adUnits).id;
  }
  return newDeck;
}

/* 玩家戰術反制 Modal */
function openBo3CounterModal(enemyFinalTeam, nextRound, nextEvent) {
  const bo3 = state.bo3;
  if (!bo3.bannedListA) bo3.bannedListA = [];
  const alreadyBanned = bo3.bannedListA;
  const eligibleTeam = enemyFinalTeam.filter(u => !alreadyBanned.includes(u.id));
  const candidateList = eligibleTeam.length ? eligibleTeam : enemyFinalTeam;

  $('#bo3CounterTitle').textContent = `第 ${bo3.round} 局失利：啟動戰術反制 (BO5 全系列賽永久鎖定)`;
  $('#bo3CounterDesc').textContent = `你擁有最高反制特權：點選並指定禁用敵方上一局的 1 件裝備，被禁用的裝備將於後續所有賽局（第 3、4、5 局）永久鎖定不可再選！`;
  
  bo3.candidateBan = candidateList[0].id;
  $('#bo3BanGrid').innerHTML = candidateList.map((u, idx) => {
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

  if (!bo3.bannedListA) bo3.bannedListA = [];
  if (!bo3.bannedListA.includes(bannedId)) {
    bo3.bannedListA.push(bannedId);
  }
  bo3.bannedByA = bannedId;
  $('#bo3CounterModal').hidden = true;

  if (state.isOnlinePvp) {
    // 線上真人對抗：發送 BAN_COMMIT 給對手，附帶全系列賽累計禁用清單
    OnlinePvPEngine.sendPacket('BAN_COMMIT', { 
      bannedUnitId: bannedId,
      bannedList: bo3.bannedListA.slice()
    });
    state.pvpMyReady = false;
    renderAll();
    toast(`🎯 戰術反制生效：已永久鎖定對手的【${UNIT_MAP[bannedId].name}】（累計禁用 ${bo3.bannedListA.length} 件）！請重新調整第 ${bo3.round} 局陣容。`);
    return;
  }

  bo3.round++;
  // 替換敵方被 Ban 的裝備 (避開所有累計被禁用的武器)
  const banIdx = bo3.enemyDeck.indexOf(bannedId);
  if (banIdx >= 0) {
    const slotFixed = SLOTS[banIdx].fixed;
    const cat = slotFixed || UNIT_MAP[bannedId].cat;
    const alternatives = UNITS.filter(u => u.cat === cat && !bo3.bannedListA.includes(u.id) && !bo3.enemyDeck.includes(u.id));
    if (alternatives.length) bo3.enemyDeck[banIdx] = pick(alternatives).id;
  }

  setupMatch();
  renderAll();
  toast(`🎯 戰術反制生效：已永久鎖定敵方的【${UNIT_MAP[bannedId].name}】（累計禁用 ${bo3.bannedListA.length} 件）！請調整陣容應戰。`);
};

/* BO3 系列賽冠軍結算 */
function showBo3SeriesResult(isPlayerWon) {
  const bo3 = state.bo3;
  const isHost = OnlinePvPEngine.isHostUser();
  if (isPlayerWon) {
    stats.bo3Won = (stats.bo3Won || 0) + 1;
    LS.set('db15_stats', stats);
  }
  currentActiveModal = $('#bo3SeriesModal');
  const scoreText = state.isOnlinePvp
    ? `(本部 ${bo3.winsA} - 突擊 ${bo3.winsB})`
    : `(${bo3.winsA} - ${bo3.winsB})`;

  $('#bo3SeriesCard').innerHTML = `
    <button class="modal-x" id="bo3CloseX" title="關閉彈窗並檢視戰場情形">✕</button>
    <div class="trophy-banner">
      <div class="tag">BO5 SERIES VICTORY</div>
      <h2>${isPlayerWon ? `🏆 贏得 BO5 系列賽！${scoreText}` : `BO5 系列賽惜敗 ${scoreText}`}</h2>
      <p class="muted" style="margin-top:6px">${isPlayerWon ? '恭喜你在殘酷的戰術禁用與兵種相剋博弈中奪得 3 勝，贏得系列賽勝利！' : '對手指揮官在關鍵局完成了針對性反制。再接再厲！'}</p>
    </div>
    <div class="bo3-timeline">
      ${bo3.history.map(h => {
        const roundWon = state.isOnlinePvp ? (isHost ? h.winner === 'A' : h.winner === 'B') : (h.winner === 'A');
        const isDraw = h.winner === 'draw';
        const resultLabel = isDraw ? '平 局 ⚖' : (roundWon ? '勝 利 ✔' : '敗 北 ✘');
        const resultColor = isDraw ? 'var(--amber)' : (roundWon ? 'var(--green)' : 'var(--red)');
        const scoreLine = state.isOnlinePvp
          ? `本部 ${h.scoreA.toFixed(0)} : ${h.scoreB.toFixed(0)} 突擊`
          : `我方 ${h.scoreA.toFixed(0)} : ${h.scoreB.toFixed(0)} 敵方`;
        return `<div class="bo3-round-row">
          <span><b>第 ${h.round}/5 局</b> · ${h.event.icon} ${h.event.name}</span>
          <span>${scoreLine}</span>
          <b style="color:${resultColor}">${resultLabel}</b>
        </div>`;
      }).join('')}
    </div>
    <div class="res-actions">
      <button class="btn primary" id="bo3NewSeries">${state.isOnlinePvp ? '結束對戰並返回大廳' : '重啟新一輪 BO5 征服賽'}</button>
      <button class="btn" id="bo3Review">檢視戰場情形 🔍</button>
      ${state.isOnlinePvp ? '' : '<button class="btn ghost" id="bo3Close">返回大廳</button>'}
    </div>
  `;
  $('#bo3SeriesModal').hidden = false;

  const reviewBo3Battlefield = () => {
    $('#bo3SeriesModal').hidden = true;
    if ($('#btnPause')) $('#btnPause').hidden = true;
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

  $('#bo3NewSeries').onclick = () => {
    $('#bo3SeriesModal').hidden = true;
    closeBattle();
    if (state.isOnlinePvp) {
      OnlinePvPEngine.closeConnection();
      state.isOnlinePvp = false;
      state.pvpMyReady = false;
      state.pvpOpponentReady = false;
      state.pvpOpponentDeck = null;
      initBo3Series();
      renderAll();
      toast('已結束線上雙人對戰，回到常規模式。');
    } else {
      initBo3Series();
      renderAll();
    }
  };
  if ($('#bo3Close')) {
    $('#bo3Close').onclick = () => {
      $('#bo3SeriesModal').hidden = true;
      closeBattle();
      if (state.isOnlinePvp) {
        OnlinePvPEngine.closeConnection();
        state.isOnlinePvp = false;
      }
      state.bo3.active = false;
      setMode('quick');
    };
  }
}

/* ---------- 旗艦級戰鬥結算報告 (C4ISR Tactical After-Action Report, AAR) ---------- */
function showResult(res, bo3Custom) {
  const isHost = OnlinePvPEngine.isHostUser();
  const won = state.isOnlinePvp ? (isHost ? res.winner === 'A' : res.winner === 'B') : (res.winner === 'A');
  const draw = res.winner === 'draw';
  const A = res.vp.A, B = res.vp.B;
  const f = x => x.toFixed(1);
  const why = buildWhy(res);

  // 雙方生還統計與得分對比
  const aliveCountA = res.final.A.filter(u => u.alive).length;
  const aliveCountB = res.final.B.filter(u => u.alive).length;
  const mySide = state.isOnlinePvp ? (isHost ? 'A' : 'B') : 'A';
  const enemySide = mySide === 'A' ? 'B' : 'A';
  const myAlive = mySide === 'A' ? aliveCountA : aliveCountB;
  const enemyAlive = mySide === 'A' ? aliveCountB : aliveCountA;
  const myTotalVP = res.vp[mySide].total;
  const enemyTotalVP = res.vp[enemySide].total;
  const diffVP = myTotalVP - enemyTotalVP;
  const enemyWiped = enemyAlive === 0;

  // 1. 計算作戰評級 (Combat Grade)
  // S: 頂級完勝（零戰損 5/5 全員生還，或建制高度完好 4/5 生還且淨勝積分優勢/敵軍全殲）
  // A: 戰術大勝（3/5+ 生還且火力壓制/全殲敵軍）
  // B: 戰術險勝（2/5 生還，或互有折損險勝）
  // C: 苦戰慘勝（僅 1/5 生還之皮洛士式勝利）/ 或戰敗時之「作戰惜敗」
  // ⚖: 勢均力敵戰略僵局
  // D: 作戰潰敗（部隊折損慘重）
  let grade = 'B', gradeTitle = '戰 術 險 勝', gradeDesc = '戰局焦灼，驚險獲勝', gradeClass = 'grade-b';
  if (won) {
    if (myAlive === 5) {
      grade = 'S';
      gradeTitle = '戰 略 完 勝';
      gradeDesc = '★ ACE 全員零損耗生還 · 完美殲敵';
      gradeClass = 'grade-s';
    } else if (myAlive >= 4 && (diffVP >= 8 || enemyWiped)) {
      grade = 'S';
      gradeTitle = '戰 略 完 勝';
      gradeDesc = `主力建制極度完好 (${myAlive}/5 存活) · 壓倒性戰略優勢`;
      gradeClass = 'grade-s';
    } else if (myAlive >= 3 && (diffVP >= 5 || enemyWiped)) {
      grade = 'A';
      gradeTitle = '戰 術 大 勝';
      gradeDesc = `火力全面壓制，重創敵主力建制 (${myAlive}/5 存活)`;
      gradeClass = 'grade-a';
    } else if (myAlive >= 4) {
      grade = 'A';
      gradeTitle = '優 勢 獲 勝';
      gradeDesc = `主力防線保持穩固 (${myAlive}/5 存活)，奪取戰場主動權`;
      gradeClass = 'grade-a';
    } else if (myAlive >= 2) {
      grade = 'B';
      gradeTitle = '戰 術 險 勝';
      gradeDesc = `雙方激烈交火互有折損 (${myAlive}/5 存活)，突破敵防線勝出`;
      gradeClass = 'grade-b';
    } else {
      grade = 'C';
      gradeTitle = '作 戰 慘 勝';
      gradeDesc = `浴血苦戰！特遣隊遭受重創 (僅 ${myAlive}/5 存活)，驚險逆轉險勝`;
      gradeClass = 'grade-c';
    }
  } else if (draw) {
    grade = '⚖';
    gradeTitle = '戰 略 僵 局';
    gradeDesc = '雙方勢均力敵，戰略積分打平';
    gradeClass = 'grade-draw';
  } else {
    if (diffVP > -6 || enemyAlive <= 2) {
      grade = 'C';
      gradeTitle = '作 戰 惜 敗';
      gradeDesc = '重創敵方主力建制，僅因微幅戰術分差落敗';
      gradeClass = 'grade-c';
    } else {
      grade = 'D';
      gradeTitle = '作 戰 潰 敗';
      gradeDesc = '部隊遭受壓制性打擊，建議調整戰術教條';
      gradeClass = 'grade-d';
    }
  }

  // 2. 計算 MVP 王牌軍武單位
  const mvpSide = won ? mySide : enemySide;
  const mvpUnit = res.mvp[mvpSide] || (won ? res.final[mySide][0] : res.final[enemySide][0]);
  const mvpMeta = UNIT_MAP[mvpUnit.id] || {};
  const mvpIsMine = mvpSide === mySide;

  // 3. 戰略得分比例
  const sumVP = A.total + B.total;
  const pctA = sumVP > 0 ? Math.round((A.total / sumVP) * 100) : 50;
  const pctB = 100 - pctA;

  let subtitle = `${esc(res.ev.icon + ' ' + res.ev.name)}`;
  if (state.mode === 'daily') subtitle += ' · 精選對戰 #' + dailyNo();
  else if (state.mode === 'ghost' || (state.mode === 'quick' && state.quickSubMode === 'ghost')) subtitle += ` · 幽靈對決 (${state.ghostTarget?.callsign || '名將'})`;
  else if (state.mode === 'bo3') subtitle += ` · BO5 第 ${state.bo3.round} 局 (比分 ${state.bo3.winsA} - ${state.bo3.winsB})`;
  else subtitle += ' · 快速交鋒 · AI 戰術演練';

  const modeTagText = won 
    ? (enemyWiped ? '💥 全殲敵軍' : '🎯 戰略判定') 
    : (myAlive === 0 ? '💥 全軍覆沒' : (draw ? '⚖ 平局判定' : '🎯 戰略判定'));

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
          <span class="outcome-mode-tag">${modeTagText}</span>
          <span class="outcome-sub-desc">${gradeDesc}</span>
        </div>
        <div class="outcome-meta-row">
          <span class="aar-env-tag">${subtitle}</span>
        </div>
      </div>
      <div class="outcome-gauge-col">
        <div class="gauge-labels-compact">
          <span class="g-side g-a">${state.isOnlinePvp ? (isHost ? '👑 本部特遣隊 (我方)' : '👑 本部特遣隊 (敵方)') : '友軍'} <b>${f(A.total)} VP</b> <span class="g-alive">(${aliveCountA}/5 存活)</span></span>
          <span class="g-vs">VS</span>
          <span class="g-side g-b">${state.isOnlinePvp ? (isHost ? '🎯 挑戰突擊隊 (敵方)' : '🎯 挑戰突擊隊 (我方)') : '敵軍'} <b>${f(B.total)} VP</b> <span class="g-alive">(${aliveCountB}/5 存活)</span></span>
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

    <!-- 各單位傷害輸出與生還統計表 (Unit Damage Meter) -->
    ${(() => {
      const renderSideDmg = (units, sideLabel, sideClass) => {
        const totalDmg = Math.max(1, units.reduce((acc, u) => acc + Math.round(u.dmgDone || 0), 0));
        const maxDmg = Math.max(1, ...units.map(u => Math.round(u.dmgDone || 0)));
        // 保持與對戰畫面一致的槽位順序 (Slot 1 AIR -> Slot 2 ARM -> Slot 3 ADS -> Slot 4 NAV -> Slot 5 ISR)
        return `<div class="dmg-side-col ${sideClass}">
          <div class="dmg-side-head">
            <span>${sideLabel}</span>
            <small>總輸出 <b>${totalDmg}</b></small>
          </div>
          <div class="dmg-unit-list">
            ${units.map((u, idx) => {
              const d = Math.round(u.dmgDone || 0);
              const barPct = Math.round((d / maxDmg) * 100);
              const sharePct = Math.round((d / totalDmg) * 100);
              const hpPct = Math.max(0, Math.round((u.hp / u.hpMax) * 100));
              const uMeta = UNIT_MAP[u.id] || {};
              const catInfo = CATS[u.cat] || {};
              return `<div class="dmg-unit-row ${u.alive ? '' : 'is-dead'}">
                <div class="dmg-u-info">
                  <span class="dmg-u-name">
                    <span style="font-family:var(--mono);font-size:10px;color:${catInfo.color || 'var(--muted)'};font-weight:700;margin-right:3px">${catInfo.short || `#${idx+1}`}</span>
                    ${uMeta.flag || ''} <b>${esc(u.name)}</b> <small>$${u.cost}</small>
                  </span>
                  <span class="dmg-u-stat">${d} 傷害 <small>(${sharePct}%)</small> · <i class="${u.alive ? 'alive' : 'dead'}">${u.alive ? `存活 ${hpPct}%` : '陣亡'}</i></span>
                </div>
                <div class="dmg-bar-track">
                  <div class="dmg-bar-fill" style="width:${barPct}%;background:${catInfo.color || 'var(--cyan)'}"></div>
                </div>
              </div>`;
            }).join('')}
          </div>
        </div>`;
      };
      return `<div class="aar-dmg-meter-card">
        <div class="intel-card-title">📊 各單位傷害輸出與戰果明細 (UNIT DAMAGE METER)</div>
        <div class="aar-dmg-grid">
          ${renderSideDmg(res.final.A, '🛡️ 我方特遣部隊', 'side-a')}
          ${renderSideDmg(res.final.B, '⚔️ 敵方特遣部隊', 'side-b')}
        </div>
      </div>`;
    })()}

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
      <button class="btn ghost" id="rShareReplay" title="複製一鍵重播網址，戰友點擊即可完整重現本場推演">🎬 分享重播連結</button>
      <button class="btn ghost" id="rLoadEnemySandbox" title="將本場敵方陣容與教條載入沙盒，針對性模擬 300 場測試反制配裝">🧪 載入敵陣至沙盒</button>
      <button class="btn ghost" id="rShareDebrief" title="複製精美戰報至剪貼簿">📋 複製戰報代碼</button>
      <button class="btn ghost" id="rEdit">⚙️ 返回編輯陣容</button>
    </div>
  `;

  currentActiveModal = $('#resultModal');
  $('#resultModal').hidden = false;

  const reviewBattlefield = () => {
    $('#resultModal').hidden = true;
    if ($('#btnPause')) $('#btnPause').hidden = true;
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

  // 複製一鍵戰鬥重播網址
  if ($('#rShareReplay')) {
    $('#rShareReplay').onclick = () => {
      const url = buildReplayShareUrl(res);
      copyText(url);
      toast('🎬 已複製一鍵戰鬥重播網址！分享給好友即可100%重現本場交火動畫！');
    };
  }

  // 一鍵將本場敵方陣容載入沙盒演練
  if ($('#rLoadEnemySandbox')) {
    $('#rLoadEnemySandbox').onclick = () => {
      const enemyIds = (res.final && res.final.B) ? res.final.B.map(u => u.id) : state.enemy.slice();
      const enemyDoc = (res.docs && res.docs.B) ? res.docs.B : (state.enemyDoc || 'defense');
      state.customSandEnemy = {
        name: state.enemyName || '對戰敵方特遣隊',
        deck: enemyIds,
        doc: enemyDoc
      };
      state.sandEnemy = 'custom_enemy';
      $('#resultModal').hidden = true;
      closeBattle();
      setMode('sandbox');
      toast('🧪 已將本場敵方陣容載入沙盒假想敵！可自由調整配裝並點擊「開始 300 場模擬」測試反制勝率！');
    };
  }

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
window.showResult = showResult;

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

function buildReplayShareUrl(res) {
  const deckA = (res.final?.A || []).map(u => u.id);
  const deckB = (res.final?.B || []).map(u => u.id);
  const payload = [
    deckA.join('.'),
    deckB.join('.'),
    res.seed >>> 0,
    res.ev?.id || 'clear',
    res.docs?.A || 'defense',
    res.docs?.B || 'defense'
  ].join('~');
  const url = new URL(window.location.href);
  url.search = '';
  url.searchParams.set('replay', btoa(payload));
  return url.toString();
}

function shareText(res) {
  const won = res.winner === 'A';
  const modeName = state.mode === 'daily' ? '精選對戰 #' + dailyNo() : (state.mode === 'ghost' || (state.mode === 'quick' && state.quickSubMode === 'ghost')) ? '幽靈對決' : '快速交鋒';
  const names = (res.final?.A || []).map(u => u.name).join(' / ') || state.deck.map(id => UNIT_MAP[id]?.name || id).join(' / ');
  const replayUrl = buildReplayShareUrl(res);
  return `【頂尖對戰】${modeName} ${won ? '勝利 ✅' : res.winner === 'draw' ? '平手 ⚖' : '敗北 ❌'}\n戰場：${res.ev.name}　積分 ${res.vp.A.total.toFixed(0)} : ${res.vp.B.total.toFixed(0)}\n我的 $${deckCost(state.deck)} 陣容：${names}\n陣容代碼：${encodeDeck(state.deck)}\n重播連結：${replayUrl}`;
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
    <li><b>幽靈對戰 🌐</b>：非同步挑戰其他真人玩家部署的防衛陣容，升級你的天梯軍銜（作戰少尉 ➔ 特級上將），亦可部署自己的影子陣容！</li>
    <li><b>BO5 征服賽 🏆</b>：五局三勝制！敗方享有「戰術反制」特權，指定禁用敵方上一局的 1 件裝備，考驗臨場反制與更換配裝。</li>
    <li><b>精選對戰</b>：對手擁有 <b>$19 ~ $25</b> 超標陣容，你只有 $15，挑戰極限以小博大克敵制勝！</li>
    <li><b>沙盒模擬</b>：一鍵模擬 300 場，查看勝率與各事件表現。</li>
  </ul>
  <h3>三、三階段推演與勝負</h3><ul><li>階段一：電戰值比拼（壓制敵命中率），SEAD／縱深打擊先制點穴。</li><li>階段二：防空攔截戰機（×2.5 傷害）➔ 空戰 ➔ 制海互射。</li><li>階段三：地面決戰，存活戰機密接轟炸（CAS ×1.7），火砲無人機持續支援。</li><li>積分判定：殘餘戰力 ＋ 戰線控制（裝甲/空優/海權）＋ 以小博大擊殺。</li></ul>
  <h3>四、戰術教條（賽前 3 選 1）</h3><ul>
    <li><b>⚔ 先發制人</b>：階段一、二攻擊火力 <b>+12%</b>，但承受傷害 <b>+5%</b>（適合長程精準刺殺、速攻斬首）。</li>
    <li><b>🛡 縱深防禦</b>：全隊承受傷害 <b>−12%</b>，防空攔截敵機命中率 <b>+6%</b>（適合重裝甲抗揍與陣地戰）。</li>
    <li><b>📡 電子欺敵</b>：電戰值 <b>×1.5 倍</b>（更容易奪取電磁優勢），並使敵方全體命中率 <b>−8%</b>（適合迴避流與反制高命中昂貴大殺器）。</li>
  </ul>
  <h3>五、四大聯合作戰體系羈絆 (Combined Arms Synergies)</h3><ul>
    <li><b>📡 協同接戰網 (CEC)</b>：預警機 (EW≥50) ＋ 遠程防空／神盾艦 ➔ 全隊電戰 +12、防空命中 +6%。</li>
    <li><b>🛸 有人無人協同 (MUM-T)</b>：$5 五代空優戰機 ＋ 無人機／巡飛彈／無人艇 ➔ 無人與支援單位傷害 +15%、全體隱匿 +5。</li>
    <li><b>🌊 立體海空獵殺網 (ASW Net)</b>：反潛艦／潛艦 ＋ 電戰／校射偵蒐 (EW≥15/SPOT) ➔ 制海命中 +6%、海軍傷害 +12%。</li>
    <li><b>⚙ 步坦砲協同鐵拳 (Land Force)</b>：重裝甲／主動防護戰車 ＋ 自走砲／校射支援 ➔ 階段三裝甲與火砲傷害 +10%。</li>
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
    if ($('#resultModal') && !$('#resultModal').hidden) { const rc = $('#rCloseX') || $('#rEdit'); if (rc) rc.click(); else $('#resultModal').hidden = true; }
    if ($('#tourneySpectatorModal')) $('#tourneySpectatorModal').hidden = true;
    if ($('#commanderModal')) $('#commanderModal').hidden = true;
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
    setDoctrine('deception');
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
  const isHostRole = !forceJoinCode;
  const myName = (player && player.name && player.name !== '我方聯合戰術作戰群') ? player.name : (isHostRole ? '本部特遣隊' : '挑戰突擊隊');

  $('#pvpMyFlag').textContent = player.flag || '🇹🇼';
  $('#pvpMyName').textContent = myName;
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

  const oppName = (opponent && opponent.name && opponent.name !== '我方聯合戰術作戰群') ? opponent.name : (isHost ? '挑戰突擊隊' : '本部特遣隊');
  $('#pvpEnemyFlag').textContent = opponent.flag || '🌐';
  $('#pvpEnemyName').textContent = oppName;
  $('#pvpEnemyUid').textContent = opponent.uid || 'CMD-ONLINE';

  // 只有房主顯示開戰按鈕
  $('#btnPvpStartBattle').hidden = !isHost;
  toast(`⚡ 玩家【${opponent.flag || '🌐'} ${oppName}】(${opponent.uid}) 已成功連線進房！`);
});

function handleOnlinePvpSubmit() {
  if (state.pvpMyReady) {
    if (state.pvpOpponentReady) {
      if (OnlinePvPEngine.isHostUser()) {
        toast('🎯 雙方皆已就緒，立即發起戰鬥推演！');
        checkBothReadyAndStartCombat();
      } else {
        toast('📡 已再次向本部特遣隊發送出擊就緒信號...');
        OnlinePvPEngine.sendPacket('DECK_SUBMIT', {
          deck: state.deck.slice(),
          doctrine: state.doctrine,
          round: state.bo3.round
        });
      }
    } else {
      toast('⏳ 你的陣容已提交並鎖定，正在等待對手完成配置 (已重新發送就緒封包)...');
      OnlinePvPEngine.sendPacket('DECK_SUBMIT', {
        deck: state.deck.slice(),
        doctrine: state.doctrine,
        round: state.bo3.round
      });
    }
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
    doctrine: state.doctrine,
    round: state.bo3.round
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
    // 房主生成同一個公平隨機種子與動態戰場事件 (優先使用下局預告事件)
    const seed = (Math.random() * 4294967296) >>> 0;
    const event = state.bo3.nextEvent || pick(EVENTS.filter(e => !state.event || e.id !== state.event.id));
    state.bo3.nextEvent = null;
    // 同時在 COMBAT_SYNC 攜帶備援卡組資訊，徹底杜絕網路延遲競爭
    OnlinePvPEngine.sendPacket('COMBAT_SYNC', {
      seed,
      event,
      deck: state.deck.slice(),
      doctrine: state.doctrine
    });
    startOnlinePvpBattle(seed, event);
  }
}

function startOnlinePvpBattle(seed, event) {
  if (!state.pvpOpponentDeck) {
    toast('⚠️ 戰術資料同步中，請稍候...');
    return;
  }
  $('#onlinePvpModal').hidden = true;
  $('#resultModal').hidden = true;
  $('#bo3CounterModal').hidden = true;
  if (currentActiveModal) currentActiveModal.hidden = true;
  currentActiveModal = null;
  state.event = event;

  const isHost = OnlinePvPEngine.isHostUser();
  // 核心對稱保證：房主固定在左 (Side A), 挑戰者固定在右 (Side B)
  const hostDeck = (isHost ? state.deck : state.pvpOpponentDeck).slice();
  const guestDeck = (isHost ? state.pvpOpponentDeck : state.deck).slice();
  const hostDoc = isHost ? state.doctrine : (state.pvpOpponentDoc || 'defense');
  const guestDoc = isHost ? (state.pvpOpponentDoc || 'defense') : state.doctrine;

  const opp = OnlinePvPEngine.getOpponent();
  state.enemy = state.pvpOpponentDeck.slice();
  state.enemyDoc = state.pvpOpponentDoc || 'defense';
  if (opp) {
    const oppCleanName = (opp.name && opp.name !== '我方聯合戰術作戰群') ? opp.name : (isHost ? '挑戰突擊隊' : '本部特遣隊');
    state.enemyName = `${opp.flag || '🌐'} ${oppCleanName}`;
  }

  // 雙方以完全相同的隊伍順序調用推演引擎，保證隨機數完全對稱且 100% 同步
  const res = resolveBattle(hostDeck, guestDeck, {
    seed,
    event: state.event,
    docA: hostDoc,
    docB: guestDoc
  });
  state.lastRes = res;
  showBattle(res);
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
  state.bo3.bannedListA = [];
  state.bo3.bannedListB = [];
  if (opp) state.bo3.rivalName = `${opp.flag} ${opp.name} (${opp.uid})`;
  state.mode = 'bo3';

  $('#onlinePvpModal').hidden = true;
  currentActiveModal = null;
  renderAll();
  toast(`⚡ 本部特遣隊已發起 BO5 系列賽！請挑選 5 槽陣容並點擊【鎖定陣容】！`);
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
  if (payload.deck && (!state.pvpOpponentDeck || !state.pvpOpponentDeck.length)) {
    state.pvpOpponentDeck = payload.deck;
    state.pvpOpponentDoc = payload.doctrine || 'defense';
    state.pvpOpponentReady = true;
  }
  startOnlinePvpBattle(payload.seed, payload.event);
});

OnlinePvPEngine.on('opponent_ban_committed', payload => {
  const bannedId = payload.bannedUnitId;
  if (!state.bo3.bannedListB) state.bo3.bannedListB = [];
  if (payload.bannedList && Array.isArray(payload.bannedList)) {
    state.bo3.bannedListB = payload.bannedList.slice();
  } else if (!state.bo3.bannedListB.includes(bannedId)) {
    state.bo3.bannedListB.push(bannedId);
  }
  state.bo3.bannedByB = bannedId; // 最近一次被禁用的裝備
  toast(`⚠️ 對手啟動戰術反制！永久禁用了你的【${UNIT_MAP[bannedId]?.name || bannedId}】（累計被禁用 ${state.bo3.bannedListB.length} 件）！`);
  
  // 檢查所有卡槽：若當前卡槽中正好有任何被累計禁用的單位，強制卸下並解鎖提交
  const allBanned = currentBanned();
  let unmounted = false;
  state.deck.forEach((id, idx) => {
    if (id && allBanned.includes(id)) {
      state.deck[idx] = null;
      state.active = idx;
      unmounted = true;
    }
  });
  if (unmounted) {
    state.pvpMyReady = false;
  }
  
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
   支援：👤 單人闖關 ｜ 👥 私人好友開房 ｜ 🌐 公開大廳隨機匹配
   ===================================================== */
let tourneySelectedSize = 16;
let tourneySelectedFormat = 'hybrid';
let currentTourneyTab = 'solo'; // 'solo' | 'private' | 'public'
let privateSelectedSize = 4;
let privateSelectedFormat = 'hybrid';
let publicSelectedSize = 4;
let publicSelectedFormat = 'hybrid';
let publicRoomsUnsub = null;

function getTournamentPlayerProfile() {
  const p = (typeof LadderEngine !== 'undefined') ? LadderEngine.getState().player : null;
  let localUid = localStorage.getItem('topclash_user_uid');
  if (!localUid) {
    localUid = (typeof LadderEngine !== 'undefined' && LadderEngine.generateCommanderUID)
      ? LadderEngine.generateCommanderUID()
      : ('CMD-' + Math.floor(1000 + Math.random() * 9000));
    localStorage.setItem('topclash_user_uid', localUid);
  }
  const myUid = (p && p.uid && p.uid !== 'CMD-7392') ? p.uid : localUid;

  let myName = p?.name;
  if (!myName || myName === '我方聯合戰術作戰群' || myName === '我方特遣隊') {
    let savedAutoName = localStorage.getItem('topclash_auto_callsign');
    if (!savedAutoName) {
      savedAutoName = generateProceduralCallsign();
      localStorage.setItem('topclash_auto_callsign', savedAutoName);
      if (typeof LadderEngine !== 'undefined' && LadderEngine.setPlayerName) {
        LadderEngine.setPlayerName(savedAutoName, p?.flag || '🇹🇼');
      }
    }
    myName = savedAutoName;
  }

  return {
    uid: myUid,
    name: myName,
    flag: p?.flag || '🇹🇼',
    isMe: true,
    isAI: false,
    deck: state.deck.every(Boolean) ? state.deck.slice() : null,
    doctrine: state.doctrine || 'defense'
  };
}

function renderTourneyDeckBar() {
  const deckBar = $('#tourneyMyDeckBar');
  if (!deckBar) return;

  const isFull = state.deck.every(Boolean);
  const errs = isFull ? validateDeck(state.deck, budgetLimit(), currentBanned()) : ['尚未選滿 5 個槽位'];
  const cost = deckCost(state.deck.filter(Boolean));
  const prof = getTournamentPlayerProfile();
  const shortUid = prof.uid.replace('CMD-', '').slice(-4);

  if (errs.length === 0) {
    const unitsHtml = state.deck.map(id => {
      const u = UNIT_MAP[id];
      return u ? `<span style="font-size:11px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);padding:2px 6px;border-radius:4px;color:var(--text)"><b style="color:${CATS[u.cat].color}">$${u.cost}</b> ${esc(u.name.split(' ')[0])}</span>` : '';
    }).join(' ');
    deckBar.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <span style="font-weight:800;color:var(--cyan);display:flex;align-items:center;gap:5px">
          <span>${prof.flag}</span> 👑 ${esc(prof.name)} <span style="font-family:var(--mono);font-size:10.5px;color:var(--muted)">#${shortUid}</span>
          <button class="btn-micro" id="btnTourneyEditName" style="margin-left:4px" title="更換部隊呼號">✏️ 改名</button>
        </span>
        <div style="display:flex;gap:4px;flex-wrap:wrap">${unitsHtml}</div>
        <span style="font-family:var(--mono);font-size:11.5px;color:var(--muted)">$${cost}/15</span>
        <span class="badge badge-ok" style="font-size:10px">✔ 陣容整備完畢</span>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn ghost sm" id="btnTourneyLobbyTune">🛠️ 調配陣容</button>
      </div>
    `;
  } else {
    deckBar.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span style="font-weight:800;color:var(--amber);display:flex;align-items:center;gap:5px">
          <span>${prof.flag}</span> ⚠️ 參賽部隊整備中：${esc(prof.name)}
          <button class="btn-micro" id="btnTourneyEditName" style="margin-left:4px" title="更換部隊呼號">✏️ 改名</button>
        </span>
        <span class="muted" style="font-size:12px">${errs[0]}</span>
        <span style="font-family:var(--mono);font-size:11.5px;color:var(--amber)">($${cost}/15)</span>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn primary sm" id="btnTourneyLobbyRand">⚡ 隨機組隊 (R)</button>
        <button class="btn ghost sm" id="btnTourneyLobbyTune">🛠️ 前往軍火庫</button>
      </div>
    `;
  }

  $('#btnTourneyEditName')?.addEventListener('click', () => {
    openCommanderModal();
  });
  $('#btnTourneyLobbyTune')?.addEventListener('click', () => {
    setMode('quick');
    toast('請在軍火庫調整你的 5 槽聯合作戰陣容，完成後切回【淘汰錦標賽】！');
  });
  $('#btnTourneyLobbyRand')?.addEventListener('click', () => {
    const d = randomDeck(Math.random, budgetLimit(), []) || randomDeck(Math.random, budgetLimit(), []);
    if (d) {
      state.deck = d.slice();
      if (state.deckSlot === 'B') state.dualDecks.B = d.slice();
      else state.dualDecks.A = d.slice();
      renderTournamentView();
      toast('🎲 已自動為你隨機組建一組合法 15 元聯合作戰部隊！');
    }
  });
}

function renderTournamentView() {
  // 檢查是否處於 Firebase 線上多人房間中
  const onlineRoom = (typeof FirebaseTourneyEngine !== 'undefined') ? FirebaseTourneyEngine.getCurrentRoom() : null;
  const isOnlineActive = !!onlineRoom;

  let t = null;
  let isLobby = false;

  if (isOnlineActive) {
    t = onlineRoom;
    isLobby = (t.status === 'waiting');
  } else {
    t = TournamentEngine.getState();
    if (!t) {
      t = TournamentEngine.create(tourneySelectedSize, tourneySelectedFormat, getTournamentPlayerProfile());
    } else if (t.status === 'registration' && t.participants && t.participants[0]) {
      const prof = getTournamentPlayerProfile();
      t.participants[0].name = prof.name;
      t.participants[0].flag = prof.flag;
      t.participants[0].deck = prof.deck;
      t.participants[0].doctrine = prof.doctrine;
    }
    isLobby = (t.status === 'registration');
  }

  const tourneyHeader = $('#tourneyHeader');
  const lobbyCard = $('#tourneyLobbyCard');
  const bracketVp = $('#tourneyBracketViewport');
  const tourneyLayout = $('#viewTournament');

  if (tourneyLayout) tourneyLayout.classList.toggle('is-lobby', isLobby);
  if (tourneyHeader) tourneyHeader.hidden = isLobby; // 大廳備戰時隱藏獨立 HUD，徹底消除重複卡片
  if (lobbyCard) lobbyCard.hidden = !isLobby;
  if (bracketVp) bracketVp.hidden = isLobby;

  if (isLobby) {
    renderTourneyLobby(t, isOnlineActive);
  } else {
    renderTourneyHeader(t, isOnlineActive);
    renderTournamentBracket(t);
  }
}

function renderTourneyHeader(t, isOnline = false) {
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

  const prof = getTournamentPlayerProfile();
  let myMatch = null;

  if (isOnline) {
    // 從雲端 room.matches 尋找自己參與的對戰
    myMatch = Object.values(t.matches || {}).find(m => {
      if (m.status === 'finished') return false;
      const aIsMe = m.teamA && m.teamA.uid === prof.uid;
      const bIsMe = m.teamB && m.teamB.uid === prof.uid;
      return (aIsMe || bIsMe) && (m.teamA && m.teamB);
    }) || null;
  } else {
    myMatch = TournamentEngine.getMyMatch();
  }

  const amIEliminated = !myMatch && (t.status === 'in_progress');

  $('#tourneyRoundPill').textContent = `第 ${t.currentRound}/${t.totalRounds} 輪 · ${roundNames[t.currentRound] || '淘汰賽'}`;
  $('#tourneyFormatName').textContent = formatNames[t.format || t.matchType] || '標準賽制';

  const statusTagEl = $('#tourneyStatusTag');
  if (statusTagEl) {
    if (t.status === 'completed') {
      statusTagEl.textContent = '🏁 賽事圓滿完結';
      statusTagEl.style.background = 'rgba(245, 158, 11, 0.15)';
      statusTagEl.style.borderColor = 'rgba(245, 158, 11, 0.4)';
      statusTagEl.style.color = '#fbbf24';
    } else if (amIEliminated) {
      statusTagEl.textContent = '👀 戰術觀戰中';
      statusTagEl.style.background = 'rgba(148, 163, 184, 0.15)';
      statusTagEl.style.borderColor = 'rgba(148, 163, 184, 0.4)';
      statusTagEl.style.color = '#94a3b8';
    } else {
      statusTagEl.textContent = '🟢 激戰進行中';
      statusTagEl.style.background = 'rgba(16, 185, 129, 0.15)';
      statusTagEl.style.borderColor = 'rgba(16, 185, 129, 0.4)';
      statusTagEl.style.color = '#34d399';
    }
  }

  const myStateEl = $('#tourneyMyState');
  if (myStateEl) {
    if (t.status === 'completed') {
      const won = t.champion && (t.champion.uid === prof.uid || t.champion.isMe);
      myStateEl.innerHTML = won ? '🏆 <b style="color:#fbbf24">榮獲世界盃總冠軍！</b>' : '🏁 賽事圓滿完結';
    } else if (amIEliminated) {
      myStateEl.innerHTML = '👀 <span style="color:#94a3b8">特邀戰術觀摩員 (點選對抗樹即時觀戰)</span>';
    } else if (myMatch) {
      myStateEl.innerHTML = '🟢 <b style="color:var(--cyan)">席位在線 · 準備迎戰</b>';
    } else {
      myStateEl.innerHTML = '⏳ 備戰大廳';
    }
  }

  // 計算當前輪次剩餘隊伍
  const activeTeams = Object.values(t.matches || {}).filter(m => m.round === t.currentRound && m.status !== 'finished').length * 2;
  $('#tourneyRemainingCount').textContent = `${Math.max(activeTeams, 2)} 隊`;

  // 操作按鈕列
  const actBox = $('#tourneyActionBox');
  if (actBox) {
    if (t.status === 'registration' || t.status === 'waiting') {
      actBox.innerHTML = '';
    } else if (myMatch && t.status === 'in_progress') {
      const isTeamA = myMatch.teamA && myMatch.teamA.uid === prof.uid;
      const opp = isTeamA ? myMatch.teamB : myMatch.teamA;
      const readyKey = isTeamA ? 'readyA' : 'readyB';
      const isIReady = myMatch[readyKey] === true;

      const totalRounds = t.totalRounds || Math.log2(t.size);
      const reqWins = (typeof FirebaseTourneyEngine !== 'undefined' && FirebaseTourneyEngine.getRequiredWins)
        ? FirebaseTourneyEngine.getRequiredWins(myMatch, t.format, totalRounds)
        : 1;
      const roundNum = ensureArray(myMatch.history).length + 1;
      const secLeft = myMatch.deadline ? Math.max(0, Math.ceil((myMatch.deadline - Date.now()) / 1000)) : 60;
      const oppFlag = opp?.flag || '🌐';
      const oppTitle = opp?.name || '待定對手';

      let fightBtnText = '';
      if (isIReady) {
        fightBtnText = `⏳ 陣容已鎖定 · 等對手出擊 (${secLeft}s)...`;
      } else if (reqWins > 1) {
        fightBtnText = `⚔️ 迎戰 ${oppFlag} ${esc(oppTitle)} (第 ${roundNum} 局 · 目前 ${myMatch.scoreA || 0}:${myMatch.scoreB || 0})`;
      } else {
        fightBtnText = `⚔️ 迎戰 ${oppFlag} ${esc(oppTitle)} (出擊)`;
      }

      const waitPct = Math.max(0, Math.min(100, Math.round((secLeft / 60) * 100)));
      const waitProgressHtml = isIReady ? `
        <div class="tourney-wait-bar-wrap" id="tourneyWaitBarWrap" data-deadline="${myMatch.deadline || (Date.now() + 60000)}">
          <div class="tourney-wait-bar-track"><div class="tourney-wait-bar-fill" id="tourneyWaitBarFill" style="width:${waitPct}%"></div></div>
          <span class="tourney-wait-status" id="tourneyWaitStatus">📡 對手正在調配戰術陣容 · 倒數 <b>${secLeft}s</b> 後自動由 AI 特遣隊接管開戰</span>
        </div>
      ` : '';
      actBox.innerHTML = `
        <button class="btn amber sm" id="btnTourneyGoFight" style="font-weight:800;animation:pulseGoldBorder 1.5s infinite">
          ${fightBtnText}
        </button>
        <button class="btn ghost sm" id="btnTourneyTuneDeck" title="調整當前作戰陣容">🛠️ 調配陣容</button>
        ${isOnline ? '<button class="btn ghost sm" id="btnTourneyLeaveOnline" style="color:var(--red);border-color:rgba(255,93,110,.3)">退出房間 ✕</button>' : '<button class="btn ghost sm" id="btnTourneyResetAll" style="color:var(--red);border-color:rgba(255,93,110,.3)">重置錦標賽 ✕</button>'}
        ${waitProgressHtml}
      `;
      if (window.__tourneyWaitTicker) clearInterval(window.__tourneyWaitTicker);
      if (isIReady && myMatch.deadline) {
        window.__tourneyWaitTicker = setInterval(() => {
          const wrap = document.getElementById('tourneyWaitBarWrap');
          if (!wrap) { clearInterval(window.__tourneyWaitTicker); return; }
          const dl = Number(wrap.dataset.deadline) || 0;
          const rem = Math.max(0, Math.ceil((dl - Date.now()) / 1000));
          const pct = Math.max(0, Math.min(100, Math.round((rem / 60) * 100)));
          const fillEl = document.getElementById('tourneyWaitBarFill');
          const statEl = document.getElementById('tourneyWaitStatus');
          const btnEl = document.getElementById('btnTourneyGoFight');
          if (fillEl) fillEl.style.width = pct + '%';
          if (statEl) statEl.innerHTML = `📡 對手正在調配戰術陣容 · 倒數 <b>${rem}s</b> 後自動由 AI 特遣隊接管開戰`;
          if (btnEl) btnEl.textContent = `⏳ 陣容已鎖定 · 等對手出擊 (${rem}s)...`;
          if (rem <= 0) clearInterval(window.__tourneyWaitTicker);
        }, 1000);
      }
    } else {
      actBox.innerHTML = `
        <span class="muted" style="font-size:12px;margin-right:6px">點選樹狀圖任一場次即可觀摩推演</span>
        <button class="btn ghost sm" id="btnTourneyTuneDeck">🛠️ 瀏覽軍火庫</button>
        ${isOnline ? '<button class="btn ghost sm" id="btnTourneyLeaveOnline" style="color:var(--red);border-color:rgba(255,93,110,.3)">返回大廳 ✕</button>' : '<button class="btn ghost sm" id="btnTourneyResetAll" style="color:var(--red);border-color:rgba(255,93,110,.3)">重新開賽 🔄</button>'}
      `;
    }
  }
}

function renderTourneyLobby(t, isOnline = false) {
  renderTourneyDeckBar();

  // 若處於線上多人房間
  if (isOnline) {
    const prof = getTournamentPlayerProfile();
    const isHost = t.hostUid === prof.uid;
    const roomCode = t.id;

    // 切換至私人房間活躍面板
    currentTourneyTab = 'private';
    updateTourneyTabPanels();

    $('#privateLobbyEntrance').hidden = true;
    $('#privateRoomActiveView').hidden = false;
    $('#privateRoomCodeDisplay').textContent = roomCode;
    $('#privateTotalCount').textContent = t.size;

    const participants = Array.isArray(t.participants) ? t.participants : Object.values(t.participants || {});
    const filled = participants.filter(Boolean).length;
    $('#privateFilledCount').textContent = filled;

    // 只有房主能開賽或 AI 補位
    $('#btnPrivateStart').disabled = !isHost;
    if (!isHost) {
      $('#btnPrivateStart').textContent = '⌛ 等待房主點擊正式開賽...';
      $('#btnPrivateStart').className = 'btn ghost lg block';
    } else {
      $('#btnPrivateStart').textContent = '⚔️ 正式開賽 · 啟動多人錦標賽 (START TOURNAMENT)';
      $('#btnPrivateStart').className = 'btn amber lg block';
    }

    const grid = $('#privateParticipantsGrid');
    if (grid) {
      grid.innerHTML = participants.map((p, idx) => {
        if (!p) {
          return `<div class="p-slot-chip empty">
            <span class="muted">#${idx + 1}</span>
            <span class="p-name muted" style="font-style:italic">待抽籤席位 (各國特遣隊)</span>
            <span class="muted" style="font-size:9.5px">空席</span>
          </div>`;
        }
        const isMe = (p.uid === prof.uid);
        return `<div class="p-slot-chip ${isMe ? 'me' : (p.isAI ? 'ai' : 'online-peer')}">
          <span>${p.flag || '🌐'}</span>
          <span class="p-name" style="${isMe ? 'font-weight:800;color:var(--cyan)' : ''}" title="${esc(p.name)}">${esc(p.name)}</span>
          <span class="badge ${isMe ? 'badge-ok' : (p.isAI ? '' : 'badge-ok')}" style="font-size:9px;padding:1px 4px;margin-left:auto">
            ${isMe ? '你親率參賽' : (p.isAI ? 'AI 特遣隊' : '🟢 真人選手')}
          </span>
        </div>`;
      }).join('');
    }
    return;
  }

  // 單人闖關大廳
  $('#lobbyTotalCount').textContent = t.size;
  const participants = Array.isArray(t.participants) ? t.participants : Object.values(t.participants || {});
  const filled = participants.filter(Boolean).length;
  $('#lobbyFilledCount').textContent = filled;

  const grid = $('#lobbyParticipantsGrid');
  if (!grid) return;

  grid.innerHTML = participants.map((p, idx) => {
    if (!p) {
      return `<div class="p-slot-chip empty">
        <span class="muted">#${idx + 1}</span>
        <span class="p-name muted" style="font-style:italic">待抽籤席位 (各國特遣隊)</span>
        <span class="muted" style="font-size:9.5px">AI 抽籤</span>
      </div>`;
    }
    return `<div class="p-slot-chip ${p.isMe ? 'me' : 'ai'}">
      <span>${p.flag || '🌐'}</span>
      <span class="p-name" title="${esc(p.name)}">${esc(p.name)}</span>
      <span class="muted" style="font-size:9.5px">${p.isMe ? '你親率參賽' : '各國特遣隊'}</span>
    </div>`;
  }).join('');
}

function getFormatNameShort(fmt) {
  if (fmt === 'bo1') return '⚡ 全程 BO1';
  if (fmt === 'bo3') return '⚔️ 全程 BO3';
  return '⭐ 決賽升級制';
}

function updateTourneyLobbyBadge() {
  const badge = $('#tourneyLobbyModeBadge');
  if (!badge) return;

  const onlineRoom = (typeof FirebaseTourneyEngine !== 'undefined') ? FirebaseTourneyEngine.getCurrentRoom() : null;
  if (onlineRoom && onlineRoom.status === 'waiting') {
    badge.innerHTML = `👥 私人房間 [#${esc(onlineRoom.id)}] · <b>${onlineRoom.size} 強</b> <span style="opacity:0.85">(${getFormatNameShort(onlineRoom.format || onlineRoom.matchType)})</span>`;
    badge.style.color = 'var(--amber)';
    badge.style.borderColor = 'rgba(245,158,11,.45)';
    badge.style.background = 'rgba(245,158,11,.12)';
    return;
  }

  if (currentTourneyTab === 'solo') {
    badge.innerHTML = `👤 單人闖關 · <b>${tourneySelectedSize} 強</b> <span style="opacity:0.85">(${getFormatNameShort(tourneySelectedFormat)})</span>`;
    badge.style.color = 'var(--cyan)';
    badge.style.borderColor = 'rgba(61,224,255,.45)';
    badge.style.background = 'rgba(61,224,255,.12)';
  } else if (currentTourneyTab === 'private') {
    badge.innerHTML = `👥 私人好友 · <b>${privateSelectedSize} 強</b> <span style="opacity:0.85">(${getFormatNameShort(privateSelectedFormat)})</span>`;
    badge.style.color = 'var(--amber)';
    badge.style.borderColor = 'rgba(245,158,11,.45)';
    badge.style.background = 'rgba(245,158,11,.12)';
  } else {
    badge.innerHTML = `🌐 公開隨機 · <b>${publicSelectedSize} 強</b> <span style="opacity:0.85">(${getFormatNameShort(publicSelectedFormat)})</span>`;
    badge.style.color = 'var(--green)';
    badge.style.borderColor = 'rgba(93,255,176,.45)';
    badge.style.background = 'rgba(93,255,176,.12)';
  }
}

function syncTourneySelectorsUI() {
  // Solo 面板按鈕選取同步
  document.querySelectorAll('#tourneySizeSelector .pill-btn').forEach(b => {
    b.classList.toggle('active', +b.dataset.size === tourneySelectedSize);
  });
  document.querySelectorAll('#tourneyFormatSelector .pill-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.format === tourneySelectedFormat);
  });
  // Private 面板按鈕選取同步
  document.querySelectorAll('#privateSizeSelector .pill-btn').forEach(b => {
    b.classList.toggle('active', +b.dataset.size === privateSelectedSize);
  });
  document.querySelectorAll('#privateFormatSelector .pill-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.format === privateSelectedFormat);
  });
  // Public 面板按鈕選取同步
  document.querySelectorAll('#publicSizeSelector .pill-btn').forEach(b => {
    b.classList.toggle('active', +b.dataset.size === publicSelectedSize);
  });
  document.querySelectorAll('#publicFormatSelector .pill-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.format === publicSelectedFormat);
  });
}

function updateTourneyTabPanels() {
  document.querySelectorAll('#tourneyModeTabs .t-mode-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === currentTourneyTab);
  });

  $('#panelTourneySolo').hidden = (currentTourneyTab !== 'solo');
  $('#panelTourneyPrivate').hidden = (currentTourneyTab !== 'private');
  $('#panelTourneyPublic').hidden = (currentTourneyTab !== 'public');

  syncTourneySelectorsUI();
  updateTourneyLobbyBadge();

  if (currentTourneyTab === 'public' && typeof FirebaseTourneyEngine !== 'undefined') {
    startListeningPublicRooms();
  }
}

function startListeningPublicRooms() {
  if (publicRoomsUnsub) publicRoomsUnsub();
  const listEl = $('#tourneyPublicRoomsList');
  if (!listEl) return;
  listEl.innerHTML = '<div class="muted" style="grid-column:1/-1;text-align:center;padding:20px">⏳ 正在同步雲端即時大廳房間清單...</div>';

  publicRoomsUnsub = FirebaseTourneyEngine.listenPublicRooms(rooms => {
    if (!rooms || rooms.length === 0) {
      listEl.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:30px;background:rgba(255,255,255,.02);border:1px dashed var(--line);border-radius:8px">
          <div style="font-size:24px;margin-bottom:6px">🌐</div>
          <div style="font-weight:700;color:var(--text);font-size:14px">目前沒有等待中的公開房間</div>
          <div class="muted" style="font-size:12px;margin-top:4px">點擊上方【⚡ 一鍵快速匹配出擊】立即發起湊桌，60 秒 (1分鐘) 必開賽！</div>
        </div>
      `;
      return;
    }

    listEl.innerHTML = rooms.map(r => {
      const remainingSec = r.countdownEnd ? Math.max(0, Math.floor((r.countdownEnd - Date.now()) / 1000)) : 60;
      return `<div class="room-live-card" data-code="${esc(r.code)}">
        <div class="r-top">
          <div class="r-name">${esc(r.name)}</div>
          <span class="badge ${remainingSec > 0 ? 'badge-ok' : ''}" style="font-size:10px">
            ${remainingSec > 0 ? `⏱️ 倒數 ${remainingSec}s` : '🔥 滿員即開'}
          </span>
        </div>
        <div class="r-meta">
          <span>${r.hostFlag} ${esc(r.hostName)}</span>
          <span>·</span>
          <span><b>${r.size} 強</b> (${r.format === 'bo1' ? '⚡ BO1' : (r.format === 'bo3' ? '⚔️ BO3' : '⭐ 升級制')})</span>
          <span>·</span>
          <span style="color:var(--cyan);font-weight:700">${r.filledCount}/${r.size} 席位</span>
        </div>
        <div style="margin-top:4px">
          <button class="btn primary sm block btnJoinLiveRoom" data-code="${esc(r.code)}">一鍵加入房間 ➔</button>
        </div>
      </div>`;
    }).join('');
  });
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

  container.style.height = 'auto';
  container.classList.remove('is-mobile-pan');
  container.style.transform = 'translate(-50%, -50%)';
  const natW = container.offsetWidth;
  const natH = container.offsetHeight;
  const vpW = viewport.clientWidth;
  const vpH = viewport.clientHeight;
  if (!natW || !natH || !vpW || !vpH) return 1;

  // 手機與窄螢幕 (<= 768px)：維持最小可讀字級縮放 (0.68x ~ 0.90x)，啟用觸控平移並自動聚焦至「我方作戰線」
  if (window.innerWidth <= 768) {
    const mScale = Math.max(0.68, Math.min((vpW - 16) / natW, 0.92));
    container.classList.remove('is-fitted');
    container.classList.add('is-mobile-pan');
    container.style.transform = `scale(${mScale.toFixed(4)})`;
    container.dataset.scale = String(mScale);
    requestAnimationFrame(() => {
      const myCard = container.querySelector('.b-match-card.is-my-match') || container.querySelector('.bracket-center');
      if (myCard && !viewport.dataset.userScrolled) {
        const cRect = container.getBoundingClientRect();
        const mRect = myCard.getBoundingClientRect();
        const targetLeft = (mRect.left - cRect.left) - (vpW - mRect.width) / 2;
        viewport.scrollLeft = Math.max(0, targetLeft);
      }
    });
    return mScale;
  }

  // 桌機與平板橫向 (> 768px)：一屏流等比縮放，寬高皆完整放入（保留 12px 安全邊距）
  const availW = vpW - 12;
  const availH = vpH - 12;
  const scale = Math.min(availW / natW, availH / natH, 1.25);

  const targetH = availH / scale;
  if (targetH > natH) container.style.height = `${Math.floor(targetH)}px`;

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
  const prof = getTournamentPlayerProfile();
  const isMyMatch = (m.teamA?.uid === prof.uid || m.teamB?.uid === prof.uid || m.teamA?.isMe || m.teamB?.isMe);
  const isFinished = (m.status === 'finished');
  const totalRounds = t.totalRounds || Math.log2(t.size);
  const reqWins = (typeof FirebaseTourneyEngine !== 'undefined' && FirebaseTourneyEngine.getRequiredWins)
    ? FirebaseTourneyEngine.getRequiredWins(m, t.format, totalRounds)
    : TournamentEngine.getRequiredWins(m);

  // 局數計分圓點生成輔助 (BO3/BO5 pips)
  const renderPips = (score, req) => {
    if (req <= 1) return '';
    let pips = '';
    for (let i = 0; i < req; i++) {
      pips += `<span class="pip ${i < score ? 'won' : ''}"></span>`;
    }
    return `<div class="b-pips">${pips}</div>`;
  };

  const renderTeamTag = (team, isOpponent) => {
    if (!team) return '';
    const isMe = (team.uid === prof.uid || team.isMe);
    if (isMe) {
      return `<span class="badge" style="background:rgba(61,224,255,.25);color:var(--cyan);border:1px solid rgba(61,224,255,.5);font-size:9px;padding:1px 4px;margin-right:4px">👑我方</span>`;
    }
    if (isOpponent) {
      return `<span class="badge" style="background:rgba(239,68,68,.25);color:#ef4444;border:1px solid rgba(239,68,68,.5);font-size:9px;padding:1px 4px;margin-right:4px">🎯對手</span>`;
    }
    if (team.isAI) {
      return `<span class="badge" style="background:rgba(255,255,255,.08);color:var(--muted);font-size:8.5px;padding:1px 3px;margin-left:4px">🤖AI</span>`;
    }
    return `<span class="badge" style="background:rgba(16,185,129,.15);color:#10b981;font-size:8.5px;padding:1px 3px;margin-left:4px">🟢真人</span>`;
  };

  const renderUidSuffix = (team) => {
    if (!team || team.isAI || !team.uid) return '';
    const shortUid = team.uid.replace('CMD-', '').slice(-4);
    return `<span style="font-family:var(--mono);font-size:9px;color:var(--muted);margin-left:3px">#${shortUid}</span>`;
  };

  return `<div class="b-match-card ${isMyMatch ? 'is-my-match' : ''} ${isFinal ? 'is-grand-final' : ''} ${isBronze ? 'is-bronze-card' : ''}" data-match-id="${m.id}">
    <div class="port-terminal port-left" aria-hidden="true"></div>
    <div class="port-terminal port-right" aria-hidden="true"></div>

    ${isMyMatch ? `<div class="my-match-strip"><span class="pulse-beacon"></span> 我方作戰線</div>` : ''}

    <div class="b-team-row ${isFinished && m.winner === 'A' ? 'winner' : isFinished ? 'loser' : ''}">
      <div class="b-team-name-box">
        ${renderTeamTag(m.teamA, isMyMatch && m.teamB && (m.teamB.uid === prof.uid || m.teamB.isMe))}
        <span class="b-team-flag-pill">${m.teamA ? m.teamA.flag : '？'}</span>
        <span class="b-team-name" title="${m.teamA ? esc(m.teamA.name) : '待定對手'}">
          ${m.teamA ? esc(m.teamA.name) : '待定對手'}
        </span>
        ${renderUidSuffix(m.teamA)}
      </div>
      <div class="b-score-wrapper">
        ${renderPips(m.scoreA, reqWins)}
        <span class="b-score-plate ${isFinished && m.winner === 'A' ? 'is-winner' : ''}">${m.scoreA}</span>
      </div>
    </div>

    <div class="b-team-row ${isFinished && m.winner === 'B' ? 'winner' : isFinished ? 'loser' : ''}">
      <div class="b-team-name-box">
        ${renderTeamTag(m.teamB, isMyMatch && m.teamA && (m.teamA.uid === prof.uid || m.teamA.isMe))}
        <span class="b-team-flag-pill">${m.teamB ? m.teamB.flag : '？'}</span>
        <span class="b-team-name" title="${m.teamB ? esc(m.teamB.name) : '待定對手'}">
          ${m.teamB ? esc(m.teamB.name) : '待定對手'}
        </span>
        ${renderUidSuffix(m.teamB)}
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
  const onlineRoom = (typeof FirebaseTourneyEngine !== 'undefined') ? FirebaseTourneyEngine.getCurrentRoom() : null;
  let snap = null;
  if (onlineRoom && onlineRoom.status === 'in_progress') {
    const m = onlineRoom.matches ? onlineRoom.matches[matchId] : null;
    if (m) {
      const totalRounds = onlineRoom.totalRounds || Math.log2(onlineRoom.size);
      const reqWins = (typeof FirebaseTourneyEngine !== 'undefined' && FirebaseTourneyEngine.getRequiredWins)
        ? FirebaseTourneyEngine.getRequiredWins(m, onlineRoom.format, totalRounds)
        : 1;
      snap = {
        matchId: m.id,
        round: m.round,
        status: m.status,
        teamA: m.teamA,
        teamB: m.teamB,
        scoreA: m.scoreA || 0,
        scoreB: m.scoreB || 0,
        requiredWins: reqWins,
        history: ensureArray(m.history)
      };
    }
  } else {
    snap = TournamentEngine.getMatchSnapshot(matchId);
    if (snap) snap.history = ensureArray(snap.history);
  }
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
  const onlineRoom = (typeof FirebaseTourneyEngine !== 'undefined') ? FirebaseTourneyEngine.getCurrentRoom() : null;
  if (onlineRoom && onlineRoom.status === 'in_progress') {
    showResult(res, {
      bo3NextText: '🏆 返回錦標賽對抗樹',
      bo3Callback: () => {
        closeBattle();
        setMode('tournament');
      }
    });
    return;
  }

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

/* 綁定錦標賽大廳與樹狀圖交互事件 (支援 Solo / Private / Public) */
$('#tourneyModeTabs')?.addEventListener('click', e => {
  const btn = e.target.closest('.t-mode-tab'); if (!btn) return;
  currentTourneyTab = btn.dataset.tab;
  updateTourneyTabPanels();
});

$('#tourneySizeSelector')?.addEventListener('click', e => {
  const btn = e.target.closest('.pill-btn'); if (!btn) return;
  tourneySelectedSize = +btn.dataset.size;
  TournamentEngine.create(tourneySelectedSize, tourneySelectedFormat, getTournamentPlayerProfile());
  renderTournamentView();
  syncTourneySelectorsUI();
  updateTourneyLobbyBadge();
});

$('#tourneyFormatSelector')?.addEventListener('click', e => {
  const btn = e.target.closest('.pill-btn'); if (!btn) return;
  tourneySelectedFormat = btn.dataset.format;
  TournamentEngine.create(tourneySelectedSize, tourneySelectedFormat, getTournamentPlayerProfile());
  renderTournamentView();
  syncTourneySelectorsUI();
  updateTourneyLobbyBadge();
});

$('#privateSizeSelector')?.addEventListener('click', e => {
  const btn = e.target.closest('.pill-btn'); if (!btn) return;
  privateSelectedSize = +btn.dataset.size;
  syncTourneySelectorsUI();
  updateTourneyLobbyBadge();
  toast(`已設定私人房間規模：${privateSelectedSize} 強`);
});

$('#privateFormatSelector')?.addEventListener('click', e => {
  const btn = e.target.closest('.pill-btn'); if (!btn) return;
  privateSelectedFormat = btn.dataset.format || 'hybrid';
  syncTourneySelectorsUI();
  updateTourneyLobbyBadge();
  toast(`已設定私人賽制：${getFormatNameShort(privateSelectedFormat)}`);
});

$('#publicSizeSelector')?.addEventListener('click', e => {
  const btn = e.target.closest('.pill-btn'); if (!btn) return;
  publicSelectedSize = +btn.dataset.size;
  syncTourneySelectorsUI();
  updateTourneyLobbyBadge();
  toast(`已設定公開排隊規模：${publicSelectedSize} 強`);
});

$('#publicFormatSelector')?.addEventListener('click', e => {
  const btn = e.target.closest('.pill-btn'); if (!btn) return;
  publicSelectedFormat = btn.dataset.format || 'hybrid';
  syncTourneySelectorsUI();
  updateTourneyLobbyBadge();
  toast(`已設定公開賽制：${getFormatNameShort(publicSelectedFormat)}`);
});

$('#btnTourneyFillAI')?.addEventListener('click', () => {
  TournamentEngine.fillWithAI();
  renderTournamentView();
  toast('🤖 已自動抽籤調派全球各國特遣隊，補滿全部參賽席位！');
});

$('#btnTourneyResetLobby')?.addEventListener('click', () => {
  TournamentEngine.create(tourneySelectedSize, tourneySelectedFormat, getTournamentPlayerProfile());
  renderTournamentView();
  toast('已重置參賽席位');
});

$('#btnTourneyStart')?.addEventListener('click', () => {
  const errs = validateDeck(state.deck, budgetLimit(), currentBanned());
  if (errs.length) {
    toast(`⚠️ 參賽陣容尚未整備完畢（${errs[0]}），請先點選「隨機組隊」或前往軍火庫配置！`);
    return;
  }
  TournamentEngine.start();
  renderTournamentView();
  toast('🏆 世界盃淘汰錦標賽正式開賽！世足對抗樹已生成！');
});

// 私人房間：建立房間
$('#btnCreatePrivateRoom')?.addEventListener('click', async () => {
  try {
    const prof = getTournamentPlayerProfile();
    const res = await FirebaseTourneyEngine.createRoom({
      size: privateSelectedSize,
      format: privateSelectedFormat,
      isPublic: false,
      playerProfile: prof
    });
    toast(`👑 成功建立私人房間【${res.roomCode}】！已生成邀請連結。`);
    renderTournamentView();
  } catch (err) {
    toast(`⚠️ 建房失敗：${err.message}`);
  }
});

// 私人房間：加入房間
$('#btnJoinTourneyRoom')?.addEventListener('click', async () => {
  const code = $('#inputJoinTourneyCode')?.value.trim();
  if (!code) {
    toast('請輸入 6 位房間代碼！');
    return;
  }
  try {
    const prof = getTournamentPlayerProfile();
    await FirebaseTourneyEngine.joinRoom(code, prof);
    toast(`🟢 成功加入錦標賽房間【${code.toUpperCase()}】！`);
    renderTournamentView();
  } catch (err) {
    toast(`⚠️ 加入失敗：${err.message}`);
  }
});

// 複製代碼與邀請連結
$('#btnCopyTourneyCode')?.addEventListener('click', () => {
  const code = $('#privateRoomCodeDisplay')?.textContent;
  if (code && code !== '------') {
    navigator.clipboard?.writeText(code);
    toast(`📋 已複製房間代碼：${code}`);
  }
});

$('#btnCopyTourneyLink')?.addEventListener('click', () => {
  const code = $('#privateRoomCodeDisplay')?.textContent;
  if (code && code !== '------') {
    const url = new URL(window.location.href);
    url.searchParams.set('tourney', code);
    navigator.clipboard?.writeText(url.toString());
    toast(`🔗 已複製專屬邀請連結！傳送給好友即可一鍵入隊！`);
  }
});

$('#btnLeaveTourneyRoom')?.addEventListener('click', () => {
  if (confirm('確定要退出當前線上錦標賽房間嗎？')) {
    FirebaseTourneyEngine.leaveRoom();
    $('#privateRoomActiveView').hidden = true;
    $('#privateLobbyEntrance').hidden = false;
    toast('已安全退出房間，返回大廳。');
    renderTournamentView();
  }
});

$('#btnPrivateFillAI')?.addEventListener('click', async () => {
  const code = FirebaseTourneyEngine.getCurrentRoomCode();
  if (code) {
    await FirebaseTourneyEngine.fillWithAI(code);
    toast('🤖 已調派全球各國特遣隊補齊名額，並正式開賽！');
  }
});

$('#btnPrivateStart')?.addEventListener('click', async () => {
  const code = FirebaseTourneyEngine.getCurrentRoomCode();
  if (code) {
    await FirebaseTourneyEngine.startTournament(code);
    toast('🏆 多人錦標賽正式開賽！世足對抗樹已生成！');
  }
});

// 公開大廳：快速匹配
$('#btnQuickMatchTourney')?.addEventListener('click', async () => {
  try {
    const prof = getTournamentPlayerProfile();
    toast(`⚡ 正在搜尋雲端最快開賽之 ${publicSelectedSize} 強公開房間...`);
    const res = await FirebaseTourneyEngine.quickMatch(prof, publicSelectedSize, publicSelectedFormat);
    if (res.isNew) {
      toast(`👑 已為你發起 ${publicSelectedSize} 強公開湊桌房【${res.roomCode}】！60 秒自動倒數開賽！`);
    } else {
      toast(`🟢 已快速滑入公開房間【${res.roomCode}】！等待開賽！`);
    }
    renderTournamentView();
  } catch(err) {
    toast(`⚠️ 匹配失敗：${err.message}`);
  }
});

// 公開大廳：主動建立公開房間
$('#btnCreatePublicRoom')?.addEventListener('click', async () => {
  try {
    const prof = getTournamentPlayerProfile();
    const res = await FirebaseTourneyEngine.createRoom({
      name: `軍武世界盃 ${publicSelectedSize}強公開賽`,
      size: publicSelectedSize,
      format: publicSelectedFormat,
      isPublic: true,
      playerProfile: prof
    });
    toast(`👑 成功建立公開房間【${res.roomCode}】！已發布至大廳清單，啟動 60 秒倒數！`);
    renderTournamentView();
  } catch(err) {
    toast(`⚠️ 公開建房失敗：${err.message}`);
  }
});

$('#btnRefreshPublicRooms')?.addEventListener('click', () => {
  startListeningPublicRooms();
  toast('🔄 已刷新公開大廳即時房間清單');
});

// 點擊公開房間卡片加入
$('#tourneyPublicRoomsList')?.addEventListener('click', async e => {
  const btn = e.target.closest('.btnJoinLiveRoom'); if (!btn) return;
  const code = btn.dataset.code;
  if (!code) return;
  try {
    const prof = getTournamentPlayerProfile();
    await FirebaseTourneyEngine.joinRoom(code, prof);
    toast(`🟢 成功加入公開房間【${code}】！`);
    renderTournamentView();
  } catch(err) {
    toast(`⚠️ 加入失敗：${err.message}`);
  }
});

$('#tourneyActionBox')?.addEventListener('click', async e => {
  if (e.target.closest('#btnTourneyGoFight')) {
    const onlineRoom = (typeof FirebaseTourneyEngine !== 'undefined') ? FirebaseTourneyEngine.getCurrentRoom() : null;
    if (onlineRoom && onlineRoom.status === 'in_progress') {
      // 線上多人出擊：雙階段盲提
      const prof = getTournamentPlayerProfile();
      const errs = validateDeck(state.deck, budgetLimit(), currentBanned());
      if (errs.length) {
        toast(`⚠️ 參賽陣容未達標（${errs[0]}）！請調整陣容。`);
        setMode('quick');
        return;
      }
      const myMatch = Object.values(onlineRoom.matches || {}).find(m => {
        if (m.status === 'finished') return false;
        const aIsMe = m.teamA && m.teamA.uid === prof.uid;
        const bIsMe = m.teamB && m.teamB.uid === prof.uid;
        return aIsMe || bIsMe;
      });
      if (myMatch) {
        await FirebaseTourneyEngine.submitMatchDeck(onlineRoom.id, myMatch.id, prof.uid, state.deck, state.doctrine);
        toast('🎯 陣容已鎖定並提交雲端！等待對手出擊...');
        renderTournamentView();
      }
      return;
    }

    startTournamentPlayerBattle();
    return;
  }
  if (e.target.closest('#btnTourneyTuneDeck')) {
    setMode('quick');
    toast('請在軍火庫調整你的 5 槽聯合作戰陣容，完成後切回【淘汰錦標賽】出擊！');
    return;
  }
  if (e.target.closest('#btnTourneyLeaveOnline')) {
    if (confirm('確定要退出當前線上錦標賽嗎？')) {
      FirebaseTourneyEngine.leaveRoom();
      toast('已退出線上錦標賽');
      renderTournamentView();
    }
    return;
  }
  if (e.target.closest('#btnTourneyResetAll')) {
    TournamentEngine.create(tourneySelectedSize, tourneySelectedFormat, getTournamentPlayerProfile());
    renderTournamentView();
    toast('已重置淘汰錦標賽，回到配置大廳');
    return;
  }
});

// 監聽 Firebase 房間更新與戰鬥播報事件
if (typeof FirebaseTourneyEngine !== 'undefined') {
  let tourneyTicker = null;
  setInterval(() => {
    const room = FirebaseTourneyEngine.getCurrentRoom();
    if (room && state.mode === 'tournament') {
      if (room.status === 'waiting' && room.isPublic && room.countdownEnd && Date.now() > room.countdownEnd) {
        const prof = getTournamentPlayerProfile();
        if (room.hostUid === prof.uid) {
          FirebaseTourneyEngine.fillWithAI(room.id);
        }
      }
      if (room.status === 'in_progress') {
        FirebaseTourneyEngine.checkTimeoutAndAutoResolve(room.id);
        const btn = document.querySelector('#btnTourneyGoFight');
        if (btn && btn.textContent.includes('等對手出擊')) {
          const prof = getTournamentPlayerProfile();
          const myMatch = Object.values(room.matches || {}).find(m => {
            if (m.status === 'finished') return false;
            return (m.teamA && m.teamA.uid === prof.uid) || (m.teamB && m.teamB.uid === prof.uid);
          });
          if (myMatch && myMatch.deadline) {
            const sec = Math.max(0, Math.ceil((myMatch.deadline - Date.now()) / 1000));
            btn.textContent = '⏳ 陣容已鎖定 · 等對手出擊 (' + sec + 's)...';
          }
        }
      }
    }
  }, 1000);

  FirebaseTourneyEngine.on('room_updated', room => {
    if (state.mode === 'tournament') {
      renderTournamentView();
    }
  });

  FirebaseTourneyEngine.on('match_resolved', data => {
    if (state.mode !== 'tournament') return;
    const prof = getTournamentPlayerProfile();
    const m = data.match;
    if (m && (m.teamA?.uid === prof.uid || m.teamB?.uid === prof.uid)) {
      const isTeamA = (m.teamA && m.teamA.uid === prof.uid);
      const opp = isTeamA ? m.teamB : m.teamA;
      const h = data.historyItem;
      const res = data.res;

      state.mode = 'tournament';
      state.deck = isTeamA ? h.deckA.slice() : h.deckB.slice();
      state.doctrine = isTeamA ? (h.docA || 'defense') : (h.docB || 'defense');
      state.enemy = isTeamA ? h.deckB.slice() : h.deckA.slice();
      state.enemyDoc = isTeamA ? (h.docB || 'defense') : (h.docA || 'defense');
      state.enemyName = ((opp?.flag || '') + ' ' + (opp?.name || '對手')).trim();
      state.event = h.event || { id: 'fair', name: '晴朗無風', icon: '☀' };
      state.seed = h.seed;
      state.lastRes = res;

      showBattle(res);
      toast('⚔️ 雙方陣容已揭曉！正式進入對決推演！');
    }
  });

  FirebaseTourneyEngine.on('room_closed', () => {
    toast('房間已關閉或結束');
    if (state.mode === 'tournament') {
      renderTournamentView();
    }
  });
}

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
    const onlineRoom = (typeof FirebaseTourneyEngine !== 'undefined') ? FirebaseTourneyEngine.getCurrentRoom() : null;
    if (onlineRoom && onlineRoom.status && onlineRoom.status !== 'waiting') {
      const fbSnap = FirebaseTourneyEngine.getMatchSnapshot(matchId, rIdx);
      if (fbSnap && fbSnap.battleRes) {
        $('#tourneySpectatorModal').hidden = true;
        currentActiveModal = null;
        showBattle(fbSnap.battleRes);
      }
      return;
    }
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
const tourneyParam = new URLSearchParams(window.location.search).get('tourney');
if (tourneyParam && typeof FirebaseTourneyEngine !== 'undefined') {
  setTimeout(async () => {
    setMode('tournament');
    currentTourneyTab = 'private';
    updateTourneyTabPanels();
    const input = $('#inputJoinTourneyCode');
    if (input) input.value = tourneyParam.toUpperCase();
    try {
      const prof = getTournamentPlayerProfile();
      await FirebaseTourneyEngine.joinRoom(tourneyParam.toUpperCase(), prof);
      toast(`🟢 透過專屬連結加入錦標賽房間【${tourneyParam.toUpperCase()}】！`);
      renderTournamentView();
    } catch(e) {
      toast(`⚠️ 加入房間提示：${e.message}`);
    }
  }, 400);
}

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

const replayParam = urlParams.get('replay');
if (replayParam) {
  try {
    const raw = atob(replayParam.trim());
    const [dA, dB, seedStr, evId, docA, docB] = raw.split('~');
    const deckA = dA.split('.').filter(id => UNIT_MAP[id]);
    const deckB = dB.split('.').filter(id => UNIT_MAP[id]);
    if (deckA.length === 5 && deckB.length === 5) {
      LS.set('db15_seen', 1);
      const evObj = EVENTS.find(e => e.id === evId) || EVENTS[0];
      state.deck = deckA.slice();
      state.enemy = deckB.slice();
      state.event = evObj;
      state.doctrine = docA || 'defense';
      state.enemyDoc = docB || 'defense';
      const res = resolveBattle(deckA, deckB, {
        seed: Number(seedStr) >>> 0,
        event: evObj,
        docA: state.doctrine,
        docB: state.enemyDoc
      });
      state.lastRes = res;
      setTimeout(() => {
        showBattle(res);
        toast('🎬 已載入分享戰局重播，正在重現完整推演！');
      }, 250);
    }
  } catch (e) {
    console.warn('Replay decode error:', e);
  }
}

if (!LS.get('db15_seen', 0) && !replayParam && !tourneyParam && !roomParam) showHelp();

// Service Worker 由 index.html 與 armory.html 統一註冊

window.__db15 = { state, startBattle, setMode, getGhostPool, applyTheme, toggleTheme, LadderEngine, renderLadderView, OnlinePvPEngine, getTournamentPlayerProfile, buildReplayShareUrl };
})();
