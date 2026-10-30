'use strict';
/* =====================================================
   頂尖對戰：15元聯合作戰 — 資料層 (v4.8.0 2026最新軍武與全域平衡版)
   100 款全差異化現代裝備 = 5 兵種 × 5 價位 × 4 款 (100% 具備專屬戰術特性)
   ===================================================== */
const BUDGET = 15;

const CATS = {
  air:         { label: '制空打擊',     short: 'AIR', color: '#38bdf8' },
  armor:       { label: '重裝鐵騎',     short: 'ARM', color: '#fbbf24' },
  air_defense: { label: '區域防空',     short: 'ADS', color: '#a78bfa' },
  naval:       { label: '制海權威',     short: 'NAV', color: '#22d3ee' },
  support:     { label: '情報／長程打擊', short: 'ISR', color: '#4ade80' }
};

/* 五大兵種專屬槽位 */
const SLOTS = [
  { id: 's1', label: '制空槽', fixed: 'air' },
  { id: 's2', label: '裝甲槽', fixed: 'armor' },
  { id: 's3', label: '防空槽', fixed: 'air_defense' },
  { id: 's4', label: '制海槽', fixed: 'naval' },
  { id: 's5', label: '支援槽', fixed: 'support' }
];

const TRAITS = {
  CAS:     '空中密接：第三階段對地傷害 ×1.8（一般戰機 ×1.15，對裝甲再 ×1.1）',
  LR:      '遠程截擊：空戰命中率 +6%',
  HEAVY:   '重裝甲：複合／貧鈾重裝甲防護（減傷高達 20%～27%）',
  APS:     '主動防護：自動攔截第一次來襲的攻擊',
  AA_LONG: '遠程防空：防空命中率 +8%',
  CIWS:    '近防火網：敵方無人機傷害減半',
  AEGIS:   '神盾系統：階段二可兼任防空（火力 55%）',
  SUB:     '潛艦：隱匿極高；對水面艦傷害 ×1.3',
  ASW:     '反潛專精：對潛艦傷害 ×1.6',
  AMBUSH:  '伏擊：對高價（+2 費以上）艦艇傷害 ×1.25',
  SWARM:   '蜂群：同時攻擊兩個目標（單次傷害 ×0.6）',
  EW:      '電子戰：電戰值領先越多，敵方命中最多 −15%、己方火力最多 +8%（差距達 50 滿額）',
  SEAD:    '壓制防空：階段一先制攻擊敵方防空單位',
  DEEP:    '縱深打擊：階段一直擊敵方最貴單位',
  ARTY:    '火砲支援：第三階段持續打擊敵方裝甲',
  SAT:     '飽和面殺傷：同時攻擊兩個目標（單次傷害 ×0.75）',
  TRUE_AT: '穿甲打擊：無視裝甲減傷（真實傷害），對裝甲額外破防加成',
  SPOT:    '校射引導：友軍火砲傷害 +15%'
};

