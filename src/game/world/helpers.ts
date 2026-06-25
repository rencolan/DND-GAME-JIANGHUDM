import { enemyPresets } from "../../data";
import type { GamePatch, GameState, Quest } from "../../types";

export type ParsedHitResult = {
  label?: string;
  total: number;
  dc: number;
  success: boolean;
  damageTotal: number;
  naturalRoll?: number;
  isCritical?: boolean;
};

export type ParsedDamageResult = {
  label?: string;
  total: number;
};

const ESCAPE_ACTION_KEYWORDS = [
  "逃跑",
  "逃走",
  "跑路",
  "跑",
  "撤退",
  "撤离",
  "退走",
  "脱身",
  "脱战",
  "不打了",
  "先撤",
  "夺路",
  "溜走",
  "开溜",
  "离开战斗",
  "翻窗遁走",
  "借势退开"
];

export function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

const WORLD_PERCEPTION_KEYWORDS = [
  "足迹",
  "脚印",
  "鞋印",
  "泥印",
  "痕迹",
  "血迹",
  "拖拽",
  "草叶",
  "草丛",
  "地面",
  "泥土",
  "灰尘",
  "动静",
  "声响",
  "听声",
  "倾听",
  "气味",
  "风声",
  "埋伏",
  "伏击",
  "暗处",
  "异样",
  "不对劲",
  "四周",
  "周围",
  "查看足迹",
  "查看痕迹",
  "查看地面"
];

const WORLD_GENERIC_LOOK_KEYWORDS = [
  "查看",
  "看看",
  "观察",
  "打量",
  "环顾",
  "搜索",
  "搜寻",
  "寻找"
];

const WORLD_INTELLECT_KEYWORDS = [
  "账本",
  "账页",
  "残页",
  "书信",
  "线索",
  "机关",
  "阵法",
  "图纸",
  "地图",
  "文字",
  "符号",
  "暗号",
  "辨认",
  "查验",
  "推演",
  "研读",
  "琢磨",
  "拆招",
  "认穴",
  "门路",
  "破绽"
];

export function inferWorldCheckAbilityKey(action: string) {
  const cleanIntent = inferCleanWorldCheckIntent(action);
  if (cleanIntent) return cleanAbilityForWorldIntent(cleanIntent);

  if (includesAny(action, WORLD_PERCEPTION_KEYWORDS)) return "wis";
  if (includesAny(action, WORLD_INTELLECT_KEYWORDS)) return "int";
  if (includesAny(action, WORLD_GENERIC_LOOK_KEYWORDS)) return "wis";
  if (includesAny(action, ["潜行", "摸近", "闪避", "轻功", "绕后", "翻窗", "抢位", "贴身"])) return "dex";
  if (includesAny(action, ["硬闯", "破门", "掀翻", "擒拿", "压制", "扛物", "撞开"])) return "str";
  if (includesAny(action, ["死撑", "抗毒", "硬扛", "忍伤", "熬住", "长途跋涉", "扛下"])) return "con";
  if (includesAny(action, ["调息", "运气", "疗伤", "感知", "静坐", "周天", "内功运转", "运转内功"])) return "wis";
  if (includesAny(action, ["说服", "交涉", "安抚", "套话", "讲价", "求人", "圆场", "威吓", "求助", "欺瞒"])) return "cha";
  return undefined;
}

type WorldCheckIntent = "perception" | "intellect" | "stealth" | "force" | "endurance" | "social" | "inner";
type WorldCheckFactor = "time" | "clue" | "target" | "method";

const CLEAN_WORLD_KEYWORDS: Record<WorldCheckIntent, string[]> = {
  perception: [
    "观察", "查看", "看看", "打量", "环顾", "搜索", "搜寻", "寻找", "察觉", "留意", "听", "倾听",
    "脚印", "足迹", "痕迹", "血迹", "气味", "动静", "四周", "周围", "不对劲", "异样"
  ],
  intellect: [
    "鉴定", "辨认", "识别", "查验", "调查", "推演", "研读", "琢磨", "拆招", "认穴", "机关",
    "账本", "账册", "残页", "书信", "线索", "阵法", "图纸", "地图", "文字", "符号", "暗号",
    "秘笈", "秘籍", "功法", "来历", "门路", "破绽"
  ],
  stealth: ["潜行", "摸近", "闪避", "轻功", "绕后", "翻窗", "抢位", "贴身", "躲开", "避开", "悄悄"],
  force: ["硬闯", "破门", "掀翻", "擒抱", "压制", "扛物", "撞开", "推开", "砸开", "硬来"],
  endurance: ["死撑", "抗毒", "硬扛", "忍伤", "熬住", "长途跋涉", "扛下", "撑住", "忍住"],
  social: ["说服", "交涉", "安抚", "套话", "讲价", "求人", "圆场", "威吓", "求助", "欺瞒", "打听"],
  inner: ["调息", "运气", "疗伤", "感知凶险", "静坐", "周天", "内功运转", "运转内功", "压住气机"]
};

const CLEAN_WORLD_CHECK_LABELS: Record<WorldCheckIntent, string> = {
  perception: "察觉环境异样",
  intellect: "鉴定线索与门路",
  stealth: "轻身避开耳目",
  force: "正面发力破局",
  endurance: "咬牙硬撑过去",
  social: "让对方松口",
  inner: "稳住气机与心神"
};

