import { enemyPresets } from "../../data";
import {
  abilityModifier,
  abilityValue,
  calculateInnerInjuryPressure,
  calculateMartialDamageBonus,
  hasMartialTag,
  injuryTickDamage,
  resolveInnerInjuryDelta
} from "../rules";
import type { EnemyArchetype, GamePatch, GameState, MartialArt, PendingCheck, RollMode, ThreatTier } from "../../types";

const DEFAULT_ENEMY_NAME = "黑衣刺客";
const ESCAPE_THREAT_MOD: Record<ThreatTier, number> = {
  weak: 1,
  normal: 3,
  elite: 5,
  master: 8
};
const ESCAPE_ADVANTAGE_KEYWORDS = ["翻窗", "掀桌", "借烟尘", "转角", "混入人群", "借势退开"];
const ESCAPE_DISADVANTAGE_KEYWORDS = ["硬闯", "转身就跑", "背身撤退", "正面硬冲"];
const ESCAPE_ABILITY_KEYS = new Set(["str", "dex", "con", "int", "wis", "cha"]);

export type CombatHitResult = {
  label?: string;
  total: number;
  dc: number;
  success: boolean;
  damageTotal: number;
  naturalRoll?: number;
  isCritical?: boolean;
};

export type CombatDamageResult = {
  label?: string;
  total: number;
};

type StartCombatOptions = Partial<PendingCheck> & {
  systemNote?: string;
  skipInitiative?: boolean;
};

type InjuryTrigger = "external_crit" | "internal_hit" | "internal_crit";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function rollD20() {
  return Math.ceil(Math.random() * 20);
}

function rollDie(sides: number) {
  return Math.ceil(Math.random() * Math.max(1, sides));
}

function findEnemyPreset(name: string) {
  const direct = enemyPresets.find((preset) => preset.name === name || preset.id === name);
  if (direct) return direct;

  for (const preset of enemyPresets) {
    if (name.includes(preset.name) || preset.name.includes(name)) return preset;
  }

  return enemyPresets.find((preset) => preset.id === "black-assassin") || enemyPresets[0];
}

function firstEnemyArt(state: GameState) {
  return (state.combat.enemyMartialArts || [])[0];
}

function availableEnemyArts(state: GameState) {
  const enemyQi = state.combat.enemyQi || 0;
  return (state.combat.enemyMartialArts || []).filter((art) =>
    art.category !== "internal" || enemyQi >= (art.baseQiCost || 0)
  );
}

function tagWeightForArchetype(art: MartialArt, archetype?: EnemyArchetype) {
  const tags = art.tags || [];
  const role = art.role;
  switch (archetype) {
    case "brute":
      return (tags.includes("break") ? 4 : 0) + (role === "pressure" || role === "finisher" ? 3 : 0);
    case "assassin":
      return (tags.includes("pierce") ? 4 : 0) + (tags.includes("control") ? 2 : 0) + (role === "starter" ? 2 : 0);
    case "internalist":
      return (art.category === "internal" ? 4 : 0) + (tags.includes("injure") ? 3 : 0) + (tags.includes("recover") ? 2 : 0);
    case "poisoner":
      return (tags.includes("injure") ? 4 : 0) + (tags.includes("control") ? 4 : 0);
    case "defender":
      return (tags.includes("guard") ? 4 : 0) + (tags.includes("pierce") ? 2 : 0);
    case "boss":
      return (role === "finisher" ? 4 : 0) + (art.category === "internal" ? 2 : 0) + tags.length;
    default:
      return tags.length;
  }
}

function adjustedArtWeight(state: GameState, art: MartialArt) {
  const round = state.combat.round || 1;
  const enemyQi = state.combat.enemyQi || 0;
  const enemyMaxQi = state.combat.enemyMaxQi || 1;
  const enemyStatuses = state.combat.enemyStatus || [];
  let weight = 1 + tagWeightForArchetype(art, state.combat.enemyArchetype);

  if (enemyStatuses.includes("controlled") && art.role === "finisher") weight -= 5;
  if (art.role === "finisher" && round % 3 !== 0) weight -= 3;
  if (art.category === "internal" && enemyQi <= Math.ceil(enemyMaxQi * 0.35)) weight -= 3;
  if (enemyStatuses.includes("exposed") && hasMartialTag(art, "guard")) weight += 2;
  if (enemyQi <= 1 && hasMartialTag(art, "recover")) weight += 4;

  return Math.max(1, weight);
}

