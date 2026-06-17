import { enemyPresets } from "../../data";
import type { GamePatch, GameState, MartialArt, PendingCheck } from "../../types";

const DEFAULT_ENEMY_NAME = "黑衣刺客";

export type CombatHitResult = {
  label?: string;
  total: number;
  dc: number;
  success: boolean;
  damageTotal: number;
};

export type CombatDamageResult = {
  label?: string;
  total: number;
};

type StartCombatOptions = Partial<PendingCheck> & {
  systemNote?: string;
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
  return `You need to stabilize ${enemyName} before the situation worsens.`;
}

export function getNextEnemyPendingCheck(state: GameState): GamePatch["pendingCheck"] | undefined {
  if (!state.combat.active) return undefined;

  const martialArts = state.combat.enemyMartialArts || [];
  const nextArt = martialArts[Math.floor(Math.random() * Math.max(1, martialArts.length))];
  const linkedAbility = nextArt?.linkedAbility || "dex";
  const enemyName = state.combat.enemy || DEFAULT_ENEMY_NAME;

  return {
    label: `Respond to ${enemyName}'s next move`,
    abilityKey: linkedAbility,
    martialArtId: nextArt?.id,
    dc: clamp((state.combat.enemyAc || 12) + 2, 11, 18),
    reason: nextArt
      ? `${enemyName} is pressing with ${nextArt.name}.`
      : `${enemyName} is trying to seize the initiative again.`,
    risk: "If you fail, you take damage or lose position.",
    enemyIntent: nextArt
      ? `${enemyName} wants to continue pressing with ${nextArt.name}.`
      : `${enemyName} wants to keep the pressure on you.`,
    suggestedAction: "You can brace, evade, counter, or break the rhythm."
  };
}

export function startCombat(state: GameState, enemyName: string, options: StartCombatOptions = {}): GamePatch {
  const preset = findEnemyPreset(enemyName || DEFAULT_ENEMY_NAME);
  const firstArt = preset.martialArts[0];

  return {
    combatAction: "enter",
    enemyName: preset.name,
    pendingCheck: {
      label: options.label || `Respond to ${preset.name}'s opening move`,
      abilityKey: options.abilityKey || firstArt?.linkedAbility || "dex",
      martialArtId: options.martialArtId || firstArt?.id,
      dc: options.dc ?? clamp(preset.ac + 2, 12, 18),
      reason: options.reason || `${preset.name} has already moved first. You need to answer immediately.`,
      risk: options.risk || "If you fail, you take damage and lose tempo.",
      enemyIntent: options.enemyIntent || `${preset.name} wants to overwhelm you before you can settle.`,
      suggestedAction: options.suggestedAction || "Brace, evade, counter, or disrupt the opening attack."
    },
    systemNote: options.systemNote
  };
}

export function prepareCombatDamageRoll(art: MartialArt, hitText: string, qiBonusSpend: number): GamePatch {
  return {
    pendingCheck: undefined,
    pendingDamage: {
      martialArtId: art.id,
      label: art.name,
      damageDice: art.damageDice,
      damageBonus: art.damageBonus,
      qiCost: art.category === "internal" ? art.baseQiCost : 0,
      qiBonusSpend,
      hitText
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
  const nextCheck = enemyAfter > 0 ? getNextEnemyPendingCheck(state) : undefined;

  return {
    pendingDamage: undefined,
    pendingCheck: nextCheck,
    combatUpdate: {
      enemyHpChange: -damage.total,
      enemyStatusAdd: damage.total >= 10 ? ["exposed"] : [],
      enemyMartialArtUsed: damage.label || state.pendingDamage?.label,
      phase: enemyAfter > 0 ? "awaiting_hit_check" : "ended",
      roundDelta: enemyAfter > 0 ? 1 : 0,
      stakes: inferCombatStakes(enemyName)
    },
    combatAction: enemyAfter <= 0 ? "exit" : "none"
  };
}

export function resolveCombatHit(state: GameState, hit: CombatHitResult): GamePatch {
  if (!state.combat.active) return {};

  const enemyName = state.combat.enemy || DEFAULT_ENEMY_NAME;
  const enemyAfter = hit.success
    ? clamp((state.combat.enemyHp || 0) - hit.damageTotal, 0, state.combat.enemyMaxHp || 1)
    : (state.combat.enemyHp || 0);
  const nextCheck = enemyAfter > 0 ? getNextEnemyPendingCheck(state) : undefined;
  const enemyArt = firstEnemyArt(state);
  const enemyDamage = enemyArt
    ? Math.max(2, Math.ceil(parseDiceTotal(enemyArt.damageDice) / 2))
    : 4;

  return {
    pendingDamage: undefined,
    pendingCheck: nextCheck,
    hpChange: hit.success ? 0 : -enemyDamage,
    combatUpdate: {
      enemyHpChange: hit.success ? -hit.damageTotal : 0,
      enemyStatusAdd: hit.success && hit.total - hit.dc >= 5 ? ["exposed"] : [],
      enemyMartialArtUsed: hit.success ? hit.label : undefined,
      phase: nextCheck ? "awaiting_hit_check" : "ended",
      roundDelta: nextCheck ? 1 : 0,
      stakes: inferCombatStakes(enemyName)
    },
    combatAction: hit.success && enemyAfter <= 0 ? "exit" : "none"
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
