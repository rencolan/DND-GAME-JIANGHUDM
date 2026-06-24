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
  "观察",
  "搜寻",
  "寻找",
  "查看足迹",
  "查看痕迹",
  "查看地面"
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
  if (includesAny(action, WORLD_PERCEPTION_KEYWORDS)) return "wis";
  if (includesAny(action, WORLD_INTELLECT_KEYWORDS)) return "int";
  if (includesAny(action, ["潜行", "摸近", "闪避", "轻功", "绕后", "翻窗", "抢位", "贴身"])) return "dex";
  if (includesAny(action, ["硬闯", "破门", "掀翻", "擒拿", "压制", "扛物", "撞开"])) return "str";
  if (includesAny(action, ["死撑", "抗毒", "硬扛", "忍伤", "熬住", "长途跋涉", "扛下"])) return "con";
  if (includesAny(action, ["调息", "运气", "疗伤", "感知", "静坐", "周天", "内功运转", "运转内功"])) return "wis";
  if (includesAny(action, ["说服", "交涉", "安抚", "套话", "讲价", "求人", "圆场", "威吓", "求助", "欺瞒"])) return "cha";
  return undefined;
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
  check: GamePatch["pendingCheck"] | undefined
): GamePatch["pendingCheck"] | undefined {
  if (!check || check.kind === "initiative" || check.kind === "combat_attack" || check.kind === "combat_escape") {
    return check;
  }

  const abilityKey = inferWorldCheckAbilityKey(action);
  return abilityKey ? { ...check, abilityKey, kind: check.kind || "world" } : check;
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

function findDamageLine(text: string) {
  return text.split(/\r?\n/).reverse().find((line) =>
    line.includes("【伤害】") || line.includes("銆愬激瀹")
  );
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

export function buildSuggestedCheck(action: string): GamePatch["pendingCheck"] | undefined {
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