function chooseWeighted<T>(entries: Array<{ item: T; weight: number }>) {
  const total = entries.reduce((sum, entry) => sum + Math.max(1, entry.weight), 0);
  let cursor = Math.random() * total;
  for (const entry of entries) {
    cursor -= Math.max(1, entry.weight);
    if (cursor <= 0) return entry.item;
  }
  return entries[0]?.item;
}

function chooseEnemyArt(state: GameState) {
  const usableArts = availableEnemyArts(state);
  if (usableArts.length > 0) {
    const enemyStatuses = state.combat.enemyStatus || [];
    const guarded = enemyStatuses.includes("guarded");
    return chooseWeighted(usableArts.map((art) => ({
      item: art,
      weight: adjustedArtWeight(state, art)
        + (guarded && hasMartialTag(art, "control") ? 2 : 0)
    }))) || usableArts[0];
  }

  const fallbackExternal = (state.combat.enemyMartialArts || []).find((art) => art.category === "external");
  return fallbackExternal || firstEnemyArt(state);
}

function hasBlockedInternalArts(state: GameState) {
  const allArts = state.combat.enemyMartialArts || [];
  return allArts.some((art) => art.category === "internal")
    && availableEnemyArts(state).every((art) => art.category !== "internal");
}

export function inferCombatStakes(enemyName: string) {
  return `稳住 ${enemyName} 的节奏，寻找下一次能打实的机会。`;
}

function findAbilityModifier(abilities: GameState["character"]["abilities"] | undefined, abilityKey = "dex") {
  const score = abilities?.find((ability) => ability.key === abilityKey)?.value ?? 10;
  return abilityModifier(score);
}

function abilityLabel(state: GameState, abilityKey = "dex") {
  return state.character.abilities.find((ability) => ability.key === abilityKey)?.label || abilityKey.toUpperCase();
}

function enemyThreatTier(state: GameState): ThreatTier {
  const enemyName = state.combat.enemy || DEFAULT_ENEMY_NAME;
  const preset = findEnemyPreset(enemyName);
  const enemyAc = preset?.ac ?? state.combat.enemyAc ?? 10;
  const enemyMaxHp = preset?.maxHp ?? state.combat.enemyMaxHp ?? 1;

  if (enemyAc <= 10 && enemyMaxHp <= 16) return "weak";
  if (enemyAc <= 12 && enemyMaxHp <= 30) return "normal";
  if (enemyAc <= 14 && enemyMaxHp <= 45) return "elite";
  return "master";
}

function normalizeEscapeAbilityKey(proposed?: string) {
  return proposed && ESCAPE_ABILITY_KEYS.has(proposed) ? proposed : "dex";
}

function resolveEscapeRollMode(state: GameState, action: string): RollMode {
  const lowerHp = state.character.hp <= Math.ceil(state.character.maxHp * 0.25);
  const threatTier = enemyThreatTier(state);
  const enemyStatuses = state.combat.enemyStatus || [];
  const allowAdvantage = enemyStatuses.includes("exposed")
    || ESCAPE_ADVANTAGE_KEYWORDS.some((keyword) => action.includes(keyword));
  const allowDisadvantage = lowerHp
    || ((threatTier === "elite" || threatTier === "master")
      && ESCAPE_DISADVANTAGE_KEYWORDS.some((keyword) => action.includes(keyword)));

  if (allowDisadvantage) return "disadvantage";
  if (allowAdvantage) return "advantage";
  return "normal";
}

function effectiveEnemyAc(state: GameState) {
  const base = state.combat.enemyAc || 12;
  const statuses = state.combat.enemyStatus || [];
  return Math.max(1, base - (statuses.includes("exposed") ? 2 : 0) + (statuses.includes("guarded") ? 1 : 0));
}

function parseDice(damageDice: string) {
  const match = damageDice.trim().toLowerCase().match(/^(\d+)d(\d+)$/);
  if (!match) return { count: 0, sides: 0 };
  return {
    count: Number(match[1]),
    sides: Number(match[2])
  };
}

export function parseDamageDice(damageDice: string) {
  const { count, sides } = parseDice(damageDice);
  if (!count || !sides) return { rolls: [0], total: 0 };

  const rolls = Array.from({ length: count }, () => rollDie(sides));
  return {
    rolls,
    total: rolls.reduce((sum, value) => sum + value, 0)
  };
}