/* [id, 名稱, 兵種, 費用, 風格, 標語, 說明, 隱匿, 電戰, 特性[], HP, ATK, DEF] */
const RAW_UNITS = [
  // ==================== 制空打擊 (air, 20 款) ====================
  // $5
  ['F22','F-22A 猛禽 (Block 35)','air',5,'A','極致隱形·空地主宰','第五代空優王者，升級紅外線IRST與AIM-260長程飛彈，兼顧視距外獵殺與對地精準打擊。',88,12,['LR','CAS'],216,120,0],
  ['J20','殲-20S 雙座威龍','air',5,'B','雙座指管·忠誠僚機','全球首款雙座五代隱身戰機，後座專司電子戰與無人機蜂群協同指管，超視距截擊火力強悍。',78,24,['LR','EW'],226,124,0],
  ['SU57','蘇-57M 惡棍 (產品30)','air',5,'C','二階推力·極音速獵殺','換裝AL-51F1新世代向量渦扇發動機，內置極音速空對空與穿甲巡弋飛彈，空地雙棲狂暴輸出。',75,14,['LR','CAS'],232,132,0],
  ['F35A','F-35A 閃電II (Block 4)','air',5,'D','AN/APG-85 穿透直擊','升級氮化鎵雷達與TR-3運算核心，自帶強效電戰，開局直接穿透防空網點穴敵方最貴資產。',80,20,['DEEP','EW'],190,98,0],
  // $4
  ['RAFALE','陣風 F4 (Rafale F4)','air',4,'A','SPECTRA電戰·飆風打擊','配備F4標準數位頭盔與SPECTRA全向主動電戰系統，兼顧視距外空戰與高存活密接支援。',58,20,['LR','CAS'],182,98,0],
  ['EF2K','颱風 Tranche 4','air',4,'B','ECRS雙軸相控陣空優','換裝歐洲最新ECRS Mk2寬頻電子戰相控陣雷達，超音速巡航攔截與對地風暴暗影打擊兼備。',55,16,['LR','CAS'],192,108,0],
  ['F15EX','F-15EX 鷹二型 (武庫機)','air',4,'C','22枚飛彈飽和齊射','配備EPAWSS主被動生存電戰系統與22處掛點，可同時向雙目標傾瀉超視距與對地彈雨。',46,16,['SAT','CAS'],198,104,0],
  ['SU35','蘇-35SM 超側衛','air',4,'D','三維向量·重載壓制','升級型雪豹-E雷達與R-37M長程飛彈，掛載重型滑翔導引炸彈實施高威力對地支援。',52,14,['LR','CAS'],196,110,0],
  // $3
  ['F16V','F-16V Block 70 蝰蛇','air',3,'A','APG-83雷達·全能主力','換裝五代機同源AESA雷達與複合適形油箱，空戰攔截與地面密接火力最為均衡。',40,12,['CAS','LR'],156,85,0],
  ['JAS39','JAS-39E 鷹獅 NG','air',3,'B','公路分散·神盾電戰','內建Arexis新世代數位電戰干擾系統，極小雷達截面積搭配流星飛彈，性價比極高。',42,20,['EW','LR'],136,74,0],
  ['M2K9','幻象 2000-9 現代化改','air',3,'C','黑沙欣巡弋·穿甲截擊','中東頂配雙座型，除雲母雙模空空彈外更可掛載匿蹤巡弋彈貫穿重裝甲目標。',40,12,['LR','TRUE_AT'],146,82,0],
  ['J10C','殲-10CE 猛龍 (實戰型)','air',3,'D','氮化鎵雷達·霹靂獵殺','配備氮化鎵有源相控陣雷達與PL-15E雙脈衝飛彈，中距空戰與對地支援結實耐打。',38,10,['LR','CAS'],150,80,0],
  // $2
  ['FA50','FA-50 Block 20 戰鷹','air',2,'A','幻影雷達·輕型密接','升級AESA雷達與狙擊手標定莢艙的輕型戰機，高出勤率專職地面密接火力支援。',26,6,['CAS'],118,65,0],
  ['JF17','梟龍 JF-17 Block 3','air',2,'B','平價AESA·超音速破甲','配備KLJ-7A相控陣雷達與防區外穿甲飛彈，能以低廉成本無視敵方重裝甲減傷。',28,8,['TRUE_AT'],108,63,0],
  ['M2K','幻象 2000-5Ei (空優型)','air',2,'C','三角翼極速高空攔截','高空2.2馬赫極速爬升攔截，雙模雲母飛彈提供強悍中距離制空火網。',30,8,['LR'],118,74,0],
  ['F5E','F-5E/F 虎式改 (戰術偵打)','air',2,'D','山谷低空隱蔽奇襲','加裝新式航電與雷射導引炸彈，利用地形掩護實施低空對地密接奇襲。',24,6,['CAS'],124,63,0],
  // $1
  ['A29','A-29N 超級巨嘴鳥','air',1,'A','北約規渦槳密接支援','北約特戰化渦輪螺旋槳攻擊機，超低空滯空以雷射導引火箭精準支援地面。',14,0,['CAS'],86,48,0],
  ['MIG21','米格-21 LanceR 升級型','air',1,'B','以系航電·高空高速突擊','經以色列Elta雷達與頭盔瞄準具現代化改裝，具備平價超音速視距外攔截能力。',14,6,['LR'],92,46,0],
  ['YAK130','雅克-130M 攻擊型','air',1,'C','雷達莢艙·雙座集束彈幕','2024最新現代化升級型，加裝雷達與光電球，地面壓制火力同級最高。',14,4,['CAS'],86,50,0],
  ['L159','L-159T2 蜂鳥破防機','air',1,'D','西方航電·小牛穿甲破防','掛載AGM-65小牛光電反裝甲飛彈，以 $1 極低代價破除敵方重坦護甲。',16,4,['TRUE_AT'],80,46,0],

  // ==================== 重裝鐵騎 (armor, 20 款) ====================
  // $5
  ['M1A2','M1A2 SEPv3 艾布蘭 (Trophy)','armor',5,'A','貧鈾重甲·戰利品防護','美軍主力重坦，配備NGAP貧鈾複合裝甲與以色列Trophy主動防護系統，攻防一體。',6,0,['APS','HEAVY'],354,112,0.26],
  ['LEO2','豹 2A8 (EuroTrophy)','armor',5,'B','L55A1頂峰火控·主動防護','德國最新量產型主戰車，原廠整合EuroTrophy主動防護與DM73超高膛壓穿甲彈。',6,0,['APS','HEAVY'],346,116,0.25],
  ['T14','T-14 阿瑪塔 (2A82-1M)','armor',5,'C','無人砲塔·真空穿甲重砲','乘員全員裝甲膠囊隔艙，配備阿富汗石主動防禦與真空-1長桿穿甲彈，破甲爆發力極限。',10,0,['APS','TRUE_AT'],332,116,0.16],
  ['MK4','梅卡瓦 Mk 4 Barak (閃電型)','armor',5,'D','第5代AI火控·重盾堡壘','配備Iron Vision 360度穿透頭盔與高能戰利品系統，全遊戲最厚實裝甲生命值。',6,8,['APS','HEAVY'],364,106,0.25],
  // $4
  ['K2','K2PL 黑豹 (主動防護型)','armor',4,'A','氣液懸吊·KAPS主動防護','配備KAPS硬殺傷主動防護與自動裝彈機，可發射KSTAM智慧頂攻穿甲彈。',8,0,['APS'],274,88,0.16],
  ['CH3','挑戰者 3 (萊茵金屬滑膛砲)','armor',4,'B','法恩堡裝甲·高膛壓穿甲','英國換裝120mm L55A1滑膛砲與新一代模組化複合裝甲，正面硬扛重砲並強勢破防。',6,0,['HEAVY','TRUE_AT'],298,88,0.27],
  ['LEC','勒克萊爾 XLR (蠍式數位網)','armor',4,'C','Scorpion協同·極速破甲','法國蠍式聯合作戰計畫核心，自動裝填機維持極限射速，發射鎢芯穿甲彈貫穿重甲。',8,6,['TRUE_AT'],278,96,0.18],
  ['T99A','99A 式主戰戰車 (重裝雷射)','armor',4,'D','箭形雙防裝甲·雷射致盲','重型雙防反應裝甲搭配砲塔頂部主動雷射壓制系統，兼備高減傷與光電干擾能力。',8,12,['HEAVY','EW'],292,94,0.24],
  // $3
  ['T90','T-90M 突破-3 (隱身披覆)','armor',3,'A','化石反應裝甲·減紅外篷','披覆Nakidka減紅外雷達偽裝網與Relikt重型反應裝甲，生存力極為強韌。',12,0,['HEAVY'],242,78,0.27],
  ['T10','10 式戰車 (C4I網路協同)','armor',3,'B','無段變速·極速首發穿甲','日本第四代C4I網路戰車，極輕量高機動搭配新型120mm高膛壓穿甲彈無視裝甲減傷。',12,6,['TRUE_AT'],216,80,0.16],
  ['M1A1','M1A2T 艾布蘭 (台灣特規)','armor',3,'C','國軍地表最強·獵殲火控','台灣最新接裝主力戰車，配備外銷型複合重裝甲、獵殲獨立熱像儀與KEW-A1鎢芯穿甲彈。',10,0,['HEAVY'],248,80,0.25],
  ['LEO2A4','豹 2A4V (實戰反應裝甲型)','armor',3,'D','接觸反應裝甲·歐陸鐵騎','烏俄實戰改裝構型，車體與砲塔滿掛爆炸反應裝甲並配備DM53穿甲彈，攻守扎實。',10,0,['HEAVY'],244,81,0.24],
  // $2
  ['T72','T-72B3M (實戰籠式裝甲)','armor',2,'A','反無人機頂棚·鋼鐵洪流','加裝實戰反FPV格柵頂棚與松樹-U熱像儀，平價耐打的地面戰線肉盾。',6,0,['HEAVY'],212,62,0.20],
  ['STRY','史崔克 30mm 龍騎兵','armor',2,'B','輪式突擊·標槍穿甲協同','美軍八輪高速裝甲車，配備30mm Mk44無人砲塔與標槍反甲飛彈，快速穿插破甲。',15,0,['TRUE_AT'],175,66,0.15],
  ['BOXER','拳獅犬 CRV (長釘反甲型)','armor',2,'C','模組化重裝八輪步戰','車體防護力堪比輕坦的38噸重型輪式步戰，配備萊茵金屬Lance砲塔與長釘導彈。',10,0,['HEAVY'],196,65,0.22],
  ['CM34','雲豹 CM-34 (30mm 穿甲鏈砲)','armor',2,'D','國軍八輪主力·高角防空','配備美製Mk44巨蝮二式30mm鏈砲，可平射脫殼穿甲彈並高角攔截敵方低空無人機。',18,0,['CIWS','TRUE_AT'],186,66,0.16],
  // $1
  ['TOYO','武裝豐田皮卡 (短號反甲組)','armor',1,'A','高隱蔽游擊·雷射破甲','改裝高機動皮卡搭載Kornet-EM反裝甲導彈，利用高隱匿在遠距離狙殺重型坦克。',30,0,['TRUE_AT'],134,45,0],
  ['T55','T-62M 實戰頂棚肉盾車','armor',1,'B','重型眉形裝甲·吸傷鐵棺','加掛厚重複合眉形裝甲與反無人機鐵網，專職在第一線替主力吸收成噸砲火。',5,0,['HEAVY'],174,40,0.22],
  ['M113T','M113 拖式二B 頂攻飛彈車','armor',1,'C','履帶掩蔽·雙彈頭頂攻','配備BGM-71F TOW-2B掠飛頂攻反戰車飛彈，專門貫穿重坦最脆弱的砲塔頂甲。',14,0,['TRUE_AT'],128,52,0.08],
  ['HMMWV','悍馬標槍/TOW 偵打獵坦組','armor',1,'D','前線光電校射·輪式伏擊','高機動越野車搭載熱像觀測儀與反甲飛彈，為友軍火砲提供校射加成並實施伏擊。',26,10,['SPOT'],138,48,0.06],

  // ==================== 區域防空 (air_defense, 20 款) ====================
  // $5
  ['PAC3','愛國者 PAC-3 MSE (LTAMDS)','air_defense',5,'A','幽靈眼氮化鎵·全向反導','換裝最新LTAMDS 360度三面氮化鎵雷達與MSE雙脈衝動能攔截彈，防空與反無人機兼備。',15,16,['AA_LONG','CIWS'],242,124,0],
  ['S500','S-500 普羅米修斯','air_defense',5,'B','太空邊緣·極音速反導','具備攔截低軌目標與極音速飛行器能力的戰略防空系統，單發殺傷力全場最高。',14,12,['AA_LONG'],252,134,0.05],
  ['S400','S-400 凱旋 (96L6 高空雷達)','air_defense',5,'C','400公里多層次飽和防空','整合遠中近四種防空導彈，陣地耐久極高且具備抗飽和打擊能力。',14,10,['AA_LONG','CIWS'],258,122,0.06],
  ['DAVID','大衛投石索 (EL/M-2084)','air_defense',5,'D','雙模尋標·強電戰多層防空','眩暈攔截彈結合紅外與主動雷達雙尋標器，自帶高電戰抗性封鎖各型匿蹤戰機。',16,20,['AA_LONG','EW'],236,120,0],
  // $4
  ['SAMPT','SAMP/T NG (紫菀30 B1NT)','air_defense',4,'A','Kronos雷達·向量極限攔截','法義最新次世代防空系統，配備PIF-PAF直接力控制向量推進，精準獵殺高速戰機。',14,10,['AA_LONG'],196,102,0],
  ['IRON','鐵穹 + 鐵束雷射系統 (Iron Beam)','air_defense',4,'B','100kW高能雷射·飽和攔截網','結合實戰部署的「鐵束」高能光纖雷射與塔米爾攔截彈，無人機傷害減半並兼顧遠程防空。',12,8,['CIWS','AA_LONG'],204,94,0],
  ['TK3','強弓 / 天弓三型增程防空系統','air_defense',4,'C','台灣長程反導·相控陣天網','國軍最新量產層系防空核心，配備主動相控陣導引頭與高機動相列雷達車。',14,10,['AA_LONG'],196,104,0],
  ['HQ9L','紅旗-9B 遠程防空系統','air_defense',4,'D','重型8x8越野·垂直冷發射','配備主動雷達加紅外複合導引頭與裝甲發射車體，抗轟炸能力與防空射程俱佳。',12,6,['AA_LONG'],202,98,0.10],
  // $3
  ['NASAMS','NASAMS 3 (AMRAAM-ER 增程型)','air_defense',3,'A','北約分散網路·增程獵殺','美挪聯合研製分散式防空網，換裝AMRAAM-ER增程攔截彈，大幅擴展防空射程與命中率。',18,10,['AA_LONG'],164,80,0],
  ['IRIST','IRIS-T SLM (紅外成像神盾)','air_defense',3,'B','烏俄實戰近100%攔截神話','配備TRML-4D相控陣雷達與紅外成像導引頭，不受電戰干擾並能高效攔截巡弋彈與無人機。',18,12,['CIWS','AA_LONG'],152,82,0],
  ['BUKM3','山毛櫸 Buk-M3 (維京野戰防空)','air_defense',3,'C','12枚待發垂發·裝甲履帶','全裝甲履帶底盤跟隨坦克集群推進，具備重裝甲減傷與高密度野戰防空火力。',12,6,['HEAVY'],164,86,0.16],
  ['HQ16','紅旗-16FE (燃氣舵快反防空)','air_defense',3,'D','尾翼燃氣舵·極速低空攔截','採用垂直冷發射與燃氣動力轉向技術，反應時間極短，專剋低空突防與無人機群。',14,6,['CIWS'],158,82,0.08],
  // $2
  ['PANT','鎧甲-S1M (極音速近防彈砲)','air_defense',2,'A','雙聯機砲+極音速近防彈','升級型相控陣搜索雷達與57E6M高速攔截彈，專職獵殺敵方無人機與巡飛彈。',12,4,['CIWS'],128,62,0],
  ['GEPARD','獵豹防空戰車 (AHEAD空爆砲)','air_defense',2,'B','雙聯35mm鎢珠空爆雲','烏克蘭實戰封神的無人機剋星，豹1裝甲底盤自帶減傷，空爆彈幕撕裂蜂群。',10,0,['CIWS'],138,58,0.15],
  ['AVNG','復仇者 M1097A2 (反無人機改)','air_defense',2,'C','野戰機動·光電近防攔截','八枚待發刺針飛彈搭配.50機槍與電子干擾器，快速攔截低空無人機與攻擊機。',18,8,['CIWS'],124,68,0],
  ['TC2','陸射劍二防空系統 (蜂眼雷達)','air_defense',2,'D','國軍野戰主力·相控陣攔截','台灣自研野戰防空系統，搭配蜂眼3D相列雷達車，具備中遠距全天候多目標接戰能力。',15,8,['AA_LONG'],126,64,0],
  // $1
  ['STING','刺針 FIM-92K 雙聯防空組','air_defense',1,'A','前線隱蔽伏擊·數據鏈校射','升級資料鏈尋標器之單兵肩射防空組，高隱蔽難以被察覺，並可兼任前線觀測校射。',36,0,['SPOT'],94,48,0],
  ['IGLA','柳樹 9K333 (針式升級型) 防空組','air_defense',1,'B','三光譜尋標·低空無人機剋星','俄軍最新單兵防空飛彈，三光譜導引頭可識別並擊落低熱源無人機與巡弋飛彈。',32,0,['CIWS'],102,46,0],
  ['STAR','星光防空飛彈 (暴風車載型)','air_defense',1,'C','3馬赫雷射乘波三飛鏢','全球最快短程防空飛彈，3馬赫鎢合金三彈頭讓敵機毫無反應時間，防空命中率極高。',28,0,['AA_LONG'],90,52,0],
  ['OERL','歐瑞康 GDF-009 雙聯35mm快砲','air_defense',1,'D','天兵雷達·AHEAD空爆火網','瑞士經典防空快砲最新數位化型號，發射程式化空爆鎢球，免疫電戰並克制無人機。',16,0,['CIWS'],100,48,0.10],

  // ==================== 制海權威 (naval, 20 款) ====================
  // $5
  ['DDG51','伯克級 Flight III (AN/SPY-6)','naval',5,'A','SPY-6氮化鎵神盾·海空基石','美軍最新服役神盾驅逐艦，換裝靈敏度提升30倍的SPY-6雷達與SEWIP Block 3電戰系統。',22,20,['AEGIS','AA_LONG'],345,124,0.12],
  ['T055','055 型萬噸大驅 (鷹擊-21)','naval',5,'B','112垂發·高超音速反艦','萬噸級綜合雙波段雷達驅逐艦，艦體耐久全場最高，搭載鷹擊-21高超音速反艦飛彈。',18,12,['AEGIS'],375,132,0.10],
  ['KDX3','正祖大王級神盾艦 (KDX-III B2)','naval',5,'C','128垂發·海空反潛全能巨獸','南韓最新交付的新世代萬噸神盾艦，兼具區域防空、重型反艦與拖曳陣列反潛獵殺能力。',18,10,['AEGIS','ASW'],348,128,0.10],
  ['TYPE45','45 型勇敢級 (海毒蛇升級型)','naval',5,'D','桑普森雷達·艦隊電戰防空盾','英國皇家海軍防空核心，換裝CAMM與紫菀30B1NT共72枚垂發，自帶頂尖電戰干擾。',25,24,['AEGIS','EW'],315,116,0.10],
  // $4
  ['VA','維吉尼亞級 Block V 核潛艇','naval',4,'A','VPM垂發模組·深海刺客','加長艦體配備28枚戰斧/極音速飛彈垂發筒，泵噴推進極限靜音，對水面艦傷害×1.3。',75,0,['SUB'],266,98,0.10],
  ['FREMM','星座級 / FREMM 飛彈巡防艦','naval',4,'B','頂尖反潛獵手·神盾協同','配備CAPTAS-4低頻主被動拖曳聲納與32單元垂發，專職獵殺深海潛艦並協同區域防空。',25,10,['ASW','AEGIS'],278,96,0.12],
  ['MOGAMI','最上級匿蹤巡防艦 (Mk41垂發型)','naval',4,'C','UNICORN匿蹤天線·反潛伏擊','日本全匿蹤多用途巡防艦，整合一體化複合桅杆與17式反艦彈，兼具反潛與反大艦伏擊。',48,12,['ASW','AMBUSH'],264,100,0.10],
  ['YASEN','亞森-M 級核潛艇 (鋯石極音速型)','naval',4,'D','鋯石9馬赫導彈·深海狂暴核潛','俄羅斯第四代攻擊核潛艇，可水下齊射鋯石極音速反艦飛彈與重型魚雷，爆發力極度兇殘。',66,0,['SUB'],278,102,0.10],
  // $3
  ['KILO','基洛級 636.3 (口徑巡弋飛彈型)','naval',3,'A','大洋黑洞·潛射巡弋伏擊','靜音性能卓越的柴電潛艦，除重型尾流魚雷外更可水下發射口徑反艦巡弋飛彈。',70,0,['SUB'],216,79,0.10],
  ['SORYU','大鯨級 / 蒼龍改鋰電潛艦','naval',3,'B','全鋰電池推進·深海無聲獵手','日本最新服役的鋰離子電池潛艦，水下高速續航與靜音能力超越傳統AIP潛艦。',72,0,['SUB'],212,82,0.10],
  ['U212','212CD 型無磁匿蹤潛艇','naval',3,'C','鑽石切面艦體·燃料電池隱匿','德挪聯合研製次世代無磁潛艇，鑽石多面體外殼大幅降低敵方主動聲納反射。',75,0,['SUB'],206,80,0.10],
  ['KD','康定級華陽垂發升級型','naval',3,'D','32枚海劍二垂發·反潛防空換心','國軍拉法葉艦現代化升級，換裝華陽垂直發射系統32枚海劍二飛彈與新型反潛聲納。',36,8,['AEGIS'],226,76,0.10],
  // $2
  ['TJ','塔江級 / 沱江級防空反艦巡邏艦','naval',2,'A','航母殺手·海劍二防空雙體艦','台灣量產型穿浪雙體巡邏艦，滿載雄二/雄三反艦飛彈與海劍二防空彈，專打高價大型艦艇。',40,8,['AMBUSH'],184,70,0.10],
  ['T22','022 型隱形穿浪飛彈快艇','naval',2,'B','高速穿浪·鷹擊飛彈狼群','鋁合金隱形穿浪雙體快艇，50節極速突擊傾瀉8枚反艦飛彈，對主力艦威脅極大。',45,0,['AMBUSH'],176,76,0.10],
  ['GOWIND','追風級 (Gowind 2500) 護衛艦','naval',2,'C','全景感測桅杆·近海反潛主力','法國外銷王牌輕型護衛艦，配備Kingklip艦殼聲納與MU90魚雷，反潛與耐海性俱佳。',28,6,['ASW'],192,65,0.12],
  ['SAAR6','薩爾 6 型神盾輕護衛艦','naval',2,'D','EL/M-2248相控陣·C-Dome鐵穹','僅2000噸卻塞入四面相控陣雷達、巴拉克-8防空與海鐵穹，堪稱袖珍防空神盾艦。',30,10,['AEGIS','CIWS'],174,66,0.10],
  // $1
  ['USV','MAGURA V5 / Sea Baby 無人快艇群','naval',1,'A','黑海艦隊殺手·星鏈蜂群撞擊','烏克蘭實戰重創多艘大型軍艦的自殺無人快艇群，體積小、隱匿高，以小博大同時撞擊雙目標。',48,0,['AMBUSH','SWARM'],130,55,0],
  ['PB','Mk VI 海岸武裝巡邏艇','naval',1,'B','25mm遙控鏈砲·近海反無人艇','美製高速巡邏艇，配備Mk38遙控鏈砲與Griffin飛彈，專職獵殺敵方無人快艇與低空無人機。',26,0,['CIWS'],148,48,0.08],
  ['HF3','雄風三型增程岸置反艦飛彈車組','naval',1,'C','400km超音速掠海·海峽封鎖','陸基高機動偽裝發射車，發射2.5馬赫超音速反艦飛彈，以極低成本重創高價主力艦。',42,0,['AMBUSH'],124,56,0],
  ['SBS','特戰乾式微型潛航器 (SDV)','naval',1,'D','水下無聲滲透·龍骨磁雷爆破','特種部隊搭乘全電力推進微型潛艇，具備潛艦高隱匿特性，貼近大艦底部引爆重型水雷。',62,0,['SUB','AMBUSH'],112,48,0],

  // ==================== 情報／長程打擊 (support, 20 款) ====================
  // $5
  ['E7','E-7A 楔尾空中預警指管機','support',5,'A','MESA相控陣·全戰場電磁中樞','美軍與北約新一代空中指管樞紐，72點超高電戰壓制全場，並為友軍火砲提供即時校射。',10,72,['EW','SPOT'],206,90,0],
  ['B21','B-21 突襲者戰略匿蹤轟炸機','support',5,'B','六代全翼穿透·縱深破甲點穴','美軍最新試飛之次世代隱身轟炸機，86點極限隱匿，開局直毀敵方最貴核心並無視裝甲減傷。',86,15,['DEEP','TRUE_AT'],185,120,0],
  ['KJ500','空警-500A 數位陣列預警機','support',5,'C','三面氮化鎵雷達·長航時指管','360度無死角數位相控陣預警機，機體耐久厚實，掌控電磁權並引導全域遠程火力。',10,70,['EW','SPOT'],215,86,0],
  ['RQ4','RQ-4B 全球鷹 / MQ-4C 海神','support',5,'D','兩萬米高空開圖·廣域電戰校射','高空長航時戰略偵察無人機，兼顧高空隱匿、56點強效電戰與全戰場目標標定校射。',48,56,['EW','SPOT'],180,94,0],
  // $4
  ['HIMARS','M142 海馬斯 (PrSM 精準打擊飛彈)','support',4,'A','500km PrSM飛彈·先制反防空','升級最新PrSM精準打擊飛彈與GMLRS火箭，階段一先制摧毀防空，階段三持續轟擊裝甲。',26,10,['SEAD','ARTY'],158,88,0],
  ['EA18','EA-18G 咆哮者 (NGJ-MB 電戰艙)','support',4,'B','次世代全頻干擾·電磁致盲霸權','換裝AN/ALQ-249次世代中頻干擾莢艙，以62點強大電戰致盲敵方防空與空戰火控網。',48,62,['EW'],154,70,0],
  ['ATACMS','MGM-140 ATACMS / 暗鷹極音速組','support',4,'C','戰區縱深點穴·重型彈道覆蓋','長程陸軍戰術飛彈系統，開局直擊敵方最昂貴核心資產，並於決戰階段提供重砲火力。',24,6,['DEEP','ARTY'],156,104,0],
  ['STORM','風暴暗影 / SCALP-EG 巡弋飛彈組','support',4,'D','低空地形匹配·BROACH穿甲點穴','匿蹤長程巡弋飛彈，配備BROACH串聯聚能穿甲彈頭，開局無視裝甲減傷貫穿敵方主力。',46,8,['TRUE_AT','DEEP'],148,95,0],
  // $3
  ['PZH','PzH 2000 / RCH 155 重裝自走砲','support',3,'A','裝甲砲塔防護·極速多發彈著','具備複合裝甲防護的重型自走砲，每分鐘10發極速齊射，在砲戰中擁有最高生存力。',10,0,['ARTY','HEAVY'],144,92,0.20],
  ['SMERCH','龍捲風-S (9A54 衛星導引火箭)','support',3,'B','300mm導引火箭·雙目標飽和齊射','12管300mm重型遠程火箭砲，每枚火箭具備獨立GLONASS衛星修正，同時轟擊兩個地面目標。',8,0,['ARTY','SAT'],130,75,0],
  ['CAESAR','凱撒 Mk II 8x8 卡車砲 (反砲兵型)','support',3,'C','快打快撤·先制反防空雷達','法國最新裝甲駕駛室8x8卡車砲，結合反砲兵雷達可在開局先制狙擊敵方防空陣地。',18,6,['ARTY','SEAD'],126,82,0],
  ['ARCHER','弓箭手 Archer (M982 神劍導引砲)','support',3,'D','30秒快打快撤·神劍GPS數位校射','瑞典全自動無人砲塔卡車砲，發射M982 Excalibur精準導引砲彈並內建數位火控校射鏈。',16,10,['ARTY','SPOT'],130,82,0.08],
  // $2
  ['MQ9','MQ-9B 天衛者 (SkyGuardian)','support',2,'A','40小時長滯空·電戰海空偵打','符合北約適航標準之新一代長航時無人機，提供18點電戰支援與地獄火持續打擊。',35,18,['ARTY'],102,50,0],
  ['TB2','TB-2 / Akinci 突擊察打無人機','support',2,'B','激光導引穿甲·低空戰術獵殺','實戰成名的察打一體無人機，掛載MAM-L/T激光制導穿甲彈，精準點名敵方裝甲車輛。',44,8,['TRUE_AT'],102,62,0],
  ['SW600','彈簧刀 600 (標槍彈頭巡飛彈)','support',2,'C','40km長程遊蕩·標槍彈頭破甲','採用FGM-148標槍反戰車飛彈同款雙聚能破甲彈頭，高隱匿盤旋鎖定重坦一擊必殺。',54,0,['TRUE_AT'],96,67,0],
  ['ORION','獵戶座 / 柳葉刀-3M 巡飛母機','support',2,'D','X翼巡飛彈母機·光電協同破甲','俄系中空長航時無人機搭配柳葉刀-3M巡飛彈，具備電戰抗性與穩定反裝甲穿透力。',36,12,['TRUE_AT'],108,58,0],
  // $1
  ['FPV','光纖抗干擾 FPV 自殺無人機群','support',1,'A','20km光纖導控·免疫電戰破甲蜂群','2025戰場最新演進之光纖連線FPV穿越機群，攜帶PG-7VR破甲彈頭同時鑽擊兩個裝甲目標。',55,0,['TRUE_AT','SWARM'],76,41,0],
  ['SPOT','多光譜商用無人機校射組','support',1,'B','AI熱成像識別·火砲傷害+15%','配備雙光熱成像與雷射測距儀的微型無人機組，提供18點電戰並讓友軍火砲傷害提升15%。',42,18,['SPOT','EW'],88,44,0],
  ['SW300','彈簧刀 300 Block 20 (反雷達型)','support',1,'C','單兵背負式·先制防空雷達殺手','升級數位鏈路與定向破片彈頭，以 $1 代價在開局先制壓制敵方昂貴防空雷達。',52,6,['SEAD'],82,50,0],
  ['MORTAR','120mm 車載速射迫擊砲小隊','support',1,'D','數位火控曲射·前觀協同支援','搭載自動瞄準系統的120mm重型迫擊砲班，便宜耐打，兼具前觀校射與持續曲射砲擊。',32,0,['ARTY','SPOT'],98,46,0]
];

