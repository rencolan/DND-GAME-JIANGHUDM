import type {
  Character,
  GameState,
  Item,
  LocationNode,
  MartialArt,
  Npc,
  ObjectiveHint,
  OriginTemplate,
  SceneType
} from "./types";

const rasterPortraitIds = new Set([
  "a-zhu",
  "a-zi",
  "duan-yu",
  "mu-wanqing",
  "murong-fu",
  "qiao-feng",
  "shuang-er",
  "wang-yuyan",
  "xu-zhu"
]);

const portrait = (id: string) => rasterPortraitIds.has(id)
  ? `./assets/portraits/${id}${id === "shuang-er" ? "-v2" : ""}.png`
  : `./assets/portraits/${id}.svg`;

const item = (id: string, name: string, desc: string, count = 1, extra: Partial<Item> = {}): Item => ({
  id,
  name,
  desc,
  count,
  ...extra,
  type: extra.type || "quest"
});

const art = (
  id: string,
  name: string,
  category: MartialArt["category"],
  linkedAbility: string,
  damageDice: string,
  _summary: string,
  baseQiCost: number,
  extra: Partial<MartialArt> = {}
): MartialArt => ({
  id,
  name,
  grade: "入门",
  category,
  linkedAbility,
  damageDice,
  baseQiCost,
  source: "开局所学",
  ...extra
});

const defaultInventory = () => ([
  item("medicine", "金疮药", "恢复 8 点生命。", 2, { type: "consumable", usable: true, hpRestore: 8 }),
  item("qi-pill", "行气散", "恢复 2 点内力。", 1, { type: "consumable", usable: true, qiRestore: 2 })
]);

const makeCharacter = (
  id: string,
  name: string,
  title: string,
  focus: [number, number, number, number, number, number],
  qi: number,
  martialArts: MartialArt[],
  extra: Partial<Character> = {}
): Character => ({
  id,
  name,
  title,
  portrait: portrait(id),
  hp: 20 + Math.max(0, focus[2] - 8) * 2,
  maxHp: 20 + Math.max(0, focus[2] - 8) * 2,
  qi,
  maxQi: qi,
  ac: 10 + Math.floor((focus[1] - 10) / 2),
  abilities: [
    { key: "str", label: "力道", value: focus[0] },
    { key: "dex", label: "身法", value: focus[1] },
    { key: "con", label: "根骨", value: focus[2] },
    { key: "int", label: "悟性", value: focus[3] },
    { key: "cha", label: "气运", value: focus[4] },
    { key: "wis", label: "心境", value: focus[5] }
  ],
  martialArts,
  inventory: defaultInventory(),
  ...extra
});