export function doubleDamageDice(damageDice: string) {
  const { count, sides } = parseDice(damageDice);
  if (!count || !sides) return damageDice;
  return `${count * 2}d${sides}`;
}

function rollDamageTotal(damageDice: string, critical = false) {
  const { count, sides } = parseDice(damageDice);
  if (!count || !sides) return { rolls: [0], total: 0 };

  const rollCount = critical ? count * 2 : count;
  const rolls = Array.from({ length: rollCount }, () => rollDie(sides));
  return {
    rolls,
    total: rolls.reduce((sum, value) => sum + value, 0)
  };
}

function buildInitiativeCheck(state: GameState, enemyName?: string): GamePatch["pendingCheck"] {
  const foe = enemyName || state.combat.enemy || DEFAULT_ENEMY_NAME;
  const enemyDexMod = findAbilityModifier(state.combat.enemyAbilities, "dex");
  const enemyInitiative = rollD20() + enemyDexMod;

  return {
    kind: "initiative",
    label: `抢先手：${foe}`,
    abilityKey: "dex",
    dc: enemyInitiative,
    reason: `${foe} 已经逼到眼前，谁先起手，谁就先掌住这一轮节奏。`,
    risk: "若失去先手，对方会先动。",
    enemyIntent: `${foe} 正盯着你的起手，想抢在你前头压上来。`,
    suggestedAction: "用身法和时机抢下先手。"
  };
}

export function buildPlayerAttackCheck(state: GameState): GamePatch["pendingCheck"] | undefined {
  if (!state.combat.active) return undefined;

  const enemyName = state.combat.enemy || DEFAULT_ENEMY_NAME;
  return {
    kind: "combat_attack",
    label: `攻击 ${enemyName}`,
    dc: effectiveEnemyAc(state),
    reason: "现在轮到你回手。选定一门武学，先做命中判定，命中后再结算伤害。",
    risk: "若失手，对方会立刻把节奏抢回去。",
    enemyIntent: state.combat.enemyIntent || `${enemyName} 正在等你露出空门。`,
    suggestedAction: "挑一门顺手的武学，直接接攻击。"
  };
}

export function buildCombatEscapeCheck(
  state: GameState,
  action: string,
  proposedCheck?: Partial<PendingCheck>
): GamePatch["pendingCheck"] | undefined {
  if (!state.combat.active) return undefined;

  const enemyName = state.combat.enemy || DEFAULT_ENEMY_NAME;
  const abilityKey = normalizeEscapeAbilityKey(proposedCheck?.abilityKey);
  const label = abilityLabel(state, abilityKey);
  const threatTier = enemyThreatTier(state);
  const enemyDexMod = Math.max(findAbilityModifier(state.combat.enemyAbilities, "dex"), 0);
  const rollMode = resolveEscapeRollMode(state, action);
  const modeText = rollMode === "advantage"
    ? "2d20 取高"
    : rollMode === "disadvantage"
      ? "2d20 取低"
      : "1d20";

  return {
    kind: "combat_escape",
    label: `脱身 ${enemyName}`,
    abilityKey,
    rollMode,
    dc: 10 + ESCAPE_THREAT_MOD[threatTier] + enemyDexMod,
    reason: proposedCheck?.reason || `${enemyName} 正抢着节奏压你，若要脱身，得先用${label}把身形拆出来。`,
    risk: "若失败，这回合你会直接让给对方。",
    enemyIntent: `${enemyName} 想把压力继续追在你身上，不会轻易让你抽身。`,
    suggestedAction: `掷 ${modeText}，再加 ${label}，看能不能先把身位拉开。`
  };
}

export type EnemyTurnResult = {
  patch: GamePatch;
  summary: string;
  defeated: boolean;
  details: {
    actionLabel: string;
    damageDice: string;
    damageBonus: number;
    naturalRoll: number;
    total: number;
    hit: boolean;
    critical: boolean;
    damage: number;
    heroHpBefore: number;
    heroHpAfter: number;
    enemyHpBefore: number;
    enemyHpAfter: number;
    enemyInnerInjuryBefore?: number;
    enemyInnerInjuryAfter?: number;
    enemyInnerInjuryTickDamage?: number;
    playerInnerInjuryDelta?: number;
    nextPhase: GameState["combat"]["phase"];
  };
};

function resolveInjuryTrigger(art: MartialArt | undefined, isCritical: boolean): InjuryTrigger | undefined {
  if (art?.category === "internal") return isCritical ? "internal_crit" : "internal_hit";
  if (isCritical) return "external_crit";
  return undefined;
}

