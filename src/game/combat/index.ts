import { enemyPresets } from "../../data";
import {
  abilityModifier,
  abilityValue,
  calculateInnerInjuryPressure,
  calculateMartialDamageBonus,
  injuryTickDamage,
  resolveInnerInjuryDelta
} from "../rules";
import type { GamePatch, GameState, MartialArt, PendingCheck, RollMode, ThreatTier } from "../../types";

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

function chooseEnemyArt(state: GameState) {
  const usableArts = availableEnemyArts(state);
  if (usableArts.length > 0) {
    return usableArts[Math.floor(Math.random() * usableArts.length)];
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
  return `先稳住${enemyName}，别让局势继续被对方推着走。`;
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

function rollD20() {
  return Math.ceil(Math.random() * 20);
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

  const rolls = Array.from({ length: count }, () => rollD20Clamped(sides));
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
  const rolls = Array.from({ length: rollCount }, () => rollD20Clamped(sides));
  return {
    rolls,
    total: rolls.reduce((sum, value) => sum + value, 0)
  };
}

function rollD20Clamped(sides: number) {
  return Math.ceil(Math.random() * Math.max(1, sides));
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
    reason: `${foe}已经逼到眼前，谁先起手，谁就先掌住这一轮的节奏。`,
    risk: "若失去先手，对方会先动。",
    enemyIntent: `${foe}正盯着你的起手，想抢在你前头压上来。`,
    suggestedAction: "用身法和时机抢下先手。"
  };
}

export function buildPlayerAttackCheck(state: GameState): GamePatch["pendingCheck"] | undefined {
  if (!state.combat.active) return undefined;

  const enemyName = state.combat.enemy || DEFAULT_ENEMY_NAME;
  return {
    kind: "combat_attack",
    label: `攻击 ${enemyName}`,
    dc: state.combat.enemyAc || 12,
    reason: "现在轮到你回手。选定一门武学，先做攻击判定，命中后再结算伤害。",
    risk: "若失手，对方会立刻把节奏抢回去。",
    enemyIntent: `${enemyName}正在等你失手，好顺势反压。`,
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
    reason: proposedCheck?.reason || `${enemyName}正抢着节奏压你，若要脱身，得先用${label}把身形拆出来。`,
    risk: "若失败，这回合你会直接让给对方。",
    enemyIntent: `${enemyName}正想把压力继续追在你身上，不会轻易让你抽身。`,
    suggestedAction: `请掷 ${modeText}，再加${label}，看能不能先把身位拉开。`
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
  if (art?.category === "internal") {
    return isCritical ? "internal_crit" : "internal_hit";
  }
  if (isCritical) return "external_crit";
  return undefined;
}

function resolveInnerInjuryFromAttack(
  attackerWis: number,
  defenderCon: number,
  trigger: InjuryTrigger | undefined
) {
  if (!trigger) return 0;
  return resolveInnerInjuryDelta(calculateInnerInjuryPressure(attackerWis, defenderCon, trigger));
}

export function resolveEnemyTurn(state: GameState, advanceRound = true): EnemyTurnResult {
  const enemyName = state.combat.enemy || DEFAULT_ENEMY_NAME;
  const enemyHpBefore = state.combat.enemyHp || 0;
  const enemyInnerInjuryBefore = state.combat.enemyInnerInjury || 0;
  const enemyInnerInjuryTick = injuryTickDamage(enemyInnerInjuryBefore);
  const enemyHpAfterTick = clamp(enemyHpBefore - enemyInnerInjuryTick, 0, state.combat.enemyMaxHp || 1);

  if (enemyHpAfterTick <= 0) {
    return {
      summary: `${enemyName}内伤发作，气脉一散，当场失去再战之力。`,
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
          stakes: `${enemyName}被自身伤势拖垮。`
        },
        combatAction: "exit",
        systemNote: `${enemyName}内伤发作，当场失去再战之力。`
      }
    };
  }

  const enemyArt = chooseEnemyArt(state);
  const actionLabel = enemyArt?.name || "普通一击";
  const attackAbility = enemyArt?.linkedAbility || "dex";
  const enemyAttackMod = findAbilityModifier(state.combat.enemyAbilities, attackAbility);
  const heroAc = state.character.ac || 10;
  const naturalRoll = rollD20();
  const total = naturalRoll + enemyAttackMod;
  const critical = naturalRoll === 20;
  const hit = naturalRoll !== 1 && (critical || total >= heroAc);
  const damageRoll = enemyArt
    ? rollDamageTotal(enemyArt.damageDice, critical)
    : { rolls: [4], total: 4 };
  const damageBonus = enemyArt?.damageBonus || 0;
  const damage = hit ? damageRoll.total + damageBonus : 0;
  const heroHpAfter = clamp(state.character.hp - damage, 0, state.character.maxHp);
  const playerInnerInjuryDelta = hit
    ? resolveInnerInjuryFromAttack(
      abilityValue(state.combat.enemyAbilities, "wis"),
      abilityValue(state.character.abilities, "con"),
      resolveInjuryTrigger(enemyArt, critical)
    )
    : 0;
  const nextCheck = heroHpAfter > 0 ? buildPlayerAttackCheck(state) : undefined;
  const nextPhase = heroHpAfter > 0 ? "awaiting_hit_check" : "ended";
  const summary = hit
    ? `${enemyName}使出${actionLabel}，命中了你，造成 ${damage} 点伤害${critical ? "（暴击）" : ""}。`
    : `${enemyName}使出${actionLabel}，却没能真正打实。`;
  const systemNote = hasBlockedInternalArts(state)
    ? `${enemyName}内力一时接续不上，只能改用不耗气的招式。${summary}`
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
        ? `${enemyName}内力接续不上，眼下更可能改用${nextArt.name}这样的不耗气招式贴上来。`
        : `${enemyName}正要以${nextArt.name}继续往前压。`
      : `${enemyName}正试图重新把先手抢回去。`,
    risk: "若失手，你会受伤或失位。",
    enemyIntent: nextArt
      ? internalBlocked
        ? `${enemyName}想先稳住气息，再用外功把压力续上。`
        : `${enemyName}想靠${nextArt.name}把你逼乱。`
      : `${enemyName}想把压力一直续下去。`,
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
      reason: options.reason || `你已经抢到了起手，眼下正好追击${preset.name}。`,
      risk: options.risk || "若失手，对方会稳住脚跟再反扑。",
      enemyIntent: options.enemyIntent || `${preset.name}想先稳住架子，再把这口气续回来。`,
      suggestedAction: options.suggestedAction || "选一门武学，直接接攻击判定。"
    }
    : buildInitiativeCheck(state, preset.name);

  return {
    combatAction: "enter",
    enemyName: preset.name,
    pendingCheck,
    combatUpdate: {
      phase: options.skipInitiative ? "awaiting_hit_check" : "opening"
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
      phase: "awaiting_damage_roll"
    }
  };
}