export const defaultMartialArts = {
  dali: [
    art("yiyang-zhi", "一阳指", "internal", "int", "1d8", "凝气一点，隔空伤敌。", 1, { grade: "家传", source: "大理段氏" }),
    art("dali-xinfa", "大理心法", "internal", "wis", "1d4", "以内息调匀经脉，适合稳守回气。", 1, { grade: "家传", source: "大理段氏" }),
    art("duanjia-jianfa", "段家剑法", "external", "dex", "1d6", "剑路规整轻灵，讲究快进快收。", 0, { grade: "入门", source: "大理段氏" }),
    art("wuluo-qingyan-zhang", "五罗轻烟掌", "external", "dex", "1d6", "掌影轻快，适合贴身连出。", 0, { grade: "熟练", source: "大理段氏" })
  ],
  jianghu: [
    art("jianghu-daolu", "江湖刀路", "external", "str", "1d6", "刀法直接，适合抢身位与逼退对手。", 0, { grade: "粗豪", source: "江湖旧路" }),
    art("xiangwei-qinggong", "巷尾轻功", "external", "dex", "1d4", "借步换位，偏重闪身与缠斗。", 0, { grade: "入门", source: "江湖旧路" })
  ],
  shaolin: [
    art("shaolin-changquan", "少林长拳", "external", "str", "1d4", "拳架平正，适合稳步压近。", 0, { grade: "正宗", source: "少林" }),
    art("shaolin-neigong", "少林内功", "internal", "wis", "1d6", "调息护体，适合以内劲硬接。", 1, { grade: "正宗", source: "少林" }),
    art("luohan-quan", "罗汉拳", "external", "str", "1d6", "拳势沉稳厚实，适合正面交手。", 0, { grade: "入门", source: "少林" }),
    art("weituo-chu", "韦陀杵", "external", "str", "1d8", "劲力直贯，讲究一击压人。", 0, { grade: "熟练", source: "少林" })
  ],
  wuliang: [
    art("wuliang-jianfa", "无量剑法", "external", "dex", "1d6", "剑法轻快多变，擅长早期试锋。", 0, { grade: "入门", source: "无量剑派" }),
    art("zhuifeng-jianlu", "追风剑路", "external", "dex", "1d8", "剑路紧追不放，连刺连封。", 0, { grade: "熟练", source: "无量剑派" })
  ],
  beggar: [
    art("taizu-changquan", "太祖长拳", "external", "str", "1d6", "拳法朴实狠辣，讲究一招一式都能打人。", 0, { grade: "入门", source: "丐帮旧传" }),
    art("lianhua-zhang", "莲花掌", "external", "str", "1d8", "掌势连绵，出手稳而不断。", 0, { grade: "熟练", source: "丐帮旧传" }),
    art("dagou-bangfa", "打狗棒法", "external", "str", "2d6", "棒影起落，专打正面空隙。", 0, { grade: "中高阶", source: "丐帮绝传" }),
    art("xianglong-shibazhang", "降龙十八掌", "external", "str", "2d8", "掌力雄浑刚猛，讲究正面压垮对手。", 1, { grade: "绝学", source: "乔峰所传" })
  ],
  gusu: [
    art("murong-jianfa", "慕容剑法", "external", "dex", "1d8", "剑势秀雅细密，步步紧跟。", 0, { grade: "熟练", source: "姑苏慕容" }),
    art("canhe-zhi", "参合指", "internal", "int", "1d8", "指劲聚于一点，阴柔中带狠厉。", 1, { grade: "上乘前置", source: "姑苏慕容" })
  ],
  xingxiu: [
    art("xingxiu-duzhang", "星宿毒掌", "internal", "con", "1d8", "掌风夹杂邪气，贴身最是阴损。", 1, { grade: "熟练", source: "星宿派" }),
    art("sanyin-wugong-zhua", "三阴蜈蚣爪", "external", "dex", "1d8", "爪法刁钻歹毒，专取近身要害。", 0, { grade: "熟练", source: "星宿派" })
  ],
  xiaoyao: [
    art("xiaoyao-zhang", "逍遥掌", "internal", "wis", "1d8", "掌力绵里藏针，看似轻缓却能透劲。", 1, { grade: "熟练", source: "逍遥派" }),
    art("beiming-shengong", "北冥神功", "internal", "wis", "2d6", "真气回旋流转，出手后仍余势不断。", 2, { grade: "高阶", source: "逍遥派" }),
    art("lingbo-weibu", "凌波微步", "external", "dex", "1d8", "步法飘忽，出手如在空隙间穿行。", 1, { grade: "高阶", source: "逍遥派" }),
    art("tianshan-liuyang-zhang", "天山六阳掌", "internal", "wis", "2d6", "掌力堂皇正大，层层递进。", 2, { grade: "高阶", source: "逍遥派" }),
    art("tianshan-zhemei-shou", "天山折梅手", "external", "dex", "2d6", "近身连变，以巧劲破门而入。", 1, { grade: "高阶", source: "逍遥派" }),
    art("shengsi-fu", "生死符", "internal", "wis", "2d6", "寒劲灌入经脉，出手便要叫人变色。", 2, { grade: "高阶", source: "逍遥派" }),
    art("xiaowuxiang-gong", "小无相功", "internal", "wis", "2d6", "劲力无声无相，运转时最显深厚。", 2, { grade: "绝学", source: "逍遥派" })
  ],
  villains: [
    art("ezui-jian", "鳄嘴剪", "external", "str", "1d10", "怪兵一合而下，狠劲十足。", 0, { grade: "上乘前置", source: "四大恶人" }),
    art("ewei-hengsao", "鳄尾横扫", "external", "str", "1d8", "横扫硬砸，最适合压身抢位。", 0, { grade: "熟练", source: "四大恶人" }),
    art("heshe-bada", "鹤蛇八打", "external", "dex", "1d8", "招式细碎凌厉，连击极快。", 0, { grade: "上乘前置", source: "四大恶人" }),
    art("hezhua-qinna", "鹤爪擒拿", "external", "dex", "1d10", "手法阴毒迅急，专拿关节与咽喉。", 0, { grade: "上乘前置", source: "四大恶人" })
  ],
  enemy: [
    art("enemy-dagger", "黑衣短刺", "external", "dex", "1d6", "贴身抢攻，专取空门。", 0, { grade: "敌招", source: "黑衣刺客" }),
    art("enemy-cuijin", "催劲突袭", "internal", "dex", "1d8", "催动内劲猛扑，凶狠而冒进。", 1, { grade: "敌招", source: "黑衣刺客" })
  ],
  bosses: [
    art("ding-huagong", "化功大法", "internal", "int", "2d8", "掌风阴柔狠毒，专破内息与经脉。", 2, { grade: "宗师", source: "丁春秋" }),
    art("ding-sanxiao", "三笑逍遥散", "internal", "int", "2d6", "毒雾先行，逼人乱神失位。", 1, { grade: "邪门", source: "丁春秋" }),
    art("ding-zhaixing", "摘星手", "external", "dex", "1d10", "忽探忽拿，专取兵刃与咽喉。", 0, { grade: "狠招", source: "丁春秋" }),
    art("you-bingcan", "冰蚕毒掌", "internal", "con", "2d8", "寒毒逼体，掌劲带着黏滞阴寒。", 2, { grade: "异门", source: "游坦之" }),
    art("you-tietou", "铁头硬撞", "external", "str", "1d10", "蛮横冲阵，靠一口狠劲硬撞开门户。", 0, { grade: "凶招", source: "游坦之" }),
    art("you-shengsi", "生死符反劲", "internal", "wis", "2d6", "内劲乱窜时反扑而出，寒意缠身。", 1, { grade: "旁门", source: "游坦之" }),
    art("jiu-huoyandao", "火焰刀", "internal", "int", "3d8", "无形刀气横空劈落，炽烈霸道。", 3, { grade: "绝学", source: "鸠摩智" }),
    art("jiu-longzhao", "龙爪擒拿", "external", "str", "2d8", "擒、锁、拧一气呵成，逼人近身崩盘。", 0, { grade: "上乘", source: "鸠摩智" })
  ],
  legends: [
    art("liumai-shenjian", "六脉神剑", "internal", "int", "4d8", "以内力化作剑气，一线穿空。", 3, { grade: "绝学", source: "剧情习得" })
  ]
} as const;

