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