const CLEAN_WORLD_CHECK_BASE_REASON: Record<WorldCheckIntent, string> = {
  perception: "这一步看的是心境与感知：从足迹、声响、气味、人物反应和环境细节里找出不对劲。",
  intellect: "这一步看的是悟性：辨认物件来历、拆解线索逻辑、查验文字暗号、机关门路或武学破绽。",
  stealth: "这一步看的是身法：既要快，也要轻，不能先露出声响和身形。",
  force: "这一步看的是力道：不靠取巧，靠正面发力把局面顶开。",
  endurance: "这一步看的是根骨：拼的是体魄、耐性和能不能扛住伤势或压力。",
  social: "这一步看的是气运与临场气度：要让对方愿意松口、配合或退一步。",
  inner: "这一步看的是心境：要把真气、呼吸和心神压稳，不能急躁乱来。"
};

const CLEAN_WORLD_CHECK_RISK: Record<WorldCheckIntent, string> = {
  perception: "失败时可能漏掉关键痕迹，或把方向判断错。",
  intellect: "失败时可能看错门路、误判来历，或把局面理解偏。",
  stealth: "失败时会先一步暴露行踪。",
  force: "失败时会被当场绊住，甚至先露出破绽。",
  endurance: "失败时会先露出疲态、伤势或承受代价。",
  social: "失败时对方会更警觉，也更不愿配合。",
  inner: "失败时气机会更乱，白白耗去心力。"
};

function includesCleanAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function inferCleanWorldCheckIntent(action: string): WorldCheckIntent | undefined {
  if (includesCleanAny(action, CLEAN_WORLD_KEYWORDS.intellect)) return "intellect";
  if (includesCleanAny(action, CLEAN_WORLD_KEYWORDS.inner)) return "inner";
  if (includesCleanAny(action, CLEAN_WORLD_KEYWORDS.social)) return "social";
  if (includesCleanAny(action, CLEAN_WORLD_KEYWORDS.stealth)) return "stealth";
  if (includesCleanAny(action, CLEAN_WORLD_KEYWORDS.force)) return "force";
  if (includesCleanAny(action, CLEAN_WORLD_KEYWORDS.endurance)) return "endurance";
  if (includesCleanAny(action, CLEAN_WORLD_KEYWORDS.perception)) return "perception";
  return undefined;
}

function cleanAbilityForWorldIntent(intent: WorldCheckIntent) {
  switch (intent) {
    case "perception":
    case "inner":
      return "wis";
    case "intellect":
      return "int";
    case "stealth":
      return "dex";
    case "force":
      return "str";
    case "endurance":
      return "con";
    case "social":
      return "cha";
  }
}

function cleanInferTaskDifficulty(action: string, intent: WorldCheckIntent): keyof typeof TASK_MOD {
  if (includesCleanAny(action, ["宗师", "高手", "精妙", "极难", "绝密", "严防", "重重", "机关重重", "高阶", "绝学"])) return "veryHard";
  if (includesCleanAny(action, ["隐藏", "掩盖", "伪装", "暗门", "密道", "复杂", "混乱", "雨", "雪", "远处", "残缺", "残篇"])) return "hard";
  if (includesCleanAny(action, ["随便", "简单", "明显", "大概", "粗略"])) return "simple";
  if (intent === "stealth" || intent === "force") return "normal";
  return "normal";
}

function cleanTimePressureMod(action: string, state?: GameState) {
  if (includesCleanAny(action, ["仔细", "慢慢", "花时间", "反复", "耐心", "蹲下细看", "细看", "逐字"])) return -1;
  if (includesCleanAny(action, ["立刻", "马上", "赶紧", "快", "匆匆", "边跑", "追上", "抢时间", "来不及"])) return 2;

  const objectiveText = `${state?.objective?.title || ""}${state?.objective?.text || ""}${state?.chapterState?.stage || ""}`;
  if (includesCleanAny(objectiveText, ["追", "救", "赶", "急", "逃", "刺客", "追兵"])) return 1;
  return 0;
}

function cleanClueQualityMod(action: string, intent: WorldCheckIntent, state?: GameState) {
  let mod = 0;
  if (intent === "perception") {
    if (includesCleanAny(action, ["明显", "很深", "新鲜", "血迹", "拖拽", "泥地", "沙土"])) mod -= 2;
    if (includesCleanAny(action, ["模糊", "半干", "不清", "雨水", "雪", "水沟", "冲散", "人群", "踩踏", "石板"])) mod += 2;
    if (includesCleanAny(action, ["抹去", "掩盖", "伪装", "刻意"])) mod += 4;
    if (state?.sceneType === "market") mod += 1;
    if (state?.sceneType === "temple" || state?.sceneType === "inn") mod -= 1;
  }

  if (intent === "intellect") {
    if (includesCleanAny(action, ["残页", "暗号", "机关", "阵法", "密文", "古字", "绝学"])) mod += 2;
    if (includesCleanAny(action, ["对照", "核对", "原本", "图纸", "账本", "抄本"])) mod -= 1;
  }

  return mod;
}

function cleanTargetStrengthMod(action: string, state?: GameState) {
  const namedEnemy = enemyPresets.find((preset) => action.includes(preset.name));
  if (namedEnemy) {
    if (namedEnemy.ac >= 15 || namedEnemy.maxHp >= 45 || namedEnemy.archetype === "boss") return 6;
    if (namedEnemy.ac >= 13 || namedEnemy.maxHp >= 30) return 4;
    if (namedEnemy.ac >= 12 || namedEnemy.maxHp >= 22) return 2;
  }

  const namedNpc = state?.npcs?.find((npc) => action.includes(npc.name));
  if (namedNpc?.tags?.some((tag) => includesCleanAny(tag, ["高手", "刺客", "掌门", "老江湖", "精英"]))) return 3;
  if (includesCleanAny(action, ["高手", "刺客", "老江湖", "警觉", "掌门", "宗师"])) return 3;
  return 0;
}

