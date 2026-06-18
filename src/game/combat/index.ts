import { enemyPresets } from "../../data";
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
  return `You need to stabilize ${enemyName} before the situation worsens.`;
}

function abilityModifier(value: number) {
  return Math.floor((value - 10) / 2);
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
    label: `Roll initiative against ${foe}`,
    abilityKey: "dex",
    dc: enemyInitiative,
    reason: `${foe} is within striking distance. Whoever moves first controls the exchange.`,
    risk: "If you lose initiative, the enemy acts first.",
    enemyIntent: `${foe} is reading your opening and looking for first blood.`,
    suggestedAction: "Use dexterity and timing to seize the first turn."
  };
}

export function buildPlayerAttackCheck(state: GameState): GamePatch["pendingCheck"] | undefined {
  if (!state.combat.active) return undefined;

  const enemyName = state.combat.enemy || DEFAULT_ENEMY_NAME;
  return {
    label: `Attack ${enemyName}`,
    dc: state.combat.enemyAc || 12,
    reason: `Your opening is here. Commit to one martial art and make the attack roll.`,
    risk: "On a miss, the enemy immediately takes the turn back.",
    enemyIntent: `${enemyName} is waiting to punish any hesitation.`,
    suggestedAction: "Choose one martial art and go straight for the attack roll."
  };
}

export type EnemyTurnResult = {
  patch: GamePatch;
  summary: string;
  defeated: boolean;
};

export function resolveEnemyTurn(state: GameState, advanceRound = true): EnemyTurnResult {
  const enemyName = state.combat.enemy || DEFAULT_ENEMY_NAME;
  const enemyArtPool = state.combat.enemyMartialArts || [];
  const enemyArt = enemyArtPool[Math.floor(Math.random() * Math.max(1, enemyArtPool.length))] || firstEnemyArt(state);
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
  const summary = hit
    ? `${enemyName} uses ${enemyArt?.name || "a quick strike"} and hits for ${totalDamage}${isCritical ? " (critical)" : ""}.`
    : `${enemyName} uses ${enemyArt?.name || "a quick strike"} but misses.`;

  return {
    summary,
    defeated: heroAfter <= 0,
    patch: {
      hpChange: hit ? -totalDamage : 0,
      pendingCheck: nextCheck,
      combatUpdate: {
        enemyQiCost: enemyArt?.category === "internal" ? enemyArt.baseQiCost : 0,
        enemyMartialArtUsed: enemyArt?.name,
        phase: heroAfter > 0 ? "awaiting_hit_check" : "ended",
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
  const pendingCheck = options.skipInitiative
    ? {
      label: options.label || `Attack ${preset.name}`,
      dc: options.dc ?? preset.ac,
      reason: options.reason || `You already have the drop on ${preset.name}. Press the attack immediately.`,
      risk: options.risk || "If you miss, the enemy recovers and counterattacks.",
      enemyIntent: options.enemyIntent || `${preset.name} is trying to recover footing before you finish the opening.`,
      suggestedAction: options.suggestedAction || "Choose a martial art and make the attack roll."
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

export function prepareCombatDamageRoll(art: MartialArt, hitText: string, qiBonusSpend: number, isCritical = false): GamePatch {
  return {
    pendingCheck: undefined,
    pendingDamage: {
      martialArtId: art.id,
      label: art.name,
      damageDice: art.damageDice,
      damageBonus: art.damageBonus,
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
      ? `You win initiative against ${enemyName}.`
      : `${enemyName} wins initiative and acts first.`
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
      ? `The attack roll connects on ${enemyName}. Roll damage next.`
      : `Your attack misses ${enemyName}.`
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