export const martialArtCatalog: MartialArt[] = Object.values(defaultMartialArts).flatMap((entries) => [...entries]);

export const enemyPresets = [
  {
    id: "black-assassin",
    name: "黑衣刺客",
    hp: 24,
    maxHp: 24,
    qi: 3,
    maxQi: 3,
    ac: 12,
    abilities: { str: 12, dex: 13, con: 11, int: 10, cha: 9, wis: 11 },
    martialArts: [...defaultMartialArts.enemy],
    tags: ["前期试探", "快攻"]
  },
  {
    id: "zuo-zimu",
    name: "左子穆",
    hp: 30,
    maxHp: 30,
    qi: 4,
    maxQi: 4,
    ac: 13,
    abilities: { str: 11, dex: 14, con: 12, int: 11, cha: 10, wis: 11 },
    martialArts: defaultMartialArts.wuliang.filter((entry) => ["wuliang-jianfa", "zhuifeng-jianlu"].includes(entry.id)),
    tags: ["前期剑客", "无量剑派", "试锋"]
  },
  {
    id: "yue-laosan",
    name: "岳老三",
    hp: 36,
    maxHp: 36,
    qi: 4,
    maxQi: 4,
    ac: 13,
    abilities: { str: 16, dex: 11, con: 14, int: 8, cha: 9, wis: 10 },
    martialArts: defaultMartialArts.villains.filter((entry) => ["ezui-jian", "ewei-hengsao"].includes(entry.id)),
    tags: ["粗暴压制", "四大恶人", "重击"]
  },
  {
    id: "yun-zhonghe",
    name: "云中鹤",
    hp: 40,
    maxHp: 40,
    qi: 5,
    maxQi: 5,
    ac: 14,
    abilities: { str: 11, dex: 16, con: 13, int: 10, cha: 11, wis: 10 },
    martialArts: defaultMartialArts.villains.filter((entry) => ["heshe-bada", "hezhua-qinna"].includes(entry.id)),
    tags: ["高机动刺杀", "四大恶人", "诡快"]
  },
  {
    id: "ding-chunqiu",
    name: "丁春秋",
    hp: 52,
    maxHp: 52,
    qi: 12,
    maxQi: 12,
    ac: 15,
    abilities: { str: 12, dex: 14, con: 14, int: 18, cha: 13, wis: 16 },
    martialArts: defaultMartialArts.bosses.filter((entry) => ["ding-huagong", "ding-sanxiao", "ding-zhaixing"].includes(entry.id)),
    tags: ["邪门宗师", "毒功", "控场"]
  },
  {
    id: "you-tanzhi",
    name: "游坦之",
    hp: 48,
    maxHp: 48,
    qi: 10,
    maxQi: 10,
    ac: 14,
    abilities: { str: 15, dex: 12, con: 16, int: 9, cha: 8, wis: 11 },
    martialArts: defaultMartialArts.bosses.filter((entry) => ["you-bingcan", "you-tietou", "you-shengsi"].includes(entry.id)),
    tags: ["寒毒莽攻", "重压", "缠斗"]
  },
  {
    id: "jiu-mozhi",
    name: "鸠摩智",
    hp: 62,
    maxHp: 62,
    qi: 18,
    maxQi: 18,
    ac: 16,
    abilities: { str: 14, dex: 15, con: 15, int: 17, cha: 14, wis: 18 },
    martialArts: [...defaultMartialArts.bosses.filter((entry) => ["jiu-huoyandao", "jiu-longzhao"].includes(entry.id)), defaultMartialArts.xiaoyao.find((entry) => entry.id === "xiaowuxiang-gong")!],
    tags: ["终局宗师", "高内力", "爆发"]
  }
] as const;