function cleanMethodRollMode(action: string, dcMods: Partial<Record<WorldCheckFactor, number>>) {
  const concreteMethod = includesCleanAny(action, [
    "蹲下", "拨开", "用灯", "火折", "对照", "沿着", "屏息", "贴墙", "绕路", "请教", "拿出", "慢慢"
  ]);
  const recklessMethod = includesCleanAny(action, ["随便", "硬来", "莽", "大声", "当众", "匆匆", "闭眼"]);

  if (concreteMethod && (dcMods.time || 0) <= 0) return "advantage" as const;
  if (recklessMethod || (dcMods.time || 0) >= 4 || (dcMods.clue || 0) >= 4) return "disadvantage" as const;
  return "normal" as const;
}

function cleanFactorSummary(dcMods: Partial<Record<WorldCheckFactor, number>>) {
  return [
    dcMods.time ? `时间压力 ${dcMods.time > 0 ? "+" : ""}${dcMods.time}` : undefined,
    dcMods.clue ? `线索条件 ${dcMods.clue > 0 ? "+" : ""}${dcMods.clue}` : undefined,
    dcMods.target ? `对象难度 +${dcMods.target}` : undefined
  ].filter(Boolean).join("；");
}

const WORLD_CHECK_LABELS: Record<WorldCheckIntent, string> = {
  perception: "察觉环境里的细微异样",
  intellect: "看破线索与门路",
  stealth: "轻身夺位不露形迹",
  force: "正面发力强行破局",
  endurance: "咬牙硬撑过去",
  social: "让对方松口表态",
  inner: "稳住气机与心神"
};

const WORLD_CHECK_BASE_REASON: Record<WorldCheckIntent, string> = {
  perception: "这一步靠的是心境沉稳、感知敏锐，去辨足迹、声响、气味、草木和人留下的细微异样。",
  intellect: "这一步靠的是悟性，去拆解账册、文字、机关、路线、暗号或武学门路里的逻辑。",
  stealth: "这一步讲究身法和步点，既要快，也要不露声色。",
  force: "这一步不是取巧的时候，得靠正面力道把局势顶开。",
  endurance: "这一步拼的不是巧劲，而是体魄、耐性与能不能熬住。",
  social: "对方心里有戒备，想让他松口，靠的是气度、话头和临场拿捏。",
  inner: "这一步讲究心神沉定、真气归拢，不能急躁乱来。"
};

const WORLD_CHECK_RISK: Record<WorldCheckIntent, string> = {
  perception: "若失手，你可能漏掉关键痕迹，或把人留下的方向判断错。",
  intellect: "若失手，你可能漏掉关键处，或把局面看偏。",
  stealth: "若失手，你会先一步暴露。",
  force: "若失手，你会被当场绊住，甚至先露破绽。",
  endurance: "若失手，你会先一步露出疲态或伤势。",
  social: "若失手，对方会更警觉，也更不愿配合。",
  inner: "若失手，气机会更乱，白白耗去心力。"
};

const TASK_MOD: Record<"simple" | "normal" | "hard" | "veryHard", number> = {
  simple: 0,
  normal: 2,
  hard: 5,
  veryHard: 8
};

function clampDc(value: number) {
  return Math.max(8, Math.min(24, value));
}

function inferWorldCheckIntent(action: string): WorldCheckIntent | undefined {
  if (includesAny(action, WORLD_PERCEPTION_KEYWORDS)) return "perception";
  if (includesAny(action, WORLD_INTELLECT_KEYWORDS)) return "intellect";
  if (includesAny(action, WORLD_GENERIC_LOOK_KEYWORDS)) return "perception";
  if (includesAny(action, ["潜行", "摸近", "闪避", "轻功", "绕后", "翻窗", "抢位", "贴身"])) return "stealth";
  if (includesAny(action, ["硬闯", "破门", "掀翻", "擒拿", "压制", "扛物", "撞开"])) return "force";
  if (includesAny(action, ["死撑", "抗毒", "硬扛", "忍伤", "熬住", "长途跋涉", "扛下"])) return "endurance";
  if (includesAny(action, ["调息", "运气", "疗伤", "感知", "静坐", "周天", "内功运转", "运转内功"])) return "inner";
  if (includesAny(action, ["说服", "交涉", "安抚", "套话", "讲价", "求人", "圆场", "威吓", "求助", "欺瞒"])) return "social";
  return undefined;
}

function abilityForWorldIntent(intent: WorldCheckIntent) {
  switch (intent) {
    case "perception":
    case "inner":
      return "wis";
    case "intellect":
      return "int";
    case "stealth":
      return "dex";
    case "force":
      return "str";
    case "endurance":
      return "con";
    case "social":
      return "cha";
    default:
      return undefined;
  }
}

function inferTaskDifficulty(action: string, intent: WorldCheckIntent): keyof typeof TASK_MOD {
  if (includesAny(action, ["宗师", "高手", "精妙", "极难", "绝密", "严防", "重重", "机关重重"])) return "veryHard";
  if (includesAny(action, ["隐藏", "掩盖", "伪装", "暗门", "密道", "复杂", "混乱", "雨", "夜", "远处"])) return "hard";
  if (intent === "stealth" || intent === "force") return "normal";
  if (includesAny(action, ["随便", "简单", "明显", "大概"])) return "simple";
  return "normal";
}