const UNIT_META = {
  // 制空
  F22: { flag: '🇺🇸', origin: '美國', weapon: 'AIM-260 JATM 長程飛彈 + GBU-39 SDB', sfx: 'missile', img: 'assets/units/F22.jpg' },
  J20: { flag: '🇨🇳', origin: '中國', weapon: 'PL-15 雙脈衝導彈 + 忠誠僚機協同指管鏈', sfx: 'missile', img: 'assets/units/J20.jpg' },
  SU57: { flag: '🇷🇺', origin: '俄羅斯', weapon: 'R-77M 空空彈 + Kh-59MK2 內置巡弋飛彈', sfx: 'missile', img: 'assets/units/SU57.jpg' },
  F35A: { flag: '🇺🇸', origin: '美國', weapon: 'AGM-158 JASSM 匿蹤飛彈 + AN/APG-85 雷達', sfx: 'missile', img: 'assets/units/F35.jpg' },
  RAFALE: { flag: '🇫🇷', origin: '法國', weapon: '流星 (Meteor) 衝壓飛彈 + AASM 鐵鎚導引彈', sfx: 'missile', img: 'assets/units/RAFALE.jpg' },
  EF2K: { flag: '🇪🇺', origin: '歐洲聯合', weapon: '流星衝壓飛彈 + ECRS Mk2 雙軸相控陣雷達', sfx: 'missile', img: 'assets/units/EF2K.jpg' },
  F15EX: { flag: '🇺🇸', origin: '美國', weapon: '22枚 AIM-120D 飽和齊射 + EPAWSS 主被動電戰', sfx: 'missile', img: 'assets/units/F15EX.jpg' },
  SU35: { flag: '🇷🇺', origin: '俄羅斯', weapon: 'R-37M 超遠程飛彈 + KAB-1500 導引炸彈', sfx: 'missile', img: 'assets/units/SU35.jpg' },
  F16V: { flag: '🇹🇼', origin: '美國/台灣', weapon: 'AIM-120C-8 + AGM-84H SLAM-ER 遠距攻陸彈', sfx: 'missile', img: 'assets/units/F16V.jpg' },
  JAS39: { flag: '🇸🇪', origin: '瑞典', weapon: '流星飛彈 + Arexis 數位電子戰干擾系統', sfx: 'missile', img: 'assets/units/JAS39.jpg' },
  M2K9: { flag: '🇫🇷', origin: '法國/阿聯', weapon: '雲母 MICA-NG 雙模彈 + 黑沙欣匿蹤巡弋飛彈', sfx: 'missile', img: 'assets/units/M2K9.jpg' },
  J10C: { flag: '🇨🇳', origin: '中國', weapon: 'PL-15E 視距外空空彈 + 氮化鎵 AESA 雷達', sfx: 'missile', img: 'assets/units/J10C.jpg' },
  FA50: { flag: '🇰🇷', origin: '南韓', weapon: 'PhantomStrike AESA 雷達 + AGM-65 小牛飛彈', sfx: 'missile', img: 'assets/units/FA50.jpg' },
  JF17: { flag: '🇵🇰', origin: '巴基斯坦', weapon: 'PL-15E 空空飛彈 + CM-400AKG 超音速破甲彈', sfx: 'missile', img: 'assets/units/JF17.jpg' },
  M2K: { flag: '🇹🇼', origin: '法國/台灣', weapon: '雲母 (MICA) 主動雷達中程飛彈 + 魔法二型', sfx: 'missile', img: 'assets/units/M2K.jpg' },
  F5E: { flag: '🇹🇼', origin: '美國/台灣', weapon: 'AIM-9P4 響尾蛇 + GBU-12 鋪路II 雷射導引炸彈', sfx: 'missile', img: 'assets/units/F5E.jpg' },
  A29: { flag: '🇧🇷', origin: '巴西', weapon: 'APKWS 雷射導引火箭 + GBU-12 鋪路II 炸彈', sfx: 'cannon', img: 'assets/units/A29.jpg' },
  MIG21: { flag: '🇷🇴', origin: '羅馬尼亞/以改', weapon: 'Elta EL/M-2032 雷達 + 巨蟒3型/R-73 飛彈', sfx: 'missile', img: 'assets/units/MIG21.jpg' },
  YAK130: { flag: '🇷🇺', origin: '俄羅斯', weapon: 'S-13 重型航空火箭巢 + KAB-500Kr 電視炸彈', sfx: 'cannon', img: 'assets/units/YAK130.jpg' },
  L159: { flag: '🇨🇿', origin: '捷克', weapon: 'AGM-65 小牛反裝甲飛彈 + 20mm 雙管機砲莢艙', sfx: 'missile', img: 'assets/units/L159.jpg' },

  // 裝甲
  M1A2: { flag: '🇺🇸', origin: '美國', weapon: '120mm M829A4 貧鈾穿甲彈 + Trophy 主動防護', sfx: 'heavy_cannon', img: 'assets/units/M1A2.jpg' },
  LEO2: { flag: '🇩🇪', origin: '德國', weapon: '120mm L55A1 DM73 穿甲彈 + EuroTrophy 防護', sfx: 'heavy_cannon', img: 'assets/units/LEO2.jpg' },
  T14: { flag: '🇷🇺', origin: '俄羅斯', weapon: '125mm 2A82-1M 真空穿甲彈 + 阿富汗石主動防護', sfx: 'heavy_cannon', img: 'assets/units/T14.jpg' },
  MK4: { flag: '🇮🇱', origin: '以色列', weapon: '120mm MG253 滑膛砲 + 戰利品 APS + AI 全景頭盔', sfx: 'heavy_cannon', img: 'assets/units/MK4.jpg' },
  K2: { flag: '🇰🇷', origin: '南韓/波蘭', weapon: '120mm L55 穿甲彈 + KSTAM 頂攻彈 + KAPS 防護', sfx: 'heavy_cannon', img: 'assets/units/K2.jpg' },
  CH3: { flag: '🇬🇧', origin: '英國', weapon: '120mm L55A1 高膛壓滑膛砲 + 法恩堡複合裝甲', sfx: 'heavy_cannon', img: 'assets/units/CH3.jpg' },
  LEC: { flag: '🇫🇷', origin: '法國', weapon: '120mm F1 自動裝填極速滑膛砲 + 蠍式戰場網路', sfx: 'heavy_cannon', img: 'assets/units/LEC.jpg' },
  T99A: { flag: '🇨🇳', origin: '中國', weapon: '125mm ZPT-98 滑膛砲 + 雙防裝甲 + 雷射壓制系統', sfx: 'heavy_cannon', img: 'assets/units/T99A.jpg' },
  T90: { flag: '🇷🇺', origin: '俄羅斯', weapon: '125mm 3BM60 穿甲彈 + 化石反應裝甲 + 隱身篷', sfx: 'heavy_cannon', img: 'assets/units/T90.jpg' },
  T10: { flag: '🇯🇵', origin: '日本', weapon: '120mm 10式高膛壓鎢芯穿甲彈 + C4I 戰術數據鏈', sfx: 'heavy_cannon', img: 'assets/units/T10.jpg' },
  M1A1: { flag: '🇹🇼', origin: '美國/台灣', weapon: '120mm M256 滑膛砲 KEW-A1 穿甲彈 + 複合重裝甲', sfx: 'heavy_cannon', img: 'assets/units/M1A1.jpg' },
  LEO2A4: { flag: '🇩🇪', origin: '德國/烏克蘭', weapon: '120mm L44 DM53 穿甲彈 + 接觸-1 爆炸反應裝甲', sfx: 'heavy_cannon', img: 'assets/units/LEO2A4.jpg' },
  T72: { flag: '🇷🇺', origin: '俄羅斯', weapon: '125mm 2A46M-5 滑膛砲 + 反無人機籠式裝甲頂棚', sfx: 'heavy_cannon', img: 'assets/units/T72.jpg' },
  STRY: { flag: '🇺🇸', origin: '美國', weapon: '30mm Mk44 鏈砲 + FGM-148 標槍反戰車飛彈', sfx: 'cannon', img: 'assets/units/STRY.jpg' },
  BOXER: { flag: '🇩🇪', origin: '德國/澳洲', weapon: '30mm MK30-2 空爆機砲 + 長釘-LR2 反戰車導彈', sfx: 'cannon', img: 'assets/units/BOXER.jpg' },
  CM34: { flag: '🇹🇼', origin: '台灣', weapon: '30mm Mk44 巨蝮二式穿甲鏈砲 + 高角反無人機火控', sfx: 'cannon', img: 'assets/units/CM34.jpg' },
  TOYO: { flag: '🌍', origin: '不對稱作戰', weapon: '9M133 短號 (Kornet) 雷射導引重型反裝甲飛彈', sfx: 'cannon', img: 'assets/units/TOYO.jpg' },
  T55: { flag: '🇷🇺', origin: '俄羅斯/東歐', weapon: '115mm U-5TS 滑膛砲 + BDD 眉形附加重裝甲', sfx: 'heavy_cannon', img: 'assets/units/T55.jpg' },
  M113T: { flag: '🇹🇼', origin: '美國/台灣', weapon: 'BGM-71F TOW-2B 雙彈頭掠飛頂攻反戰車飛彈', sfx: 'cannon', img: 'assets/units/M113T.jpg' },
  HMMWV: { flag: '🇺🇸', origin: '美國', weapon: '拖式/標槍反裝甲飛彈 + LRAS3 遠距熱像偵蒐系統', sfx: 'cannon', img: 'assets/units/HMMWV.jpg' },

  // 防空
  PAC3: { flag: '🇺🇸', origin: '美國', weapon: 'PAC-3 MSE 動能攔截彈 + LTAMDS 幽靈眼氮化鎵雷達', sfx: 'missile', img: 'assets/units/PAC3.jpg' },
  S500: { flag: '🇷🇺', origin: '俄羅斯', weapon: '77N6-N 極音速反導攔截彈 + 40N6M 超遠程防空彈', sfx: 'missile', img: 'assets/units/S500.jpg' },
  S400: { flag: '🇷🇺', origin: '俄羅斯', weapon: '40N6E 超遠程導彈 + 9M96E2 主動雷達中程防空彈', sfx: 'missile', img: 'assets/units/S400.jpg' },
  DAVID: { flag: '🇮🇱', origin: '以色列', weapon: '眩暈 (Stunner) 光電/雷達雙模尋標防空攔截彈', sfx: 'missile', img: 'assets/units/DAVID.jpg' },
  SAMPT: { flag: '🇫🇷', origin: '法國/義大利', weapon: '紫菀 30 Block 1NT 垂直發射防空反導飛彈', sfx: 'missile', img: 'assets/units/SAMPT.jpg' },
  IRON: { flag: '🇮🇱', origin: '以色列', weapon: '鐵束 (Iron Beam) 100kW 高能雷射 + 塔米爾攔截彈', sfx: 'missile', img: 'assets/units/IRON.jpg' },
  TK3: { flag: '🇹🇼', origin: '台灣', weapon: '強弓增程型 / 天弓三型垂直發射主動雷達防空飛彈', sfx: 'missile', img: 'assets/units/TK3.jpg' },
  HQ9L: { flag: '🇨🇳', origin: '中國', weapon: '紅旗-9B 垂直冷發射雙模導引長程防空飛彈', sfx: 'missile', img: 'assets/units/HQ9.jpg' },
  NASAMS: { flag: '🇳🇴', origin: '挪威/美國', weapon: 'AMRAAM-ER 增程防空飛彈 + AIM-9X Block II', sfx: 'missile', img: 'assets/units/NASAMS.jpg' },
  IRIST: { flag: '🇩🇪', origin: '德國', weapon: 'IRIS-T SLM 紅外成像防空彈 + TRML-4D 相控陣雷達', sfx: 'missile', img: 'assets/units/IRIST.jpg' },
  BUKM3: { flag: '🇷🇺', origin: '俄羅斯', weapon: '9M317M 12聯裝垂直發射主動雷達野戰防空飛彈', sfx: 'missile', img: 'assets/units/BUKM3.jpg' },
  HQ16: { flag: '🇨🇳', origin: '中國', weapon: '紅旗-16FE 燃氣舵極速轉向垂直發射防空飛彈', sfx: 'missile', img: 'assets/units/HQ16.jpg' },
  PANT: { flag: '🇷🇺', origin: '俄羅斯', weapon: '57E6M 極音速近防飛彈 + 30mm 2A38M 雙聯機砲', sfx: 'flak', img: 'assets/units/PANT.jpg' },
  GEPARD: { flag: '🇩🇪', origin: '德國', weapon: '雙聯 35mm 歐瑞康 KDA 機砲 + AHEAD 程式化空爆彈', sfx: 'flak', img: 'assets/units/GEPARD.jpg' },
  AVNG: { flag: '🇺🇸', origin: '美國/台灣', weapon: '8聯裝 FIM-92J 刺針防空艙 + M3P .50 航空機槍', sfx: 'missile', img: 'assets/units/AVNG.jpg' },
  TC2: { flag: '🇹🇼', origin: '台灣', weapon: '天劍二型陸射防空飛彈 + 蜂眼 3D 相控陣搜索雷達', sfx: 'missile', img: 'assets/units/TC2.jpg' },
  STING: { flag: '🇺🇸', origin: '美國/台灣', weapon: 'FIM-92K 雙聯裝數據鏈紅外/紫外雙模防空飛彈', sfx: 'missile', img: 'assets/units/STING.jpg' },
  IGLA: { flag: '🇷🇺', origin: '俄羅斯', weapon: '9K333 柳樹 (Verba) 三光譜紅外抗干擾防空飛彈', sfx: 'missile', img: 'assets/units/IGLA.jpg' },
  STAR: { flag: '🇬🇧', origin: '英國', weapon: '星光 (Starstreak) 3馬赫雷射乘波鎢合金三飛鏢', sfx: 'missile', img: 'assets/units/STAR.jpg' },
  OERL: { flag: '🇨🇭', origin: '瑞士', weapon: 'GDF-009 雙聯 35mm AHEAD 空爆快砲 + 天兵雷達', sfx: 'flak', img: 'assets/units/OERL.jpg' },

  // 海軍
  DDG51: { flag: '🇺🇸', origin: '美國', weapon: 'AN/SPY-6 氮化鎵雷達 + 96單元 Mk41 SM-6 標準六型', sfx: 'missile', img: 'assets/units/DDG51.jpg' },
  T055: { flag: '🇨🇳', origin: '中國', weapon: '112單元通用垂發 + 鷹擊-21 高超音速彈道反艦飛彈', sfx: 'missile', img: 'assets/units/T055.jpg' },
  KDX3: { flag: '🇰🇷', origin: '南韓', weapon: '128單元 KVLS-II 垂發 + 海星反艦 + 紅鯊反潛火箭', sfx: 'missile', img: 'assets/units/KDX3.jpg' },
  TYPE45: { flag: '🇬🇧', origin: '英國', weapon: '桑普森雙面相控陣 + 72單元紫菀30/海引信防空網', sfx: 'missile', img: 'assets/units/TYPE45.jpg' },
  VA: { flag: '🇺🇸', origin: '美國', weapon: 'Mk 48 ADCAP 重型線導魚雷 + VPM 28枚戰斧飛彈', sfx: 'torpedo', img: 'assets/units/VA.jpg' },
  FREMM: { flag: '🇫🇷', origin: '法國/義大利', weapon: 'CAPTAS-4 拖曳聲納 + MU90 反潛魚雷 + 紫菀垂發', sfx: 'torpedo', img: 'assets/units/FREMM.jpg' },
  MOGAMI: { flag: '🇯🇵', origin: '日本', weapon: '17式增程反艦飛彈 + Mk41 07式反潛火箭 + 匿蹤桅杆', sfx: 'missile', img: 'assets/units/MOGAMI.jpg' },
  YASEN: { flag: '🇷🇺', origin: '俄羅斯', weapon: '3M22 鋯石 9馬赫極音速反艦飛彈 + 物理-2 重型魚雷', sfx: 'torpedo', img: 'assets/units/YASEN.jpg' },
  KILO: { flag: '🇷🇺', origin: '俄羅斯', weapon: '3M-54 口徑潛射反艦巡弋飛彈 + 53-65K 尾流魚雷', sfx: 'torpedo', img: 'assets/units/KILO.jpg' },
  SORYU: { flag: '🇯🇵', origin: '日本', weapon: '18式重型光纖導引魚雷 + 潛射魚叉 Block II 飛彈', sfx: 'torpedo', img: 'assets/units/SORYU.jpg' },
  U212: { flag: '🇩🇪', origin: '德國/挪威', weapon: 'DM2A4 海梭四型重型魚雷 + IDAS 潛射防空反艦彈', sfx: 'torpedo', img: 'assets/units/U212.jpg' },
  KD: { flag: '🇹🇼', origin: '台灣/法國', weapon: '華陽32單元海劍二垂發 + 雄風三型超音速反艦飛彈', sfx: 'missile', img: 'assets/units/KD.jpg' },
  TJ: { flag: '🇹🇼', origin: '台灣', weapon: '8枚雄風二/三型反艦飛彈 + 16枚海劍二防空飛彈', sfx: 'missile', img: 'assets/units/TJ.jpg' },
  T22: { flag: '🇨🇳', origin: '中國', weapon: '8枚鷹擊-83J 掠海反艦飛彈 + AK-630 近防機砲', sfx: 'missile', img: 'assets/units/T22.jpg' },
  GOWIND: { flag: '🇫🇷', origin: '法國', weapon: 'MU90 反潛魚雷 + 飛魚 MM40 Block 3C 反艦飛彈', sfx: 'missile', img: 'assets/units/GOWIND.jpg' },
  SAAR6: { flag: '🇮🇱', origin: '以色列', weapon: '巴拉克-8 區域防空 + C-Dome 海鐵穹 + 加百列V反艦彈', sfx: 'missile', img: 'assets/units/SAAR6.jpg' },
  USV: { flag: '🇺🇦', origin: '烏克蘭', weapon: 'MAGURA V5 星鏈導控高爆撞擊彈頭 + R-73 防空自衛彈', sfx: 'swarm', img: 'assets/units/USV.jpg' },
  PB: { flag: '🇺🇸', origin: '美國', weapon: '25mm Mk38 遙控鏈砲 + BGM-176 獅鷲精準飛彈', sfx: 'cannon', img: 'assets/units/PB.jpg' },
  HF3: { flag: '🇹🇼', origin: '台灣', weapon: '雄風三型增程型 2.5馬赫超音速反艦飛彈機動車組', sfx: 'missile', img: 'assets/units/HF3.jpg' },
  SBS: { flag: '🇬🇧', origin: '英國', weapon: 'SDV 水下特戰潛航器 + 龍骨重型感應磁性水雷', sfx: 'torpedo', img: 'assets/units/SBS.jpg' },

  // 支援
  E7: { flag: '🇦🇺', origin: '澳洲/美國', weapon: 'MESA 多功能電子掃描陣列雷達 + Link-16 戰區指管', sfx: 'emp_pulse', img: 'assets/units/E7.jpg' },
  B21: { flag: '🇺🇸', origin: '美國', weapon: 'AGM-158B JASSM-ER 匿蹤巡弋飛彈 + GBU-57 巨型鑽地彈', sfx: 'missile', img: 'assets/units/B21.jpg' },
  KJ500: { flag: '🇨🇳', origin: '中國', weapon: '三面氮化鎵數位相控陣雷達 + 全頻段電子偵察指管網', sfx: 'emp_pulse', img: 'assets/units/KJ500.jpg' },
  RQ4: { flag: '🇺🇸', origin: '美國', weapon: 'AN/ZPY-2 合成孔徑雷達 + 全域信號情報校射鏈', sfx: 'emp_pulse', img: 'assets/units/RQ4.jpg' },
  HIMARS: { flag: '🇺🇸', origin: '美國/台灣', weapon: 'PrSM 500km 精準打擊飛彈 + M31 GMLRS 衛星導引火箭', sfx: 'rocket_salvo', img: 'assets/units/HIMARS.jpg' },
  EA18: { flag: '🇺🇸', origin: '美國', weapon: 'AN/ALQ-249 次世代干擾艙 + AGM-88G AARGM-ER 反輻射彈', sfx: 'emp_pulse', img: 'assets/units/EA18.jpg' },
  ATACMS: { flag: '🇺🇸', origin: '美國', weapon: 'MGM-140 ATACMS 300km 戰術彈道飛彈重型單彈頭', sfx: 'rocket_salvo', img: 'assets/units/ATACMS.jpg' },
  STORM: { flag: '🇬🇧', origin: '英國/法國', weapon: '風暴暗影 (Storm Shadow) BROACH 串聯穿甲巡弋飛彈', sfx: 'missile', img: 'assets/units/STORM.jpg' },
  PZH: { flag: '🇩🇪', origin: '德國', weapon: '155mm L52 重裝自走砲 + SMArt 155 攻頂雙效子母彈', sfx: 'heavy_cannon', img: 'assets/units/PZH.jpg' },
  SMERCH: { flag: '🇷🇺', origin: '俄羅斯', weapon: '9M542 300mm 格洛納斯衛星導引多管重型火箭齊射', sfx: 'rocket_salvo', img: 'assets/units/SMERCH.jpg' },
  CAESAR: { flag: '🇫🇷', origin: '法國', weapon: '155mm L52 卡車砲 + Katana 導引砲彈反砲兵狙擊', sfx: 'heavy_cannon', img: 'assets/units/CAESAR.jpg' },
  ARCHER: { flag: '🇸🇪', origin: '瑞典', weapon: '155mm 全自動遙控砲塔 + M982 神劍 (Excalibur) 破甲彈', sfx: 'heavy_cannon', img: 'assets/units/ARCHER.jpg' },
  MQ9: { flag: '🇺🇸', origin: '美國/台灣', weapon: 'AGM-114R9X 地獄火飛彈 + SeaVue 海空搜索校射雷達', sfx: 'missile', img: 'assets/units/MQ9.jpg' },
  TB2: { flag: '🇹🇷', origin: '土耳其/烏克蘭', weapon: 'MAM-L / MAM-T 雷射導引高爆穿甲微型滑翔炸彈', sfx: 'missile', img: 'assets/units/TB2.jpg' },
  SW600: { flag: '🇺🇸', origin: '美國/台灣', weapon: '彈簧刀 600 標槍雙聚能破甲彈頭長航時巡飛彈', sfx: 'swarm', img: 'assets/units/SW600.jpg' },
  ORION: { flag: '🇷🇺', origin: '俄羅斯', weapon: 'X-BPLA 激光制導反甲飛彈 + 柳葉刀-3M 巡飛彈導引', sfx: 'missile', img: 'assets/units/ORION.jpg' },
  FPV: { flag: '🇺🇦', origin: '烏克蘭', weapon: '20km 光纖線控抗干擾 FPV + PG-7VR 串聯破甲火箭彈頭', sfx: 'swarm', img: 'assets/units/FPV.jpg' },
  SPOT: { flag: '🌐', origin: '戰術無人機', weapon: 'AI 多光譜熱成像目標識別 + 雷射測距火砲校射鏈', sfx: 'emp_pulse', img: 'assets/units/SPOT.jpg' },
  SW300: { flag: '🇺🇸', origin: '美國/台灣', weapon: '彈簧刀 300 Block 20 反雷達天線定向破片巡飛彈', sfx: 'swarm', img: 'assets/units/SW300.jpg' },
  MORTAR: { flag: '🌍', origin: '步兵部隊', weapon: '120mm 車載速射迫擊砲 + STRIX 紅外導引攻頂迫砲彈', sfx: 'heavy_cannon', img: 'assets/units/MORTAR.jpg' }
};

