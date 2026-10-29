'use strict';
/* =====================================================
   頂尖對戰：15元聯合作戰 — 天梯榮譽榜資料庫 (Ladder Data)
   包含 100 位天梯指揮官名冊、軍階定義與 100% 合法真實防守陣容
   ===================================================== */

const LADDER_RANKS = [
  { tier: 10, name: '特級上將', en: 'GENERAL OF THE ARMIES', icon: '🎖️', minRP: 3000, color: '#f59e0b' },
  { tier: 9,  name: '四星上將', en: 'FOUR-STAR GENERAL',      icon: '⭐⭐⭐⭐', minRP: 2000, color: '#fbbf24' },
  { tier: 8,  name: '三星中將', en: 'LIEUTENANT GENERAL',     icon: '⭐⭐⭐',   minRP: 1600, color: '#38bdf8' },
  { tier: 7,  name: '二星少將', en: 'MAJOR GENERAL',          icon: '⭐⭐',     minRP: 1300, color: '#818cf8' },
  { tier: 6,  name: '一星准將', en: 'BRIGADIER GENERAL',      icon: '⭐',       minRP: 1050, color: '#a78bfa' },
  { tier: 5,  name: '戰區上校', en: 'COLONEL',                icon: '⚔️⚔️',    minRP: 850,  color: '#34d399' },
  { tier: 4,  name: '作戰中校', en: 'LT. COLONEL',            icon: '⚔️',      minRP: 650,  color: '#2dd4bf' },
  { tier: 3,  name: '戰術少校', en: 'MAJOR',                  icon: '🛡️⭐',    minRP: 450,  color: '#94a3b8' },
  { tier: 2,  name: '特遣上尉', en: 'CAPTAIN',                icon: '🛡️',      minRP: 250,  color: '#64748b' },
  { tier: 1,  name: '作戰少尉', en: 'LIEUTENANT',             icon: '🔰',       minRP: 0,    color: '#475569' }
];