export function resolveCombatDamage(state: GameState, damage: CombatDamageResult): GamePatch {
  if (!state.combat.active) return {};

  const enemyName = state.combat.enemy || DEFAULT_ENEMY_NAME;
  const enemyAfter = clamp((state.combat.enemyHp || 0) - damage.total, 0, state.combat.enemyMaxHp || 1);
  const pendingArt = state.character.martialArts.find((art) => art.id === state.pendingDamage?.martialArtId);
  const enemyInnerInjuryDelta = resolveInnerInjuryFromAttack(
    abilityValue(state.character.abilities, "wis"),
    abilityValue(state.combat.enemyAbilities, "con"),
    resolveInjuryTrigger(pendingArt, Boolean(state.pendingDamage?.isCritical))
  );

  return {
    pendingDamage: undefined,
    combatUpdate: {
      enemyHpChange: -damage.total,
      enemyInnerInjuryChange: enemyInnerInjuryDelta,
      enemyStatusAdd: damage.total >= 10 ? ["exposed"] : [],
      phase: enemyAfter > 0 ? "resolving_enemy_response" : "ended",
      stakes: inferCombatStakes(enemyName)
    },
    combatAction: enemyAfter <= 0 ? "exit" : "none"
  };
}

export function resolveCombatInitiative(state: GameState, hit: CombatHitResult): GamePatch {
  if (!state.combat.active) return {};

  const enemyName = state.combat.enemy || DEFAULT_ENEMY_NAME;

  return {
    pendingCheck: hit.success ? buildPlayerAttackCheck(state) : undefined,
    combatUpdate: {
      phase: hit.success ? "awaiting_hit_check" : "resolving_enemy_response",
      stakes: inferCombatStakes(enemyName)
    },
    systemNote: hit.success
      ? `你抢到了 ${enemyName} 的先手。`
      : `${enemyName}抢到了先手，先一步压了上来。`
  };
}

export function resolveCombatHit(state: GameState, hit: CombatHitResult): GamePatch {
  if (!state.combat.active) return {};

  const enemyName = state.combat.enemy || DEFAULT_ENEMY_NAME;

  return {
    pendingDamage: undefined,
    pendingCheck: undefined,
    combatUpdate: {
      phase: "resolving_enemy_response",
      stakes: inferCombatStakes(enemyName)
    },
    systemNote: hit.success
      ? `这一击已经打中 ${enemyName}，下一步该掷伤害。`
      : `你这一击没能打中 ${enemyName}。`
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
        stakes: `你暂时摆脱了 ${enemyName} 的缠斗。`
      },
      combatAction: "exit",
      systemNote: `你找到了空当，暂时摆脱了 ${enemyName} 的缠斗。`
    };
  }

  return {
    pendingCheck: undefined,
    pendingDamage: undefined,
    combatUpdate: {
      phase: "resolving_enemy_response",
      stakes: inferCombatStakes(enemyName)
    },
    systemNote: "你想抽身的这一步没能成，空门立刻就露了出来。"
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