const UNITS = RAW_UNITS.map(r => {
  const [id, name, cat, cost, v, tag, desc, st, ew, traits, hp, atk, def] = r;
  const meta = UNIT_META[id] || {
    flag: '🌐', origin: '現代軍武',
    weapon: '常規標準戰術武裝',
    sfx: 'missile',
    img: ''
  };
  return {
    id, name, cat, cost, v, tag, desc, traits,
    st, ew,
    hp, atk, def,
    flag: meta.flag,
    origin: meta.origin,
    weapon: meta.weapon,
    sfx: meta.sfx,
    img: meta.img
  };
});

const UNIT_MAP = {};
UNITS.forEach(u => { UNIT_MAP[u.id] = u; });
// 向後相容舊版存檔或模板 ID 別名
if (UNIT_MAP['F35A'] && !UNIT_MAP['F35']) UNIT_MAP['F35'] = UNIT_MAP['F35A'];
if (UNIT_MAP['HQ9L'] && !UNIT_MAP['HQ9']) UNIT_MAP['HQ9'] = UNIT_MAP['HQ9L'];
if (UNIT_MAP['PAC3'] && !UNIT_MAP['PATRIOT']) UNIT_MAP['PATRIOT'] = UNIT_MAP['PAC3'];
if (UNIT_MAP['DDG51'] && !UNIT_MAP['BURKE']) UNIT_MAP['BURKE'] = UNIT_MAP['DDG51'];
if (UNIT_MAP['TJ'] && !UNIT_MAP['TUOCHIANG']) UNIT_MAP['TUOCHIANG'] = UNIT_MAP['TJ'];

