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

const ESCAPE_ACTION_KEYWORDS = ["逃跑", "撤退", "脱身", "夺路", "翻窗遁走", "借势退开"];

export function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
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
  const legacy = text.match(new RegExp(`銆愬${prefix === "判定" ? "垽瀹" : "激瀹"}.*?\\s*(.+)`));
  return legacy?.[1]?.trim();
}

function extractLastNumber(text: string, pattern: RegExp) {
  const match = text.match(pattern);
  return Number(match?.[1] || Number.NaN);
}

export function parseHitResult(text: string): ParsedHitResult {
  const label = extractLabel(text, "判定");
  const naturalRoll = extractLastNumber(text, /d20[=:：]\s*(\d+)/);
  const total = Number(
    text.match(/总计[：:]\s*(\d+)/)?.[1]
    || text.match(/鎬昏锛?\s*(\d+)/)?.[1]
    || Number.NaN
  );
  const dc = extractLastNumber(text, /DC\s*(\d+)/);
  const success = text.includes("结果：成功")
    ? true
    : text.includes("结果：失败")
      ? false
      : (naturalRoll === 20 || total >= dc);
  const damageTotal = extractLastNumber(text, /=\s*(\d+)\s*$/m);
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
  const label = extractLabel(text, "伤害")?.match(/^(.+?)\s+\d+d\d+/)?.[1]?.trim() || extractLabel(text, "伤害");
  const total = extractLastNumber(text, /=\s*(\d+)\s*$/m);
  return { label, total };
}

export function parseCombatHitResult(text: string): ParsedHitResult {
  return parseHitResult(text);
}

export function parseCombatDamageResult(text: string): ParsedDamageResult {
  return parseDamageResult(text);
}

export function buildSuggestedCheck(action: string): GamePatch["pendingCheck"] | undefined {
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
      storyFlagsAdd: ["support:shuang-er:travel"],
      systemNote: "双儿替你把路上的零碎先整理好了，你终于能稳稳喘口气。"
    };
  }

  return undefined;
}

export function isResolvedDice(text: string) {
  return text.includes("【判定】") || text.includes("【伤害】");
}
