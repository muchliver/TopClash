'use strict';
/* =====================================================
   頂尖對戰：15元聯合作戰 — 資料層
   100 款全差異化現代裝備 = 5 兵種 × 5 價位 × 4 款
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
  HEAVY:   '重裝甲：複合／貧鈾重裝甲防護（減傷高達 22%～27%）',
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
  ['F22','F-22 猛禽','air',5,'A','極致隱形空優','第五代匿蹤戰機，雷達反射極小，專職奪取空優並壓制防空。',88,0,['CAS'],207,115,0],
  ['J20','殲-20A 威龍','air',5,'B','遠程重載截擊','雙發重型匿蹤升力體戰機，載彈量大、航程遠，空戰射程極長。',74,10,['LR'],225,122,0],
  ['SU57','蘇-57 惡棍','air',5,'C','超機動極限空戰','超機動格鬥怪獸，向量推力強悍，空戰爆發火力極高。',65,0,['LR'],218,132,0],
  ['F35A','F-35A 閃電II (深打型)','air',5,'D','網絡穿透直擊','感測器高度融合，自帶高電戰，開局直毀敵方核心資產。',80,30,['DEEP','EW'],195,110,0],
  // $4
  ['RAFALE','陣風 (Rafale C)','air',4,'A','全能飆風·光電打擊','被動光電雷達偵搜，抗電戰干擾強，空戰與密接俱佳。',55,18,['LR'],170,96,0],
  ['EF2K','颱風戰鬥機','air',4,'B','超音速格鬥空優','機動性極強的雙發重型多用途戰機，空戰火力出色。',35,0,['LR'],175,102,0],
  ['F15EX','F-15EX 鷹二型','air',4,'C','巨型飛彈卡車','重型載彈量怪獸，可同時發射超視距飛彈迎擊多目標。',20,0,['SAT'],188,98,0],
  ['SU35','蘇-35S 超側衛','air',4,'D','眼鏡蛇超機動','向量推力超機動，載彈量大，空戰爆發火力強悍。',30,0,['LR'],180,106,0],
  // $3
  ['F16V','F-16V 蝰蛇','air',3,'A','成熟全能主力','全球量產最多的多用途戰機，價格與性能最均衡。',25,0,['CAS'],139,77,0],
  ['JAS39','JAS-39E 鷹獅','air',3,'B','戰備分散·強電戰','輕型戰機自帶專屬電戰干擾系統，性價比極高。',40,22,['EW'],130,72,0],
  ['M2K9','幻象 2000-9','air',3,'C','高速三角翼截擊','三角翼高速攔截機，空戰火力優於同價位一般機種。',30,0,['LR'],134,84,0],
  ['J10C','殲-10C 猛龍','air',3,'D','鴨翼敏捷主力','AESA 雷達與霹靂飛彈加持，對地密接支援結實耐打。',32,5,['CAS'],145,76,0],
  // $2
  ['FA50','FA-50 戰鷹','air',2,'A','經濟型密接支援','高出勤率的輕型攻擊戰機，專職地面密接支援。',20,0,['CAS'],114,63,0],
  ['JF17','梟龍 JF-17 Block 3','air',2,'B','平價穿甲輕戰機','配備先進反裝甲巡航彈，無視裝甲減傷進行破防。',28,10,['TRUE_AT'],108,66,0],
  ['M2K','幻象 2000-5','air',2,'C','輕裝極速防空','極速高空攔截，以較高攻擊力提供中距離制空掩護。',20,0,['LR'],110,72,0],
  ['F5E','F-5E/F 虎式改','air',2,'D','老將最後衝鋒','經典輕戰機結構升級，價格低且皮實耐打。',15,0,['CAS'],122,60,0],
  // $1
  ['A29','A-29 超級巨嘴鳥','air',1,'A','低成本密接支援','渦輪螺旋槳攻擊機，專打地面部隊的平價選擇。',8,0,['CAS'],85,47,0],
  ['MIG21','米格-21 升級型','air',1,'B','消耗型鐵翼肉盾','換裝新電戰的老戰機，勝在便宜且血量厚實。',8,0,[],98,45,0],
  ['YAK130','雅克-130 攻擊型','air',1,'C','雙座集束對地彈幕','雙座輕型攻擊機，地面壓制火力同級最高。',12,0,['CAS'],88,52,0],
  ['L159','L-159 ALCA','air',1,'D','微型穿甲破防機','掛載小牛飛彈，以 $1 代價破除敵方重裝甲減傷。',15,0,['TRUE_AT'],80,48,0],

  // ==================== 重裝鐵騎 (armor, 20 款) ====================
  // $5
  ['M1A2','M1A2 SEPv3 艾布蘭','armor',5,'A','貧鈾重裝甲','美軍主戰坦克，貧鈾複合裝甲，極致減傷掌控戰線。',5,0,['HEAVY'],363,108,0.27],
  ['LEO2','豹 2A8','armor',5,'B','頂級火控·主動防護','配備 Trophy 主動防護系統，自動攔截首發反裝甲彈藥。',5,0,['APS','HEAVY'],345,118,0.25],
  ['T14','T-14 阿瑪塔','armor',5,'C','無人砲塔攻防','無人砲塔隔艙設計，穿甲火力兇猛，自帶主動防禦。',10,0,['APS'],350,125,0.15],
  ['MK4','梅卡瓦 Mk 4M','armor',5,'D','前置重盾步坦協同','前置發動機超厚車體，全遊戲最高裝甲生命值。',5,0,['APS','HEAVY'],378,104,0.25],
  // $4
  ['K2','K2 黑豹','armor',4,'A','數位火控·主動防護','配備主動防護系統與液壓懸吊，攔截首發反裝甲彈藥。',5,0,['APS'],278,89,0.15],
  ['CH3','挑戰者 3','armor',4,'B','多層複合重裝甲','英製重裝甲堡壘，多層喬巴姆裝甲，正面極難擊穿。',5,0,['HEAVY'],305,82,0.27],
  ['LEC','勒克萊爾 XLR','armor',4,'C','自動裝填速射砲','極速自動裝彈機，穿甲火力為同價位最高水準。',5,0,[],270,102,0.15],
  ['T99A','99A 式主戰戰車','armor',4,'D','箭形雙防裝甲','重型反應裝甲與雷射壓制系統，攻守兼備主力。',8,0,['HEAVY'],288,94,0.22],
  // $3
  ['T90','T-90M 突破','armor',3,'A','重型反應裝甲','化石爆炸反應裝甲加持的俄系主力戰車。',5,0,['HEAVY'],232,72,0.27],
  ['T10','10 式戰車','armor',3,'B','極速首發命中','日本主戰坦克，火控精準，機動穿甲火力出色。',8,0,[],215,85,0.15],
  ['M1A1','M1A1 SA 艾布蘭','armor',3,'C','實戰淬鍊老兵','貧鈾裝甲與高膛壓砲，性能扎實穩定。',5,0,[],240,75,0.20],
  ['LEO2A4','豹 2A4 升級型','armor',3,'D','歐陸鋼鐵中堅','經典滑膛砲與複合裝甲，標準均衡裝甲部隊。',5,0,[],225,78,0.18],
  // $2
  ['T72','T-72B3','armor',2,'A','裝甲洪流基底','低成本的鋼鐵洪流，血量深厚耐磨損。',5,0,[],208,59,0.15],
  ['STRY','史崔克 30mm 龍騎兵','armor',2,'B','輪式快速突擊','30mm 鏈砲輪式裝甲車，快速突穿敵方防線。',15,0,['TRUE_AT'],175,68,0.15],
  ['BOXER','拳獅犬 (Boxer CRV)','armor',2,'C','重裝模組步戰','重型輪式裝甲，車體防護力堪比輕型坦克。',10,0,['HEAVY'],192,64,0.22],
  ['CM34','雲豹 CM-34 鏈砲車','armor',2,'D','機動城市步戰','具備高機動巷戰優勢，反制輕型載具。',18,0,[],182,70,0.15],
  // $1
  ['TOYO','武裝豐田皮卡','armor',1,'A','機動遊擊兵','改裝皮卡機槍車，隱匿值高，難以被重砲鎖定。',30,0,[],141,44,0],
  ['T55','T-55 / T-62M 改','armor',1,'B','消耗型鐵棺肉盾','上古戰車加裝附加裝甲，專門替主力吸收砲火。',5,0,['HEAVY'],172,38,0.22],
  ['M113T','M113 拖式飛彈車','armor',1,'C','輕裝反戰車伏擊','車薄但配備重型反甲飛彈，無視裝甲秒殺重坦。',12,0,['TRUE_AT'],125,55,0.05],
  ['HMMWV','悍馬 TOW 裝甲車','armor',1,'D','輪式機動伏擊組','高速輪式越野反裝甲載具，小資換高價戰車。',25,0,[],132,48,0.05],

  // ==================== 區域防空 (air_defense, 20 款) ====================
  // $5
  ['PAC3','愛國者 PAC-3 MSE','air_defense',5,'A','全域防空反導','全球最成熟的長程防空與動能碰撞攔截反導系統。',10,0,['AA_LONG'],230,113,0],
  ['S500','S-500 普羅米修斯','air_defense',5,'B','太空邊緣極音速反導','極音速超遠程防空，單發毀滅性防空殺傷力。',10,0,['AA_LONG'],240,128,0],
  ['S400','S-400 凱旋','air_defense',5,'C','超遠程多層火網','多層次飽和接戰，陣地耐久極高不易被壓制。',10,0,['AA_LONG'],255,118,0],
  ['DAVID','大衛投石索','air_defense',5,'D','雙模尋標多層防空','雙尋標攔截彈，自帶電子戰抗性，封鎖各型戰機。',15,15,['AA_LONG'],225,115,0],
  // $4
  ['SAMPT','SAMP/T 紫菀30','air_defense',4,'A','精確攔截','歐洲聯合研製垂直發射，多目標接戰精度極高。',10,0,[],186,98,0],
  ['IRON','鐵穹 + 大衛投石索','air_defense',4,'B','飽和攔截網','多層次密集火網，使敵方無人機與火箭傷害減半。',10,0,['CIWS'],202,92,0],
  ['TK3','天弓三型防空系統','air_defense',4,'C','相控陣長程阻絕','台灣製造長程主動雷達導引反導系統，防護覆蓋廣闊。',12,8,['AA_LONG'],192,104,0],
  ['HQ9L','陸基紅旗-9B','air_defense',4,'D','重型野戰長程防空','垂直冷發射防空飛彈，車體厚實抗炸力優異。',10,0,[],198,96,0.10],
  // $3
  ['NASAMS','NASAMS 增程型','air_defense',3,'A','中程分散式防空','分散式網絡化節點部署，生存力與抗損性極佳。',15,0,[],162,76,0],
  ['IRIST','IRIS-T SLM','air_defense',3,'B','紅外成像高機動防空','紅外導引不受電子戰干擾影響，精準打擊各型飛機。',18,12,[],148,82,0],
  ['BUKM3','山毛櫸 Buk-M3','air_defense',3,'C','野戰履帶垂直防空','跟隨裝甲部隊推進的重型野戰防空載具。',10,0,[],158,86,0],
  ['HQ16','紅旗-16FE','air_defense',3,'D','中程野戰快反火網','垂直發射反應時間極短，專防低空突防戰機。',12,0,[],154,80,0.05],
  // $2
  ['PANT','鎧甲-S1','air_defense',2,'A','彈砲近防','雙管機砲與近防飛彈合一，無人機與巡弋彈剋星。',10,0,['CIWS'],126,62,0],
  ['GEPARD','獵豹野戰防空 (Gepard)','air_defense',2,'B','雙聯 35mm 空爆神砲','裝甲履帶底盤自帶減傷，彈藥程式化空爆無人機。',10,0,['CIWS'],138,58,0.15],
  ['AVNG','復仇者防空車','air_defense',2,'C','野戰機動防空','輪式輕型機動防空載具，反應迅速先手追擊。',15,0,[],118,68,0],
  ['TC2','天劍二型陸射系統','air_defense',2,'D','全天候相控陣防空','主動雷達導引防空飛彈，全天候野戰多目標阻截。',12,5,[],124,64,0],
  // $1
  ['STING','刺針小隊','air_defense',1,'A','單兵便攜隱蔽','單兵肩射紅外線防空，隱蔽性極高，難以被先手消滅。',35,0,[],94,48,0],
  ['IGLA','針式小隊 (9K38)','air_defense',1,'B','戰壕突襲防空','俄製單兵防空，部署簡便且耐打。',30,0,[],102,44,0],
  ['STAR','星光防空飛彈 (Starstreak)','air_defense',1,'C','3馬赫雷射乘波破甲','極速鎢合金三箭頭，不可被熱誘餌欺騙。',28,0,[],88,54,0],
  ['OERL','雙聯 35mm 歐瑞康快砲','air_defense',1,'D','機械陣地固定火網','純機械火控火砲，完全免疫電戰干擾。',15,0,[],98,46,0.10],

  // ==================== 制海權威 (naval, 20 款) ====================
  // $5
  ['DDG51','伯克級 Flight III','naval',5,'A','神盾基石','神盾戰鬥系統，階段二可兼任區域防空，海空核心。',20,0,['AEGIS'],322,118,0.10],
  ['T055','055 型大驅','naval',5,'B','萬噸全能垂發','萬噸級驅逐艦，艦身耐久全場之最，垂發火力驚人。',15,0,['AEGIS'],389,135,0.10],
  ['KDX3','世宗大王級驅逐艦','naval',5,'C','火力巨獸 128 垂發','亞洲最強垂發配置，同時兼顧飽和反艦與防空。',15,10,['AEGIS'],350,130,0.10],
  ['TYPE45','45 型勇敢級 (Type 45)','naval',5,'D','桑普森雷達防空旗艦','頂尖海空搜索雷達，自帶強電戰，艦隊超級屏障。',25,25,['AEGIS','EW'],310,115,0.10],
  // $4
  ['VA','維吉尼亞級核潛艇','naval',4,'A','水下刺客','核動力攻擊潛艦，極限隱匿，對水面艦傷害 ×1.3。',75,0,['SUB'],260,95,0.10],
  ['FREMM','FREMM 巡防艦','naval',4,'B','反潛旗艦','歐洲多用途巡防艦，反潛能力一流，對潛艦傷害 ×1.6。',20,0,['ASW'],275,92,0.10],
  ['MOGAMI','最上級匿蹤巡防艦','naval',4,'C','雷達隱形多功能艦','高度自動化匿蹤艦體，水面交戰先手命中率高。',45,0,[],250,98,0.10],
  ['YASEN','亞森級核潛艇 (Yasen-M)','naval',4,'D','深海巡弋極音速殺手','重型巡弋飛彈核潛艇，水下爆發火力極度兇殘。',68,0,['SUB'],285,105,0.10],
  // $3
  ['KILO','基洛級 636.3','naval',3,'A','靜音潛艦','「大洋黑洞」柴電潛艦，靜音性能卓越的水下伏擊者。',70,0,['SUB'],216,79,0.10],
  ['SORYU','蒼龍級 AIP 潛艦','naval',3,'B','絕氣推進深海獵手','絕氣推進長滯空，反艦反潛綜合平衡神艦。',68,0,['SUB'],210,82,0.10],
  ['U212','212A 型 AIP 潛艇','naval',3,'C','無磁隱蔽獵殺','燃料電池與無磁性船體，完全免疫常規磁異探測。',74,0,['SUB'],205,78,0.10],
  ['KD','康定級升級型 (拉法葉)','naval',3,'D','換心垂發匿蹤艦','換裝海劍二垂發與雄三超音速飛彈，攻防兼備。',35,8,[],228,76,0.10],
  // $2
  ['TJ','沱江級巡邏艦','naval',2,'A','航母殺手','雙體穿浪艦，搭載反艦飛彈對高價艦艇造成額外傷害。',35,0,['AMBUSH'],177,64,0.10],
  ['T22','22 型飛彈快艇','naval',2,'B','飛彈狼群','隱形穿浪飛彈快艇，高速突擊，爆發傷害極高。',40,0,['AMBUSH'],165,72,0.10],
  ['GOWIND','追風級 (Gowind 2500)','naval',2,'C','模組化近海護衛艦','耐海性優異且血條厚實，近海戰線控制力強。',25,0,[],188,62,0.10],
  ['SAAR6','薩爾 6 型護衛艦','naval',2,'D','刺蝟重武裝輕護','配備密集防空反艦飛彈，自帶微量電戰值。',30,10,[],172,66,0.10],
  // $1
  ['USV','自殺無人快艇群','naval',1,'A','群狼撞擊','無人自殺艇群，以小博大，同時自爆多艘水面艦。',48,0,['AMBUSH','SWARM'],132,56,0],
  ['PB','武裝突擊巡邏艇','naval',1,'B','近海騷擾攔截','巡邏機槍艇，皮實耐打，防範無人艇襲擾。',25,0,[],145,46,0.05],
  ['HF3','雄三岸置反艦車組','naval',1,'C','岸基超音速伏擊','陸基掩蔽發射超音速反艦彈，低成本扼守海峽。',40,0,['AMBUSH'],120,54,0],
  ['SBS','特戰微型潛水艇','naval',1,'D','特種水下爆破','極高隱匿，以極小代價實施水下暗殺偷襲。',55,0,[],115,50,0],

  // ==================== 情報／長程打擊 (support, 20 款) ====================
  // $5
  ['E7','E-7 楔尾預警機','support',5,'A','全戰場空域指管樞紐','掌控戰場電磁權，電戰領先可削弱敵方命中、提振己方火力。',5,72,['EW'],203,88,0],
  ['B21','B-21 突襲者','support',5,'B','戰略匿蹤轟炸','次世代隱形轟炸機，階段一直擊敵方最貴核心單位。',85,0,['DEEP'],185,126,0],
  ['KJ500','空警-500 預警機','support',5,'C','三面相控陣雷達先鋒','數位陣列雷達，具備厚實機體耐久與 70 電戰值。',5,70,['EW'],215,82,0],
  ['RQ4','RQ-4 全球鷹戰略無人機','support',5,'D','萬米高空全域開圖','萬米高空合成孔徑雷達，高電戰與優異高空隱匿。',45,55,['EW'],175,92,0],
  // $4
  ['HIMARS','M142 海馬斯','support',4,'A','衛星精準火箭','精準火箭彈，先制壓制防空並持續打擊敵方裝甲。',20,8,['SEAD','ARTY'],149,79,0],
  ['EA18','EA-18G 咆哮者','support',4,'B','全頻譜電戰干擾','電子戰專用機，電戰值高達 65，大幅削弱敵方防空與空戰。',50,65,['EW'],158,72,0],
  ['ATACMS','陸軍戰術飛彈 (ATACMS)','support',4,'C','戰區縱深定點點穴','300 公里重型單彈頭，直毀敵方核心樞紐單位。',15,0,['DEEP'],142,96,0],
  ['STORM','風暴暗影巡弋飛彈組','support',4,'D','穿透地堡貫穿裝甲','無視裝甲減傷之重型巡弋飛彈，貫穿指揮中心。',40,0,['TRUE_AT','DEEP'],138,90,0],
  // $3
  ['PZH','PzH 2000 自走砲','support',3,'A','極速齊射砲王','世界射速之王，第三階段持續打擊敵方裝甲部隊。',5,0,['ARTY'],124,85,0],
  ['SMERCH','龍捲風-S','support',3,'B','多管重火箭面殺傷','300mm 導引火箭飽和齊射，同時打擊兩個裝甲目標。',5,0,['ARTY','SAT'],132,76,0],
  ['CAESAR','凱撒自走砲 (CAESAR)','support',3,'C','輪式快打快撤砲兵','高機動卡車砲，射擊完畢即時轉移，生存發揮最穩。',12,0,['ARTY'],118,80,0],
  ['ARCHER','弓箭手 (Archer) 自走砲','support',3,'D','全自動極限精準火砲','全電腦自動火控與快速裝填，火砲精度極高。',8,5,['ARTY'],120,82,0],
  // $2
  ['MQ9','MQ-9 死神無人機','support',2,'A','持久偵打一體','長滯空偵察與定點獵殺，提供少量電戰值與持續砲火。',35,18,['ARTY'],101,48,0],
  ['TB2','TB-2 察打無人機','support',2,'B','低空戰術襲擾','廉價察打無人機，配備激光導引炸彈穿甲獵殺戰車。',40,0,['TRUE_AT'],94,55,0],
  ['SW600','彈簧刀 600 (Switchblade)','support',2,'C','重型巡飛破甲彈','標槍彈頭長時巡飛，隱匿值高且破甲爆發極強。',52,0,['TRUE_AT'],88,64,0],
  ['ORION','獵戶座 (Orion) 察打機','support',2,'D','前沿戰術光電導引','兼具電戰與持續反裝甲，血量厚實不易被擊落。',30,10,['TRUE_AT'],106,50,0],
  // $1
  ['FPV','FPV 自殺無人機組','support',1,'A','裝甲點穴蜂群','穿越機改裝自殺無人機群，專剋昂貴戰車，無視減傷。',58,0,['TRUE_AT','SWARM'],75,46,0],
  ['SPOT','民用無人機校射組','support',1,'B','熱像視野引導','民用無人機校射，讓友軍火砲傷害 +15% 且提供電戰。',40,16,['SPOT'],86,42,0],
  ['SW300','彈簧刀 300','support',1,'C','背負式雷達天線殺手','微型巡飛彈，以 $1 代價先制壓制敵方防空雷達。',50,0,['SEAD'],72,44,0],
  ['MORTAR','前進觀測迫擊砲小隊','support',1,'D','隱蔽曲射近距支援','步兵迫擊砲陣地，便宜耐打，提供持續基礎砲擊。',30,0,['ARTY'],94,40,0]
];

const UNIT_META = {
  // 制空
  F22: { flag: '🇺🇸', origin: '美國', weapon: 'AIM-120D 視距外長程空對空飛彈', sfx: 'missile', img: 'assets/units/F22.jpg' },
  J20: { flag: '🇨🇳', origin: '中國', weapon: 'PL-15 長程雙脈衝主動雷達導彈', sfx: 'missile', img: 'assets/units/J20.jpg' },
  SU57: { flag: '🇷🇺', origin: '俄羅斯', weapon: 'R-77M / R-37M 極音速導彈', sfx: 'missile', img: 'assets/units/SU57.jpg' },
  F35A: { flag: '🇺🇸', origin: '美國', weapon: 'AGM-158 JASSM 匿蹤長程巡弋飛彈', sfx: 'missile', img: 'assets/units/F35.jpg' },
  RAFALE: { flag: '🇫🇷', origin: '法國', weapon: '流星 (Meteor) 衝壓超視距飛彈', sfx: 'missile', img: 'assets/units/RAFALE.jpg' },
  EF2K: { flag: '🇪🇺', origin: '歐洲聯合', weapon: '流星衝壓飛彈 / ASRAAM 近距彈', sfx: 'missile', img: 'assets/units/EF2K.jpg' },
  F15EX: { flag: '🇺🇸', origin: '美國', weapon: '22枚 AIM-120 飽和載彈超視距齊射', sfx: 'missile', img: 'assets/units/F15EX.jpg' },
  SU35: { flag: '🇷🇺', origin: '俄羅斯', weapon: 'R-73 / R-77 高機動空對空飛彈', sfx: 'missile', img: 'assets/units/SU35.jpg' },
  F16V: { flag: '🇺🇸', origin: '美國/台灣', weapon: 'AIM-120C-7 / AIM-9X 響尾蛇', sfx: 'missile', img: 'assets/units/F16V.jpg' },
  JAS39: { flag: '🇸🇪', origin: '瑞典', weapon: '流星飛彈 + 整合式電戰干擾莢艙', sfx: 'missile', img: 'assets/units/JAS39.jpg' },
  M2K9: { flag: '🇫🇷', origin: '法國/阿聯', weapon: '雲母 (MICA) 射頻/紅外雙模空空彈', sfx: 'missile', img: 'assets/units/M2K9.jpg' },
  J10C: { flag: '🇨🇳', origin: '中國', weapon: 'PL-10 近距格鬥彈 + PL-15 中程彈', sfx: 'missile', img: 'assets/units/J10C.jpg' },
  FA50: { flag: '🇰🇷', origin: '南韓', weapon: 'AGM-65 小牛飛彈 / AIM-9 響尾蛇', sfx: 'missile', img: 'assets/units/FA50.jpg' },
  JF17: { flag: '🇵🇰', origin: '巴基斯坦', weapon: 'PL-12 空空飛彈 + C-802AK 穿甲彈', sfx: 'missile', img: 'assets/units/JF17.jpg' },
  M2K: { flag: '🇫🇷', origin: '法國/台灣', weapon: '雲母 (MICA) 雷達導引中程空空飛彈', sfx: 'missile', img: 'assets/units/M2K.jpg' },
  F5E: { flag: '🇺🇸', origin: '美國/台灣', weapon: 'AIM-9P4 響尾蛇 / 鋪路II 導引炸彈', sfx: 'missile', img: 'assets/units/F5E.jpg' },
  A29: { flag: '🇧🇷', origin: '巴西', weapon: 'GBU-12 鋪路II 導引炸彈 / 火箭彈', sfx: 'cannon', img: 'assets/units/A29.jpg' },
  MIG21: { flag: '🇷🇺', origin: '俄羅斯', weapon: 'R-60MK 近距空空飛彈 / 雙管機砲', sfx: 'missile', img: 'assets/units/MIG21.jpg' },
  YAK130: { flag: '🇷🇺', origin: '俄羅斯', weapon: 'S-8 航空火箭巢 / 集束航空炸彈', sfx: 'cannon', img: 'assets/units/YAK130.jpg' },
  L159: { flag: '🇨🇿', origin: '捷克', weapon: 'AGM-65 小牛反裝甲飛彈 / 雙管機砲', sfx: 'missile', img: 'assets/units/L159.jpg' },

  // 裝甲
  M1A2: { flag: '🇺🇸', origin: '美國', weapon: '120mm M829A4 貧鈾翼穩脫殼穿甲彈', sfx: 'heavy_cannon', img: 'assets/units/M1A2.jpg' },
  LEO2: { flag: '🇩🇪', origin: '德國', weapon: '120mm DM63 鎢合金尾翼脫殼穿甲彈 + Trophy', sfx: 'heavy_cannon', img: 'assets/units/LEO2.jpg' },
  T14: { flag: '🇷🇺', origin: '俄羅斯', weapon: '125mm 2A82-1M 砲 + 阿富汗石主動防護', sfx: 'heavy_cannon', img: 'assets/units/T14.jpg' },
  MK4: { flag: '🇮🇱', origin: '以色列', weapon: '120mm MG253 滑膛砲 + 戰利品主動防護', sfx: 'heavy_cannon', img: 'assets/units/MK4.jpg' },
  K2: { flag: '🇰🇷', origin: '南韓', weapon: '120mm 55倍徑穿甲彈 / KSTAM 頂攻彈', sfx: 'heavy_cannon', img: 'assets/units/K2.jpg' },
  CH3: { flag: '🇬🇧', origin: '英國', weapon: '120mm L55A1 高膛壓長桿穿甲彈', sfx: 'heavy_cannon', img: 'assets/units/CH3.jpg' },
  LEC: { flag: '🇫🇷', origin: '法國', weapon: '120mm 52倍徑自動裝填極速穿甲滑膛砲', sfx: 'heavy_cannon', img: 'assets/units/LEC.jpg' },
  T99A: { flag: '🇨🇳', origin: '中國', weapon: '125mm 滑膛砲 + 雙防反應裝甲 + 雷射壓制', sfx: 'heavy_cannon', img: 'assets/units/T99A.jpg' },
  T90: { flag: '🇷🇺', origin: '俄羅斯', weapon: '125mm 3BM60 鉛-2 尾翼脫殼穿甲彈', sfx: 'heavy_cannon', img: 'assets/units/T90.jpg' },
  T10: { flag: '🇯🇵', origin: '日本', weapon: '120mm 新型鎢合金高速穿甲彈', sfx: 'heavy_cannon', img: 'assets/units/T10.jpg' },
  M1A1: { flag: '🇺🇸', origin: '美國/烏克蘭', weapon: '120mm M829 穿甲彈 + 貧鈾裝甲', sfx: 'heavy_cannon', img: 'assets/units/M1A1.jpg' },
  LEO2A4: { flag: '🇩🇪', origin: '德國/北約', weapon: '120mm L44 滑膛砲高速穿甲彈', sfx: 'heavy_cannon', img: 'assets/units/LEO2A4.jpg' },
  T72: { flag: '🇷🇺', origin: '俄羅斯', weapon: '125mm 2A46M 滑膛砲高速穿甲彈', sfx: 'heavy_cannon', img: 'assets/units/T72.jpg' },
  STRY: { flag: '🇺🇸', origin: '美國/台灣', weapon: '30mm Mk44 鏈砲 / 拖式二型反戰車飛彈', sfx: 'cannon', img: 'assets/units/STRY.jpg' },
  BOXER: { flag: '🇩🇪', origin: '德國/澳洲', weapon: '30mm 機砲 + 長釘-LR 反戰車導彈', sfx: 'cannon', img: 'assets/units/BOXER.jpg' },
  CM34: { flag: '🇹🇼', origin: '台灣', weapon: '30mm Mk44 鏈砲 + 煙幕干擾發射器', sfx: 'cannon', img: 'assets/units/CM34.jpg' },
  TOYO: { flag: '🌍', origin: '武裝改裝', weapon: '12.7mm DShK 重機槍 / 短號反裝甲飛彈', sfx: 'cannon', img: 'assets/units/TOYO.jpg' },
  T55: { flag: '🇷🇺', origin: '俄羅斯/東歐', weapon: '100mm D-10T 線膛砲穿甲彈', sfx: 'heavy_cannon', img: 'assets/units/T55.jpg' },
  M113T: { flag: '🇺🇸', origin: '美國', weapon: 'BGM-71 拖式重型破甲反戰車飛彈', sfx: 'cannon', img: 'assets/units/M113T.jpg' },
  HMMWV: { flag: '🇺🇸', origin: '美國', weapon: '拖式反甲飛彈發射座 + .50 機槍', sfx: 'cannon', img: 'assets/units/HMMWV.jpg' },

  // 防空
  PAC3: { flag: '🇺🇸', origin: '美國', weapon: 'PAC-3 MSE 動能撞擊防空反導飛彈', sfx: 'missile', img: 'assets/units/PAC3.jpg' },
  S500: { flag: '🇷🇺', origin: '俄羅斯', weapon: '77N6-N 極音速太空邊緣攔截導彈', sfx: 'missile', img: 'assets/units/S500.jpg' },
  S400: { flag: '🇷🇺', origin: '俄羅斯', weapon: '40N6E 超遠程高超音速防空飛彈', sfx: 'missile', img: 'assets/units/S400.jpg' },
  DAVID: { flag: '🇮🇱', origin: '以色列', weapon: '眩暈 (Stunner) 雙模尋標防空反導彈', sfx: 'missile', img: 'assets/units/DAVID.jpg' },
  SAMPT: { flag: '🇫🇷', origin: '法國/意大利', weapon: 'Aster 30 (紫菀30) 垂直發射反導飛彈', sfx: 'missile', img: 'assets/units/SAMPT.jpg' },
  IRON: { flag: '🇮🇱', origin: '以色列', weapon: '塔米爾 (Tamir) 飽和攔截防空飛彈', sfx: 'missile', img: 'assets/units/IRON.jpg' },
  TK3: { flag: '🇹🇼', origin: '台灣', weapon: '天弓三型垂直發射長程防空反導飛彈', sfx: 'missile', img: 'assets/units/TK3.jpg' },
  HQ9L: { flag: '🇨🇳', origin: '中國', weapon: '紅旗-9B 垂直冷發射重型防空導彈', sfx: 'missile', img: 'assets/units/HQ9.jpg' },
  NASAMS: { flag: '🇳🇴', origin: '挪威/美國', weapon: 'AMRAAM-ER 增程地對空防空飛彈', sfx: 'missile', img: 'assets/units/NASAMS.jpg' },
  IRIST: { flag: '🇩🇪', origin: '德國', weapon: 'IRIS-T 紅外成像高機動短中程防空彈', sfx: 'missile', img: 'assets/units/IRIST.jpg' },
  BUKM3: { flag: '🇷🇺', origin: '俄羅斯', weapon: '9M317M 垂直高密接戰野戰防空彈', sfx: 'missile', img: 'assets/units/BUKM3.jpg' },
  HQ16: { flag: '🇨🇳', origin: '中國', weapon: '紅旗-16FE 中程垂直發射快反防空彈', sfx: 'missile', img: 'assets/units/HQ16.jpg' },
  PANT: { flag: '🇷🇺', origin: '俄羅斯', weapon: '30mm 雙聯雙管機砲 + 57E6 攔截彈', sfx: 'flak', img: 'assets/units/PANT.jpg' },
  GEPARD: { flag: '🇩🇪', origin: '德國', weapon: '雙聯 35mm 歐瑞康 AHEAD 空爆快砲', sfx: 'flak', img: 'assets/units/GEPARD.jpg' },
  AVNG: { flag: '🇺🇸', origin: '美國', weapon: '刺針 FIM-92 便攜防空飛彈發射艙', sfx: 'missile', img: 'assets/units/AVNG.jpg' },
  TC2: { flag: '🇹🇼', origin: '台灣', weapon: '天劍二型陸射主動雷達導引防空飛彈', sfx: 'missile', img: 'assets/units/TC2.jpg' },
  STING: { flag: '🇺🇸', origin: '美國', weapon: 'FIM-92J 便攜紅外線單兵防空飛彈', sfx: 'missile', img: 'assets/units/STING.jpg' },
  IGLA: { flag: '🇷🇺', origin: '俄羅斯', weapon: '9K38 針式單兵肩射防空飛彈', sfx: 'missile', img: 'assets/units/IGLA.jpg' },
  STAR: { flag: '🇬🇧', origin: '英國', weapon: '星光 (Starstreak) 3馬赫高速飛鏢破甲彈', sfx: 'missile', img: 'assets/units/STAR.jpg' },
  OERL: { flag: '🇨🇭', origin: '瑞士', weapon: '雙聯 35mm 機械相聯固定防空快砲', sfx: 'flak', img: 'assets/units/OERL.jpg' },

  // 海軍
  DDG51: { flag: '🇺🇸', origin: '美國', weapon: 'Mk 41 垂直發射系統 / SM-6 標準六型', sfx: 'missile', img: 'assets/units/DDG51.jpg' },
  T055: { flag: '🇨🇳', origin: '中國', weapon: '112單元通用垂發 / 鷹擊-21 高超音速反艦飛彈', sfx: 'missile', img: 'assets/units/T055.jpg' },
  KDX3: { flag: '🇰🇷', origin: '南韓', weapon: '128單元神盾垂發 / 海星反艦 / 玄武巡弋彈', sfx: 'missile', img: 'assets/units/KDX3.jpg' },
  TYPE45: { flag: '🇬🇧', origin: '英國', weapon: '桑普森相控陣 / 紫菀15/30 區域防空網', sfx: 'missile', img: 'assets/units/TYPE45.jpg' },
  VA: { flag: '🇺🇸', origin: '美國', weapon: 'Mk 48 Mod 7 重型線導魚雷 / 戰斧巡弋飛彈', sfx: 'torpedo', img: 'assets/units/VA.jpg' },
  FREMM: { flag: '🇫🇷', origin: '法國/意大利', weapon: 'MU90 輕型反潛魚雷 / 飛魚反艦飛彈', sfx: 'torpedo', img: 'assets/units/FREMM.jpg' },
  MOGAMI: { flag: '🇯🇵', origin: '日本', weapon: '17式反艦飛彈 / 07式反潛火箭 / 匿蹤艦體', sfx: 'missile', img: 'assets/units/MOGAMI.jpg' },
  YASEN: { flag: '🇷🇺', origin: '俄羅斯', weapon: '口徑巡弋飛彈 / 鋯石極音速反艦導彈', sfx: 'torpedo', img: 'assets/units/YASEN.jpg' },
  KILO: { flag: '🇷🇺', origin: '俄羅斯', weapon: '53-65K 重型熱動力反艦尾流歸向魚雷', sfx: 'torpedo', img: 'assets/units/KILO.jpg' },
  SORYU: { flag: '🇯🇵', origin: '日本', weapon: '89式重型魚雷 / 魚叉潛射反艦飛彈', sfx: 'torpedo', img: 'assets/units/SORYU.jpg' },
  U212: { flag: '🇩🇪', origin: '德國', weapon: 'DM2A4 海梭四型光纖導引重型魚雷', sfx: 'torpedo', img: 'assets/units/U212.jpg' },
  KD: { flag: '🇹🇼', origin: '台灣/法國', weapon: '華陽垂直發射海劍二 + 雄三超音速反艦彈', sfx: 'missile', img: 'assets/units/KD.jpg' },
  TJ: { flag: '🇹🇼', origin: '台灣', weapon: '雄風二型 / 雄風三型超音速反艦飛彈齊射', sfx: 'missile', img: 'assets/units/TJ.jpg' },
  T22: { flag: '🇨🇳', origin: '中國', weapon: '鷹擊-83J 亞音速掠海反艦飛彈狼群突擊', sfx: 'missile', img: 'assets/units/T22.jpg' },
  GOWIND: { flag: '🇫🇷', origin: '法國', weapon: '飛魚 MM40 Block 3 反艦導彈 + 雲母艦空', sfx: 'missile', img: 'assets/units/GOWIND.jpg' },
  SAAR6: { flag: '🇮🇱', origin: '以色列', weapon: 'Barak-8 防空 + C-Dome 艦載鐵穹 + 魚叉', sfx: 'missile', img: 'assets/units/SAAR6.jpg' },
  USV: { flag: '🇺🇦', origin: '烏克蘭', weapon: 'MAGURA V5 自殺無人遙控快艇高爆炸藥', sfx: 'swarm', img: 'assets/units/USV.jpg' },
  PB: { flag: '🇺🇸', origin: '美國', weapon: '40mm Mk 19 自動榴彈機槍 / 重機槍', sfx: 'cannon', img: 'assets/units/PB.jpg' },
  HF3: { flag: '🇹🇼', origin: '台灣', weapon: '雄風三型岸基機動超音速反艦飛彈車組', sfx: 'missile', img: 'assets/units/HF3.jpg' },
  SBS: { flag: '🇬🇧', origin: '英國', weapon: '特種部隊微型潛航器 + 磁性水雷爆破', sfx: 'torpedo', img: 'assets/units/SBS.jpg' },

  // 支援
  E7: { flag: '🇦🇺', origin: '澳洲/美國', weapon: 'MESA 主動電子掃描陣列預警指管雷達', sfx: 'emp_pulse', img: 'assets/units/E7.jpg' },
  B21: { flag: '🇺🇸', origin: '美國', weapon: 'AGM-158 JASSM-ER 遠程匿蹤巡弋飛彈', sfx: 'missile', img: 'assets/units/B21.jpg' },
  KJ500: { flag: '🇨🇳', origin: '中國', weapon: '三面相控陣全向電戰預警指管雷達', sfx: 'emp_pulse', img: 'assets/units/KJ500.jpg' },
  RQ4: { flag: '🇺🇸', origin: '美國', weapon: '高空合成孔徑雷達 + 全頻信號情報系統', sfx: 'emp_pulse', img: 'assets/units/RQ4.jpg' },
  HIMARS: { flag: '🇺🇸', origin: '美國/烏克蘭', weapon: 'M31 GMLRS 衛星精準導引火箭齊射', sfx: 'rocket_salvo', img: 'assets/units/HIMARS.jpg' },
  EA18: { flag: '🇺🇸', origin: '美國', weapon: 'ALQ-99 / ALQ-249 全頻譜電子干擾莢艙', sfx: 'emp_pulse', img: 'assets/units/EA18.jpg' },
  ATACMS: { flag: '🇺🇸', origin: '美國', weapon: 'MGM-140 戰術飛彈 300km 縱深精準貫穿', sfx: 'rocket_salvo', img: 'assets/units/ATACMS.jpg' },
  STORM: { flag: '🇬🇧', origin: '英國/法國', weapon: '風暴暗影 BROACH 串聯深穿地堡彈頭', sfx: 'missile', img: 'assets/units/STORM.jpg' },
  PZH: { flag: '🇩🇪', origin: '德國', weapon: '155mm L52 自走砲精準增程砲彈', sfx: 'heavy_cannon', img: 'assets/units/PZH.jpg' },
  SMERCH: { flag: '🇷🇺', origin: '俄羅斯', weapon: '300mm 龍捲風多管重型火箭飽和齊射', sfx: 'rocket_salvo', img: 'assets/units/SMERCH.jpg' },
  CAESAR: { flag: '🇫🇷', origin: '法國', weapon: '155mm 52倍徑卡車砲快打快撤增程彈', sfx: 'heavy_cannon', img: 'assets/units/CAESAR.jpg' },
  ARCHER: { flag: '🇸🇪', origin: '瑞典', weapon: '155mm 弓箭手全自動遙控火控齊射系統', sfx: 'heavy_cannon', img: 'assets/units/ARCHER.jpg' },
  MQ9: { flag: '🇺🇸', origin: '美國', weapon: 'AGM-114 地獄火反裝甲飛彈 / 雙光感測', sfx: 'missile', img: 'assets/units/MQ9.jpg' },
  TB2: { flag: '🇹🇷', origin: '土耳其/烏克蘭', weapon: 'MAM-L 激光制導微型反戰車彈藥', sfx: 'missile', img: 'assets/units/TB2.jpg' },
  SW600: { flag: '🇺🇸', origin: '美國', weapon: '彈簧刀 600 標槍穿甲巡飛自爆彈', sfx: 'swarm', img: 'assets/units/SW600.jpg' },
  ORION: { flag: '🇷🇺', origin: '俄羅斯', weapon: 'Kornet 激光制導重型反戰車飛彈', sfx: 'missile', img: 'assets/units/ORION.jpg' },
  FPV: { flag: '🇺🇦', origin: '烏克蘭', weapon: 'PG-7VR 串聯破甲火箭彈頭第一視角自爆', sfx: 'swarm', img: 'assets/units/FPV.jpg' },
  SPOT: { flag: '🌐', origin: '商用改裝', weapon: '高解析度多光譜即時熱成像校射引導', sfx: 'emp_pulse', img: 'assets/units/SPOT.jpg' },
  SW300: { flag: '🇺🇸', origin: '美國', weapon: '彈簧刀 300 背負式反雷達天線巡飛彈', sfx: 'swarm', img: 'assets/units/SW300.jpg' },
  MORTAR: { flag: '🌍', origin: '步兵部隊', weapon: '120mm 輕型迫擊砲煙幕與密集高爆彈', sfx: 'heavy_cannon', img: 'assets/units/MORTAR.jpg' }
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