export const originTemplates: OriginTemplate[] = [
  {
    id: "nameless-wanderer",
    name: "无名客",
    desc: "无门无派，先在大理客栈落脚，再被无量山风波一步步卷进江湖大局。",
    qiStart: 2,
    intro: "大理城里人声未歇，无量山那边的风波却已经吹到了客栈门口。你只是个暂时落脚的无名客，本想歇一夜再走，可掌柜、双儿和往来旅人都像在等一场将至的麻烦。",
    setupHint: "起手身份中性，先从客栈、人情和无量山线索入局。",
    firstQuest: {
      title: "客栈歇脚",
      text: "先在大理客栈站稳脚跟，看看掌柜、双儿和无量山的风声到底牵着哪条线。",
      location: "大理城",
      npc: "双儿"
    },
    martialArts: [...defaultMartialArts.jianghu]
  }
];

export const routeGuides: Record<string, { sceneType: SceneType; objective: ObjectiveHint; intro: string }> = {
  "nameless-wanderer": {
    sceneType: "inn",
    objective: { title: "入局引导", text: "先在客栈落脚，看看掌柜、双儿和无量山的风声。", location: "大理城" },
    intro: originTemplates[0].intro
  }
};

export const roster: Character[] = [
  makeCharacter(
    "placeholder-dali",
    "无名少侠",
    "无名客，初入江湖",
    [10, 10, 10, 10, 10, 10],
    2,
    originTemplates[0].martialArts,
    { originId: originTemplates[0].id, isCustom: true }
  )
];

export const locations: LocationNode[] = [
  { id: "dali", name: "大理城", x: 18, y: 68, unlocked: true, current: true, desc: "苍山洱海之间，坊市里总比官道先传出消息。" },
  { id: "wuliang", name: "无量山", x: 34, y: 76, unlocked: true, desc: "山路深曲，草木与脚印都擅长藏话。" },
  { id: "gusu", name: "姑苏", x: 66, y: 60, unlocked: false, desc: "水路纵横，消息与人心一样绕。" },
  { id: "shaoshi", name: "少室山", x: 58, y: 30, unlocked: false, desc: "钟声入云，山门下的人未必都是香客。" },
  { id: "yanmen", name: "雁门关", x: 78, y: 20, unlocked: false, desc: "风沙极硬，旧案与血债都埋在关外。" },
  { id: "xingxiu", name: "星宿海", x: 15, y: 24, unlocked: false, desc: "毒雾与怪笑同起，远行者少有归人。" }
];