function timePressureMod(action: string, state?: GameState) {
  if (includesAny(action, ["仔细", "慢慢", "花时间", "反复", "耐心", "蹲下细看", "细看"])) return -1;
  if (includesAny(action, ["立刻", "马上", "赶紧", "快速", "匆匆", "边跑", "追上", "抢时间", "来不及"])) return 2;

  const objectiveText = `${state?.objective?.title || ""}${state?.objective?.text || ""}${state?.chapterState?.stage || ""}`;
  if (includesAny(objectiveText, ["追", "救", "赶", "危", "逃", "刺客", "追兵"])) return 2;
  return 0;
}

function clueQualityMod(action: string, intent: WorldCheckIntent, state?: GameState) {
  let mod = 0;
  if (intent === "perception") {
    if (includesAny(action, ["明显", "很深", "新鲜", "血迹", "拖拽", "泥地", "沙土"])) mod -= 2;
    if (includesAny(action, ["模糊", "半枚", "不清", "露水", "雨", "水沟", "冲散", "人群", "踩踏", "石板"])) mod += 2;
    if (includesAny(action, ["抹去", "掩盖", "伪装", "刻意"])) mod += 4;
    if (state?.sceneType === "market") mod += 1;
    if (state?.sceneType === "temple" || state?.sceneType === "inn") mod -= 1;
  }

  if (intent === "intellect") {
    if (includesAny(action, ["残页", "暗号", "机关", "阵法", "密文"])) mod += 2;
    if (includesAny(action, ["对照", "核对", "原本", "图纸", "账本"])) mod -= 1;
  }

  return mod;
}

function targetStrengthMod(action: string, state?: GameState) {
  const namedEnemy = enemyPresets.find((preset) => action.includes(preset.name));
  if (namedEnemy) {
    if (namedEnemy.ac >= 15 || namedEnemy.maxHp >= 45 || namedEnemy.archetype === "boss") return 6;
    if (namedEnemy.ac >= 13 || namedEnemy.maxHp >= 30) return 4;
    if (namedEnemy.ac >= 12 || namedEnemy.maxHp >= 22) return 2;
  }

  const namedNpc = state?.npcs?.find((npc) => action.includes(npc.name));
  if (namedNpc?.tags?.some((tag) => includesAny(tag, ["高手", "刺客", "掌门", "老江湖", "精英"]))) return 3;
  if (includesAny(action, ["高手", "刺客", "老江湖", "警觉", "掌门", "宗师"])) return 3;
  return 0;
}

function methodRollMode(action: string, dcMods: Partial<Record<WorldCheckFactor, number>>) {
  const concreteMethod = includesAny(action, [
    "蹲下",
    "拨开",
    "用灯",
    "火折",
    "对照",
    "沿着",
    "屏息",
    "贴墙",
    "绕路",
    "请教",
    "拿出",
    "慢慢"
  ]);
  const recklessMethod = includesAny(action, ["随便", "硬来", "莽", "大声", "当众", "匆匆", "闭眼"]);

  if (concreteMethod && (dcMods.time || 0) <= 0) return "advantage" as const;
  if (recklessMethod || (dcMods.time || 0) >= 4 || (dcMods.clue || 0) >= 4) return "disadvantage" as const;
  return "normal" as const;
}

function factorSummary(dcMods: Partial<Record<WorldCheckFactor, number>>) {
  return [
    dcMods.time ? `时间${dcMods.time > 0 ? "紧" : "足"} ${dcMods.time > 0 ? "+" : ""}${dcMods.time}` : undefined,
    dcMods.clue ? `线索${dcMods.clue > 0 ? "不明" : "明显"} ${dcMods.clue > 0 ? "+" : ""}${dcMods.clue}` : undefined,
    dcMods.target ? `对象难缠 +${dcMods.target}` : undefined
  ].filter(Boolean).join("；");
}

export function buildWorldCheck(
  action: string,
  state?: GameState,
  proposedCheck?: GamePatch["pendingCheck"]
): GamePatch["pendingCheck"] | undefined {
  const intent = inferCleanWorldCheckIntent(action)
    || inferWorldCheckIntent(action)
    || (proposedCheck?.abilityKey === "int" ? "intellect" : undefined)
    || (proposedCheck?.abilityKey === "dex" ? "stealth" : undefined)
    || (proposedCheck?.abilityKey === "str" ? "force" : undefined)
    || (proposedCheck?.abilityKey === "con" ? "endurance" : undefined)
    || (proposedCheck?.abilityKey === "cha" ? "social" : undefined)
    || (proposedCheck?.abilityKey === "wis" ? "perception" : undefined);
  if (!intent) return undefined;

  const checkedIntent = intent as WorldCheckIntent;
  const abilityKey = cleanAbilityForWorldIntent(checkedIntent);
  const task = cleanInferTaskDifficulty(action, checkedIntent);
  const dcMods = {
    time: cleanTimePressureMod(action, state),
    clue: cleanClueQualityMod(action, checkedIntent, state),
    target: cleanTargetStrengthMod(action, state)
  };
  const dc = clampDc(10 + TASK_MOD[task] + dcMods.time + dcMods.clue + dcMods.target);
  const mode = cleanMethodRollMode(action, dcMods);
  const factors = cleanFactorSummary(dcMods);

  return {
    kind: "world",
    checkId: proposedCheck?.checkId,
    label: proposedCheck?.label || CLEAN_WORLD_CHECK_LABELS[checkedIntent],
    abilityKey,
    rollMode: mode,
    dc,
    reason: `${CLEAN_WORLD_CHECK_BASE_REASON[checkedIntent]}${factors ? ` 本次难度因子：${factors}。` : ""}`,
    risk: proposedCheck?.risk || CLEAN_WORLD_CHECK_RISK[checkedIntent],
    suggestedAction: proposedCheck?.suggestedAction
  };

}