/* ---------- 聯合作戰體系羈絆 (Combined Arms Synergies) ---------- */
const DRONE_IDS = new Set(['FPV', 'TB2', 'MQ9', 'SW600', 'SW300', 'ORION', 'SPOT', 'RQ4', 'USV']);
const SYNERGIES = [
  {
    id: 'cec',
    icon: '📡',
    name: '協同接戰網 (CEC)',
    desc: '高階電戰預警機 (EW≥50) ＋ 遠程防空／神盾艦：電戰 +12、防空命中 +6%',
    check: units => units.some(u => (u.ew || 0) >= 50) && units.some(u => (u.traits || []).includes('AEGIS') || (u.traits || []).includes('AA_LONG')),
    partial: units => {
      const hasEw = units.some(u => (u.ew || 0) >= 50);
      const hasAa = units.some(u => (u.traits || []).includes('AEGIS') || (u.traits || []).includes('AA_LONG'));
      if (hasEw && !hasAa) return '已備妥預警機，再選【遠程防空或神盾艦】即可啟動：電戰 +12、防空命中 +6%';
      if (!hasEw && hasAa) return '已備妥神盾/長程防空，再選【$5 高階預警機 (EW≥50)】即可啟動：電戰 +12、防空命中 +6%';
      return null;
    }
  },
  {
    id: 'mumt',
    icon: '🛸',
    name: '有人無人協同 (MUM-T)',
    desc: '$5 五代空優戰機 ＋ 無人機／巡飛彈／無人艇：支援與無人單位傷害 +15%、全體隱匿 +5',
    check: units => units.some(u => u.cat === 'air' && u.cost === 5) && units.some(u => DRONE_IDS.has(u.id) || (u.traits || []).includes('SWARM')),
    partial: units => {
      const has5th = units.some(u => u.cat === 'air' && u.cost === 5);
      const hasDrone = units.some(u => DRONE_IDS.has(u.id) || (u.traits || []).includes('SWARM'));
      if (has5th && !hasDrone) return '已備妥 $5 五代戰機，再選【無人機／巡飛彈／無人快艇】即可啟動：無人與支援傷害 +15%、全體隱匿 +5';
      if (!has5th && hasDrone) return '已備妥無人作戰單位，再選【$5 五代空優戰機】即可啟動：無人與支援傷害 +15%、全體隱匿 +5';
      return null;
    }
  },
  {
    id: 'asw_net',
    icon: '🌊',
    name: '立體海空獵殺網 (ASW Net)',
    desc: '反潛艦／潛艦 ＋ 電戰／校射偵蒐 (EW≥15 或 SPOT)：制海命中 +6%、海軍傷害 +12%',
    check: units => units.some(u => (u.traits || []).includes('ASW') || (u.traits || []).includes('SUB')) && units.some(u => (u.ew || 0) >= 15 || (u.traits || []).includes('SPOT')),
    partial: units => {
      const hasNav = units.some(u => (u.traits || []).includes('ASW') || (u.traits || []).includes('SUB'));
      const hasSpot = units.some(u => (u.ew || 0) >= 15 || (u.traits || []).includes('SPOT'));
      if (hasNav && !hasSpot) return '已備妥反潛艦／潛艦，再選【電戰或校射偵蒐單位 (EW≥15 / SPOT)】即可啟動：制海命中 +6%、海軍傷害 +12%';
      return null;
    }
  },
  {
    id: 'iron_fist',
    icon: '⚙',
    name: '步坦砲協同鐵拳 (Land Force)',
    desc: '重裝甲／主動防護戰車 ＋ 自走砲／校射支援：階段三裝甲與火砲傷害 +10%',
    check: units => units.some(u => (u.traits || []).includes('HEAVY') || (u.traits || []).includes('APS')) && units.some(u => (u.traits || []).includes('ARTY') || (u.traits || []).includes('SPOT')),
    partial: units => {
      const hasTank = units.some(u => (u.traits || []).includes('HEAVY') || (u.traits || []).includes('APS'));
      const hasArty = units.some(u => (u.traits || []).includes('ARTY') || (u.traits || []).includes('SPOT'));
      if (hasTank && !hasArty) return '已備妥重裝主戰坦克，再選【自走砲／火箭砲／前觀校射】即可啟動：階段三裝甲與火砲傷害 +10%';
      if (!hasTank && hasArty) return '已備妥火砲／校射支援，再選【重裝甲／APS主動防護戰車】即可啟動：階段三裝甲與火砲傷害 +10%';
      return null;
    }
  }
];

