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
  ...extra
});

const art = (
  id: string,
  name: string,
  category: MartialArt["category"],
  linkedAbility: string,
  damageDice: string,
  effect: string,
  baseQiCost: number,
  extra: Partial<MartialArt> = {}
): MartialArt => ({
  id,
  name,
  grade: "入门",
  category,
  linkedAbility,
  effect,
  damageDice,
  baseQiCost,
  risk: category === "internal" ? "内力不足时难以稳定施展。" : "硬接强敌时容易露出破绽。",
  source: "开局所学",
  ...extra
});

const makeCharacter = (
  id: string,
  name: string,
  title: string,
  focus: [number, number, number, number, number, number],
  qi: number,
  equipmentNames: [string, string, string],
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
  equipment: {
    weapon: item(`${id}-weapon`, equipmentNames[0], "随身兵刃。", 1, { type: "weapon", equipable: true }),
    armor: item(`${id}-armor`, equipmentNames[1], "随身护具。", 1, { type: "armor", equipable: true }),
    accessory: item(`${id}-acc`, equipmentNames[2], "带着来历与故事的随身物。", 1, { type: "accessory", equipable: true })
  },
  inventory: [
    item("medicine", "金疮药", "恢复 8 点生命。", 2, { type: "consumable", usable: true, hpRestore: 8 }),
    item("qi-pill", "行气散", "恢复 2 点内力。", 1, { type: "consumable", usable: true, qiRestore: 2 })
  ],
  ...extra
});

export const defaultMartialArts = {
  dali: [
    art("yiyang-zhi", "一阳指", "internal", "int", "1d8", "凝气一点，隔空伤敌。", 1, { grade: "家传" }),
    art("dali-xinfa", "大理心法", "internal", "wis", "1d4", "以内息调匀经脉，适合守势与回气。", 1, { grade: "家传" })
  ],
  jianghu: [
    art("jianghu-daolu", "江湖刀路", "external", "str", "1d6", "刀法直接，适合抢身位与逼退对手。", 0, { grade: "粗豪" }),
    art("xiangwei-qinggong", "巷尾轻功", "external", "dex", "1d4", "借步换位，偏重闪身与缠斗。", 0, { grade: "入门" })
  ],
  shaolin: [
    art("shaolin-changquan", "少林长拳", "external", "str", "1d4", "拳架平正，适合稳步压近。", 0, { grade: "正宗" }),
    art("shaolin-neigong", "少林内功", "internal", "wis", "1d6", "调息护体，适合以内劲硬接。", 1, { grade: "正宗" })
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
    art("jiu-xiaowuxiang", "小无相功", "internal", "wis", "2d6", "无声转劲，借他门路数化为己用。", 2, { grade: "绝学", source: "鸠摩智" }),
    art("jiu-longzhao", "龙爪擒拿", "external", "str", "2d8", "擒、锁、拧一气呵成，逼人近身崩盘。", 0, { grade: "上乘", source: "鸠摩智" })
  ],
  legends: [
    art("liumai-shenjian", "六脉神剑", "internal", "int", "6d8", "以内力化作剑气，一线穿空。", 3, { grade: "绝学", source: "剧情习得" })
  ]
} as const;

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
    id: "ding-chunqiu",
    name: "丁春秋",
    hp: 46,
    maxHp: 46,
    qi: 12,
    maxQi: 12,
    ac: 15,
    abilities: { str: 12, dex: 14, con: 14, int: 18, cha: 13, wis: 16 },
    martialArts: defaultMartialArts.bosses.filter(entry => ["ding-huagong", "ding-sanxiao", "ding-zhaixing"].includes(entry.id)),
    tags: ["星宿老怪", "毒功", "控场"]
  },
  {
    id: "you-tanzhi",
    name: "游坦之",
    hp: 40,
    maxHp: 40,
    qi: 8,
    maxQi: 8,
    ac: 13,
    abilities: { str: 15, dex: 12, con: 16, int: 9, cha: 8, wis: 11 },
    martialArts: defaultMartialArts.bosses.filter(entry => ["you-bingcan", "you-tietou", "you-shengsi"].includes(entry.id)),
    tags: ["寒毒", "莽攻", "缠斗"]
  },
  {
    id: "jiu-mozhi",
    name: "鸠摩智",
    hp: 52,
    maxHp: 52,
    qi: 16,
    maxQi: 16,
    ac: 16,
    abilities: { str: 14, dex: 15, con: 15, int: 17, cha: 14, wis: 18 },
    martialArts: defaultMartialArts.bosses.filter(entry => ["jiu-huoyandao", "jiu-xiaowuxiang", "jiu-longzhao"].includes(entry.id)),
    tags: ["国师", "高内力", "爆发"]
  }
] as const;

