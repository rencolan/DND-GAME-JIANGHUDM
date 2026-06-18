import { enemyPresets } from "../../data";
import type { GamePatch, GameState, MartialArt, PendingCheck, Quest } from "../../types";

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

export function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
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

export function parseHitResult(text: string): ParsedHitResult {
  const label = text.match(/【判定】(.+)/)?.[1]?.trim()
    || text.match(/銆愬垽瀹氥€?(.+)/)?.[1]?.trim();
  const naturalRoll = Number(text.match(/d20[：:]\s*(\d+)/)?.[1] || Number.NaN);
  const total = Number(text.match(/总计[：:]\s*(\d+)/)?.[1] || text.match(/鎬昏锛?\s*(\d+)/)?.[1] || Number.NaN);
  const dc = Number(text.match(/DC (\d+)/)?.[1] || Number.NaN);
  const result = text.match(/结果[：:]\s*(成功|失败)/)?.[1]
    || text.match(/缁撴灉锛?\s*(鎴愬姛|澶辫触)/)?.[1];
  const damageTotal = Number(text.match(/= (\d+)\s*$/m)?.[1] || 0);
  const isCritical = naturalRoll === 20 || text.includes("暴击");

  return {
    label,
    total,
    dc,
    success: result ? (result === "成功" || result === "鎴愬姛") : (isCritical || total >= dc),
    damageTotal,
    naturalRoll,
    isCritical
  };
}

export function parseDamageResult(text: string): ParsedDamageResult {
  const label = text.match(/【伤害】(.+?)\s+\d+d\d+/)?.[1]?.trim()
    || text.match(/銆愪激瀹炽€?(.+?)\s+\d+d\d+/)?.[1]?.trim();
  const total = Number(text.match(/= (\d+)\s*$/m)?.[1] || Number.NaN);

  return {
    label,
    total
  };
}

export function parseCombatHitResult(text: string): ParsedHitResult {
  const label = text.match(/【判定】\s*(.+)/)?.[1]?.trim();
  const naturalRoll = Number(text.match(/d20[=:：]\s*(\d+)/)?.[1] || Number.NaN);
  const total = Number(text.match(/总计[：:]\s*(\d+)/)?.[1] || Number.NaN);
  const dc = Number(text.match(/DC (\d+)/)?.[1] || Number.NaN);
  const result = text.match(/结果[：:]\s*(成功|失败)/)?.[1];
  const damageTotal = Number(text.match(/= (\d+)\s*$/m)?.[1] || 0);
  const isCritical = naturalRoll === 20 || text.includes("暴击");
  const success = naturalRoll === 1
    ? false
    : result
      ? result === "成功"
      : (isCritical || total >= dc);

  return {
    label,
    total,
    dc,
    success,
    damageTotal,
    naturalRoll,
    isCritical
  };
}

export function parseCombatDamageResult(text: string): ParsedDamageResult {
  const label = text.match(/【伤害】\s*(.+?)\s+\d+d\d+/)?.[1]?.trim();
  const total = Number(text.match(/= (\d+)\s*$/m)?.[1] || Number.NaN);

  return {
    label,
    total
  };
}

export function buildSuggestedCheck(action: string): GamePatch["pendingCheck"] | undefined {
  if (includesAny(action, ["查看", "调查", "打探", "辨认", "查验"])) {
    return {
      label: "看出线索真假",
      abilityKey: "int",
      dc: 12,
      reason: "眼前线索杂乱，需要先分辨哪条值得继续追下去。",
      risk: "如果失败，你会看漏关键处，或者惊动旁人。"
    };
  }

  if (includesAny(action, ["潜行", "摸近", "闪避", "轻功"])) {
    return {
      label: "不露声色地占位",
      abilityKey: "dex",
      dc: 13,
      reason: "局面很紧，想悄悄抢到有利位置并不轻松。",
      risk: "如果失败，你会先暴露自己。"
    };
  }

  if (includesAny(action, ["说服", "交涉", "安抚", "套话"])) {
    return {
      label: "让对方松口",
      abilityKey: "cha",
      dc: 12,
      reason: "对方心里有防备，不会轻易把话说明白。",
      risk: "如果失败，对方会更警惕。"
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
  if (includesAny(action, ["刀", "砍", "劈", "斩", "硬进", "硬闯", "猛冲", "迎面", "压上", "硬接", "大开大阖"])) return "str";
  if (includesAny(action, ["闪", "绕", "侧身", "滑步", "游走", "抢步", "快刺", "贴身", "轻身", "飘开"])) return "dex";
  if (includesAny(action, ["提气", "运气", "以内力", "内劲", "护体", "调息", "真气"])) return "wis";
  if (includesAny(action, ["拆招", "看破", "料敌", "变招", "算准", "窥破"])) return "int";
  if (includesAny(action, ["硬扛", "死撑", "顶住", "抗下"])) return "con";
  return undefined;
}

function pickMartialArtForAbility(state: GameState, abilityKey?: string) {
  if (!abilityKey) return undefined;
  return state.character.martialArts.find((art) => art.linkedAbility === abilityKey);
}

export function buildCombatActionCheck(
  state: GameState,
  action: string
): { pendingCheck: GamePatch["pendingCheck"]; promptText: string } | undefined {
  if (!state.combat.active || !state.pendingCheck) return undefined;

  if (state.combat.phase === "opening") {
    const label = abilityLabel(state, "dex");
    return {
      pendingCheck: {
        ...state.pendingCheck,
        abilityKey: "dex",
        reason: `${state.combat.enemy || "对手"}已经起势。这一下比的不是花巧，而是谁先抢到先手。`,
        suggestedAction: `请掷 d20 + ${label}，先定这一轮谁先动。`
      },
      promptText: `你这一手说到底是在抢先手，这一步固定用${label}判定。请点开“待先攻”，掷 d20 + ${label}，先看这一轮谁先动。`
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
      label: `攻击 ${enemyName}`,
      abilityKey: inferredAbilityKey,
      martialArtId: inferredArt?.id,
      reason: `你这一手是要正面对${enemyName}递招，眼下先按${label}做攻击判定；若命中，再掷伤害。`,
      suggestedAction: `请掷 d20 + ${label}。`
    },
    promptText: inferredArt
      ? `你这一手可按「${actionLabel}」来算，先用${label}做攻击判定。请点开“待攻击”，按 d20 + ${label} 掷骰；若命中，再掷这招的伤害。`
      : `你这一手更偏${label}路数，眼下先用${label}做攻击判定。请点开“待攻击”，按 d20 + ${label} 掷骰；命中之后，再结算伤害。`
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