function getDeckSynergies(idsOrUnits) {
  const units = (idsOrUnits || []).map(x => (typeof x === 'string' ? UNIT_MAP[x] : x)).filter(Boolean);
  if (units.length < 2) return [];
  return SYNERGIES.filter(syn => syn.check(units));
}

function getPartialDeckSynergies(idsOrUnits) {
  const units = (idsOrUnits || []).map(x => (typeof x === 'string' ? UNIT_MAP[x] : x)).filter(Boolean);
  if (units.length === 0 || units.length >= 5) return [];
  const out = [];
  for (const syn of SYNERGIES) {
    if (!syn.check(units) && typeof syn.partial === 'function') {
      const hint = syn.partial(units);
      if (hint) out.push({ id: syn.id, icon: syn.icon, name: syn.name, hint });
    }
  }
  return out;
}

function getUnitSynergyHints(u) {
  if (!u) return [];
  const hints = [];
  const isCecEw = (u.ew || 0) >= 50;
  const isCecAa = (u.traits || []).includes('AEGIS') || (u.traits || []).includes('AA_LONG');
  if (isCecEw) hints.push({ icon: '📡', name: '協同接戰網 (CEC)', hint: '搭配【神盾艦／長程防空】可啟動：電戰+12、防空命中+6%' });
  if (isCecAa) hints.push({ icon: '📡', name: '協同接戰網 (CEC)', hint: '搭配【$5 高階預警機】可啟動：電戰+12、防空命中+6%' });

  const is5th = u.cat === 'air' && u.cost === 5;
  const isDrone = DRONE_IDS.has(u.id) || (u.traits || []).includes('SWARM');
  if (is5th) hints.push({ icon: '🛸', name: '有人無人協同 (MUM-T)', hint: '搭配【無人機／巡飛彈／無人快艇】可啟動：無人單位傷害+15%、全體隱匿+5' });
  if (isDrone) hints.push({ icon: '🛸', name: '有人無人協同 (MUM-T)', hint: '搭配【$5 五代空優戰機】可啟動：無人單位傷害+15%、全體隱匿+5' });

  const isNav = (u.traits || []).includes('ASW') || (u.traits || []).includes('SUB');
  const isSpot = (u.ew || 0) >= 15 || (u.traits || []).includes('SPOT');
  if (isNav) hints.push({ icon: '🌊', name: '立體反潛網 (ASW Net)', hint: '搭配【電戰或校射偵蒐 (EW≥15/SPOT)】可啟動：制海命中+6%、海軍傷害+12%' });
  if (isSpot && u.cat !== 'naval') hints.push({ icon: '🌊', name: '立體反潛網 (ASW Net)', hint: '搭配【反潛艦／潛艦】可啟動：制海命中+6%、海軍傷害+12%' });

  const isTank = (u.traits || []).includes('HEAVY') || (u.traits || []).includes('APS');
  const isArty = (u.traits || []).includes('ARTY') || (u.traits || []).includes('SPOT');
  if (isTank) hints.push({ icon: '⚙', name: '步坦砲協同鐵拳', hint: '搭配【自走砲／長程火砲／前觀校射】可啟動：火砲與裝甲傷害+10%' });
  if (isArty && u.cat !== 'armor') hints.push({ icon: '⚙', name: '步坦砲協同鐵拳', hint: '搭配【重裝甲／APS主戰坦克】可啟動：火砲與裝甲傷害+10%' });

  return hints;
}
const MAX_HP = Math.max(...UNITS.map(u => u.hp));
const MAX_ATK = Math.max(...UNITS.map(u => u.atk));

const CAT_HINT = {
  air:         '擅長：空戰、密接支援裝甲。害怕：防空單位（匿蹤可削弱攔截）。',
  armor:       '擅長：地面決戰、掌握戰線控制分。害怕：空中密接、無人機與火砲。',
  air_defense: '擅長：攔截戰機（×2.5）。害怕：階段一被 SEAD 先制壓制。',
  naval:       '擅長：海上對決、岸轟。潛艦隱匿高，需反潛艦克制。',
  support:     '擅長：電戰先攻、先制壓制、持續火砲。本身脆弱需要保護。'
};