function perceptionSuggestedCheck(action: string): GamePatch["pendingCheck"] | undefined {
  if (inferWorldCheckAbilityKey(action) !== "wis") return undefined;

  return {
    kind: "world",
    label: "察觉环境里的细微异样",
    abilityKey: "wis",
    dc: 12,
    reason: "这不是拆解账册或推演门路，而是看足迹、听动静、辨风声和草木痕迹，靠的是心境沉稳与感知敏锐。",
    risk: "若失手，你可能漏掉关键痕迹，或把人留下的方向判断错。"
  };
}

export function normalizeWorldCheckAbility(
  action: string,
  check: GamePatch["pendingCheck"] | undefined,
  state?: GameState
): GamePatch["pendingCheck"] | undefined {
  if (!check || check.kind === "initiative" || check.kind === "combat_attack" || check.kind === "combat_escape") {
    return check;
  }

  return buildWorldCheck(action, state, check) || check;
}

export function isEscapeCombatAction(text: string) {
  return includesAny(text, ESCAPE_ACTION_KEYWORDS);
}

export function currentLocation(state: GameState) {
  return state.locations.find((location) => location.current);
}

export function currentLocationId(state: GameState) {
  return currentLocation(state)?.id;
}

export function currentLocationName(state: GameState) {
  return currentLocation(state)?.name || "Unknown location";
}

export function hasQuestStatus(state: GameState, questId: string, status?: Quest["status"]) {
  const inList = state.quests.some((quest) => quest.id === questId && (!status || quest.status === status));
  const inState = state.questStateMap[questId];
  return inList || Boolean(inState && (!status || inState.status === status));
}

export function hasStoryFlag(state: GameState, flag: string) {
  return state.storyFlags.includes(flag);
}

export function routeStage(state: GameState, routeId: string) {
  return state.relationshipRoutes[routeId]?.stage;
}

export function findLocationByName(state: GameState, name: string) {
  return state.locations.find((location) => location.name === name || location.id === name);
}

export function findNamedEnemy(action: string) {
  return enemyPresets.find((preset) => action.includes(preset.name));
}

function extractLabel(text: string, prefix: "判定" | "伤害") {
  const direct = text.match(new RegExp(`【${prefix}】\\s*(.+)`));
  if (direct?.[1]) return direct[1].trim();
  // Legacy mojibake matcher: keep this only so older saved roll text can still resolve.
  const legacy = text.match(new RegExp(`銆愬${prefix === "判定" ? "垽瀹" : "激瀹"}.*?\\s*(.+)`));
  return legacy?.[1]?.trim();
}

function extractLastNumber(text: string, pattern: RegExp) {
  const match = text.match(pattern);
  return Number(match?.[1] || Number.NaN);
}

function findDamageLine(text: string) {
  // Legacy mojibake matcher: keep this only so older saved damage text can still resolve.
  return text.split(/\r?\n/).reverse().find((line) =>
    line.includes("【伤害】") || line.includes("銆愬激瀹")
  );
}

export function parseHitResult(text: string): ParsedHitResult {
  const label = extractLabel(text, "判定");
  const naturalRoll = extractLastNumber(text, /d20[=:：]\s*(\d+)/);
  const total = Number(
    text.match(/总计[：:]\s*(\d+)/)?.[1]
    // Legacy mojibake matcher: keep this only so older saved roll text can still resolve.
    || text.match(/鎬昏锛?\s*(\d+)/)?.[1]
    || Number.NaN
  );
  const dc = extractLastNumber(text, /DC\s*(\d+)/);
  const success = text.includes("结果：成功")
    ? true
    : text.includes("结果：失败")
      ? false
      : (naturalRoll === 20 || total >= dc);
  const damageLine = findDamageLine(text);
  const damageTotal = damageLine ? extractLastNumber(damageLine, /=\s*(\d+)\s*$/) : Number.NaN;
  const isCritical = naturalRoll === 20 || text.includes("暴击：是") || text.includes("暴击");

  return {
    label,
    total,
    dc,
    success: naturalRoll === 1 ? false : success,
    damageTotal: Number.isNaN(damageTotal) ? 0 : damageTotal,
    naturalRoll,
    isCritical
  };
}

export function parseDamageResult(text: string): ParsedDamageResult {
  const damageLine = findDamageLine(text);
  if (!damageLine) return { label: undefined, total: Number.NaN };
  const label = extractLabel(damageLine, "伤害")?.match(/^(.+?)\s+\d+d\d+/)?.[1]?.trim()
    || extractLabel(damageLine, "伤害");
  const total = extractLastNumber(damageLine, /=\s*(\d+)\s*$/);
  return { label, total };
}

export function parseCombatHitResult(text: string): ParsedHitResult {
  return parseHitResult(text);
}

export function parseCombatDamageResult(text: string): ParsedDamageResult {
  return parseDamageResult(text);
}