function resolveInnerInjuryFromAttack(
  attackerWis: number,
  defenderCon: number,
  trigger: InjuryTrigger | undefined,
  pressureBonus = 0
) {
  if (!trigger) return 0;
  return resolveInnerInjuryDelta(calculateInnerInjuryPressure(attackerWis, defenderCon, trigger) + pressureBonus);
}

function combatEffectText(art: MartialArt | undefined, actor: "player" | "enemy") {
  const effects: string[] = [];
  if (hasMartialTag(art, "break")) effects.push(actor === "player" ? "敌人露出破绽" : "你的架势被压乱");
  if (hasMartialTag(art, "guard")) effects.push(actor === "player" ? "你保住守势" : "敌人架势更稳");
  if (hasMartialTag(art, "control")) effects.push(actor === "player" ? "敌人下次出手受扰" : "你下次应对受扰");
  if (hasMartialTag(art, "recover")) effects.push(actor === "player" ? "你回 1 点真气" : "敌人回稳内息");
  if (hasMartialTag(art, "injure")) effects.push("内伤压力提高");
  return effects.join("；");
}

function statusFromEnemyArt(art: MartialArt | undefined) {
  const statuses: string[] = [];
  const name = art?.name || "";
  const source = art?.source || "";
  if (name.includes("毒") || name.includes("三笑") || source.includes("星宿")) statuses.push("poisoned");
  if (name.includes("寒") || name.includes("冰蚕") || name.includes("生死符")) statuses.push("cold");
  if (name.includes("化功")) statuses.push("sealed");
  return statuses;
}