const LADDER_PRESETS = [
  {
    "id": "bot_01",
    "name": "鷹隼特遣隊・阿特拉斯",
    "flag": "🇺🇸",
    "rp": 3500,
    "doc": "strike",
    "deck": [
      "J20",
      "CH3",
      "BUKM3",
      "T22",
      "FPV"
    ],
    "title": "極致空優先手打擊"
  },
  {
    "id": "bot_02",
    "name": "北方威龍戰鬥群・赤羽",
    "flag": "🇨🇳",
    "rp": 3447,
    "doc": "defense",
    "deck": [
      "RAFALE",
      "K2",
      "IRIST",
      "GOWIND",
      "SW600"
    ],
    "title": "遠程截擊裝甲防禦"
  },
  {
    "id": "bot_03",
    "name": "北極熊近衛突擊軍・沃爾科夫",
    "flag": "🇷🇺",
    "rp": 3393,
    "doc": "strike",
    "deck": [
      "J20",
      "T10",
      "NASAMS",
      "KD",
      "MORTAR"
    ],
    "title": "超機動重裝狂飆"
  },
  {
    "id": "bot_04",
    "name": "北約飆風聯隊・雷諾",
    "flag": "🇫🇷",
    "rp": 3340,
    "doc": "deception",
    "deck": [
      "F15EX",
      "T14",
      "TC2",
      "SORYU",
      "FPV"
    ],
    "title": "全能陣風光電壓制"
  },
  {
    "id": "bot_05",
    "name": "日耳曼裝甲重拳・海因茨",
    "flag": "🇩🇪",
    "rp": 3287,
    "doc": "defense",
    "deck": [
      "M2K9",
      "M1A1",
      "HQ16",
      "SORYU",
      "SMERCH"
    ],
    "title": "超音速空優重裝洪流"
  },
  {
    "id": "bot_06",
    "name": "高麗黑豹突擊隊・崔將軍",
    "flag": "🇰🇷",
    "rp": 3233,
    "doc": "strike",
    "deck": [
      "EF2K",
      "LEO2A4",
      "SAMPT",
      "GOWIND",
      "SW600"
    ],
    "title": "黑豹突擊神經網絡"
  },
  {
    "id": "bot_07",
    "name": "沙漠投石索營・艾利爾",
    "flag": "🇮🇱",
    "rp": 3180,
    "doc": "deception",
    "deck": [
      "F35A",
      "CM34",
      "SAMPT",
      "KD",
      "SW300"
    ],
    "title": "隱身深打鐵穹防禦"
  },
  {
    "id": "bot_08",
    "name": "皇家無敵艦隊・漢密爾頓",
    "flag": "🇬🇧",
    "rp": 3127,
    "doc": "defense",
    "deck": [
      "F16V",
      "CH3",
      "IRIST",
      "SORYU",
      "TB2"
    ],
    "title": "45型神盾巡弋穿透"
  },
  {
    "id": "bot_09",
    "name": "大和神盾機動隊・山本",
    "flag": "🇯🇵",
    "rp": 3073,
    "doc": "deception",
    "deck": [
      "F22",
      "T99A",
      "HQ16",
      "SAAR6",
      "SPOT"
    ],
    "title": "深打匿蹤遠程截擊"
  },
  {
    "id": "bot_10",
    "name": "極北獅鷲戰隊・拉爾森",
    "flag": "🇸🇪",
    "rp": 3020,
    "doc": "strike",
    "deck": [
      "RAFALE",
      "K2",
      "IRIST",
      "SAAR6",
      "TB2"
    ],
    "title": "分散野戰機動出擊"
  },
  {
    "id": "bot_11",
    "name": "安納托利亞蜂群・凱末爾",
    "flag": "🇹🇷",
    "rp": 2960,
    "doc": "deception",
    "deck": [
      "F22",
      "T90",
      "IRIST",
      "U212",
      "SW300"
    ],
    "title": "無人蜂群精準直擊"
  },
  {
    "id": "bot_12",
    "name": "第十山地快速反應旅",
    "flag": "🇺🇸",
    "rp": 2892,
    "doc": "strike",
    "deck": [
      "EF2K",
      "M1A2",
      "TC2",
      "SORYU",
      "MORTAR"
    ],
    "title": "重型火箭面殺傷"
  },
  {
    "id": "bot_13",
    "name": "東海迅雷防空營・林上校",
    "flag": "🇨🇳",
    "rp": 2825,
    "doc": "defense",
    "deck": [
      "J10C",
      "LEO2A4",
      "HQ16",
      "KILO",
      "ARCHER"
    ],
    "title": "055神盾防空阻絕"
  },
  {
    "id": "bot_14",
    "name": "烏拉爾鋼鐵近衛旅",
    "flag": "🇷🇺",
    "rp": 2757,
    "doc": "defense",
    "deck": [
      "F15EX",
      "LEO2A4",
      "TK3",
      "GOWIND",
      "SW600"
    ],
    "title": "突破型穿甲極限"
  },
  {
    "id": "bot_15",
    "name": "高盧凱撒重砲團",
    "flag": "🇫🇷",
    "rp": 2689,
    "doc": "deception",
    "deck": [
      "J20",
      "BOXER",
      "IRON",
      "SORYU",
      "SPOT"
    ],
    "title": "長程自走精準火力"
  },
  {
    "id": "bot_16",
    "name": "波羅的海海狼潛航隊",
    "flag": "🇩🇪",
    "rp": 2622,
    "doc": "defense",
    "deck": [
      "JAS39",
      "CH3",
      "IRIST",
      "SORYU",
      "ORION"
    ],
    "title": "AIP潛艦寂靜伏擊"
  },
  {
    "id": "bot_17",
    "name": "波斯灣黑金守衛隊",
    "flag": "🇦🇪",
    "rp": 2554,
    "doc": "strike",
    "deck": [
      "J20",
      "LEC",
      "HQ16",
      "SAAR6",
      "FPV"
    ],
    "title": "全天候多域防護"
  },
  {
    "id": "bot_18",
    "name": "南十字星防衛陣線",
    "flag": "🇦🇺",
    "rp": 2486,
    "doc": "deception",
    "deck": [
      "F15EX",
      "T99A",
      "IRIST",
      "T22",
      "MQ9"
    ],
    "title": "全球鷹全域情報引導"
  },
  {
    "id": "bot_19",
    "name": "安地斯雄鷹特混隊",
    "flag": "🇨🇱",
    "rp": 2418,
    "doc": "strike",
    "deck": [
      "F35A",
      "T10",
      "IRIST",
      "KILO",
      "SW300"
    ],
    "title": "高原作戰長程打擊"
  },
  {
    "id": "bot_20",
    "name": "維京暴風巡邏隊",
    "flag": "🇳🇴",
    "rp": 2351,
    "doc": "defense",
    "deck": [
      "EF2K",
      "M1A2",
      "AVNG",
      "U212",
      "SW300"
    ],
    "title": "峽灣隱匿快速防衛"
  },
  {
    "id": "bot_21",
    "name": "戰區第 21 聯合防衛分隊",
    "flag": "🇩🇪",
    "rp": 2283,
    "doc": "deception",
    "deck": [
      "J10C",
      "T10",
      "NASAMS",
      "U212",
      "CAESAR"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_22",
    "name": "戰區第 22 聯合防衛分隊",
    "flag": "🇯🇵",
    "rp": 2215,
    "doc": "strike",
    "deck": [
      "RAFALE",
      "T90",
      "SAMPT",
      "SAAR6",
      "ORION"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_23",
    "name": "戰區第 23 聯合防衛分隊",
    "flag": "🇮🇱",
    "rp": 2148,
    "doc": "defense",
    "deck": [
      "F22",
      "STRY",
      "SAMPT",
      "KD",
      "FPV"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_24",
    "name": "戰區第 24 聯合防衛分隊",
    "flag": "🇸🇪",
    "rp": 2080,
    "doc": "deception",
    "deck": [
      "JAS39",
      "LEC",
      "IRIST",
      "SORYU",
      "TB2"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_25",
    "name": "戰區第 25 聯合防衛分隊",
    "flag": "🇰🇷",
    "rp": 2030,
    "doc": "strike",
    "deck": [
      "J20",
      "CH3",
      "NASAMS",
      "TJ",
      "SW300"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_26",
    "name": "戰區第 26 聯合防衛分隊",
    "flag": "🇹🇼",
    "rp": 2006,
    "doc": "defense",
    "deck": [
      "RAFALE",
      "LEC",
      "NASAMS",
      "TJ",
      "MQ9"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_27",
    "name": "戰區第 27 聯合防衛分隊",
    "flag": "🇵🇱",
    "rp": 1983,
    "doc": "deception",
    "deck": [
      "F35A",
      "LEO2A4",
      "HQ16",
      "U212",
      "SPOT"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_28",
    "name": "戰區第 28 聯合防衛分隊",
    "flag": "🇹🇷",
    "rp": 1959,
    "doc": "strike",
    "deck": [
      "RAFALE",
      "LEO2",
      "TC2",
      "SORYU",
      "MORTAR"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_29",
    "name": "戰區第 29 聯合防衛分隊",
    "flag": "🇮🇹",
    "rp": 1935,
    "doc": "defense",
    "deck": [
      "F16V",
      "T10",
      "HQ16",
      "KD",
      "ARCHER"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_30",
    "name": "戰區第 30 聯合防衛分隊",
    "flag": "🇳🇴",
    "rp": 1911,
    "doc": "deception",
    "deck": [
      "EF2K",
      "T10",
      "SAMPT",
      "SAAR6",
      "MQ9"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_31",
    "name": "戰區第 31 聯合防衛分隊",
    "flag": "🇺🇸",
    "rp": 1888,
    "doc": "strike",
    "deck": [
      "J20",
      "STRY",
      "IRON",
      "SORYU",
      "MORTAR"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_32",
    "name": "戰區第 32 聯合防衛分隊",
    "flag": "🇨🇳",
    "rp": 1864,
    "doc": "defense",
    "deck": [
      "JAS39",
      "CH3",
      "BUKM3",
      "U212",
      "ORION"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_33",
    "name": "戰區第 33 聯合防衛分隊",
    "flag": "🇷🇺",
    "rp": 1840,
    "doc": "deception",
    "deck": [
      "SU57",
      "CH3",
      "HQ16",
      "SAAR6",
      "SW300"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_34",
    "name": "戰區第 34 聯合防衛分隊",
    "flag": "🇫🇷",
    "rp": 1816,
    "doc": "strike",
    "deck": [
      "F15EX",
      "K2",
      "IRIST",
      "SAAR6",
      "TB2"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_35",
    "name": "戰區第 35 聯合防衛分隊",
    "flag": "🇬🇧",
    "rp": 1793,
    "doc": "defense",
    "deck": [
      "F22",
      "T10",
      "HQ16",
      "KILO",
      "SPOT"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_36",
    "name": "戰區第 36 聯合防衛分隊",
    "flag": "🇩🇪",
    "rp": 1769,
    "doc": "deception",
    "deck": [
      "RAFALE",
      "LEO2",
      "AVNG",
      "SORYU",
      "MORTAR"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_37",
    "name": "戰區第 37 聯合防衛分隊",
    "flag": "🇯🇵",
    "rp": 1745,
    "doc": "strike",
    "deck": [
      "JAS39",
      "M1A1",
      "NASAMS",
      "U212",
      "SMERCH"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_38",
    "name": "戰區第 38 聯合防衛分隊",
    "flag": "🇮🇱",
    "rp": 1721,
    "doc": "defense",
    "deck": [
      "EF2K",
      "M1A1",
      "HQ9L",
      "SAAR6",
      "SW600"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_39",
    "name": "戰區第 39 聯合防衛分隊",
    "flag": "🇸🇪",
    "rp": 1698,
    "doc": "deception",
    "deck": [
      "F35A",
      "BOXER",
      "TK3",
      "KD",
      "MORTAR"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_40",
    "name": "戰區第 40 聯合防衛分隊",
    "flag": "🇰🇷",
    "rp": 1674,
    "doc": "strike",
    "deck": [
      "M2K9",
      "K2",
      "IRIST",
      "KILO",
      "MQ9"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_41",
    "name": "戰區第 41 聯合防衛分隊",
    "flag": "🇹🇼",
    "rp": 1650,
    "doc": "defense",
    "deck": [
      "F22",
      "CH3",
      "HQ16",
      "GOWIND",
      "SPOT"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_42",
    "name": "戰區第 42 聯合防衛分隊",
    "flag": "🇵🇱",
    "rp": 1627,
    "doc": "deception",
    "deck": [
      "SU35",
      "LEC",
      "BUKM3",
      "T22",
      "SW600"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_43",
    "name": "戰區第 43 聯合防衛分隊",
    "flag": "🇹🇷",
    "rp": 1603,
    "doc": "strike",
    "deck": [
      "F35A",
      "T10",
      "HQ16",
      "KILO",
      "FPV"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_44",
    "name": "戰區第 44 聯合防衛分隊",
    "flag": "🇮🇹",
    "rp": 1579,
    "doc": "defense",
    "deck": [
      "SU35",
      "M1A2",
      "AVNG",
      "KILO",
      "FPV"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_45",
    "name": "戰區第 45 聯合防衛分隊",
    "flag": "🇳🇴",
    "rp": 1555,
    "doc": "deception",
    "deck": [
      "J10C",
      "M1A1",
      "NASAMS",
      "KILO",
      "PZH"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_46",
    "name": "戰區第 46 聯合防衛分隊",
    "flag": "🇺🇸",
    "rp": 1532,
    "doc": "strike",
    "deck": [
      "F15EX",
      "M1A1",
      "SAMPT",
      "T22",
      "ORION"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_47",
    "name": "戰區第 47 聯合防衛分隊",
    "flag": "🇨🇳",
    "rp": 1508,
    "doc": "defense",
    "deck": [
      "F22",
      "STRY",
      "HQ9L",
      "KD",
      "SPOT"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_48",
    "name": "戰區第 48 聯合防衛分隊",
    "flag": "🇷🇺",
    "rp": 1484,
    "doc": "deception",
    "deck": [
      "JAS39",
      "T99A",
      "HQ16",
      "KD",
      "ORION"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_49",
    "name": "戰區第 49 聯合防衛分隊",
    "flag": "🇫🇷",
    "rp": 1460,
    "doc": "strike",
    "deck": [
      "J20",
      "K2",
      "IRIST",
      "TJ",
      "MORTAR"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_50",
    "name": "戰區第 50 聯合防衛分隊",
    "flag": "🇬🇧",
    "rp": 1437,
    "doc": "defense",
    "deck": [
      "F15EX",
      "T99A",
      "BUKM3",
      "GOWIND",
      "MQ9"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_51",
    "name": "戰區第 51 聯合防衛分隊",
    "flag": "🇩🇪",
    "rp": 1413,
    "doc": "deception",
    "deck": [
      "SU57",
      "M1A1",
      "BUKM3",
      "SORYU",
      "FPV"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_52",
    "name": "戰區第 52 聯合防衛分隊",
    "flag": "🇯🇵",
    "rp": 1389,
    "doc": "strike",
    "deck": [
      "EF2K",
      "MK4",
      "AVNG",
      "SORYU",
      "FPV"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_53",
    "name": "戰區第 53 聯合防衛分隊",
    "flag": "🇮🇱",
    "rp": 1365,
    "doc": "defense",
    "deck": [
      "F16V",
      "M1A1",
      "NASAMS",
      "SORYU",
      "CAESAR"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_54",
    "name": "戰區第 54 聯合防衛分隊",
    "flag": "🇸🇪",
    "rp": 1342,
    "doc": "deception",
    "deck": [
      "F15EX",
      "T10",
      "HQ9L",
      "T22",
      "SW600"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_55",
    "name": "戰區第 55 聯合防衛分隊",
    "flag": "🇰🇷",
    "rp": 1318,
    "doc": "strike",
    "deck": [
      "F22",
      "T72",
      "IRON",
      "KD",
      "SW300"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_56",
    "name": "戰區第 56 聯合防衛分隊",
    "flag": "🇹🇼",
    "rp": 1294,
    "doc": "defense",
    "deck": [
      "J10C",
      "T99A",
      "BUKM3",
      "U212",
      "SW600"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_57",
    "name": "戰區第 57 聯合防衛分隊",
    "flag": "🇵🇱",
    "rp": 1271,
    "doc": "deception",
    "deck": [
      "F35A",
      "K2",
      "NASAMS",
      "GOWIND",
      "SW300"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_58",
    "name": "戰區第 58 聯合防衛分隊",
    "flag": "🇹🇷",
    "rp": 1247,
    "doc": "strike",
    "deck": [
      "EF2K",
      "K2",
      "BUKM3",
      "GOWIND",
      "SW600"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_59",
    "name": "戰區第 59 聯合防衛分隊",
    "flag": "🇮🇹",
    "rp": 1223,
    "doc": "defense",
    "deck": [
      "SU57",
      "M1A1",
      "HQ16",
      "SORYU",
      "MORTAR"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_60",
    "name": "戰區第 60 聯合防衛分隊",
    "flag": "🇳🇴",
    "rp": 1199,
    "doc": "deception",
    "deck": [
      "SU35",
      "T14",
      "GEPARD",
      "KILO",
      "MORTAR"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_61",
    "name": "戰區第 61 聯合防衛分隊",
    "flag": "🇺🇸",
    "rp": 1176,
    "doc": "strike",
    "deck": [
      "M2K9",
      "M1A1",
      "NASAMS",
      "SORYU",
      "SMERCH"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_62",
    "name": "戰區第 62 聯合防衛分隊",
    "flag": "🇨🇳",
    "rp": 1152,
    "doc": "defense",
    "deck": [
      "SU35",
      "LEO2A4",
      "SAMPT",
      "T22",
      "SW600"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_63",
    "name": "戰區第 63 聯合防衛分隊",
    "flag": "🇷🇺",
    "rp": 1128,
    "doc": "deception",
    "deck": [
      "F22",
      "CM34",
      "IRON",
      "KD",
      "MORTAR"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_64",
    "name": "戰區第 64 聯合防衛分隊",
    "flag": "🇫🇷",
    "rp": 1104,
    "doc": "strike",
    "deck": [
      "JAS39",
      "T99A",
      "BUKM3",
      "KILO",
      "SW600"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_65",
    "name": "戰區第 65 聯合防衛分隊",
    "flag": "🇬🇧",
    "rp": 1081,
    "doc": "defense",
    "deck": [
      "J20",
      "CH3",
      "HQ16",
      "T22",
      "MORTAR"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_66",
    "name": "戰區第 66 聯合防衛分隊",
    "flag": "🇩🇪",
    "rp": 1057,
    "doc": "deception",
    "deck": [
      "F15EX",
      "LEC",
      "BUKM3",
      "TJ",
      "SW600"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_67",
    "name": "戰區第 67 聯合防衛分隊",
    "flag": "🇯🇵",
    "rp": 1033,
    "doc": "strike",
    "deck": [
      "J20",
      "T90",
      "NASAMS",
      "KILO",
      "SW300"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_68",
    "name": "戰區第 68 聯合防衛分隊",
    "flag": "🇮🇱",
    "rp": 1009,
    "doc": "defense",
    "deck": [
      "RAFALE",
      "T14",
      "TC2",
      "SORYU",
      "SPOT"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_69",
    "name": "戰區第 69 聯合防衛分隊",
    "flag": "🇸🇪",
    "rp": 986,
    "doc": "deception",
    "deck": [
      "F16V",
      "T10",
      "IRIST",
      "U212",
      "SMERCH"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_70",
    "name": "戰區第 70 聯合防衛分隊",
    "flag": "🇰🇷",
    "rp": 962,
    "doc": "strike",
    "deck": [
      "EF2K",
      "LEO2A4",
      "HQ9L",
      "T22",
      "SW600"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_71",
    "name": "戰區第 71 聯合防衛分隊",
    "flag": "🇹🇼",
    "rp": 938,
    "doc": "defense",
    "deck": [
      "F35A",
      "STRY",
      "SAMPT",
      "KD",
      "FPV"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_72",
    "name": "戰區第 72 聯合防衛分隊",
    "flag": "🇵🇱",
    "rp": 915,
    "doc": "deception",
    "deck": [
      "M2K9",
      "T99A",
      "HQ16",
      "U212",
      "MQ9"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_73",
    "name": "戰區第 73 聯合防衛分隊",
    "flag": "🇹🇷",
    "rp": 891,
    "doc": "strike",
    "deck": [
      "SU57",
      "CH3",
      "HQ16",
      "SAAR6",
      "MORTAR"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_74",
    "name": "戰區第 74 聯合防衛分隊",
    "flag": "🇮🇹",
    "rp": 867,
    "doc": "defense",
    "deck": [
      "F15EX",
      "LEC",
      "BUKM3",
      "TJ",
      "MQ9"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_75",
    "name": "戰區第 75 聯合防衛分隊",
    "flag": "🇳🇴",
    "rp": 843,
    "doc": "deception",
    "deck": [
      "F35A",
      "T10",
      "HQ16",
      "U212",
      "SPOT"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_76",
    "name": "戰區第 76 聯合防衛分隊",
    "flag": "🇺🇸",
    "rp": 820,
    "doc": "strike",
    "deck": [
      "EF2K",
      "T14",
      "TC2",
      "KD",
      "FPV"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_77",
    "name": "戰區第 77 聯合防衛分隊",
    "flag": "🇨🇳",
    "rp": 796,
    "doc": "defense",
    "deck": [
      "J10C",
      "T10",
      "NASAMS",
      "SORYU",
      "CAESAR"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_78",
    "name": "戰區第 78 聯合防衛分隊",
    "flag": "🇷🇺",
    "rp": 772,
    "doc": "deception",
    "deck": [
      "SU35",
      "T90",
      "IRON",
      "SAAR6",
      "MQ9"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_79",
    "name": "戰區第 79 聯合防衛分隊",
    "flag": "🇫🇷",
    "rp": 748,
    "doc": "strike",
    "deck": [
      "F22",
      "STRY",
      "IRON",
      "KILO",
      "FPV"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_80",
    "name": "戰區第 80 聯合防衛分隊",
    "flag": "🇬🇧",
    "rp": 725,
    "doc": "defense",
    "deck": [
      "JAS39",
      "LEC",
      "IRIST",
      "KILO",
      "SW600"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_81",
    "name": "戰區第 81 聯合防衛分隊",
    "flag": "🇩🇪",
    "rp": 701,
    "doc": "deception",
    "deck": [
      "F35A",
      "K2",
      "HQ16",
      "SAAR6",
      "FPV"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_82",
    "name": "戰區第 82 聯合防衛分隊",
    "flag": "🇯🇵",
    "rp": 677,
    "doc": "strike",
    "deck": [
      "RAFALE",
      "LEC",
      "BUKM3",
      "T22",
      "ORION"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_83",
    "name": "戰區第 83 聯合防衛分隊",
    "flag": "🇮🇱",
    "rp": 653,
    "doc": "defense",
    "deck": [
      "SU57",
      "LEO2A4",
      "BUKM3",
      "SORYU",
      "SPOT"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_84",
    "name": "戰區第 84 聯合防衛分隊",
    "flag": "🇸🇪",
    "rp": 630,
    "doc": "deception",
    "deck": [
      "F15EX",
      "M1A2",
      "GEPARD",
      "SORYU",
      "FPV"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_85",
    "name": "戰區第 85 聯合防衛分隊",
    "flag": "🇰🇷",
    "rp": 606,
    "doc": "strike",
    "deck": [
      "JAS39",
      "M1A1",
      "NASAMS",
      "KILO",
      "CAESAR"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_86",
    "name": "戰區第 86 聯合防衛分隊",
    "flag": "🇹🇼",
    "rp": 582,
    "doc": "defense",
    "deck": [
      "F15EX",
      "T10",
      "TK3",
      "T22",
      "SW600"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_87",
    "name": "戰區第 87 聯合防衛分隊",
    "flag": "🇵🇱",
    "rp": 559,
    "doc": "deception",
    "deck": [
      "SU57",
      "BOXER",
      "SAMPT",
      "U212",
      "SPOT"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_88",
    "name": "戰區第 88 聯合防衛分隊",
    "flag": "🇹🇷",
    "rp": 535,
    "doc": "strike",
    "deck": [
      "M2K9",
      "K2",
      "NASAMS",
      "SORYU",
      "MQ9"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_89",
    "name": "戰區第 89 聯合防衛分隊",
    "flag": "🇮🇹",
    "rp": 511,
    "doc": "defense",
    "deck": [
      "SU57",
      "CH3",
      "HQ16",
      "GOWIND",
      "FPV"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_90",
    "name": "戰區第 90 聯合防衛分隊",
    "flag": "🇳🇴",
    "rp": 487,
    "doc": "deception",
    "deck": [
      "SU35",
      "K2",
      "HQ16",
      "TJ",
      "MQ9"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_91",
    "name": "戰區第 91 聯合防衛分隊",
    "flag": "🇺🇸",
    "rp": 464,
    "doc": "strike",
    "deck": [
      "SU57",
      "LEO2A4",
      "NASAMS",
      "KILO",
      "SW300"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_92",
    "name": "戰區第 92 聯合防衛分隊",
    "flag": "🇨🇳",
    "rp": 440,
    "doc": "defense",
    "deck": [
      "F15EX",
      "MK4",
      "TC2",
      "U212",
      "SPOT"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_93",
    "name": "戰區第 93 聯合防衛分隊",
    "flag": "🇷🇺",
    "rp": 416,
    "doc": "deception",
    "deck": [
      "JAS39",
      "LEO2A4",
      "HQ16",
      "SORYU",
      "ARCHER"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_94",
    "name": "戰區第 94 聯合防衛分隊",
    "flag": "🇫🇷",
    "rp": 392,
    "doc": "strike",
    "deck": [
      "EF2K",
      "T90",
      "IRON",
      "GOWIND",
      "MQ9"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_95",
    "name": "戰區第 95 聯合防衛分隊",
    "flag": "🇬🇧",
    "rp": 369,
    "doc": "defense",
    "deck": [
      "F35A",
      "CM34",
      "TK3",
      "KD",
      "MORTAR"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_96",
    "name": "戰區第 96 聯合防衛分隊",
    "flag": "🇩🇪",
    "rp": 345,
    "doc": "deception",
    "deck": [
      "JAS39",
      "T99A",
      "IRIST",
      "KILO",
      "ORION"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_97",
    "name": "戰區第 97 聯合防衛分隊",
    "flag": "🇯🇵",
    "rp": 321,
    "doc": "strike",
    "deck": [
      "SU57",
      "LEC",
      "BUKM3",
      "T22",
      "SW300"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_98",
    "name": "戰區第 98 聯合防衛分隊",
    "flag": "🇮🇱",
    "rp": 297,
    "doc": "defense",
    "deck": [
      "EF2K",
      "CH3",
      "BUKM3",
      "TJ",
      "MQ9"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_99",
    "name": "戰區第 99 聯合防衛分隊",
    "flag": "🇸🇪",
    "rp": 274,
    "doc": "deception",
    "deck": [
      "F35A",
      "T90",
      "HQ16",
      "SORYU",
      "SW300"
    ],
    "title": "戰備全域巡航防線"
  },
  {
    "id": "bot_100",
    "name": "戰區第 100 聯合防衛分隊",
    "flag": "🇰🇷",
    "rp": 250,
    "doc": "strike",
    "deck": [
      "SU35",
      "T14",
      "TC2",
      "U212",
      "SW300"
    ],
    "title": "戰備全域巡航防線"
  }
];