export function buildSuggestedCheck(action: string, state?: GameState): GamePatch["pendingCheck"] | undefined {
  return buildWorldCheck(action, state);

  const perceptionCheck = perceptionSuggestedCheck(action);
  if (perceptionCheck) return perceptionCheck;

  if (includesAny(action, ["查看", "调查", "打探", "辨认", "查验", "拆招", "推演", "演练", "认穴", "琢磨"])) {
    return {
      kind: "world",
      label: "看破线索与门路",
      abilityKey: "int",
      dc: 12,
      reason: "眼前细节不少，得先看出哪条线索、哪处破绽真正值得追下去。",
      risk: "若失手，你可能漏掉关键处，或把局面看偏。"
    };
  }

  if (includesAny(action, ["潜行", "摸近", "闪避", "轻功", "绕后", "翻窗", "抢位", "贴身"])) {
    return {
      kind: "world",
      label: "轻身夺位不露形迹",
      abilityKey: "dex",
      dc: 13,
      reason: "这一步讲究身法和步点，既要快，也要不露声色。",
      risk: "若失手，你会先一步暴露。"
    };
  }

  if (includesAny(action, ["硬闯", "破门", "掀翻", "擒抱", "压制", "扛物", "撞开"])) {
    return {
      kind: "world",
      label: "正面发力强行破局",
      abilityKey: "str",
      dc: 13,
      reason: "这不是取巧的时候，得靠正面力道把局势顶开。",
      risk: "若失手，你会被当场拦住，甚至先露破绽。"
    };
  }

  if (includesAny(action, ["死撑", "抗毒", "硬扛", "忍伤", "熬住", "长途跋涉", "扛下"])) {
    return {
      kind: "world",
      label: "咬牙硬扛过去",
      abilityKey: "con",
      dc: 12,
      reason: "这一步拼的不是巧劲，而是体魄、耐性与能不能熬住。",
      risk: "若失手，你会先一步露出疲态或伤势。"
    };
  }

  if (includesAny(action, ["调息", "运气", "疗伤", "感知", "静坐", "周天", "内功运转", "运转内功"])) {
    return {
      kind: "world",
      label: "稳住气机与心神",
      abilityKey: "wis",
      dc: 12,
      reason: "这一手讲究心神沉定、真气归拢，不能急躁乱来。",
      risk: "若失手，气机会更乱，白白耗去心力。"
    };
  }

  if (includesAny(action, ["说服", "交涉", "安抚", "套话", "讲价", "求人", "圆场", "威吓", "求助", "欺瞒"])) {
    return {
      kind: "world",
      label: "让对方松口表态",
      abilityKey: "cha",
      dc: 12,
      reason: "对方心里有戒备，想让他松口，靠的是气度、话头和临场拿捏。",
      risk: "若失手，对方会更警觉，也更不愿配合。"
    };
  }

  return undefined;
}

function abilityLabel(state: GameState, abilityKey?: string) {
  return state.character.abilities.find((ability) => ability.key === abilityKey)?.label || abilityKey || "对应属性";
}

function findPlayerMartialArtFromAction(state: GameState, action: string) {
  return state.character.martialArts.find((art) => action.includes(art.name));
}

function inferCombatAbilityKey(action: string) {
  if (includesAny(action, ["刀", "拳", "掌", "棍", "硬进", "硬闯", "猛冲", "迎面", "压上", "硬接", "大开大阖"])) return "str";
  if (includesAny(action, ["闪", "绕", "侧身", "滑步", "游走", "抢步", "快刺", "贴身", "轻身", "飘开"])) return "dex";
  if (includesAny(action, ["提气", "运气", "以内力", "内劲", "护体", "调息", "真气"])) return "wis";
  if (includesAny(action, ["拆招", "看破", "料敌", "变招", "算准", "突破"])) return "int";
  if (includesAny(action, ["硬扛", "死撑", "顶住", "抗下"])) return "con";
  return undefined;
}

function pickMartialArtForAbility(state: GameState, abilityKey?: string) {
  if (!abilityKey) return undefined;
  return state.character.martialArts.find((art) => art.linkedAbility === abilityKey);
}

export function buildCombatEscapePromptText(state: GameState, check: NonNullable<GamePatch["pendingCheck"]>) {
  const label = abilityLabel(state, check.abilityKey);
  const modeText = check.rollMode === "advantage"
    ? "优势，掷 2d20 取高"
    : check.rollMode === "disadvantage"
      ? "劣势，掷 2d20 取低"
      : "常规，掷 1d20";
  return `你这一手是在设法脱身，眼下该用${label}判定，DC ${check.dc}，${modeText}。请点开“待逃脱”，先把这一掷做完。`;
}

export function buildCombatActionCheck(
  state: GameState,
  action: string
): { pendingCheck: GamePatch["pendingCheck"]; promptText: string } | undefined {
  if (!state.combat.active || !state.pendingCheck) return undefined;

  if (state.pendingCheck.kind === "combat_escape") {
    return {
      pendingCheck: state.pendingCheck,
      promptText: buildCombatEscapePromptText(state, state.pendingCheck)
    };
  }

  if (state.combat.phase === "opening") {
    const label = abilityLabel(state, "dex");
    return {
      pendingCheck: {
        ...state.pendingCheck,
        kind: "initiative",
        abilityKey: "dex",
        rollMode: "normal",
        reason: `${state.combat.enemy || "对手"}已经起势。这一下比的不是花巧，而是谁先抢到先手。`,
        suggestedAction: `请掷 d20 + ${label}，先定这一轮谁先动。`
      },
      promptText: `你这一步说到底是在抢先手，这一步固定用${label}判定。请点开“待先攻”，掷 d20 + ${label}，先看这一轮谁先动。`
    };
  }

  if (state.combat.phase !== "awaiting_hit_check") return undefined;

  const matchedArt = findPlayerMartialArtFromAction(state, action);
  const inferredAbilityKey = matchedArt?.linkedAbility || inferCombatAbilityKey(action) || state.pendingCheck.abilityKey || "str";
  const inferredArt = matchedArt || pickMartialArtForAbility(state, inferredAbilityKey);
  const label = abilityLabel(state, inferredAbilityKey);
  const enemyName = state.combat.enemy || "对手";
  const actionLabel = inferredArt?.name || `${label}出手`;

  return {
    pendingCheck: {
      ...state.pendingCheck,
      kind: "combat_attack",
      label: `攻击 ${enemyName}`,
      abilityKey: inferredAbilityKey,
      martialArtId: inferredArt?.id,
      rollMode: "normal",
      reason: `你这一手是要正面对${enemyName}递招，眼下先用${label}做攻击判定；若命中，再掷伤害。`,
      suggestedAction: `请掷 d20 + ${label}。`
    },
    promptText: inferredArt
      ? `你这一手可按“${actionLabel}”来算，先用${label}做攻击判定。请点开“待攻击”，掷 d20 + ${label}；若命中，再掷这招的伤害。`
      : `你这一手更像${label}路数，眼下先用${label}做攻击判定。请点开“待攻击”，掷 d20 + ${label}；命中之后，再结算伤害。`
  };
}