export function resolveEnemyTurn(state: GameState, advanceRound = true): EnemyTurnResult {
  const enemyName = state.combat.enemy || DEFAULT_ENEMY_NAME;
  const enemyHpBefore = state.combat.enemyHp || 0;
  const enemyInnerInjuryBefore = state.combat.enemyInnerInjury || 0;
  const enemyInnerInjuryTick = injuryTickDamage(enemyInnerInjuryBefore);
  const enemyHpAfterTick = clamp(enemyHpBefore - enemyInnerInjuryTick, 0, state.combat.enemyMaxHp || 1);

  if (enemyHpAfterTick <= 0) {
    return {
      summary: `【敌方回合】${enemyName} 内伤发作，气脉一散，当场失去再战之力。`,
      defeated: true,
      details: {
        actionLabel: "内伤发作",
        damageDice: "0",
        damageBonus: 0,
        naturalRoll: 0,
        total: 0,
        hit: false,
        critical: false,
        damage: 0,
        heroHpBefore: state.character.hp,
        heroHpAfter: state.character.hp,
        enemyHpBefore,
        enemyHpAfter: enemyHpAfterTick,
        enemyInnerInjuryBefore,
        enemyInnerInjuryAfter: enemyInnerInjuryBefore,
        enemyInnerInjuryTickDamage: enemyInnerInjuryTick,
        playerInnerInjuryDelta: 0,
        nextPhase: "ended"
      },
      patch: {
        pendingCheck: undefined,
        combatUpdate: {
          enemyHpChange: -enemyInnerInjuryTick,
          phase: "ended",
          stakes: `${enemyName} 被内伤拖垮。`,
          lastCombatEvent: `${enemyName} 内伤发作倒下。`
        },
        combatAction: "exit",
        systemNote: `${enemyName} 内伤发作，当场失去再战之力。`
      }
    };
  }

  const enemyArt = chooseEnemyArt(state);
  const actionLabel = enemyArt?.name || "普通一击";
  const attackAbility = enemyArt?.linkedAbility || "dex";
  const enemyAttackMod = findAbilityModifier(state.combat.enemyAbilities, attackAbility);
  const heroAc = state.character.ac || 10;
  const naturalRoll = rollD20();
  const playerStatuses = state.combat.playerStatus || [];
  const guardedPenalty = playerStatuses.includes("guarded") ? 2 : 0;
  const screenedPenalty = playerStatuses.includes("screened") ? 3 : 0;
  const controlledPenalty = (state.combat.enemyStatus || []).includes("controlled") ? 2 : 0;
  const total = naturalRoll + enemyAttackMod - guardedPenalty - screenedPenalty - controlledPenalty;
  const critical = naturalRoll === 20;
  const hit = naturalRoll !== 1 && (critical || total >= heroAc);
  const damageRoll = enemyArt ? rollDamageTotal(enemyArt.damageDice, critical) : { rolls: [4], total: 4 };
  const damageBonus = enemyArt?.damageBonus || 0;
  const guardedDamageReduction = playerStatuses.includes("guarded") ? 2 : 0;
  const screenedDamageReduction = playerStatuses.includes("screened") ? 1 : 0;
  const damage = hit ? Math.max(0, damageRoll.total + damageBonus - guardedDamageReduction - screenedDamageReduction) : 0;
  const heroHpAfter = clamp(state.character.hp - damage, 0, state.character.maxHp);
  const playerInnerInjuryDelta = hit
    ? resolveInnerInjuryFromAttack(
      abilityValue(state.combat.enemyAbilities, "wis"),
      abilityValue(state.character.abilities, "con"),
      resolveInjuryTrigger(enemyArt, critical),
      hasMartialTag(enemyArt, "injure") ? 2 : 0
    )
    : 0;
  const nextCheck = heroHpAfter > 0 ? buildPlayerAttackCheck(state) : undefined;
  const nextPhase = heroHpAfter > 0 ? "awaiting_hit_check" : "ended";
  const effectText = hit ? combatEffectText(enemyArt, "enemy") : "";
  const summary = [
    `【敌方回合】${enemyName} 使用 ${actionLabel}：${hit ? "命中" : "未命中"}。`,
    `命中：d20 ${naturalRoll} + 修正 ${enemyAttackMod}${guardedPenalty ? " - 守势 2" : ""}${screenedPenalty ? " - 掩护 3" : ""}${controlledPenalty ? " - 受扰 2" : ""} = ${total} / AC ${heroAc}`,
    hit ? `伤害：${damageRoll.rolls.join(" + ")}${damageBonus ? ` + ${damageBonus}` : ""}${guardedDamageReduction ? " - 守势 2" : ""}${screenedDamageReduction ? " - 掩护 1" : ""} = ${damage}` : "伤害：0",
    playerInnerInjuryDelta ? `内伤：+${playerInnerInjuryDelta}` : undefined,
    effectText ? `状态：${effectText}` : undefined,
    `你的 HP：${state.character.hp} → ${heroHpAfter}`
  ].filter(Boolean).join("\n");
  const systemNote = hasBlockedInternalArts(state)
    ? `${enemyName} 内力一时接续不上，改用低耗招式。\n${summary}`
    : summary;

  return {
    summary,
    defeated: heroHpAfter <= 0,
    details: {
      actionLabel,
      damageDice: enemyArt?.damageDice || "1d4",
      damageBonus,
      naturalRoll,
      total,
      hit,
      critical,
      damage,
      heroHpBefore: state.character.hp,
      heroHpAfter,
      enemyHpBefore,
      enemyHpAfter: enemyHpAfterTick,
      enemyInnerInjuryBefore,
      enemyInnerInjuryAfter: enemyInnerInjuryBefore,
      enemyInnerInjuryTickDamage: enemyInnerInjuryTick,
      playerInnerInjuryDelta,
      nextPhase
    },
    patch: {
      hpChange: hit ? -damage : 0,
      innerInjuryChange: playerInnerInjuryDelta,
      pendingCheck: nextCheck,
      combatUpdate: {
        enemyHpChange: -enemyInnerInjuryTick,
        enemyQiCost: enemyArt?.category === "internal" ? enemyArt.baseQiCost : 0,
        enemyMartialArtUsed: enemyArt?.name,
        enemyStatusAdd: hit && hasMartialTag(enemyArt, "guard") ? ["guarded"] : [],
        enemyStatusRemove: ["controlled"],
        playerStatusAdd: [
          ...(hit && hasMartialTag(enemyArt, "control") ? ["controlled"] : []),
          ...(hit ? statusFromEnemyArt(enemyArt) : [])
        ],
        playerStatusRemove: ["guarded", "screened"],
        enemyIntent: heroHpAfter > 0 ? findEnemyPreset(enemyName).intent : undefined,
        lastCombatEvent: `${enemyName} ${hit ? "命中" : "未命中"}：${actionLabel}`,
        phase: nextPhase,
        roundDelta: heroHpAfter > 0 && advanceRound ? 1 : 0,
        stakes: inferCombatStakes(enemyName)
      },
      combatAction: heroHpAfter <= 0 ? "exit" : "none",
      systemNote
    }
  };
}

