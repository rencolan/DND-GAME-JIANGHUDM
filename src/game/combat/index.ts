import { enemyPresets } from "../../data";
import { abilityModifier, calculateMartialDamageBonus } from "../rules";
import type { GamePatch, GameState, MartialArt, PendingCheck } from "../../types";

const DEFAULT_ENEMY_NAME = "黑衣刺客";

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

export function inferCombatStakes(enemyName: string) {
  return `先稳住 ${enemyName}，别让局势继续被对方推着走。`;
}

function findAbilityModifier(abilities: GameState["character"]["abilities"] | undefined, abilityKey = "dex") {
  const score = abilities?.find((ability) => ability.key === abilityKey)?.value ?? 10;
  return abilityModifier(score);
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
    label: `抢先手：${foe}`,
    abilityKey: "dex",
    dc: enemyInitiative,
    reason: `${foe} 已经逼到眼前，谁先起手，谁就先掌握这一轮节奏。`,
    risk: "若失去先手，对方会先动。",
    enemyIntent: `${foe} 正盯着你的起手，想抢在你前头压上来。`,
    suggestedAction: "用身法和时机抢下先手。"
  };
}

export function buildPlayerAttackCheck(state: GameState): GamePatch["pendingCheck"] | undefined {
  if (!state.combat.active) return undefined;

  const enemyName = state.combat.enemy || DEFAULT_ENEMY_NAME;
  return {
    label: `攻击 ${enemyName}`,
    dc: state.combat.enemyAc || 12,
    reason: "现在轮到你回手。选定一门武学，先做攻击判定，命中后再结算伤害。",
    risk: "若失手，对方会立刻把节奏抢回去。",
    enemyIntent: `${enemyName} 正在等你失手，好顺势反压。`,
    suggestedAction: "挑一门顺手的武学，直接掷攻击。"
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
    nextPhase: GamePatch["combatUpdate"] extends infer T
      ? T extends { phase?: infer P }
        ? P
        : never
      : never;
  };
};

export function resolveEnemyTurn(state: GameState, advanceRound = true): EnemyTurnResult {
  const enemyName = state.combat.enemy || DEFAULT_ENEMY_NAME;
  const enemyArtPool = state.combat.enemyMartialArts || [];
  const enemyArt = enemyArtPool[Math.floor(Math.random() * Math.max(1, enemyArtPool.length))] || firstEnemyArt(state);
  const actionLabel = enemyArt?.name || "一记快手";
  const attackAbility = enemyArt?.linkedAbility || "dex";
  const enemyAttackMod = findAbilityModifier(state.combat.enemyAbilities, attackAbility);
  const heroAc = state.character.ac || 10;
  const naturalRoll = rollD20();
  const total = naturalRoll + enemyAttackMod;
  const isCritical = naturalRoll === 20;
  const hit = naturalRoll !== 1 && (isCritical || total >= heroAc);
  const damageRoll = enemyArt
    ? rollDamageTotal(enemyArt.damageDice, isCritical)
    : { rolls: [4], total: 4 };
  const damageBonus = enemyArt?.damageBonus || 0;
  const totalDamage = hit ? damageRoll.total + damageBonus : 0;
  const heroAfter = clamp(state.character.hp - totalDamage, 0, state.character.maxHp);
  const nextCheck = heroAfter > 0 ? buildPlayerAttackCheck(state) : undefined;
  const nextPhase = heroAfter > 0 ? "awaiting_hit_check" : "ended";
  const summary = hit
    ? `${enemyName}使出${actionLabel}，打中了你${totalDamage}点${isCritical ? "（暴击）" : ""}。`
    : `${enemyName}使出${actionLabel}，却没能打实。`;

  return {
    summary,
    defeated: heroAfter <= 0,
    details: {
      actionLabel,
      damageDice: enemyArt?.damageDice || "1d4",
      damageBonus,
      naturalRoll,
      total,
      hit,
      critical: isCritical,
      damage: totalDamage,
      heroHpBefore: state.character.hp,
      heroHpAfter: heroAfter,
      enemyHpBefore: state.combat.enemyHp || 0,
      enemyHpAfter: state.combat.enemyHp || 0,
      nextPhase
    },
    patch: {
      hpChange: hit ? -totalDamage : 0,
      pendingCheck: nextCheck,
      combatUpdate: {
        enemyQiCost: enemyArt?.category === "internal" ? enemyArt.baseQiCost : 0,
        enemyMartialArtUsed: enemyArt?.name,
        phase: nextPhase,
        roundDelta: heroAfter > 0 && advanceRound ? 1 : 0,
        stakes: inferCombatStakes(enemyName)
      },
      combatAction: heroAfter <= 0 ? "exit" : "none",
      systemNote: summary
    }
  };
}

export function getNextEnemyPendingCheck(state: GameState): GamePatch["pendingCheck"] | undefined {
  if (!state.combat.active) return undefined;

  const martialArts = state.combat.enemyMartialArts || [];
  const nextArt = martialArts[Math.floor(Math.random() * Math.max(1, martialArts.length))];
  const linkedAbility = nextArt?.linkedAbility || "dex";
  const enemyName = state.combat.enemy || DEFAULT_ENEMY_NAME;

  return {
    label: `应对 ${enemyName} 的下一手`,
    abilityKey: linkedAbility,
    martialArtId: nextArt?.id,
    dc: clamp((state.combat.enemyAc || 12) + 2, 11, 18),
    reason: nextArt
      ? `${enemyName}正借${nextArt.name}继续往前压。`
      : `${enemyName}正试图重新把先手抢回去。`,
    risk: "若失败，你会受伤或失位。",
    enemyIntent: nextArt
      ? `${enemyName}想借${nextArt.name}把你逼乱。`
      : `${enemyName}想把压力一直续下去。`,
    suggestedAction: "你可以硬接、闪躲、反击，或先拆掉对方的节奏。"
  };
}

export function startCombat(state: GameState, enemyName: string, options: StartCombatOptions = {}): GamePatch {
  const preset = findEnemyPreset(enemyName || DEFAULT_ENEMY_NAME);
  const pendingCheck = options.skipInitiative
    ? {
      label: options.label || `攻击 ${preset.name}`,
      dc: options.dc ?? preset.ac,
      reason: options.reason || `你已经抢到了起手，眼下正好追击 ${preset.name}。`,
      risk: options.risk || "若失手，对方会稳住脚跟再反扑。",
      enemyIntent: options.enemyIntent || `${preset.name}想先稳住架子，再把这口气续回来。`,
      suggestedAction: options.suggestedAction || "选一门武学，直接掷攻击判定。"
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

  return {
    pendingDamage: undefined,
    combatUpdate: {
      enemyHpChange: -damage.total,
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

function parseDiceTotal(damageDice: string) {
  const match = damageDice.trim().toLowerCase().match(/^(\d+)d(\d+)$/);
  if (!match) return 0;

  const count = Number(match[1]);
  const sides = Number(match[2]);
  return count * Math.ceil(sides / 2);
}