export function buildShuangErSupportPatch(state: GameState): GamePatch | undefined {
  const stage = routeStage(state, "shuang-er");
  if (state.combat.active && (stage === "partiality" || stage === "follow" || stage === "enduring")) {
    const bossFight = state.combat.enemyArchetype === "boss";
    const canDelayFinisher = !bossFight && (stage === "follow" || stage === "enduring");
    return {
      hpChange: 2,
      qiRecovery: stage === "follow" || stage === "enduring" ? 1 : undefined,
      combatUpdate: {
        playerStatusAdd: ["guarded"],
        enemyStatusAdd: stage === "follow" || stage === "enduring" ? ["controlled"] : undefined,
        enemySuppressedFinisherUntilRound: canDelayFinisher ? (state.combat.round || 1) + 1 : undefined,
        enemyIntent: "双儿抢到你身侧半步，短打和袖中暗劲正好截住敌人的进身。",
        lastCombatEvent: bossFight ? "双儿贴身护主，强敌攻势稍缓" : "双儿贴身护主"
      },
      systemNote: bossFight
        ? "双儿不声不响贴到你身侧，替你护住破绽。强敌没有被完全截断攻势，但节奏被她缓了一缓。"
        : "双儿不声不响贴到你身侧，一手替你护住破绽，一手用短打扰乱敌人进身。"
    };
  }

  if (state.combat.active && stage === "trust") {
    return {
      hpChange: 2,
      combatUpdate: {
        playerStatusAdd: ["guarded"],
        enemyIntent: "双儿替你看住身后一线，敌人这一轮很难抓到空门。",
        lastCombatEvent: "双儿替你守住身后"
      },
      systemNote: "双儿虽未正式随行，却已经替你守住身后一线，你这一轮更稳。"
    };
  }

  if (stage === "trust" && !hasStoryFlag(state, "support:shuang-er:medicine")) {
    return {
      newItem: {
        id: "shuang-er-medicine",
        name: "双儿包好的药包",
        desc: "双儿把止血和行气的药都细细包好，轻声叮嘱你别再硬撑。",
        count: 1,
        type: "consumable",
        usable: true,
        hpRestore: 6
      },
      storyFlagsAdd: ["support:shuang-er:medicine"],
      systemNote: "双儿悄悄替你备下了一只药包。"
    };
  }

  if (stage === "partiality" && !hasStoryFlag(state, "support:shuang-er:travel")) {
    return {
      qiRecovery: 1,
      innerInjuryChange: -4,
      storyFlagsAdd: ["support:shuang-er:travel"],
      systemNote: "双儿替你把路上的零碎、药囊和换洗布条都整理好了，你终于能稳稳喘口气。"
    };
  }

  if (stage === "follow" || stage === "enduring") {
    return {
      hpChange: 3,
      qiRecovery: 1,
      innerInjuryChange: -6,
      systemNote: "双儿替你收拾行囊、温药理伤，又轻声提醒你别逞强。你身上的疲乏缓下去不少。"
    };
  }

  return undefined;
}