export function getNextEnemyPendingCheck(state: GameState): GamePatch["pendingCheck"] | undefined {
  if (!state.combat.active) return undefined;

  const nextArt = chooseEnemyArt(state);
  const linkedAbility = nextArt?.linkedAbility || "dex";
  const enemyName = state.combat.enemy || DEFAULT_ENEMY_NAME;
  const internalBlocked = hasBlockedInternalArts(state);

  return {
    kind: "combat_attack",
    label: `应对 ${enemyName} 的下一手`,
    abilityKey: linkedAbility,
    martialArtId: nextArt?.id,
    dc: clamp((state.combat.enemyAc || 12) + 2, 11, 18),
    reason: nextArt
      ? internalBlocked
        ? `${enemyName} 内力接续不上，眼下更可能改用 ${nextArt.name} 这类低耗招式。`
        : `${enemyName} 正要以 ${nextArt.name} 继续往前压。`
      : `${enemyName} 正试图重新把先手抢回去。`,
    risk: "若失败，你会受伤或失位。",
    enemyIntent: state.combat.enemyIntent || `${enemyName} 想把压力继续压下去。`,
    suggestedAction: "你可以硬接、闪身、反击，或先拆掉对方的节奏。"
  };
}

export function startCombat(state: GameState, enemyName: string, options: StartCombatOptions = {}): GamePatch {
  const preset = findEnemyPreset(enemyName || DEFAULT_ENEMY_NAME);
  const pendingCheck: GamePatch["pendingCheck"] = options.skipInitiative
    ? {
      kind: "combat_attack",
      label: options.label || `攻击 ${preset.name}`,
      dc: options.dc ?? preset.ac,
      reason: options.reason || `你已经抢到了起手，眼下正好追击 ${preset.name}。`,
      risk: options.risk || "若失手，对方会稳住脚跟再反扑。",
      enemyIntent: options.enemyIntent || preset.intent,
      suggestedAction: options.suggestedAction || "选一门武学，直接接攻击判定。"
    }
    : buildInitiativeCheck(state, preset.name);

  return {
    combatAction: "enter",
    enemyName: preset.name,
    pendingCheck,
    combatUpdate: {
      phase: options.skipInitiative ? "awaiting_hit_check" : "opening",
      enemyIntent: preset.intent,
      lastCombatEvent: `${preset.name} 入战`
    },
    systemNote: options.systemNote
  };
}

export function prepareCombatDamageRoll(
  art: MartialArt,
  hitText: string,
  qiBonusSpend: number,
  isCritical = false,
  actor?: GameState["character"]
): GamePatch {
  const damageBonus = actor ? calculateMartialDamageBonus(actor.abilities, art) : art.damageBonus;

  return {
    pendingCheck: undefined,
    pendingDamage: {
      martialArtId: art.id,
      label: art.name,
      damageDice: art.damageDice,
      damageBonus,
      qiCost: art.category === "internal" ? art.baseQiCost : 0,
      qiBonusSpend,
      hitText,
      isCritical
    },
    qiChange: -qiBonusSpend,
    combatUpdate: {
      phase: "awaiting_damage_roll",
      lastCombatEvent: `${art.name} 已命中，等待伤害`
    }
  };
}