export const npcs: Npc[] = [
  { id: "duan-yu", name: "段誉", title: "大理世子", portrait: portrait("duan-yu"), location: "无量山", goal: "误入山中乱局，还想护着身边的人", attitude: "温雅", relationship: 48, lastSeen: "无量山山道", status: "未现身", tags: ["大理", "世族"], companion: false, hidden: true, discovered: false },
  { id: "qiao-feng", name: "乔峰", title: "丐帮帮主", portrait: portrait("qiao-feng"), location: "雁门关", goal: "追查边关旧案", attitude: "敬重", relationship: 58, lastSeen: "北地酒肆", status: "远行", tags: ["丐帮", "豪侠"], companion: false },
  { id: "murong-fu", name: "慕容复", title: "姑苏公子", portrait: portrait("murong-fu"), location: "姑苏", goal: "寻找英雄帖背后的势力", attitude: "试探", relationship: 38, lastSeen: "燕子坞水榭", status: "观望", tags: ["姑苏", "世家"], companion: false },
  { id: "xu-zhu", name: "虚竹", title: "少林弟子", portrait: portrait("xu-zhu"), location: "少室山", goal: "护送寺中密函", attitude: "和善", relationship: 50, lastSeen: "寺外石阶", status: "未会合", tags: ["少林"], companion: false },
  { id: "wang-yuyan", name: "王语嫣", title: "琅嬛书影", portrait: portrait("wang-yuyan"), location: "姑苏", goal: "辨认银针上的武学门路", attitude: "谨慎", relationship: 46, lastSeen: "藏书楼", status: "可请教", tags: ["武学"], companion: false },
  { id: "a-zhu", name: "阿朱", title: "易容巧手", portrait: portrait("a-zhu"), location: "大理城", goal: "打探黑衣人的真实身份", attitude: "亲近", relationship: 62, lastSeen: "城南茶肆", status: "暗访", tags: ["潜入"], companion: false },
  { id: "a-zi", name: "阿紫", title: "星宿门下", portrait: portrait("a-zi"), location: "星宿海", goal: "盯住值得利用的人与物", attitude: "乖张", relationship: 24, lastSeen: "毒雾边市", status: "行踪不定", tags: ["星宿", "毒"], companion: false, hidden: true, discovered: false },
  { id: "mu-wanqing", name: "木婉清", title: "黑衣箭影", portrait: portrait("mu-wanqing"), location: "无量山", goal: "挟着段誉突围，不让追兵靠近半步", attitude: "冷硬", relationship: 60, lastSeen: "无量山山道", status: "未现身", tags: ["追踪"], companion: false, hidden: true, discovered: false },
  { id: "shuang-er", name: "双儿", title: "客栈丫鬟", portrait: portrait("shuang-er"), location: "大理城", goal: "照看伤者，替掌柜留心往来人的动静", attitude: "温柔", relationship: 58, lastSeen: "客栈后院", status: "在客栈帮忙", tags: ["客栈", "疗伤", "细心"], companion: false, hidden: true, discovered: false, recruitable: false }
];

export const initialGameState: GameState = {
  setupComplete: false,
  originId: "nameless-wanderer",
  creationMode: "origin",
  chapter: "第一卷：无量山风波",
  chapterState: {
    id: "nameless-wanderer-ch1",
    stage: "intro"
  },
  storyFlags: [],
  worldDay: 1,
  timeSlot: "黄昏",
  actionCount: 0,
  currentCharacterId: roster[0].id,
  character: roster[0],
  roster,
  npcs,
  npcStoryState: {
    "duan-yu": "hidden",
    "qiao-feng": "rumored",
    "murong-fu": "rumored",
    "xu-zhu": "hidden",
    "wang-yuyan": "rumored",
    "a-zhu": "hidden",
    "a-zi": "hidden",
    "mu-wanqing": "hidden",
    "shuang-er": "hidden"
  },
  locations,
  locationUnlocks: {
    dali: "initial",
    wuliang: "initial"
  },
  quests: [],
  questStateMap: {},
  rumors: [],
  relationshipRoutes: {
    "duan-yu": {
      npcId: "duan-yu",
      kind: "bond",
      active: false,
      stage: "unawakened",
      supportUnlocked: []
    },
    "mu-wanqing": {
      npcId: "mu-wanqing",
      kind: "bond",
      active: false,
      stage: "unawakened",
      supportUnlocked: []
    },
    "wang-yuyan": {
      npcId: "wang-yuyan",
      kind: "romance",
      active: false,
      stage: "unawakened",
      supportUnlocked: []
    },
    "a-zhu": {
      npcId: "a-zhu",
      kind: "romance",
      active: false,
      stage: "unawakened",
      supportUnlocked: []
    },
    "mu-wanqing-romance": {
      npcId: "mu-wanqing",
      kind: "romance",
      active: false,
      stage: "unawakened",
      supportUnlocked: []
    },
    "shuang-er": {
      npcId: "shuang-er",
      kind: "retainer",
      active: false,
      stage: "unawakened",
      allowCompanion: false,
      supportUnlocked: []
    }
  },
  messages: [
    {
      id: "m0",
      role: "dm",
      text: "【说书人】大理城里人声未歇，无量山那边的风波却已经吹到了客栈门口。你先歇脚，先看人，再决定自己要不要踩进这摊麻烦。"
    }
  ],
  combat: { active: false },
  systemLog: ["系统：首轮行动后才会正式派发第一条任务。"],
  sceneType: "inn",
  objective: { title: "入局引导", text: "先在客栈落脚，看看掌柜、双儿和无量山的风声。", location: "大理城" }
};
