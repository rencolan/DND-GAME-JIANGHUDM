import type { Ability, Character, MartialArt } from "../types";

export const CREATION_STAT_MIN = 6;
export const CREATION_RANDOM_CAP = 12;
export const CREATION_STAT_MAX = 15;
export const CREATION_BASE_TOTAL = 45;
export const CREATION_FREE_POINTS = 15;

export function abilityModifier(value: number) {
  return Math.floor((value - 10) / 2);
}

export function abilityValue(abilities: Ability[] | undefined, abilityKey: string, fallback = 10) {
  return abilities?.find((ability) => ability.key === abilityKey)?.value ?? fallback;
}

export function abilityModifierFromList(abilities: Ability[] | undefined, abilityKey: string, fallback = 10) {
  return abilityModifier(abilityValue(abilities, abilityKey, fallback));
}

export function calculateHpFromCon(con: number) {
  return 20 + (2 * abilityModifier(con));
}

export function calculateAcFromDex(dex: number) {
  return 10 + abilityModifier(dex);
}

export function calculateMaxQi(baseQi: number, wis: number, growthBonus = 0) {
  return Math.max(1, baseQi + abilityModifier(wis) + growthBonus);
}

export function calculateMartialDamageBonus(abilities: Ability[] | undefined, art: MartialArt) {
  const baseBonus = art.damageBonus || 0;
  const abilityBonus = Math.max(0, abilityModifierFromList(abilities, art.linkedAbility || "str"));
  return baseBonus + abilityBonus;
}

export function proficiencyBonus(cultivationRank = 1) {
  if (cultivationRank >= 9) return 6;
  if (cultivationRank >= 7) return 5;
  if (cultivationRank >= 5) return 4;
  if (cultivationRank >= 3) return 3;
  return 2;
}

export function hasMartialTag(art: MartialArt | undefined, tag: NonNullable<MartialArt["tags"]>[number]) {
  return Boolean(art?.tags?.includes(tag));
}

export function martialTagLabels(art: MartialArt | undefined) {
  const labels: Record<string, string> = {
    break: "破防",
    guard: "守势",
    injure: "内伤",
    control: "控场",
    recover: "回气",
    pierce: "穿防"
  };
  return (art?.tags || []).map((tag) => labels[tag] || tag);
}

export function internalStylePracticeThreshold(masteryLevel = 0) {
  return 2 + Math.max(0, masteryLevel);
}

export function internalStyleRiskLevel(art: MartialArt | undefined) {
  if (!art) return 1;
  if (art.source.includes("星宿") || art.name.includes("毒") || art.name.includes("化功")) return 3;
  if (art.grade === "绝学" || art.grade === "高阶" || art.grade === "宗师") return 3;
  if (art.grade === "家传" || art.grade === "上乘前置") return 2;
  return 1;
}

export function qiGrowthForInternalMastery(art: MartialArt | undefined, masteryLevel: number) {
  if (!art) return 1;
  const base = art.grade === "绝学" || art.grade === "高阶" || art.grade === "宗师"
    ? 2
    : 1;
  return masteryLevel > 0 && masteryLevel % 3 === 0 ? base + 1 : base;
}

export type InnerInjuryTriggerKind =
  | "external_crit"
  | "internal_hit"
  | "internal_crit"
  | "training_failure"
  | "internal_study_failure"
  | "cultivation_failure";

export function calculateInnerInjuryPressure(
  attackerWis: number,
  defenderCon: number,
  triggerKind: InnerInjuryTriggerKind
) {
  const base = {
    external_crit: 4,
    internal_hit: 6,
    internal_crit: 10,
    training_failure: 8,
    internal_study_failure: 7,
    cultivation_failure: 9
  }[triggerKind];

  return base + abilityModifier(attackerWis) - abilityModifier(defenderCon);
}

export function resolveInnerInjuryDelta(pressure: number) {
  if (pressure <= 4) return 0;
  if (pressure <= 7) return 6;
  if (pressure <= 10) return 10;
  return 14;
}

export function injuryTickDamage(innerInjury = 0) {
  if (innerInjury >= 80) return 4;
  if (innerInjury >= 60) return 3;
  if (innerInjury >= 40) return 2;
  if (innerInjury >= 20) return 1;
  return 0;
}

export function injuryTierLabel(innerInjury = 0) {
  if (innerInjury >= 80) return "命悬";
  if (innerInjury >= 60) return "伤重";
  if (innerInjury >= 40) return "郁结";
  return "轻伤";
}

export function recalculateCharacterDerivedStats(character: Character, baseQi: number, qiGrowthBonus = 0) {
  const con = abilityValue(character.abilities, "con");
  const dex = abilityValue(character.abilities, "dex");
  const wis = abilityValue(character.abilities, "wis");
  const maxHp = calculateHpFromCon(con);
  const hpMissing = Math.max(0, (character.maxHp || maxHp) - character.hp);
  const maxQi = calculateMaxQi(baseQi, wis, qiGrowthBonus);
  const qiMissing = Math.max(0, (character.maxQi || maxQi) - character.qi);

  return {
    ...character,
    hp: Math.max(0, maxHp - hpMissing),
    maxHp,
    qi: Math.max(0, maxQi - qiMissing),
    maxQi,
    ac: calculateAcFromDex(dex)
  };
}