export function resolveCombatDamage(state: GameState, damage: CombatDamageResult): GamePatch {
  if (!state.combat.active) return {};

  const enemyName = state.combat.enemy || DEFAULT_ENEMY_NAME;
  const enemyBefore = state.combat.enemyHp || 0;
  const enemyAfter = clamp(enemyBefore - damage.total, 0, state.combat.enemyMaxHp || 1);
  const pendingArt = state.character.martialArts.find((art) => art.id === state.pendingDamage?.martialArtId);
  const enemyInnerInjuryDelta = resolveInnerInjuryFromAttack(
    abilityValue(state.character.abilities, "wis"),
    abilityValue(state.combat.enemyAbilities, "con"),
    resolveInjuryTrigger(pendingArt, Boolean(state.pendingDamage?.isCritical)),
    hasMartialTag(pendingArt, "injure") ? 2 : 0
  );
  const effectLines = combatEffectText(pendingArt, "player");

  return {
    pendingDamage: undefined,
    qiRecovery: hasMartialTag(pendingArt, "recover") ? 1 : undefined,
    combatUpdate: {
      enemyHpChange: -damage.total,
      enemyInnerInjuryChange: enemyInnerInjuryDelta,
      enemyStatusAdd: [
        ...(hasMartialTag(pendingArt, "break") || damage.total >= 10 ? ["exposed"] : []),
        ...(hasMartialTag(pendingArt, "control") ? ["controlled"] : [])
      ],
      enemyStatusRemove: ["guarded"],
      playerStatusAdd: hasMartialTag(pendingArt, "guard") ? ["guarded"] : [],
      phase: enemyAfter > 0 ? "resolving_enemy_response" : "ended",
      stakes: inferCombatStakes(enemyName),
      lastCombatEvent: `${pendingArt?.name || "攻击"} 造成 ${damage.total} 点伤害${effectLines ? `；${effectLines}` : ""}`
    },
    combatAction: enemyAfter <= 0 ? "exit" : "none",
    systemNote: [
      `【伤害】${pendingArt?.name || damage.label || "攻击"} 对 ${enemyName} 造成 ${damage.total} 点伤害。`,
      `${enemyName} HP：${enemyBefore} → ${enemyAfter}`,
      enemyInnerInjuryDelta ? `内伤：+${enemyInnerInjuryDelta}` : undefined,
      effectLines ? `状态：${effectLines}` : undefined
    ].filter(Boolean).join("\n")
  };
}

export function resolveCombatInitiative(state: GameState, hit: CombatHitResult): GamePatch {
  if (!state.combat.active) return {};

  const enemyName = state.combat.enemy || DEFAULT_ENEMY_NAME;

  return {
    pendingCheck: hit.success ? buildPlayerAttackCheck(state) : undefined,
    combatUpdate: {
      phase: hit.success ? "awaiting_hit_check" : "resolving_enemy_response",
      stakes: inferCombatStakes(enemyName),
      lastCombatEvent: hit.success ? `你抢到 ${enemyName} 的先手` : `${enemyName} 抢到先手`
    },
    systemNote: hit.success
      ? `【先攻】你抢到了 ${enemyName} 的先手。\n检定：${hit.total} / DC ${hit.dc}`
      : `【先攻】${enemyName} 抢到了先手。\n检定：${hit.total} / DC ${hit.dc}`
  };
}

export function resolveCombatHit(state: GameState, hit: CombatHitResult): GamePatch {
  if (!state.combat.active) return {};

  const enemyName = state.combat.enemy || DEFAULT_ENEMY_NAME;

  return {
    pendingDamage: undefined,
    pendingCheck: undefined,
    combatUpdate: {
      enemyStatusRemove: hit.success ? ["exposed"] : [],
      phase: "resolving_enemy_response",
      stakes: inferCombatStakes(enemyName),
      lastCombatEvent: hit.success ? `你命中 ${enemyName}` : `你未命中 ${enemyName}`
    },
    systemNote: hit.success
      ? `【命中】你已经打中 ${enemyName}，下一步结算伤害。\n检定：${hit.total} / DC ${hit.dc}`
      : `【命中】你没能打中 ${enemyName}。\n检定：${hit.total} / DC ${hit.dc}`
  };
}

export function resolveCombatEscape(state: GameState, hit: CombatHitResult): GamePatch {
  if (!state.combat.active) return {};

  const enemyName = state.combat.enemy || DEFAULT_ENEMY_NAME;
  if (hit.success) {
    return {
      pendingCheck: undefined,
      pendingDamage: undefined,
      combatUpdate: {
        phase: "ended",
        stakes: `你暂时摆脱了 ${enemyName} 的缠斗。`,
        lastCombatEvent: `你脱离 ${enemyName}`
      },
      combatAction: "exit",
      systemNote: `【脱身】你找到空当，暂时摆脱了 ${enemyName}。\n检定：${hit.total} / DC ${hit.dc}`
    };
  }

  return {
    pendingCheck: undefined,
    pendingDamage: undefined,
    combatUpdate: {
      phase: "resolving_enemy_response",
      stakes: inferCombatStakes(enemyName),
      lastCombatEvent: `你脱身失败`
    },
    systemNote: `【脱身】你没能彻底摆脱 ${enemyName}，空门露了出来。\n检定：${hit.total} / DC ${hit.dc}`
  };
}

export function cleanupCombatState(): GamePatch {
  return {
    pendingCheck: undefined,
    pendingDamage: undefined,
    combatUpdate: {
      phase: "ended"
    },
    combatAction: "exit"
  };
}