export const originTemplates: OriginTemplate[] = [
  {
    id: "dali-heir",
    name: "大理世族",
    desc: "识礼数、通人情，起手内力较稳，适合先礼后兵。",
    qiStart: 3,
    intro: "暮色正落在大理城墙上，城门未闭，风却已经有些凉。你从茶肆旁经过时，闻到一缕不该出现在城南的淡檀香。",
    setupHint: "擅长周旋、辨认线索，起手内力较稳。",
    firstQuest: {
      title: "茶肆里的旧香",
      text: "查清城南茶肆里那缕不合时宜的檀香，以及它为何会和江湖人留下的暗记连在一起。",
      location: "大理城",
      npc: "阿朱"
    },
    equipmentNames: ["青锋短剑", "细纹软衣", "玉佩"],
    openingItem: item("dali-note", "城南账页", "一张写着模糊时辰与茶钱的旧账页。", 1, { type: "quest" }),
    martialArts: [...defaultMartialArts.dali]
  },
  {
    id: "jianghu-orphan",
    name: "江湖孤客",
    desc: "无门无派，靠眼力和脚力吃饭，起手内力最少。",
    qiStart: 1,
    intro: "你在大理城外的夜路上止步，火光刚落，便看见有人把一只碎瓷盏踢进草里，像是不愿让别人多看一眼。",
    setupHint: "擅长贴地求生、摸路试探，早期更依赖外功。",
    firstQuest: {
      title: "碎瓷盏的暗号",
      text: "弄清那只碎瓷盏上的刻痕与夜路来人之间的关系，找出是谁先一步灭了踪迹。",
      location: "无量山",
      npc: "木婉清"
    },
    equipmentNames: ["旧铁短刀", "灰布劲装", "铜钱串"],
    openingItem: item("road-shard", "碎瓷盏", "边缘刻着似图非图的细痕。", 1, { type: "quest" }),
    martialArts: [...defaultMartialArts.jianghu]
  },
  {
    id: "shaolin-lay",
    name: "少林俗家",
    desc: "根骨扎实，心性稳，起手内力最高，但打法朴正。",
    qiStart: 5,
    intro: "山路上的暮鼓声还没散尽，你便看见一名香客把供果落在台阶边，自己却一步也不敢回头，像是身后有人盯着。",
    setupHint: "擅长正面硬接与稳住局势，起手内力最充足。",
    firstQuest: {
      title: "台阶边的供果",
      text: "顺着香客丢下的供果与脚印，查清是谁在少室山脚下暗中逼视来往行人。",
      location: "少室山",
      npc: "虚竹"
    },
    equipmentNames: ["齐眉棍", "粗布护臂", "木念珠"],
    openingItem: item("offering-tag", "供果签纸", "签纸上沾着一丝不寻常的药味。", 1, { type: "quest" }),
    martialArts: [...defaultMartialArts.shaolin]
  }
];

export const routeGuides: Record<string, { sceneType: SceneType; objective: ObjectiveHint; intro: string }> = {
  "dali-heir": {
    sceneType: "market",
    objective: { title: "未接任务", text: "先观察城南茶肆四周的异常动静。", location: "大理城" },
    intro: originTemplates[0].intro
  },
  "jianghu-orphan": {
    sceneType: "inn",
    objective: { title: "未接任务", text: "先弄清夜路上那只碎瓷盏是谁留下的。", location: "无量山" },
    intro: originTemplates[1].intro
  },
  "shaolin-lay": {
    sceneType: "temple",
    objective: { title: "未接任务", text: "先安静观察少室山脚下的人与脚印。", location: "少室山" },
    intro: originTemplates[2].intro
  }
};

export const roster: Character[] = [
  makeCharacter(
    "placeholder-dali",
    "无名少侠",
    "大理世族门下",
    [10, 10, 10, 10, 10, 10],
    3,
    originTemplates[0].equipmentNames,
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
  originId: "dali-heir",
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
    wuliang: "initial",
    gusu: "initial"
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