export function buildNpcSupportPatch(state: GameState, npcIdOrName: string): GamePatch | undefined {
  const npc = state.npcs.find((entry) => entry.id === npcIdOrName || entry.name === npcIdOrName);
  const key = npc?.id || npcIdOrName;
  const combatSupportFlag = `support:${key}:combat:${state.combat.combatId || `${state.worldDay}:${state.combat.enemy || "unknown"}`}`;
  const dailySupportFlag = `support:${key}:used:${state.worldDay}`;
  const supportFlag = state.combat.active ? combatSupportFlag : dailySupportFlag;

  if (state.combat.active && !npc?.companion) {
    return {
      systemNote: `${npc?.name || "对方"}眼下并未与你同行，不能在这场战斗里替你出手。`
    };
  }

  if (hasStoryFlag(state, supportFlag)) {
    return {
      systemNote: state.combat.active
        ? `${npc?.name || "对方"}这场战斗已经帮过你一次，眼下只能靠你自己接住后手。`
        : `${npc?.name || "对方"}今日已经帮过你一次，眼下不好再强求。`
    };
  }

  if (key === "shuang-er") {
    const patch = buildShuangErSupportPatch(state);
    return patch
      ? { ...patch, storyFlagsAdd: [...(patch.storyFlagsAdd || []), supportFlag] }
      : { storyFlagsAdd: [supportFlag], qiRecovery: 1, systemNote: "双儿替你把零碎照应妥当，你稍稍回稳了一口气。" };
  }

  if (key === "a-zhu") {
    if (state.combat.active) {
      return {
        storyFlagsAdd: [supportFlag],
        combatUpdate: {
          playerStatusAdd: ["screened"],
          enemyStatusAdd: state.combat.enemyArchetype === "boss" ? undefined : ["exposed"],
          enemyIntent: "阿朱用假身形和错位声响替你遮了一瞬，敌人的判断慢了半拍。",
          lastCombatEvent: "阿朱易容误导"
        },
        systemNote: "阿朱没有硬拼，只用假身形和错位声响替你遮住一瞬。"
      };
    }

    return {
      storyFlagsAdd: [supportFlag],
      rumorAdd: [{
        text: "阿朱替你换了个身份去打听，带回一条不走明路的消息：姑苏水路还有一处私下接头点。",
        kind: "hook",
        location: "姑苏",
        npc: "阿朱",
        source: "npc-support"
      }],
      systemNote: "阿朱替你易容打探，补出一条隐秘线索。"
    };
  }

  if (key === "wang-yuyan") {
    return state.combat.active
      ? {
        storyFlagsAdd: [supportFlag],
        combatUpdate: {
          enemyStatusAdd: ["exposed"],
          enemyIntent: "王语嫣点破了对方招路，你终于看清下一处破绽。",
          lastCombatEvent: "王语嫣识破敌招"
        },
        systemNote: "王语嫣低声点破对方招路，敌人露出破绽。"
      }
      : {
        storyFlagsAdd: [supportFlag],
        attributeInsightAdd: [{ id: `insight:wang-yuyan:${state.actionCount}`, choices: ["int", "wis"], reason: "王语嫣替你拆解武学路数" }],
        systemNote: "王语嫣替你拆解一路武学，你得到一次可落到悟性或心境上的心得。"
      };
  }

  if (key === "duan-yu") {
    if (state.combat.active) {
      return {
        storyFlagsAdd: [supportFlag],
        qiRecovery: 1,
        combatUpdate: {
          playerStatusAdd: ["screened"],
          enemyIntent: "段誉脚下急转，替你把敌人视线带偏了一线。",
          lastCombatEvent: "段誉凌乱步法牵制"
        },
        systemNote: "段誉慌中有快，脚下急转替你牵偏敌人视线，你趁机回稳一口真气。"
      };
    }

    return {
      storyFlagsAdd: [supportFlag],
      qiRecovery: 1,
      rumorAdd: [{
        text: "段誉又提起无量山石室的步图和运气残痕，你可以回无量山继续追凌波与北冥线索。",
        kind: "hook",
        location: "无量山",
        npc: "段誉",
        source: "npc-support"
      }],
      systemNote: "段誉替你补起无量山石室的细节，你的真气也稍稍回稳。"
    };
  }

  if (key === "mu-wanqing") {
    return state.combat.active
      ? {
        storyFlagsAdd: [supportFlag],
        combatUpdate: {
          enemyStatusAdd: ["controlled"],
          enemySuppressedFinisherUntilRound: state.combat.enemyArchetype === "boss" ? undefined : (state.combat.round || 1) + 1,
          lastCombatEvent: state.combat.enemyArchetype === "boss" ? "木婉清冷箭牵制强敌" : "木婉清冷箭压住敌人"
        },
        systemNote: state.combat.enemyArchetype === "boss"
          ? "木婉清一箭逼得强敌稍稍偏身，但这种人物不会被一箭完全封住杀招。"
          : "木婉清一箭压住对方进身，敌人下手被迫收乱。"
      }
      : {
        storyFlagsAdd: [supportFlag],
        pendingCheck: {
          label: "借木婉清冷箭潜行",
          abilityKey: "dex",
          rollMode: "advantage",
          dc: 12,
          reason: "木婉清替你压住视线，你可借这个空当潜行或抢位。",
          suggestedAction: "掷优势身法判定。"
        },
        systemNote: "木婉清替你压住远处视线，下一次潜行或抢位更稳。"
      };
  }

  if (key === "qiao-feng") {
    if (state.combat.active) {
      return {
        storyFlagsAdd: [supportFlag],
        combatUpdate: {
          enemyStatusAdd: ["exposed"],
          enemyIntent: "乔峰沉声一喝，逼得敌人气势一滞，门户短短露出一线。",
          lastCombatEvent: "乔峰喝破敌势"
        },
        attributeInsightAdd: [{ id: `insight:qiao-feng-combat:${state.combat.combatId || state.actionCount}`, choices: ["str", "con"], reason: "乔峰临战喝破敌势" }],
        systemNote: "乔峰没有替你接管战斗，只一声喝破敌势，给你看清正面破局的机会。"
      };
    }

    return {
      storyFlagsAdd: [supportFlag],
      attributeInsightAdd: [{ id: `insight:qiao-feng:${state.actionCount}`, choices: ["str", "con"], reason: "乔峰以重手喂招" }],
      systemNote: "乔峰不多讲，只以一记重手喂招。你得到一次可落到力道或根骨上的心得。"
    };
  }

  if (key === "xu-zhu") {
    if (state.combat.active) {
      return {
        storyFlagsAdd: [supportFlag],
        qiRecovery: 1,
        innerInjuryChange: -6,
        combatUpdate: {
          playerStatusAdd: ["guarded"],
          enemyIntent: "虚竹替你稳住一口内息，敌人这一轮难以顺势逼伤。",
          lastCombatEvent: "虚竹稳住内息"
        },
        systemNote: "虚竹急忙替你稳住内息，真气稍复，内伤也被压下一截。"
      };
    }

    return {
      storyFlagsAdd: [supportFlag],
      qiRecovery: 1,
      innerInjuryChange: -8,
      systemNote: "虚竹替你稳住内息，真气稍复，内伤也缓了一截。"
    };
  }

  return undefined;
}

export function isResolvedDice(text: string) {
  return text.includes("【判定】") || text.includes("【伤害】");
}
