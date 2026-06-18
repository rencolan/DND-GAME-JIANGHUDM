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

export function calculateMaxQi(baseQi: number, wis: number) {
  return Math.max(1, baseQi + abilityModifier(wis));
}

export function calculateMartialDamageBonus(abilities: Ability[] | undefined, art: MartialArt) {
  const baseBonus = art.damageBonus || 0;
  const abilityBonus = art.category === "external"
    ? Math.max(0, abilityModifierFromList(abilities, "str"))
    : Math.max(0, abilityModifierFromList(abilities, "wis"));
  return baseBonus + abilityBonus;
}

export function recalculateCharacterDerivedStats(character: Character, baseQi: number) {
  const con = abilityValue(character.abilities, "con");
  const dex = abilityValue(character.abilities, "dex");
  const wis = abilityValue(character.abilities, "wis");
  const maxHp = calculateHpFromCon(con);
  const hpMissing = Math.max(0, (character.maxHp || maxHp) - character.hp);
  const maxQi = calculateMaxQi(baseQi, wis);
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
